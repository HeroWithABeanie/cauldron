import { describe, it, expect, afterEach } from 'vitest';
import { createControls } from '../src/controls';
import { lockUI } from '../src/ui';
import { makeOldControls } from './reference/oldControls';
import { rng, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout };
afterEach(() => { delete g.document; delete g.window; Object.assign(g, real); try { g.localStorage.clear(); } catch (e) { /* none */ } });

const IDS = ['layoutBtn', 'layoutBtnRow', 'layoutToggle', 'recipeLayoutBtn', 'menuBtn', 'menu', 'menuSep', 'fabbar', 'wipe', 'clear', 'uncheck', 'searchbtn', 'other'];

/** A virtual clock whose timer ids stay unique across runs (ui.ts remembers the id of its last lock timer). */
let idCounter = 1000;
function clock() {
  let now = 0; const q: { t: number; id: number; fn: () => void }[] = [];
  return {
    setTimeout: (fn: () => void, ms: number) => { const id = ++idCounter; q.push({ t: now + (ms || 0), id, fn }); return id; },
    clear: (i: number) => { const k = q.findIndex((x) => x.id === i); if (k > -1) q.splice(k, 1); },
    advance(ms: number) { const end = now + ms; for (;;) { q.sort((a, b) => a.t - b.t || a.id - b.id); if (!q.length || q[0].t > end) break; const x = q.shift()!; now = x.t; x.fn(); } now = end; },
  };
}

