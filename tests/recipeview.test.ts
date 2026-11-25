import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRecipeView } from '../src/recipeview';
import { makeOldRecipeView } from './reference/oldRecipeview';
import { closeOpenSwipe } from '../src/swipe';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.document; delete g.window; });

// ---------------------------------------------------------------------------------------------------------
// A fake page: nodes with classes, children, dataset, listeners, a dialog, a fixed layout (rows are 48-49px high, 300px wide)
// and an animate() that records its animations so the test can finish them. Only what the recipe view and the swipe
// gestures it creates really use.
// ---------------------------------------------------------------------------------------------------------
class World { log: string[] = []; all: N[] = []; n = 0; anims: { onfinish: null | (() => void); oncancel: null | (() => void); cancel(): void }[] = []; }
class N {
  children: N[] = [];
  parent: N | null = null;
  classes = new Set<string>();
  dataset: Record<string, string> = new Proxy({} as Record<string, string>, { set(t, k: string, v) { t[k] = String(v); return true; } });
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  listeners: Record<string, ((e: any) => void)[]> = {};
  hidden = false; type = ''; title = ''; id = ''; tabIndex = 0; scrollTop = 0; canAnimate = true; open = false; offsetWidth = 0;
  private _text = ''; private _html = '';
  label: string;
  constructor(public w: World, public tag: string, label?: string) { this.label = label || tag + (w.n++); w.all.push(this); }
  get className() { return [...this.classes].join(' '); }
  set className(v: string) { this.classes = new Set(v.split(' ').filter(Boolean)); }
  get classList() {
    const s = this;
    return {
      add: (c: string) => { s.classes.add(c); }, remove: (c: string) => { s.classes.delete(c); }, contains: (c: string) => s.classes.has(c),
      toggle: (c: string, force?: boolean) => { const on = force === undefined ? !s.classes.has(c) : force; if (on) s.classes.add(c); else s.classes.delete(c); return on; },
    };
  }
  get textContent() { return this._text; }
  set textContent(v: string) { this._text = v; this.children.forEach((c) => { c.parent = null; }); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v: string) {
    this._html = v; this.children.forEach((c) => { c.parent = null; }); this.children = [];
    if (v !== '' && /^<svg/.test(v)) { const s = new N(this.w, 'svg', this.label + '.svg'); s.parent = this; this.children.push(s); }   // the real DOM builds the element tree
  }
  get firstChild() { return this.children[0] || null; }
  get parentNode() { return this.parent; }
  get clientWidth() { return 300; }
  get clientHeight() { return 56; }
  get offsetTop() { const p = this.parent; return p && this.tag === 'li' ? p.children.indexOf(this) * 48 : 0; }
  get offsetHeight() { const p = this.parent; return p && this.tag === 'li' ? 48 + (p.children.indexOf(this) % 2) : 0; }
  get animate(): any {
    if (!this.canAnimate) return undefined;
    return (kf: unknown, o: unknown) => {
      this.w.log.push(this.label + '.animate ' + JSON.stringify([kf, o]));
      const a = { onfinish: null as null | (() => void), oncancel: null as null | (() => void), cancel() {} };
      this.w.anims.push(a); return a;
    };
  }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t: string, e: any = {}) { (this.listeners[t] || []).slice().forEach((f) => f({ preventDefault() {}, stopPropagation() {}, target: this, ...e })); }
  focus(o?: unknown) { this.w.log.push(this.label + '.focus ' + JSON.stringify(o)); }
  blur() {}
  setPointerCapture() {}
  closest(sel: string): N | null { for (let n: N | null = this; n; n = n.parent) if (n.is(sel)) return n; return null; }
  add(c: N) { c.parent = this; this.children.push(c); return c; }
  appendChild(c: N) {
    if (c.parent) c.parent.removeChild(c);
    if (c.tag === '#frag') { c.children.slice().forEach((k) => this.add(k)); c.children = []; return c; }
    return this.add(c);
  }
  removeChild(c: N) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
  splice(i: number, n: number, ...cs: N[]) { return this.children.splice(i, n, ...cs); }
  descendants(): N[] { return this.children.reduce((a: N[], c) => a.concat([c], c.descendants()), []); }
  is(sel: string): boolean {
    const m = sel.trim().match(/^([a-z]*)((?:\.[a-z-]+)*)(?::not\(\.([a-z-]+)\))?$/);
    if (!m) throw new Error('fake page: selector not supported: ' + sel);
    if (m[1] && this.tag !== m[1]) return false;
    if (!m[2].split('.').filter(Boolean).every((c) => this.classes.has(c))) return false;
    return !(m[3] && this.classes.has(m[3]));
  }
  querySelector(sel: string): N | null { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel: string): N[] {
    if (sel === ':scope > ul') return this.children.filter((c) => c.tag === 'ul');
    return this.descendants().filter((d) => d.is(sel));
  }
  getBoundingClientRect() { return { top: 0, left: 0, width: 300, height: this.children.length * 48 }; }
}

