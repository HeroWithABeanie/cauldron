import { describe, it, expect, afterEach, vi } from 'vitest';
import { createListView } from '../src/listview';
import { makeOldList } from './reference/oldListview';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.document; delete g.window; });

// ---------------------------------------------------------------------------------------------------------
// A fake page: nodes with classes, children, dataset, listeners and a simple layout (rows are 40px high, tiles
// 90px in 3 columns), the few selectors the list view uses, and an animate() that records what it is asked.
// ---------------------------------------------------------------------------------------------------------
class World { log: string[] = []; all: N[] = []; n = 0; }
class N {
  children: N[] = [];
  parent: N | null = null;
  classes = new Set<string>();
  dataset: Record<string, string> = new Proxy({} as Record<string, string>, { set(t, k: string, v) { t[k] = String(v); return true; } });
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  listeners: Record<string, ((e: any) => void)[]> = {};
  hidden = false; checked = false; type = ''; tabIndex = 0; isRoot = false; canAnimate = true;
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
  get nextElementSibling(): N | null { const p = this.parent; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  get animate(): any {
    if (!this.canAnimate) return undefined;
    return (kf: unknown, o: unknown) => { this.w.log.push(this.label + '.animate ' + JSON.stringify([kf, o])); return { onfinish: null, cancel() {} }; };
  }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  removeAttribute(k: string) { if (k.startsWith('data-')) delete this.dataset[k.slice(5)]; else delete this.attrs[k]; }
  addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t: string, e: any = {}) { (this.listeners[t] || []).slice().forEach((f) => f({ preventDefault() {}, stopPropagation() {}, target: this, ...e })); }
  add(c: N) { c.parent = this; this.children.push(c); return c; }
  appendChild(c: N) {
    if (c.parent) c.parent.removeChild(c);
    if (c.tag === '#frag') { c.children.slice().forEach((k) => this.add(k)); c.children = []; return c; }
    return this.add(c);
  }
  removeChild(c: N) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; }
  cloneNode(deep: boolean): N {
    const c = new N(this.w, this.tag, this.label + '~');
    c.classes = new Set(this.classes); Object.assign(c.dataset, this.dataset); c.attrs = { ...this.attrs }; c.style = { ...this.style };
    c.hidden = this.hidden; c.checked = this.checked; c.type = this.type; c._text = this._text; c._html = this._html;
    if (deep) this.children.forEach((k) => c.add(k.cloneNode(true)));
    return c;
  }
  descendants(): N[] { return this.children.reduce((a: N[], c) => a.concat([c], c.descendants()), []); }
  private is(sel: string): boolean {
    const m = sel.trim().match(/^([a-z]*)((?:\.[a-z-]+)*)((?:\[[a-z-]+(?:=[a-z]+)?\])*)$/);
    if (!m) throw new Error('fake page: selector not supported: ' + sel);
    if (m[1] && this.tag !== m[1]) return false;
    if (!m[2].split('.').filter(Boolean).every((c) => this.classes.has(c))) return false;
    return (m[3].match(/\[[^\]]+\]/g) || []).every((a) => {
      const [k, v] = a.slice(1, -1).split('=');
      if (k.startsWith('data-')) return this.dataset[k.slice(5)] !== undefined;
      return v === undefined ? (this as any)[k] !== undefined : String((this as any)[k]) === v;
    });
  }
  querySelector(sel: string): N | null { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel: string): N[] {
    if (sel === ':scope > ul') return this.children.filter((c) => c.tag === 'ul');
    return this.descendants().filter((d) => d.is(sel));
  }
  // ---- a simple layout ----
  getBoundingClientRect() {
    const rowH = (li: N) => (li.classes.has('empty') ? 0 : 40 + ((li.dataset.name || '').length % 3) * 0.7);   // slightly different heights: reordering shifts rows by fractions of a pixel
    const ulH = (u: N) => { const lis = u.children.filter((c) => c.tag === 'li'); return u.classes.has('grid') ? Math.ceil(lis.length / 3) * 100 : lis.reduce((a, l) => a + rowH(l), 0) + (u.classes.has('donegrp') ? 2.2 : 0); };
    if (this.isRoot) return { top: 0, left: 0, width: 300, height: this.children.filter((c) => c.tag === 'ul').reduce((a, u) => a + ulH(u), 0) };
    const p = this.parent;
    if (this.tag === 'ul' && p && p.isRoot) {
      let top = 0; for (const s of p.children) { if (s === this) break; if (s.tag === 'ul') top += ulH(s); }
      return { top, left: 0, width: 300, height: ulH(this) };
    }
    if (this.tag === 'li' && p) {
      const up = p.getBoundingClientRect(), lis = p.children.filter((c) => c.tag === 'li'), i = lis.indexOf(this);
      return p.classes.has('grid')
        ? { top: up.top + Math.floor(i / 3) * 100, left: (i % 3) * 100, width: 90, height: 90 }
        : { top: up.top + lis.slice(0, i).reduce((a, l) => a + rowH(l), 0), left: 0, width: 300, height: rowH(this) };
    }
    return { top: 0, left: 0, width: 0, height: 0 };
  }
}