interface Sp { nItems: number; nDone: number; nRecipes: number; view: string; search: boolean; grid: boolean; tile: boolean; menuOpen: boolean; hasSearchBtn: boolean; ops: Op[] }
type Op = { k: string; n: number; b: boolean };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const op = (k: string): Op => ({ k, n: Math.floor(rand() * 4), b: rand() < .5 });
  const flow = (): Op[] => {
    const f = pick(['menu', 'menu', 'outside', 'layoutList', 'layoutRecipes', 'lockFlip', 'press', 'tab', 'searchMenu', 'emptied']);
    if (f === 'menu') return [op('sync'), op('clickMenu'), ...pick<Op[]>([[], [op('clickWipe')], [op('clickClear')], [op('clickUncheck')], [op('docMenu')], [op('docOther')], [op('clickMenu')]])];
    if (f === 'outside') return [op('sync'), op('clickMenu'), op('docOther'), op('docMenu'), op('docInside')];
    if (f === 'layoutList') return [op('clickLB'), op('clickLBR'), op('sync')];
    if (f === 'layoutRecipes') return [op('setView'), op('sync'), op('clickLT'), op('advance'), op('clickRLB'), op('sync')];
    if (f === 'lockFlip') return [op('lock'), op('clickLB'), op('clickLT'), op('clickRLB'), op('clickLBR'), op('advance')];
    if (f === 'press') return [op('clickLT'), { k: 'advance', n: 0, b: true }, { k: 'advance', n: 1, b: false }];
    if (f === 'tab') return [op('setView'), op('sync'), op('setView'), op('sync')];
    if (f === 'searchMenu') return [op('setSearch'), op('clickMenu'), op('setSearch'), op('sync')];
    return [op('setItems'), op('sync'), op('setRecipes'), op('setSearch'), op('sync')];
  };
  const single = () => op(pick(['sync', 'clickMenu', 'clickWipe', 'clickClear', 'clickUncheck', 'docMenu', 'docOther', 'docInside', 'clickLB', 'clickLBR', 'clickLT', 'clickRLB', 'setItems', 'setRecipes', 'setView', 'setSearch', 'lock', 'advance', 'noSearchBtn']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 6); s < n; s++) { if (rand() < .7) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { nItems: pick([0, 1, 2, 3, 4]), nDone: pick([0, 1, 2, 3]), nRecipes: pick([0, 1, 2]), view: pick(['list', 'recipes']), search: rand() < .3, grid: rand() < .5, tile: rand() < .5, menuOpen: rand() < .3, hasSearchBtn: rand() < .85, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], clk = clock();
  const els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  els.menuBtn.attrs['aria-expanded'] = 'false';
  (els.menuBtn as any).closest = () => true; (els.menu as any).closest = () => true; (els.other as any).closest = () => null; (els.fabbar as any).closest = () => null;
  if (sp.menuOpen) els.fabbar.classes.add('menu-open');
  let hasSearchBtn = sp.hasSearchBtn;
  const listeners: Record<string, ((e: any) => void)[]> = {};
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    querySelector: (sel: string) => (sel === '#fabRow .searchbtn' && hasSearchBtn ? els.searchbtn : null),
    addEventListener: (t: string, f: (e: any) => void) => { (listeners[t] = listeners[t] || []).push(f); log.push('document.listen ' + t); },
    documentElement: { classList: { add() { }, remove() { } } },
  };
  g.window = {};
  g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clear;
  g.localStorage.clear();
  const mk = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i, text: 'x' + i, qty: 1, unit: 'pcs', done: i < done }));
  const items: any[] = mk(sp.nItems, sp.nDone), recipes: any[] = Array.from({ length: sp.nRecipes }, (_, i) => ({ id: i, name: 'R' + i, portions: 2, items: [] }));
  const st = { layoutMode: sp.grid ? 'grid' : 'list', recipeLayout: sp.tile ? 'tile' : 'card', searchOpen: sp.search, currentView: sp.view };
  const base = {
    items, recipes, LKEY: 'LK', RLKEY: 'RLK', fabbar: els.fabbar, wipeBtn: els.wipe, clearBtn: els.clear, uncheckBtn: els.uncheck,
    render: () => log.push('render'), renderRecipes: () => log.push('renderRecipes'), closeSearch: (c: boolean) => log.push('closeSearch ' + c),
  };
  let api: any;
  if (impl === 'old') api = makeOldControls({ ...base, ...st });
  else api = createControls({ ...base, get layoutMode() { return st.layoutMode; }, set layoutMode(v) { st.layoutMode = v; }, get recipeLayout() { return st.recipeLayout; }, set recipeLayout(v) { st.recipeLayout = v; },
    get searchOpen() { return st.searchOpen; }, get currentView() { return st.currentView; } } as any);
  const layouts = () => (impl === 'old' ? api.get() : { layoutMode: st.layoutMode, recipeLayout: st.recipeLayout });
  const snap = () => JSON.stringify([layouts(), IDS.map((i) => [els[i].hidden, [...els[i].classes].sort().join(','), els[i].attrs, (els[i] as any).title]), items.length, recipes.length, g.localStorage.getItem('LK'), g.localStorage.getItem('RLK')]);
  const click = (e: El, ev: any = {}) => e.fire('click', ev);
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.n + ' ' + o.b);
    if (impl === 'old') api.set(st);
    try {
      switch (o.k) {
        case 'sync': api.syncClear(); break;
        case 'clickMenu': click(els.menuBtn, { target: els.menuBtn }); (listeners.click || []).forEach((f) => f({ target: els.menuBtn })); break;
        case 'clickWipe': click(els.wipe); break;
        case 'clickClear': click(els.clear); break;
        case 'clickUncheck': click(els.uncheck); break;
        case 'docMenu': (listeners.click || []).forEach((f) => f({ target: o.b ? els.menu : els.menuBtn })); break;
        case 'docOther': (listeners.click || []).forEach((f) => f({ target: o.b ? els.other : els.fabbar })); break;
        case 'docInside': (listeners.click || []).forEach((f) => f({ target: els.other })); break;
        case 'clickLB': click(els.layoutBtn); break;
        case 'clickLBR': click(els.layoutBtnRow); break;
        case 'clickLT': click(els.layoutToggle); break;
        case 'clickRLB': click(els.recipeLayoutBtn); break;
        case 'setItems': { items.length = 0; items.push(...mk(o.n, o.b ? 2 : o.n % 2)); break; }
        case 'setRecipes': { recipes.length = 0; recipes.push(...Array.from({ length: o.n % 3 }, (_, i) => ({ id: i, name: 'R', portions: 1, items: [] }))); break; }
        case 'setView': st.currentView = st.currentView === 'list' ? 'recipes' : 'list'; break;
        case 'setSearch': st.searchOpen = o.b; break;
        case 'lock': lockUI([0, 5, 100, 300][o.n]); break;
        case 'advance': clk.advance([0, 124, 125, 126, 1, 300][o.n + (o.b ? 0 : 2)] ?? 0); break;
        case 'noSearchBtn': hasSearchBtn = o.b; break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  clk.advance(100000);
  const txt = log.join('\n');
  if (count) {
    if (/-- clickLB \d \w+\nrender\n/.test(txt) || /-- clickLBR \d \w+\n(.*\n)*?render\n/.test(txt)) hit('list layout flipped');
    if (/-- clickRLB \d \w+\n(.*\n)*?renderRecipes\n/.test(txt) || /-- clickLT \d \w+\n(.*\n)*?renderRecipes\n/.test(txt)) hit('recipe layout flipped');
    if (/-- lock[\s\S]*?-- (clickLB|clickLT|clickRLB|clickLBR) \d \w+\nlayoutBtn.listen|-- (clickLB|clickLT|clickRLB|clickLBR)/.test(txt) && /-- lock/.test(txt)) hit('flip while locked');
    if (/closeSearch true/.test(txt)) hit('menu closes search');
    if (/closeSearch false/.test(txt)) hit('empty view closes search');
    if (/fabbar\.add menu-open/.test(txt)) hit('menu opened');
    if (/fabbar\.remove menu-open/.test(txt)) hit('menu closed');
    if (/-- docOther[^\n]*\n(?:(?!state)[^\n]*\n)*?fabbar\.remove menu-open/.test(txt)) hit('outside click closes');
    if (/-- docMenu[^\n]*\n(?:state)/.test(txt)) hit('click inside menu ignored');
    if (/-- advance 1 true/.test(txt) && /layoutToggle\.add pressed/.test(txt)) hit('press timer');
    if (/layoutToggle\.remove pressed/.test(txt)) hit('press released');
    if (/menuBtn\.hidden=true/.test(txt)) hit('menu button hidden');
    if (/uncheck\.hidden=false/.test(txt)) hit('uncheck shown');
    if (/clear\.hidden=false/.test(txt)) hit('clear shown');
    if (/searchbtn\.hidden=true/.test(txt)) hit('search button hidden');
    if (/-- noSearchBtn \d false/.test(txt)) hit('no search button');
    if (/layoutToggle\.hidden=false/.test(txt)) hit('recipe toggle shown');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log, items: JSON.parse(JSON.stringify(items)), layouts: layouts() };
}

describe('the layout switches, the menu and syncClear (new controls.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 4000 random sessions (clicks, tabs, search, locks, timers)', () => {
    const rand = rng(31337);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 4000; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['list layout flipped', 'recipe layout flipped', 'flip while locked', 'menu closes search', 'empty view closes search', 'menu opened', 'menu closed', 'outside click closes', 'click inside menu ignored', 'press timer', 'press released', 'menu button hidden', 'uncheck shown', 'clear shown', 'search button hidden', 'no search button', 'recipe toggle shown']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 180000);
});

