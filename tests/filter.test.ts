import { describe, it, expect, afterEach } from 'vitest';
import { applyListFilter, applyRecipeFilter, fx } from '../src/filter';
import { makeOldFilter } from './reference/oldFilter';

const g = globalThis as any;
afterEach(() => { delete g.document; });

// ---------------------------------------------------------------------------------------------
// A small fake page: nodes with classes, children, dataset and attributes, the few selectors the
// filters use, and a recorder for the row effects (clearMarks, markText, toggleEl ...).
// ---------------------------------------------------------------------------------------------
class N {
  children: N[] = [];
  parent: N | null = null;
  classes = new Set<string>();
  // like the real DOM, dataset values are always text (the old code stored the number n, the new one String(n))
  dataset: Record<string, string> = new Proxy({} as Record<string, string>, { set(t, k: string, v) { t[k] = String(v); return true; } });
  attrs: Record<string, string> = {};
  hidden = false;
  textContent = '';
  private _html = '';
  constructor(public tag: string, public label: string, cls = '') { cls.split(' ').filter(Boolean).forEach((c) => this.classes.add(c)); }
  get className() { return [...this.classes].join(' '); }
  set className(v: string) { this.classes = new Set(v.split(' ').filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v: string) { this._html = v; if (v === '') { this.children.forEach((c) => { c.parent = null; }); this.children = []; } }
  get classList() {
    const self = this;
    return {
      contains: (c: string) => self.classes.has(c),
      toggle: (c: string, force?: boolean) => { const on = force === undefined ? !self.classes.has(c) : force; if (on) self.classes.add(c); else self.classes.delete(c); return on; },
    };
  }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  add(c: N) { c.parent = this; this.children.push(c); return c; }
  appendChild(c: N) {
    if (c.tag === '#frag') { c.children.slice().forEach((k) => this.add(k)); c.children = []; return c; }
    return this.add(c);
  }
  all(): N[] { return this.children.reduce((a: N[], c) => a.concat([c], c.all()), []); }
  private is(sel: string): boolean {
    return sel.split(',').some((one) => {
      one = one.trim();
      if (one === '.grid>li') return this.tag === 'li' && !!this.parent && this.parent.classes.has('grid');
      const m = one.match(/^([a-z]*)((?:\.[a-z-]+)*)$/)!;
      return (!m[1] || this.tag === m[1]) && m[2].split('.').filter(Boolean).every((c) => this.classes.has(c));
    });
  }
  querySelector(sel: string): N | null { return this.all().find((n) => n.is(sel)) || null; }
  querySelectorAll(sel: string): N[] { return this.all().filter((n) => n.is(sel)); }
}

function ser(n: N): string {
  return n.tag + '.' + [...n.classes].sort().join('.') + (n.hidden ? '[hidden]' : '') + JSON.stringify(n.dataset) + JSON.stringify(n.attrs) + (n.textContent ? '"' + n.textContent + '"' : '') + (n.innerHTML ? '{html}' : '') + '(' + n.children.map(ser).join(',') + ')';
}

type Rec = (name: string, ...a: unknown[]) => void;
function recorders(log: string[]) {
  const lab = (e: any) => (e && e.label) || String(e);
  const rec: Rec = (name, ...a) => { log.push(name + ' ' + a.join(' ')); };
  return {
    clearMarks: (e: any) => rec('clearMarks', lab(e)),
    markText: (e: any, re: RegExp) => rec('markText', lab(e), re.source, re.flags, '|', e.textContent || ''),
    toggleEl: (e: any, show: boolean, animate: boolean) => rec('toggleEl', lab(e), show, animate),
    markLast: (e: any) => rec('markLast', lab(e)),
    setLi: (e: any, show: boolean, animate: boolean) => rec('setLi', lab(e), show, animate),
    fitRTiles: () => rec('fitRTiles'),
  };
}

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const WORDS = ['Milk', 'Oat milk', 'Whole wheat flour', 'Eggs', 'Caf\u00e9 au lait', 'Tomato', 'Ground beef', 'Brown sugar', 'Basil'];
const QUERIES = ['', ' ', 'milk', 'MILK ', 'e', 'wheat flo', 'xyz', 'caf\u00e9', 'beef sug', 'b'];

interface Spec {
  listKind: 'grid' | 'rows'; query: string; view: string; animate: boolean; layout: 'tile' | 'card';
  itemsCount: number; uls: { empty: boolean; done: boolean; shown?: string; names: string[] }[]; gridNames: string[];
  cards: { tile: boolean; rid: string; shown?: string }[]; recipes: { id: number; name: string; items: { qty: number; unit: string; text: string; brand?: string }[] }[];
  queries2: string[];
}
function randomSpec(rand: () => number): Spec {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const names = () => Array.from({ length: Math.floor(rand() * 5) }, () => pick(WORDS));
  const recipes = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, i) => ({
    id: i + 1, name: pick(['Pancakes', 'Milk shake', 'Beef stew', 'Caprese', 'Fl\u00e4dle']),
    items: Array.from({ length: Math.floor(rand() * 4) }, () => ({ qty: 1 + Math.floor(rand() * 5), unit: pick(['g', 'pcs', 'ml', 'tbsp']), text: pick(WORDS), brand: rand() < .3 ? pick(['Arla', 'Alpro']) : undefined })),
  }));
  const tile = rand() < .5;
  return {
    listKind: rand() < .4 ? 'grid' : 'rows', query: pick(QUERIES), view: rand() < .4 ? pick(['list', 'recipes']) : 'list', animate: rand() < .5, layout: tile ? 'tile' : 'card',
    itemsCount: rand() < .15 ? 0 : 3,
    uls: Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ empty: rand() < .15, done: rand() < .3, shown: pick([undefined, '0', '1']), names: names() })),
    gridNames: names(),
    cards: Array.from({ length: Math.floor(rand() * 6) }, () => ({ tile: tile, rid: rand() < .1 ? '999' : String(1 + Math.floor(rand() * recipes.length)), shown: pick([undefined, '0', '1']) })),
    recipes, queries2: [pick(QUERIES), pick(QUERIES)],
  };
}

