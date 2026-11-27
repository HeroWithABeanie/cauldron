import { describe, it, expect, afterEach } from 'vitest';
import * as store from '../src/store';
import { createItemActions } from '../src/itemactions';
import { makeOldItemActions } from './reference/oldItemActions';
import { rng, El } from './helpers/fakepage';

const g = globalThis as any;
afterEach(() => { delete g.document; delete g.window; });

interface Sp { items: any[]; recipes: any[]; li: Record<string, { cb: boolean; tile: boolean } | null>; ops: Op[] }
type Op = { k: string; n: number; b: boolean; m: number };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const nI = pick([0, 1, 2, 3, 4, 6]), items = Array.from({ length: nI }, (_, i) => ({ id: 'i' + i, text: 'x' + i, qty: 1, unit: 'pcs', done: rand() < .45 }));
  const recipes = Array.from({ length: pick([0, 1, 2, 3]) }, (_, i) => ({ id: i, name: 'R' + i, portions: 2, items: [] as any[] }));
  const li: Sp['li'] = {};
  for (const x of items) li['i' + x.id.slice(1)] = rand() < .3 ? null : { cb: rand() < .7, tile: rand() < .5 };
  const op = (k: string): Op => ({ k, n: Math.floor(rand() * 8), b: rand() < .5, m: Math.floor(rand() * 8) });
  const flow = (): Op[] => {
    const f = pick(['delete', 'delete', 'removeChecked', 'removeChecked', 'check', 'check', 'uncheck', 'wipe', 'wipe', 'recipe', 'dropped', 'twoUndo']);
    const undo = (): Op[] => (rand() < .6 ? [op('undo')] : []);
    if (f === 'delete') return [op('deleteItem'), ...undo(), ...(rand() < .4 ? [op('deleteItem'), op('undo')] : [])];
    if (f === 'removeChecked') return [op('removeChecked'), ...undo()];
    if (f === 'check') return [op('setChecked'), op('checkedToast'), op('undo'), ...(rand() < .4 ? [op('setChecked')] : [])];
    if (f === 'uncheck') return [op('setChecked'), op('clickUncheck'), ...undo(), op('clickUncheck')];
    if (f === 'wipe') return [pick([op('clickWipe'), op('doWipe')]), ...undo(), pick([op('clickWipe'), op('doWipe')])];
    if (f === 'recipe') return [op('performDelete'), ...undo(), ...(rand() < .3 ? [op('performDelete'), op('undo'), op('undo')] : [])];
    if (f === 'dropped') return [op('checkedToast'), op('dropItem'), op('undo'), op('addItem'), op('undo')];
    return [op('deleteItem'), op('removeChecked'), op('undo'), op('undo'), op('undo')];
  };
  const single = () => op(pick(['deleteItem', 'removeChecked', 'performDelete', 'checkedToast', 'setChecked', 'clickUncheck', 'clickWipe', 'doWipe', 'undo', 'dropItem', 'addItem', 'foreignItem']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 5); s < n; s++) { if (rand() < .75) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { items, recipes, li, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [];
  const items0 = JSON.parse(JSON.stringify(sp.items));
  store.setList('items', items0); store.setList('recipes', JSON.parse(JSON.stringify(sp.recipes)));
  const items: any[] = store.items, recipes: any[] = store.recipes;
  const els: Record<string, El> = { uncheck: new El(log, 'uncheck'), wipe: new El(log, 'wipe') };
  g.document = { getElementById: (id: string) => els[id] ?? null }; g.window = {};
  const ids = (a: any[]) => a.map((x) => x.id + (x.done ? '*' : '')).join(',');
  // the rows of the list element: one per item key, with or without a checkbox and a tile
  const lis: Record<string, any> = {};
  const mkLi = (id: string, f: { cb: boolean; tile: boolean }) => ({
    classList: { toggle: (c: string, v: boolean) => log.push('li ' + id + ' toggle ' + c + ' ' + v) },
    querySelector: (sel: string) => (sel === 'input[type=checkbox]' ? (f.cb ? { set checked(v: boolean) { log.push('li ' + id + ' checked=' + v); } } : null) : sel === '.tile' ? (f.tile ? { classList: { toggle: (c: string, v: boolean) => log.push('tile ' + id + ' toggle ' + c + ' ' + v) } } : null) : null),
  });
  for (const k of Object.keys(sp.li)) if (sp.li[k]) lis['k' + k.slice(1)] = mkLi(k, sp.li[k]!);
  const list = { querySelector: (sel: string) => { log.push('query ' + sel); const m = /^li\[data-key="(.*)"\]$/.exec(sel); return m ? lis[m[1]] ?? null : null; } };
  const toasts: { msg: string; undo: (() => void) | null }[] = [];
  const env = {
    items, recipes, list, uncheckBtn: els.uncheck, wipeBtn: els.wipe,
    save: () => log.push('save ' + ids(items)), saveR: () => log.push('saveR ' + recipes.map((r) => r.id).join(',')), render: () => log.push('render ' + ids(items)), renderRecipes: () => log.push('renderRecipes ' + recipes.map((r) => r.id).join(',')),
    withAnim: (kind: string, fn: () => void, lock?: boolean) => { log.push('withAnim ' + kind + ' ' + lock); fn(); },
    showToast: (...a: any[]) => { log.push('toast ' + JSON.stringify(a.map((x) => (typeof x === 'function' ? 'fn' : x)))); toasts.push({ msg: a[0], undo: a[1] || null }); },
    syncClear: () => log.push('syncClear'), reorderSoon: (ms: number, its: any[]) => log.push('reorderSoon ' + ms + ' ' + ids(its)), openWipe: () => log.push('openWipe'),
    keyFor: (o: any) => 'k' + String(o.id).slice(1),
  };
  const api: any = impl === 'old' ? makeOldItemActions(env) : createItemActions(env as any);
  const foreign = { id: 'i99', text: 'zz', qty: 1, unit: 'g', done: false }, rForeign = { id: 99, name: 'Zed', portions: 1, items: [] };
  let extra = 0;
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.n + ' ' + o.b + ' ' + o.m);
    try {
      switch (o.k) {
        case 'deleteItem': api.deleteItem(o.m === 7 ? foreign : items[o.n % Math.max(items.length, 1)] ?? foreign, o.b); break;
        case 'removeChecked': api.removeChecked(); break;
        case 'performDelete': api.performDelete(o.m === 7 ? rForeign : recipes[o.n % Math.max(recipes.length, 1)] ?? rForeign); break;
        case 'checkedToast': api.checkedToast(items[o.n % Math.max(items.length, 1)] ?? foreign); break;
        case 'setChecked': { const sub = items.filter((_, i) => ((o.n >> (i % 3)) & 1) === 1 || i === o.m % Math.max(items.length, 1)).slice(0, o.m % 4 + 1); api.setChecked(sub, o.b); break; }
        case 'clickUncheck': els.uncheck.fire('click'); break;
        case 'clickWipe': els.wipe.fire('click'); break;
        case 'doWipe': api.doWipe(); break;
        case 'undo': { const t = toasts[o.b ? toasts.length - 1 : o.n % Math.max(toasts.length, 1)]; if (t && t.undo) t.undo(); break; }
        case 'dropItem': { const i = o.n % Math.max(items.length, 1); if (items.length) items.splice(i, 1); break; }
        case 'addItem': items.push({ id: 'i' + (50 + extra++), text: 'n', qty: 1, unit: 'g', done: o.b }); break;
        case 'foreignItem': items.splice(o.n % (items.length + 1), 0, foreign); break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + ids(items) + ' | ' + recipes.map((r) => r.id).join(','));
  }
  const txt = log.join('\n');
  if (count) {
    if (/withAnim list/.test(txt)) hit('animated delete'); if (/-- deleteItem[^\n]*\n(?:(?!state)[^\n]*\n)*?render/.test(txt)) hit('plain delete');
    if (/Item removed\./.test(txt)) hit('item removed'); if (/Items removed\./.test(txt)) hit('items removed');
    if (/-- removeChecked[^\n]*\nsave \n/.test(txt)) hit('remove with none ticked');
    if (/-- undo[\s\S]*?state/.test(txt) && /-- deleteItem/.test(txt)) hit('undo after delete');
    if (/Item checked off/.test(txt)) hit('checked toast'); if (/-- undo[^\n]*\n(?:(?!state)[^\n]*\n)*?reorderSoon/.test(txt)) hit('undo of a tick');
    if (/Items unchecked/.test(txt)) hit('unchecked'); if (/-- clickUncheck[^\n]*\nstate/.test(txt)) hit('uncheck refused (fewer than 2)');
    if (/List cleared/.test(txt)) hit('wiped'); if (/openWipe/.test(txt)) hit('wipe asked'); if (/-- clickWipe[^\n]*\nstate/.test(txt)) hit('wipe click on empty list');
    if (/-- doWipe[^\n]*\nstate/.test(txt)) hit('doWipe on empty list');
    if (/Recipe deleted/.test(txt)) hit('recipe deleted'); if (/-- performDelete 0 \w+ 7\n/.test(txt) || /-- performDelete \d \w+ 7\n/.test(txt)) hit('recipe not in list');
    if (/li i\d toggle done true/.test(txt)) hit('row ticked'); if (/li i\d checked=/.test(txt)) hit('checkbox set'); if (/tile i\d toggle/.test(txt)) hit('tile ticked');
    if (/query [^\n]*\nsyncClear/.test(txt) || /query[^\n]*\nsave/.test(txt)) hit('row missing or done');
    if (/-- dropItem[\s\S]*?-- undo/.test(txt)) hit('item dropped before undo');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log, items: JSON.parse(JSON.stringify(items)), recipes: JSON.parse(JSON.stringify(recipes)) };
}