// ---- the same controls, with the expected behaviour written out (no old code involved) ----
function mini(opts: { n?: number; done?: number; recipes?: number; view?: string; search?: boolean; grid?: boolean; tile?: boolean } = {}) {
  const log: string[] = [], els: Record<string, El> = {}, clk = clock();
  for (const id of IDS) els[id] = new El(log, id);
  (els.menuBtn as any).closest = () => true; (els.menu as any).closest = () => true; (els.other as any).closest = () => null;
  const docL: ((e: any) => void)[] = [];
  g.document = { getElementById: (id: string) => els[id], querySelector: () => els.searchbtn, addEventListener: (_t: string, f: (e: any) => void) => { docL.push(f); }, documentElement: { classList: { add() { }, remove() { } } } };
  g.window = {}; g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clear; g.localStorage.clear();
  const items: any[] = Array.from({ length: opts.n ?? 0 }, (_, i) => ({ id: 'i' + i, text: 'x', qty: 1, unit: 'g', done: i < (opts.done ?? 0) }));
  const recipes: any[] = Array.from({ length: opts.recipes ?? 0 }, (_, i) => ({ id: i, name: 'R', portions: 1, items: [] }));
  const st = { layoutMode: opts.grid ? 'grid' : 'list', recipeLayout: opts.tile ? 'tile' : 'card', searchOpen: !!opts.search, currentView: opts.view ?? 'list' };
  const calls: string[] = [];
  const api = createControls({ items, recipes, LKEY: 'LK', RLKEY: 'RLK', fabbar: els.fabbar, wipeBtn: els.wipe, clearBtn: els.clear, uncheckBtn: els.uncheck,
    render: () => calls.push('render'), renderRecipes: () => calls.push('renderRecipes'), closeSearch: (c) => calls.push('closeSearch ' + c),
    get layoutMode() { return st.layoutMode as any; }, set layoutMode(v) { st.layoutMode = v; }, get recipeLayout() { return st.recipeLayout as any; }, set recipeLayout(v) { st.recipeLayout = v; },
    get searchOpen() { return st.searchOpen; }, get currentView() { return st.currentView; } });
  return { els, api, st, items, recipes, calls, clk, doc: (target: El) => docL.forEach((f) => f({ target })), hidden: () => ['wipe', 'clear', 'uncheck', 'menuBtn', 'menuSep', 'layoutBtnRow', 'layoutToggle', 'recipeLayoutBtn', 'searchbtn'].map((i) => els[i].hidden) };
}