function ser(n: N): string {
  return n.tag + '.' + [...n.classes].sort().join('.') + (n.hidden ? '[h]' : '') + (n.checked ? '[chk]' : '') + (n.type ? '<' + n.type + '>' : '') + JSON.stringify(n.dataset) + JSON.stringify(n.attrs) + JSON.stringify(n.style)
    + (n.textContent ? '"' + n.textContent + '"' : '') + (n.innerHTML ? '{' + n.innerHTML.length + '}' : '') + '#' + Object.keys(n.listeners).sort().map((k) => k + n.listeners[k].length).join(',') + '(' + n.children.map(ser).join(',') + ')';
}

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- scenarios ----
const WORDS = ['Milk', 'Oat milk', 'Whole wheat flour', 'Eggs', 'Caf\u00e9 au lait', 'Tomato', 'Ground beef', 'Brown sugar'];
interface ItemSpec { text: string; brand?: string; qty: number; unit: string; cat?: string; done: boolean; from?: any[]; manual?: boolean; unlinked?: boolean; orig?: any }
interface Spec {
  items: ItemSpec[]; recipes: { id: number; name: string; portions: number }[];
  layout: 'list' | 'grid'; sort: string; sliding: boolean; view: string; reduced: boolean; desk: boolean; canAnimate: boolean; footers: number;
  actions: { kind: 'tick' | 'del' | 'wait' | 'many'; which: number; ms: number }[];
}
function randomSpec(rand: () => number): Spec {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const n = rand() < .1 ? 0 : 1 + Math.floor(rand() * (rand() < .25 ? 12 : 7));
  const items: ItemSpec[] = Array.from({ length: n }, () => {
    const r = rand();
    const from = r < .35 ? undefined : r < .7 ? [{ id: 1, name: 'Stew', rp: pick([4, 6]), sp: pick([1, 2, 4]) }] : r < .85 ? [{ id: 1, name: 'Stew', rp: 4, sp: 2 }, { id: 2, name: 'Soup', rp: 2, sp: 2 }] : [];
    return {
      text: pick(WORDS), brand: rand() < .25 ? 'Arla' : undefined, qty: pick([0, 1, 2, 5]), unit: pick(['g', 'pcs', 'ml']), cat: pick(['', 'Dairy', 'Fruit']),
      done: rand() < .3, from, manual: rand() < .15, unlinked: rand() < .2, orig: rand() < .5 ? { qty: 1, unit: 'g' } : undefined,
    };
  });
  return {
    items, recipes: [{ id: 1, name: 'Stew', portions: 4 }, { id: 2, name: 'Soup', portions: 2 }],
    layout: rand() < .45 ? 'grid' : 'list', sort: pick(['az', 'za', 'cat', 'recipe']), sliding: rand() < .05, view: rand() < .93 ? 'list' : 'recipes',
    reduced: rand() < .1, desk: rand() < .5, canAnimate: rand() < .93, footers: Math.floor(rand() * 3),
    actions: Array.from({ length: Math.floor(rand() * 4) }, () => ({ kind: pick(['tick', 'tick', 'del', 'wait', 'many'] as const), which: Math.floor(rand() * 1000), ms: pick([100, 300, 520, 700, 1500]) })),
  };
}