describe('the list actions with an Undo banner (new itemactions.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 3000 random sessions (delete, remove ticked, tick, uncheck, clear, recipe delete, every undo)', () => {
    const rand = rng(4242);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 3000; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['animated delete', 'plain delete', 'item removed', 'items removed', 'remove with none ticked', 'undo after delete', 'checked toast', 'undo of a tick', 'unchecked', 'uncheck refused (fewer than 2)', 'wiped', 'wipe asked', 'wipe click on empty list', 'doWipe on empty list', 'recipe deleted', 'recipe not in list', 'row ticked', 'checkbox set', 'tile ticked', 'item dropped before undo']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 120000);
});

// ---- the same actions, with the expected behaviour written out (no old code involved) ----
function mini(itemsIn: any[], recipesIn: any[] = [], rows: Record<string, any> = {}) {
  const log: string[] = [], els: Record<string, El> = { uncheck: new El(log, 'uncheck'), wipe: new El(log, 'wipe') };
  store.setList('items', itemsIn); store.setList('recipes', recipesIn);
  const calls: string[] = [], toasts: { msg: string; undo: any; ms?: number }[] = [];
  const queried: string[] = [];
  const api = createItemActions({
    items: store.items, recipes: store.recipes, list: { querySelector: (s: string) => { queried.push(s); return rows[s] ?? null; } } as any, uncheckBtn: els.uncheck as any, wipeBtn: els.wipe as any,
    save: () => calls.push('save'), saveR: () => calls.push('saveR'), render: () => calls.push('render'), renderRecipes: () => calls.push('renderRecipes'),
    withAnim: (k, fn) => { calls.push('anim ' + k); fn(); }, showToast: (msg, undo, ms) => { toasts.push({ msg, undo, ms }); }, syncClear: () => calls.push('syncClear'),
    reorderSoon: (ms, its) => calls.push('reorder ' + ms + ' ' + its.length), openWipe: () => calls.push('openWipe'), keyFor: (o: any) => o.id,
  });
  return { api, els, calls, toasts, queried, items: store.items as any[], recipes: store.recipes as any[], undo: (i = -1) => { const t = toasts.at(i)!; t.undo(); } };
}
const mk = (id: string, done = false) => ({ id, text: id, qty: 1, unit: 'pcs', done });