function ser(n: N): string {
  return n.tag + '.' + [...n.classes].sort().join('.') + (n.hidden ? '[h]' : '') + (n.type ? '<' + n.type + '>' : '') + (n.title ? '?' + n.title : '') + (n.tabIndex ? '~' + n.tabIndex : '') + (n.scrollTop ? '^' + n.scrollTop : '')
    + JSON.stringify(n.dataset) + JSON.stringify(n.attrs) + JSON.stringify(n.style)
    + (n.textContent ? '"' + n.textContent + '"' : '') + (n.innerHTML ? '{' + n.innerHTML.length + '}' : '') + '#' + Object.keys(n.listeners).sort().map((k) => k + n.listeners[k].length).join(',') + '(' + n.children.map(ser).join(',') + ')';
}

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- scenarios ----
const NAMES = ['Stew', 'Pancakes', 'Caf\u00e9 au lait cake', 'Tomato soup', '\u00c6blegr\u00f8d', 'Mac & cheese', 'A very long recipe name for a small tile', 'Chili'];
const WORDS = ['Milk', 'Oat milk', 'Whole wheat flour', 'Eggs', 'Tomato', 'Ground beef', 'Brown sugar', 'Butter'];
const RSORTS = ['az', 'za', 'pu', 'pd', 'iu', 'id'];
interface IngSpec { text: string; brand?: string; qty: number; unit: string; cat?: string }
interface RecSpec { id: number; name: string; portions: number; items: IngSpec[] }
interface ShopSpec { id: string; text: string; brand?: string; qty: number; unit: string; done: boolean; from?: { id: number; name: string }[]; unlinked?: boolean }
type Act = { kind: 'open' | 'render' | 'delIng' | 'delSwipe' | 'undo' | 'close' | 'addBtn' | 'addSwipe' | 'editIng' | 'drop' | 'rename' | 'swap' | 'wait' | 'fit'; which: number; via: number; ms: number };
interface Spec {
  recipes: RecSpec[]; items: ShopSpec[]; layout: 'card' | 'tile'; rsort: string; query: string; reduced: boolean; desk: boolean; canAnimate: boolean; actions: Act[];
}
function randomSpec(rand: () => number): Spec {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const nr = rand() < .1 ? 0 : 1 + Math.floor(rand() * 5);
  const recipes: RecSpec[] = Array.from({ length: nr }, (_, i) => {
    const ni = rand() < .15 ? 0 : 1 + Math.floor(rand() * (rand() < .3 ? 10 : 4));
    return {
      id: 100 + i, name: pick(NAMES), portions: pick([1, 2, 4, 6]),
      items: Array.from({ length: ni }, () => ({ text: pick(WORDS), brand: rand() < .25 ? 'Arla' : undefined, qty: pick([0, 1, 2, 5]), unit: pick(['g', 'pcs', 'ml']), cat: pick(['', 'Dairy']) })),
    };
  });
  // shopping items: some come from a recipe ingredient (same text, brand and unit), some are unrelated or already unlinked
  const items: ShopSpec[] = [];
  recipes.forEach((r) => r.items.forEach((ing) => {
    if (rand() < .6) items.push({ id: 'i' + items.length, text: ing.text, brand: ing.brand, qty: ing.qty, unit: ing.unit, done: rand() < .2, from: rand() < .8 ? [{ id: r.id, name: r.name }] : [{ id: 999, name: 'Other' }], unlinked: rand() < .15 });
  }));
  for (let i = Math.floor(rand() * 3); i > 0; i--) items.push({ id: 'i' + items.length, text: pick(WORDS), qty: 1, unit: 'pcs', done: false });
  const actions: Act[] = Array.from({ length: 2 + Math.floor(rand() * 9) }, () => ({ kind: pick(['open', 'open', 'open', 'render', 'delIng', 'delIng', 'delSwipe', 'undo', 'close', 'addBtn', 'addSwipe', 'addSwipe', 'editIng', 'drop', 'rename', 'swap', 'wait', 'fit'] as Act['kind'][]), which: Math.floor(rand() * 1000), via: Math.floor(rand() * 4), ms: pick([0, 100, 400, 800]) }));
  // random order alone rarely produces open, remove an ingredient, undo; make sure a good share of the scenarios do
  if (rand() < .3) { const w = Math.floor(rand() * 1000); actions.push({ kind: 'open', which: w, via: 0, ms: 0 }, { kind: rand() < .5 ? 'delIng' : 'delSwipe', which: Math.floor(rand() * 1000), via: 0, ms: pick([0, 400]) }, { kind: 'undo', which: 0, via: 0, ms: pick([0, 400]) }); }
  return { recipes, items, layout: rand() < .5 ? 'tile' : 'card', rsort: pick(RSORTS), query: rand() < .3 ? 'mi' : '', reduced: rand() < .12, desk: rand() < .5, canAnimate: rand() < .8, actions };
}