describe('the layout switches, the menu and syncClear, behaviour', () => {
  it('on the Shopping list tab the buttons follow the number of items and of ticked-off items', () => {
    const none = mini({ n: 0, recipes: 2 }); none.api.syncClear();
    expect(none.hidden()).toEqual([true, true, true, true, true, true, true, false, true]);          // wipe clear uncheck menu sep layoutRow toggle recipeBtn searchbtn
    const one = mini({ n: 3, done: 0, recipes: 0 }); one.api.syncClear();
    expect(one.hidden()).toEqual([false, true, true, false, false, false, true, true, false]);
    const done1 = mini({ n: 3, done: 1 }); done1.api.syncClear(); expect([done1.els.clear.hidden, done1.els.uncheck.hidden]).toEqual([false, true]);
    const done2 = mini({ n: 3, done: 2 }); done2.api.syncClear(); expect([done2.els.clear.hidden, done2.els.uncheck.hidden]).toEqual([false, false]);
  });
  it('on the Recipes tab only the recipe layout buttons show, the menu closes, and the search button follows the recipes', () => {
    const m = mini({ n: 3, done: 2, recipes: 1, view: 'recipes' }); m.els.fabbar.classes.add('menu-open'); m.api.syncClear();
    expect(m.hidden()).toEqual([true, true, true, true, true, false, false, false, false]); expect(m.els.fabbar.classes.has('menu-open')).toBe(false); expect(m.els.menuBtn.attrs['aria-expanded']).toBe('false');
    const e = mini({ n: 3, recipes: 0, view: 'recipes', search: true }); e.api.syncClear();
    expect(e.els.searchbtn.hidden).toBe(true); expect(e.els.layoutToggle.hidden).toBe(true); expect(e.els.recipeLayoutBtn.hidden).toBe(true); expect(e.calls).toEqual(['closeSearch false']);
  });
  it('an empty Shopping list hides the search button, closes the menu and an open search (without keeping its text)', () => {
    const m = mini({ n: 0, recipes: 3, search: true }); m.els.fabbar.classes.add('menu-open'); m.api.syncClear();
    expect([m.els.searchbtn.hidden, m.els.fabbar.classes.has('menu-open'), m.calls]).toEqual([true, false, ['closeSearch false']]);
  });
  it('the layout buttons show the current layouts: label, tiles class and aria state', () => {
    const m = mini({ grid: true, tile: true });
    expect([m.els.layoutBtn.classes.has('grid'), m.els.layoutBtnRow.attrs['aria-checked'], m.els.layoutToggle.classes.has('tiles'), m.els.layoutToggle.attrs['aria-checked'], m.els.recipeLayoutBtn.classes.has('grid')]).toEqual([true, 'true', true, 'true', true]);
    expect([(m.els.layoutToggle as any).title, m.els.layoutToggle.attrs['aria-label']]).toEqual(['Switch to list layout', 'Switch to list layout']);
    const l = mini({}); expect([l.els.layoutBtn.classes.has('grid'), l.els.layoutBtn.attrs['aria-checked'], (l.els.layoutToggle as any).title]).toEqual([false, 'false', 'Switch to tile layout']);
  });
  it('either list layout button flips the layout, remembers it and redraws the list; the recipe ones do the same for the recipes', () => {
    const m = mini({ n: 1 });
    m.els.layoutBtn.fire('click'); expect([m.st.layoutMode, m.calls, localStorage.getItem('LK'), m.els.layoutBtnRow.classes.has('grid')]).toEqual(['grid', ['render'], 'grid', true]);
    m.els.layoutBtnRow.fire('click'); expect([m.st.layoutMode, localStorage.getItem('LK'), m.calls.length]).toEqual(['list', 'list', 2]);
    m.calls.length = 0; m.els.recipeLayoutBtn.fire('click'); expect([m.st.recipeLayout, m.calls, localStorage.getItem('RLK')]).toEqual(['tile', ['renderRecipes'], 'tile']);
    m.els.layoutToggle.fire('click'); expect([m.st.recipeLayout, localStorage.getItem('RLK'), m.calls.length, m.els.recipeLayoutBtn.classes.has('grid')]).toEqual(['card', 'card', 2, false]);
  });
  it('the recipe layout switch shows a pressed look for 125 ms', () => {
    const m = mini({}); m.els.layoutToggle.fire('click'); expect(m.els.layoutToggle.classes.has('pressed')).toBe(true);
    m.clk.advance(124); expect(m.els.layoutToggle.classes.has('pressed')).toBe(true); m.clk.advance(1); expect(m.els.layoutToggle.classes.has('pressed')).toBe(false);
  });
  it('nothing flips while the screen is locked', () => {
    const m = mini({}); lockUI(50);
    for (const b of ['layoutBtn', 'layoutBtnRow', 'layoutToggle', 'recipeLayoutBtn']) m.els[b].fire('click');
    expect([m.st.layoutMode, m.st.recipeLayout, m.calls, localStorage.getItem('LK'), localStorage.getItem('RLK')]).toEqual(['list', 'card', [], null, null]);
    m.clk.advance(50); m.els.layoutBtn.fire('click'); expect(m.st.layoutMode).toBe('grid');
  });
  it('the menu button opens and closes the menu; opening it ends an open search', () => {
    const m = mini({ n: 2, search: true });
    m.els.menuBtn.fire('click'); expect([m.els.fabbar.classes.has('menu-open'), m.els.menuBtn.attrs['aria-expanded'], m.calls]).toEqual([true, 'true', ['closeSearch true']]);
    m.calls.length = 0; m.els.menuBtn.fire('click'); expect([m.els.fabbar.classes.has('menu-open'), m.els.menuBtn.attrs['aria-expanded'], m.calls]).toEqual([false, 'false', []]);
    const n = mini({ n: 2 }); n.els.menuBtn.fire('click'); expect(n.calls).toEqual([]);
  });
  it('picking a menu entry closes the menu; a click elsewhere on the page closes it, a click on the menu itself does not', () => {
    for (const b of ['wipe', 'clear', 'uncheck']) { const m = mini({ n: 2 }); m.els.menuBtn.fire('click'); m.els[b].fire('click'); expect([b, m.els.fabbar.classes.has('menu-open')]).toEqual([b, false]); }
    const m = mini({ n: 2 }); m.els.menuBtn.fire('click'); m.doc(m.els.other); expect(m.els.fabbar.classes.has('menu-open')).toBe(false); expect(m.els.menuBtn.attrs['aria-expanded']).toBe('false');
    m.els.fabbar.classes.add('menu-open'); m.doc(m.els.menu); m.doc(m.els.menuBtn); expect(m.els.fabbar.classes.has('menu-open')).toBe(true);
    m.doc(m.els.other); expect(m.els.fabbar.classes.has('menu-open')).toBe(false);
  });
  it('the module only shows and hides: it never changes the lists', () => {
    const m = mini({ n: 3, done: 2, recipes: 2 }); m.api.syncClear(); m.api.closeMenu(); expect([m.items.length, m.recipes.length, m.items.filter((x) => x.done).length]).toEqual([3, 2, 2]);
  });
});