function build(sp: Spec) {
  const noItems = new N('div', 'noItems'), noRecipes = new N('div', 'noRecipes');
  g.document = {
    getElementById: (id: string) => (id === 'noItems' ? noItems : id === 'noRecipes' ? noRecipes : null),
    createElement: (t: string) => new N(t, '<' + t + '>'),
    createDocumentFragment: () => new N('#frag', '<frag>'),
    createTextNode: (t: string) => { const n = new N('#text', '<text>'); n.textContent = t; return n; },
  };
  const list = new N('div', 'LIST');
  if (sp.listKind === 'grid') {
    const ul = list.add(new N('ul', 'ul-grid', 'grid'));
    sp.gridNames.forEach((nm, i) => { const li = ul.add(new N('li', 'g' + i)); li.dataset.name = nm.toLowerCase(); li.add(new N('div', 'g' + i + '.tname', 'tname')).textContent = nm; });
  } else {
    sp.uls.forEach((u, k) => {
      const ul = list.add(new N('ul', 'ul' + k, u.done ? 'donegrp' : ''));
      if (u.shown !== undefined) ul.dataset.shown = u.shown;
      if (u.empty) { ul.add(new N('li', 'ul' + k + '.empty', 'empty')); return; }
      u.names.forEach((nm, i) => { const li = ul.add(new N('li', 'ul' + k + '.r' + i)); li.dataset.name = nm.toLowerCase(); li.add(new N('span', li.label + '.name', 'name')).textContent = nm; });
    });
  }
  const recipesEl = new N('div', 'RECIPES');
  sp.cards.forEach((c, i) => {
    const card = recipesEl.add(new N('div', 'c' + i, c.tile ? 'rtile' : 'recipe'));
    card.dataset.rid = c.rid; if (c.shown !== undefined) card.dataset.shown = c.shown;
    if (c.tile) card.add(new N('span', 'c' + i + '.rname', 'rname')).textContent = 'tile name';
    else { card.add(new N('span', 'c' + i + '.ctitle', 'ctitle')).textContent = 'title'; const hb = card.add(new N('div', 'c' + i + '.hits', 'hits')); hb.add(new N('div', 'c' + i + '.hrows', 'hrows')); }
  });
  return { list, recipesEl, noItems, noRecipes, all: () => ser(list) + ' || ' + ser(recipesEl) + ' || ' + ser(noItems) + ' || ' + ser(noRecipes) };
}

function run(impl: 'old' | 'new', sp: Spec) {
  const log: string[] = [], snaps: string[] = [];
  const w = build(sp);
  const items = new Array(sp.itemsCount).fill({}), recipes = sp.recipes;
  const state = { list: w.list, recipesEl: w.recipesEl, items, recipes, query: sp.query, currentView: sp.view, recipeLayout: sp.layout };
  const rec = recorders(log);
  const saved = { ...fx };
  let oldF: any = null;
  if (impl === 'old') oldF = makeOldFilter(state, rec);
  else Object.assign(fx, rec);
  try {
    [sp.query, ...sp.queries2].forEach((q, i) => {
      const view = i === 1 ? (sp.view === 'list' ? 'recipes' : 'list') : sp.view;
      const s2 = { ...state, query: q, currentView: view };
      log.push('--- round ' + i + ' q=' + JSON.stringify(q) + ' view=' + view);
      if (impl === 'old') { oldF.set(s2); oldF.applyListFilter(sp.animate); snaps.push(w.all()); oldF.applyRecipeFilter(sp.animate); }
      else { applyListFilter(s2, sp.animate); snaps.push(w.all()); applyRecipeFilter(s2, sp.animate); }
      snaps.push(w.all());
    });
  } finally { Object.assign(fx, saved); }
  return { log, snaps };
}