/** The item objects of a scenario are created once and shared by the old and the new run (keyFor gives an object the same key every time). */
function makeItems(sp: Spec) { return sp.items.map((s, i) => ({ id: 'i' + i, desc: '', ...JSON.parse(JSON.stringify(s)) })); }

function run(impl: 'old' | 'new', sp: Spec, items: any[]) {
  vi.useFakeTimers();
  const w = new World();
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? sp.reduced : q.includes('hover') ? sp.desk : false }) };
  const list = new N(w, 'div', 'LIST'); list.isRoot = true; list.canAnimate = sp.canAnimate;
  const host = new N(w, 'div', 'HOST'); host.add(list);
  for (let i = 0; i < sp.footers; i++) host.add(new N(w, 'div', 'footer' + i));
  g.document = {
    createElement: (t: string) => new N(w, t),
    createDocumentFragment: () => new N(w, '#frag', '<frag>'),
    createTextNode: (t: string) => { const n = new N(w, '#text', '<text>'); n.textContent = t; return n; },
    getElementById: (id: string) => (id === 'list' ? list : null),
  };
  items.forEach((it, i) => { it.done = sp.items[i].done; });
  const state: any = { list, items, recipes: sp.recipes, layoutMode: sp.layout, sortMode: sp.sort, sliding: sp.sliding, currentView: sp.view };
  const idOf = (it: any) => it.id;
  const fn = {
    sortedItems: () => items.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.text.localeCompare(b.text) || a.id.localeCompare(b.id)),
    topLine: (it: any) => (sp.sort === 'az' || sp.sort === 'za' ? null : it.cat || ''),
    save: () => { w.log.push('save'); }, syncClear: () => { w.log.push('syncClear'); }, applyListFilter: (a: boolean) => { w.log.push('applyListFilter ' + a); },
    checkedToast: (it: any) => { w.log.push('checkedToast ' + idOf(it)); }, openDesc: (it: any) => { w.log.push('openDesc ' + idOf(it)); },
    openRelink: (it: any) => { w.log.push('openRelink ' + idOf(it)); }, deleteItem: (it: any, anim?: boolean) => { w.log.push('deleteItem ' + idOf(it) + ' ' + anim); },
  };
  let render: () => void, reorderSoon: (ms: number, its: any) => void;
  if (impl === 'old') { const o = makeOldList(state, fn); render = o.render; reorderSoon = o.reorderSoon; }
  else { const v = createListView({ get list() { return list; }, get items() { return items; }, get recipes() { return sp.recipes; }, get layoutMode() { return sp.layout; }, get sortMode() { return sp.sort; }, get sliding() { return sp.sliding; }, get currentView() { return sp.view; }, ...fn } as any); render = v.render; reorderSoon = v.reorderSoon; }

  const snaps: string[] = [];
  const snap = (label: string) => snaps.push(label + ': ' + ser(list) + ' || ' + host.children.slice(1).map(ser).join('|'));
  render(); snap('render');
  sp.actions.forEach((a, i) => {
    if (a.kind === 'tick') {
      if (sp.layout === 'grid' && items.length) {
        const tiles = list.querySelectorAll('.tile'); const t = tiles[a.which % tiles.length];
        if (t) t.fire('click', { detail: sp.desk ? 1 : 0 });
      } else {
        const boxes = list.querySelectorAll('input[type=checkbox]'); const b = boxes[a.which % boxes.length];
        if (b) { b.checked = !b.checked; b.fire('change'); }
      }
    } else if (a.kind === 'many') {
      // several items change at once (e.g. "check off all"): the first n items move together, for more than 8 the animation is skipped
      const k = a.which % 12; items.slice(0, k).forEach((it, j) => { if (j % 2 === 0) it.done = !it.done; }); reorderSoon(300, items.slice(0, k));
    } else if (a.kind === 'del') {
      const dels = list.querySelectorAll('.tdel'); const d = dels[a.which % dels.length];
      if (d) d.fire('click');
    }
    vi.advanceTimersByTime(a.ms);
    snap('action' + i);
  });
  // a render caused by reorderSoon: also exercise the grouping directly
  reorderSoon(300, items.slice(0, 2)); reorderSoon(200, items[0]);
  // a cheap signature of the transient state (the settle timer, ghost rows, lifted tiles), taken every 10 ms for the first 900 ms
  const sig = () => 'pos=' + (list.style.position || '-') + ' ghosts=' + list.children.filter((c) => c.classes.has('ghostrow')).length + ' kids=' + list.children.length + ' z=' + w.all.filter((n) => n.tag === 'li' && n.style.zIndex).length;
  const steps: string[] = [];
  for (let t = 0; t < 90; t++) { vi.advanceTimersByTime(10); steps.push(t + ':' + sig() + ' log=' + w.log.length); }
  snap('direct-reorder');
  vi.advanceTimersByTime(3000); snap('end');
  snaps.push(steps.join('\n'));
  vi.useRealTimers();
  return { log: w.log, snaps };
}