describe('the list actions, behaviour', () => {
  it('delete removes the item, saves, redraws (animated on request) and the banner puts it back at its place', () => {
    const [a, b, c] = [mk('a'), mk('b'), mk('c')], m = mini([a, b, c]);
    m.api.deleteItem(b, true); expect([m.items.map((x) => x.id), m.calls, m.toasts[0].msg]).toEqual([['a', 'c'], ['save', 'anim list', 'render'], 'Item removed.']);
    m.calls.length = 0; m.undo(); expect([m.items.map((x) => x.id), m.calls]).toEqual([['a', 'b', 'c'], ['save', 'anim list', 'render']]);
    m.calls.length = 0; m.api.deleteItem(c, false); expect(m.calls).toEqual(['save', 'render']);
    m.items.length = 0; m.undo(); expect(m.items.map((x) => x.id)).toEqual(['c']);   // the position is capped at the end
    m.calls.length = 0; m.api.deleteItem(mk('zz')); expect([m.calls, m.toasts.length]).toEqual([[], 2]);
  });
  it('removing the ticked items says "Item removed." for one and "Items removed." for none or several; undo restores their places', () => {
    const m = mini([mk('a', true), mk('b'), mk('c', true), mk('d')]); m.api.removeChecked();
    expect([m.items.map((x) => x.id), m.toasts[0].msg, m.calls]).toEqual([['b', 'd'], 'Items removed.', ['save', 'render']]);
    m.undo(); expect(m.items.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    const one = mini([mk('a'), mk('b', true)]); one.api.removeChecked(); expect(one.toasts[0].msg).toBe('Item removed.');
    const none = mini([mk('a')]); none.api.removeChecked(); expect([none.toasts[0].msg, none.items.length]).toEqual(['Items removed.', 1]);
  });
  it('ticking sets done on each item and on its row, checkbox and tile when they exist, saves, updates the buttons and re-sorts after 300 ms', () => {
    const toggles: string[] = [], cb: any = { checked: false }, row: any = { classList: { toggle: (c: string, v: boolean) => toggles.push('row ' + c + v) }, querySelector: (s: string) => (s === 'input[type=checkbox]' ? cb : { classList: { toggle: (c: string, v: boolean) => toggles.push('tile ' + c + v) } }) };
    const a = mk('a'), b = mk('b'), m = mini([a, b], [], { 'li[data-key="a"]': row });
    m.api.setChecked([a, b], true);
    expect([a.done, b.done, toggles, cb.checked, m.calls, m.queried]).toEqual([true, true, ['row donetrue', 'tile donetrue'], true, ['save', 'syncClear', 'reorder 300 2'], ['li[data-key="a"]', 'li[data-key="b"]']]);
    m.api.setChecked([a], false); expect([a.done, cb.checked, toggles.slice(2)]).toEqual([false, false, ['row donefalse', 'tile donefalse']]);
  });
  it('the "checked off" banner undoes the tick, but only while the item is still on the list', () => {
    const a = mk('a', true), m = mini([a]); m.api.checkedToast(a); expect(m.toasts[0].msg).toBe('Item checked off.');
    m.undo(); expect(a.done).toBe(false);
    const b = mk('b', true), m2 = mini([b]); m2.api.checkedToast(b); m2.items.length = 0; m2.undo(); expect([b.done, m2.calls]).toEqual([true, []]);
  });
  it('Uncheck all needs at least two ticked items, unchecks them with a 7 s banner, and the banner ticks them again', () => {
    const a = mk('a', true), b = mk('b', true), c = mk('c', true), d = mk('d'), m = mini([a, b, c, d]);
    m.els.uncheck.fire('click'); expect([m.items.map((x) => x.done), m.toasts[0].msg, m.toasts[0].ms]).toEqual([[false, false, false, false], 'Items unchecked.', 7000]);
    m.undo(); expect(m.items.map((x) => x.done)).toEqual([true, true, true, false]);
    const one = mini([mk('a', true), mk('b')]); one.els.uncheck.fire('click'); expect([one.toasts.length, one.items[0].done]).toEqual([0, true]);
    const none = mini([]); none.els.uncheck.fire('click'); expect(none.toasts.length).toBe(0);
  });
  it('the Clear entire list button only asks when there is something on the list; doWipe empties it, with a 7 s banner that brings it back', () => {
    const m = mini([mk('a'), mk('b')]); m.els.wipe.fire('click'); expect(m.calls).toEqual(['openWipe']);
    m.calls.length = 0; m.api.doWipe(); expect([m.items.length, m.toasts[0].msg, m.toasts[0].ms, m.calls]).toEqual([0, 'List cleared.', 7000, ['save', 'render']]);
    m.calls.length = 0; m.undo(); expect([m.items.map((x) => x.id), m.calls]).toEqual([['a', 'b'], ['save', 'render']]);
    const e = mini([]); e.els.wipe.fire('click'); e.api.doWipe(); expect([e.calls, e.toasts.length]).toEqual([[], 0]);
  });
  it('deleting a recipe removes it, redraws the recipes and the banner puts it back at its place', () => {
    const r1 = { id: 1, name: 'A' }, r2 = { id: 2, name: 'B' }, r3 = { id: 3, name: 'C' }, m = mini([], [r1, r2, r3]);
    m.api.performDelete(r2); expect([m.recipes.map((r) => r.id), m.toasts[0].msg, m.calls]).toEqual([[1, 3], 'Recipe deleted.', ['saveR', 'renderRecipes']]);
    m.calls.length = 0; m.undo(); expect([m.recipes.map((r) => r.id), m.calls]).toEqual([[1, 2, 3], ['saveR', 'renderRecipes']]);
  });
});