describe('applyListFilter / applyRecipeFilter (new filter.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 1500 random searches', () => {
    const rand = rng(31337);
    const seen = { grid: 0, rows: 0, emptyUl: 0, donegrp: 0, hidden0: 0, noItemsShown: 0, noRecipesShown: 0, hits: 0, tile: 0, card: 0, fit: 0 };
    for (let k = 0; k < 1500; k++) {
      const sp = randomSpec(rand);
      const a = run('old', sp), b = run('new', sp);
      expect(b).toEqual(a);
      const s = a.log.join('\n');
      if (sp.listKind === 'grid') seen.grid++; else seen.rows++;
      if (/markLast ul\d/.test(s) && sp.uls.some((u) => u.empty)) seen.emptyUl++;
      if (sp.uls.some((u) => u.done) && sp.listKind === 'rows') seen.donegrp++;
      if (/toggleEl ul\d false/.test(s)) seen.hidden0++;
      if (/toggleEl noItems true/.test(s)) seen.noItemsShown++;
      if (/toggleEl noRecipes true/.test(s)) seen.noRecipesShown++;
      if (a.snaps.some((x) => x.includes('hrow'))) seen.hits++;
      if (/fitRTiles/.test(s)) seen.fit++;
      if (sp.cards.some((c) => c.tile)) seen.tile++; else if (sp.cards.length) seen.card++;
    }
    // the random searches must really have reached every branch, or the comparison would be empty
    for (const [k, v] of Object.entries(seen)) expect([k, v > 20]).toEqual([k, true]);
  });

  // ---- a few readable examples of what the filters do ----
  const one: Spec = {
    listKind: 'rows', query: 'milk', view: 'list', animate: true, layout: 'card', itemsCount: 3,
    uls: [{ empty: false, done: false, names: ['Milk', 'Eggs', 'Oat milk'] }], gridNames: [], cards: [], recipes: [], queries2: ['', ''],
  };
  it('list: shows the rows that match and hides the others, with animation', () => {
    const r = run('new', one);
    const first = r.log.slice(0, r.log.indexOf('--- round 1 q="" view=recipes'));
    expect(first.filter((l) => l.startsWith('setLi'))).toEqual(['setLi ul0.r0 true true', 'setLi ul0.r1 false true', 'setLi ul0.r2 true true']);
    expect(first).toContain('markLast ul0');
    expect(first).toContain('toggleEl noItems false true');
  });
  it('list: says "no items" when nothing matches, but not for an empty list', () => {
    expect(run('new', { ...one, query: 'zzz' }).log).toContain('toggleEl noItems true true');
    expect(run('new', { ...one, query: 'zzz', itemsCount: 0 }).log).toContain('toggleEl noItems false true');
  });
  it('list: does nothing but clear the marks when another tab is open', () => {
    const r = run('new', { ...one, view: 'recipes' });
    expect(r.log.slice(1, 6).some((l) => l.startsWith('markText'))).toBe(false);
  });
  it('grid: hides tiles instantly (never animated)', () => {
    const r = run('new', { ...one, listKind: 'grid', gridNames: ['Milk', 'Eggs'], animate: true });
    expect(r.log.filter((l) => l.startsWith('setLi')).length).toBe(0);
    expect(r.log).toContain('toggleEl noItems false false');
    expect(r.snaps[0]).toContain('li.[hidden]');
  });
  it('recipes: a recipe stays visible when one of its ingredients matches, and the matches are listed under its title', () => {
    const sp: Spec = {
      ...one, view: 'recipes', query: 'beef', layout: 'card',
      recipes: [{ id: 1, name: 'Stew', items: [{ qty: 2, unit: 'pcs', text: 'Ground beef' }, { qty: 1, unit: 'g', text: 'Basil' }] }, { id: 2, name: 'Pancakes', items: [] }],
      cards: [{ tile: false, rid: '1' }, { tile: false, rid: '2' }],
    };
    const r = run('new', sp);
    expect(r.snaps[1]).toContain('hrow');
    expect(r.log).toContain('toggleEl c1 false true');    // Pancakes: no match, hidden
    expect(r.log.some((l) => l === 'toggleEl c0 false true')).toBe(false);
  });
});