describe('the Shopping list view (new listview.ts vs the old code from app.js)', () => {
  it('draws and animates exactly like the old code in 1200 random scenarios', () => {
    const rand = rng(8675309);
    const seen = { grid: 0, rows: 0, done: 0, warn: 0, unlinked: 0, animated: 0, ghost: 0, empty: 0, tick: 0, sectionAnim: 0 };
    for (let k = 0; k < 1200; k++) {
      const sp = randomSpec(rand), items = makeItems(sp);
      const a = run('old', sp, items), b = run('new', sp, items);
      expect(b).toEqual(a);
      const s = a.log.join('\n'), all = a.snaps.join('\n');
      if (sp.layout === 'grid' && sp.items.length) seen.grid++; else seen.rows++;
      if (all.includes('donegrp')) seen.done++;
      if (all.includes('warn')) seen.warn++;
      if (all.includes('unlinked')) seen.unlinked++;
      if (/\.animate/.test(s)) seen.animated++;
      if (all.includes('ghostrow')) seen.ghost++;
      if (!sp.items.length) seen.empty++;
      if (/checkedToast/.test(s)) seen.tick++;
      if (/\.animate \[\[\{"height":"0px","opacity":0\}/.test(s)) seen.sectionAnim++;
    }
    // the random scenarios must really have reached each branch, or the comparison would be empty
    for (const [k, v] of Object.entries(seen)) expect([k, v > 15]).toEqual([k, true]);
  }, 60000);   // this one test runs 1200 scenarios twice; vitest's default limit of 5 seconds is too short on slow machines

  // ---- a few readable examples ----
  const base: Spec = {
    items: [{ text: 'Eggs', qty: 6, unit: 'pcs', done: false }, { text: 'Milk', qty: 1, unit: 'l', done: true }],
    recipes: [], layout: 'list', sort: 'az', sliding: false, view: 'list', reduced: false, desk: true, canAnimate: true, footers: 0, actions: [],
  };
  it('list layout: one section for the open items and one for the checked-off ones', () => {
    const r = run('new', base, makeItems(base));
    expect(r.snaps[0]).toContain('donegrp');
    expect(r.log.slice(0, 2)).toEqual(['syncClear', 'applyListFilter false']);
  });
  it('an empty list shows the hint', () => {
    const sp = { ...base, items: [] };
    expect(run('new', sp, []).snaps[0]).toContain('Your list is empty.');
  });
  it('grid layout draws one tile per item', () => {
    const sp: Spec = { ...base, layout: 'grid' };
    const r = run('new', sp, makeItems(sp));
    expect(r.snaps[0].split('tile').length - 1).toBeGreaterThan(1);
    expect(r.snaps[0]).toContain('grid');
  });
  it('ticking an item saves, updates the footer, and redraws after the pause', () => {
    const sp: Spec = { ...base, actions: [{ kind: 'tick', which: 0, ms: 600 }] };
    const r = run('new', sp, makeItems(sp));
    expect(r.log).toContain('save');
    expect(r.log.filter((l) => l === 'syncClear').length).toBeGreaterThan(1);   // once for the tick, again for the redraw
  });
  it('with reduced motion the tick redraws without any animation', () => {
    const sp: Spec = { ...base, reduced: true, actions: [{ kind: 'tick', which: 0, ms: 700 }] };
    expect(run('new', sp, makeItems(sp)).log.some((l) => l.includes('.animate'))).toBe(false);
  });
});