function run(impl: 'old' | 'new', sp: Spec) {
  vi.useFakeTimers();
  closeOpenSwipe();   // the swipe module remembers the open row; start every run clean
  const w = new World();
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? sp.reduced : q.includes('hover') ? sp.desk : false }) };
  const recipesEl = new N(w, 'div', 'RECIPES'); recipesEl.canAnimate = sp.canAnimate;
  const viewList = new N(w, 'ul', 'VIEWLIST'); viewList.id = 'viewList'; viewList.canAnimate = sp.canAnimate;
  const viewTitle = new N(w, 'h2', 'TITLE'), viewPortions = new N(w, 'p', 'PORTIONS');
  const dlgView: any = new N(w, 'dialog', 'DLG');
  dlgView.showModal = () => { dlgView.open = true; w.log.push('showModal'); };
  dlgView.close = () => { if (!dlgView.open) return; dlgView.open = false; w.log.push('dlg.close'); dlgView.fire('close'); };
  g.document = {
    createElement: (t: string) => { const n = new N(w, t); n.canAnimate = sp.canAnimate; return n; },
    createDocumentFragment: () => new N(w, '#frag', '<frag>'),
    createTextNode: (t: string) => { const n = new N(w, '#text', '<text>'); n.textContent = t; return n; },
    getElementById: (id: string) => (id === 'viewTitle' ? viewTitle : id === 'viewPortions' ? viewPortions : null),
    querySelectorAll: (sel: string) => { if (sel !== '.rtile .rname') throw new Error('fake page: ' + sel); return recipesEl.descendants().filter((d) => d.classes.has('rname') && d.closest('.rtile')); },
  };
  const recipes: any[] = JSON.parse(JSON.stringify(sp.recipes)), items: any[] = JSON.parse(JSON.stringify(sp.items));
  const toasts: (() => void)[] = [];
  const fn = {
    sortedRecipes: () => recipes.slice().sort((a, b) => (sp.rsort === 'za' ? -1 : 1) * a.name.localeCompare(b.name) || a.id - b.id),
    save: () => { w.log.push('save'); }, saveR: () => { w.log.push('saveR'); }, render: () => { w.log.push('render'); },
    applyRecipeFilter: (a: boolean) => { w.log.push('applyRecipeFilter ' + a); }, syncClear: () => { w.log.push('syncClear'); }, dismissSearch: () => { w.log.push('dismissSearch'); },
    enableDrag: (grip: N, li: N, ul: N, r: any) => { w.log.push('enableDrag ' + grip.label + ' ' + li.label + ' ' + ul.label + ' ' + r.id); },
    openShop: (r: any) => { w.log.push('openShop ' + r.id); }, openRecipeEdit: (r: any, it: any) => { w.log.push('openRecipeEdit ' + r.id + ' ' + it.text); },
    showToast: (msg: string, undo: () => void) => { w.log.push('showToast ' + msg); toasts.push(undo); },
  };
  let renderRecipes: () => void, getTarget: () => any, fitView: () => void;
  if (impl === 'old') { const o = makeOldRecipeView({ recipesEl, dlgView, viewList, recipes, items, recipeLayout: sp.layout, rsort: sp.rsort, query: sp.query }, fn); renderRecipes = o.renderRecipes; getTarget = o.getTarget; fitView = o.fitView; }
  else {
    const v = createRecipeView({ recipesEl, dlgView, viewList, get recipes() { return recipes; }, get items() { return items; }, get recipeLayout() { return sp.layout; }, get rsort() { return sp.rsort; }, get query() { return sp.query; }, ...fn } as any);
    renderRecipes = v.renderRecipes; getTarget = v.getTarget; fitView = v.fitView;
  }

  const flush = () => { let guard = 0; while (w.anims.length && guard++ < 200) { const a = w.anims.shift()!; if (a.onfinish) a.onfinish(); } };
  const snaps: string[] = [];
  const snap = (label: string) => snaps.push(label + ': ' + ser(recipesEl) + ' || ' + ser(viewList) + ' || dlg=' + dlgView.open + JSON.stringify(dlgView.attrs) + ' title=' + viewTitle.textContent + ' info=' + viewPortions.textContent
    + ' target=' + (getTarget() ? getTarget().id : '-') + ' || ' + JSON.stringify(recipes) + JSON.stringify(items));
  const cards = () => recipesEl.querySelectorAll(sp.layout === 'tile' ? '.rtile' : '.recipe');
  const rows = () => viewList.children.filter((c) => c.tag === 'li' && !c.classes.has('empty'));
  const swipe = (el: N, dx: number) => {   // a touch swipe: finger down at x=300, moves dx, lifts
    const ev = (extra: object) => ({ pointerType: 'touch', pointerId: 1, clientY: 100, ...extra });
    el.fire('pointerdown', ev({ clientX: 300 })); el.fire('pointermove', ev({ clientX: 300 + dx })); el.fire('pointerup', ev({ clientX: 300 + dx }));
  };

  renderRecipes(); snap('render');
  sp.actions.forEach((a, i) => {
    const cs = cards(), c = cs.length ? cs[a.which % cs.length] : null, rs = rows(), row = rs.length ? rs[a.which % rs.length] : null;
    if (a.kind === 'open' && c) {
      const btn = c.querySelector(sp.layout === 'tile' ? '.topen' : '.cbtn') as N;
      if (a.via === 0) btn.fire('click', { detail: 0 });
      else if (a.via === 1) btn.fire('click', { detail: 1 });                // a mouse click: opens nothing on a computer (the card has hover buttons), but a mouse on a touch screen does
      else if (a.via === 2) c.fire('contextmenu');
      else (sp.layout === 'tile' ? btn : c.querySelector('.cbhits') as N).fire('click', { detail: 0 });
    } else if (a.kind === 'render') renderRecipes();
    else if (a.kind === 'delIng' && row) { const d = row.querySelector('.swdel'); if (d) d.fire('click'); }
    else if (a.kind === 'delSwipe' && row) { const fg = row.querySelector('.swfg'); if (fg) swipe(fg, -250); }
    else if (a.kind === 'undo') { const u = toasts.pop(); if (u) { w.log.push('undo'); u(); } }
    else if (a.kind === 'close') dlgView.close();
    else if (a.kind === 'addBtn' && c) { const b = c.querySelector(sp.layout === 'tile' ? '.tdel' : '.radd'); if (b) { b.fire('click'); if (a.via === 0) b.fire('click'); } }
    else if (a.kind === 'addSwipe' && c) swipe(c, [-30, -80, -150, -250][a.via]);
    else if (a.kind === 'editIng' && row) { const b = row.querySelector('.itembtn'); if (b) b.fire('click'); }
    else if (a.kind === 'drop' && recipes.length) { recipes.splice(a.which % recipes.length, 1); renderRecipes(); }
    else if (a.kind === 'rename' && recipes.length) { recipes[a.which % recipes.length].name += '!'; recipes[a.which % recipes.length].portions += 1; renderRecipes(); }
    else if (a.kind === 'swap' && recipes.length) { const k = a.which % recipes.length; recipes[k] = { ...JSON.parse(JSON.stringify(recipes[k])), name: recipes[k].name + '~' }; renderRecipes(); }   // a newer copy of the same recipe (e.g. after a sync)
    else if (a.kind === 'fit') fitView();
    vi.advanceTimersByTime(a.ms); flush();
    snap('action' + i);
  });
  vi.advanceTimersByTime(3000); flush(); snap('end');
  closeOpenSwipe(); flush();
  vi.useRealTimers();
  return { log: w.log, snaps };
}

describe('the Recipes view (new recipeview.ts vs the old code from app.js)', () => {
  it('draws, opens, edits and animates exactly like the old code in 700 random scenarios', () => {
    const rand = rng(20261125);
    const seen = { card: 0, tile: 0, none: 0, opened: 0, delIng: 0, undo: 0, closedByDrop: 0, openShop: 0, hover: 0, search: 0, maxHeight: 0, animated: 0, edit: 0, unlinked: 0, empty: 0 };
    for (let k = 0; k < 700; k++) {
      const sp = randomSpec(rand);
      const a = run('old', sp), b = run('new', sp);
      expect(b).toEqual(a);
      const s = a.log.join('\n'), all = a.snaps.join('\n');
      if (!sp.recipes.length) seen.none++; else if (sp.layout === 'tile') seen.tile++; else seen.card++;
      if (/showModal/.test(s)) seen.opened++;
      if (/showToast Item removed/.test(s)) seen.delIng++;
      if (a.log.includes('undo')) seen.undo++;
      if (/openShop/.test(s)) seen.openShop++;
      if (/enableDrag/.test(s)) seen.hover++;
      if (sp.query && /opacity":".35"/.test(all)) seen.search++;
      if (/maxHeight":"[0-9]/.test(all)) seen.maxHeight++;
      if (/\.animate/.test(s)) seen.animated++;
      if (/openRecipeEdit/.test(s)) seen.edit++;
      if (/"unlinked":true/.test(all)) seen.unlinked++;
      if (/dlg\.close/.test(s)) seen.closedByDrop++;
      if (/No recipes yet/.test(all)) seen.empty++;
    }
    // the random scenarios must really have reached each branch, or the comparison would be empty
    for (const [k, v] of Object.entries(seen)) expect([k, v > 15]).toEqual([k, true]);
  }, 90000);   // 1400 scenario runs; vitest's default limit of 5 seconds is far too short

  // ---- a few readable examples ----
  const rec = (id: number, name: string, n: number): RecSpec => ({ id, name, portions: 4, items: Array.from({ length: n }, (_, i) => ({ text: 'Thing ' + i, qty: i + 1, unit: 'pcs' })) });
  const base: Spec = { recipes: [rec(1, 'Stew', 2), rec(2, 'Cake', 8)], items: [], layout: 'card', rsort: 'az', query: '', reduced: true, desk: false, canAnimate: false, actions: [] };
  const act = (kind: Act['kind'], which = 0, via = 0, ms = 0): Act => ({ kind, which, via, ms });

  it('card layout: one section per recipe, filter and footer refreshed after drawing', () => {
    const r = run('new', base);
    expect(r.snaps[0].split('section.recipe').length - 1).toBe(2);
    expect(r.log).toEqual(['applyRecipeFilter false', 'syncClear']);
  });
  it('tile layout: the tiles sit in one grid', () => {
    const r = run('new', { ...base, layout: 'tile' });
    expect(r.snaps[0]).toContain('div.rgrid');
    expect(r.snaps[0].split('div.rtile').length - 1).toBe(2);
  });
  it('no recipes: shows the hint and no grid', () => {
    const r = run('new', { ...base, recipes: [], layout: 'tile' });
    expect(r.snaps[0]).toContain('No recipes yet. Add your first recipe below.');
    expect(r.snaps[0]).not.toContain('rgrid');
  });
  it('opening a recipe shows the window with its title and rows; closing forgets it', () => {
    const r = run('new', { ...base, actions: [act('open', 0), act('close')] });   // sorted a-z: Cake first
    expect(r.log).toContain('showModal');
    expect(r.snaps[1]).toContain('title=Cake');
    expect(r.snaps[1]).toContain('target=2');
    expect(r.snaps[1]).toContain('dlg=true');
    expect(r.snaps[2]).toContain('target=-');
  });
  it('more than six ingredients: the list gets a height that shows six rows and half of the seventh', () => {
    const r = run('new', { ...base, actions: [act('open', 0)] });
    expect(r.snaps[1]).toContain('"maxHeight":"' + (6 * 48 + 24 + 3) + 'px"');   // rows are 48px, the seventh (index 6) is 48 high: 6*48 + 24 + 3
  });
  it('a recipe that disappears while its window is open closes the window', () => {
    const r = run('new', { ...base, actions: [act('open', 0), act('drop', 1)] });   // Cake (id 2) is removed from the list
    expect(r.log).toContain('dlg.close');
    expect(r.snaps[2]).toContain('target=-');
  });
  it('a renamed recipe is updated in the open window', () => {
    const r = run('new', { ...base, actions: [act('open', 0), act('rename', 1)] });   // recipes[1] is Cake, the one that is open
    expect(r.snaps[2]).toContain('title=Cake!');
  });
  it('a newer copy of the open recipe (same id, new object) replaces it in the window', () => {
    const r = run('new', { ...base, actions: [act('open', 0), act('swap', 1)] });
    expect(r.snaps[2]).toContain('title=Cake~');
    expect(r.snaps[2]).toContain('target=2');
  });
  it('removing an ingredient unlinks its shopping items, saves, and the undo brings everything back', () => {
    const sp: Spec = { ...base, recipes: [rec(1, 'Stew', 2)], items: [{ id: 'i0', text: 'Thing 0', qty: 1, unit: 'pcs', done: false, from: [{ id: 1, name: 'Stew' }] }], actions: [act('open', 0), act('delIng', 0), act('undo')] };
    const r = run('new', sp);
    expect(r.snaps[2]).toContain('"unlinked":true');
    expect(r.log.filter((l) => l.startsWith('showToast'))).toEqual(['showToast Item removed.']);
    expect(r.log).toContain('dismissSearch');
    expect(r.snaps[3]).not.toContain('"unlinked":true');
    expect(r.snaps[3]).toContain('Thing 0');
  });
  it('the hover button adds the recipe to the shopping list after its short press animation', () => {
    const r = run('new', { ...base, actions: [act('addBtn', 0, 1, 500)] });
    expect(r.log).toContain('openShop 2');
  });
  it('a recipe without ingredients has no add button and cannot be swiped', () => {
    const r = run('new', { ...base, recipes: [rec(1, 'Empty', 0)], actions: [act('addSwipe', 0, 3, 500), act('addBtn', 0, 1, 500)] });
    expect(r.log.some((l) => l.startsWith('openShop'))).toBe(false);
  });
  it('swiping a recipe far enough to the left adds it to the shopping list', () => {
    const r = run('new', { ...base, actions: [act('addSwipe', 0, 3, 500)] });
    expect(r.log).toContain('openShop 2');
  });
});
