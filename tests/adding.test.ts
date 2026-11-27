import { describe, it, expect, afterEach } from 'vitest';
import * as store from '../src/store';
import { createAdding } from '../src/adding';
import { makeOldAdding } from './reference/oldAdding';
import { rng, clock, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout, now: Date.now, random: Math.random };
afterEach(() => { delete g.document; delete g.window; g.setTimeout = real.setTimeout; Date.now = real.now; Math.random = real.random; });

const IDS = ['form', 'qty', 'unit', 'addCat', 'brand', 'dlgConflict', 'cfExisting', 'cfNew', 'cfSeparate', 'cfMerge', 'cfCancel', 'input', 'dlgItem', 'other'];
const NAMES = ['milk', 'eggs', 'flour', 'tea'], UNITS = ['pcs', 'g', 'kg', 'ml', 'l'], CATS = ['Dairy', 'Bakery'];

interface Sp { items: any[]; hist: number; ops: Op[] }
type Op = { k: string; n: number; b: boolean; v: string };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const items = Array.from({ length: pick([0, 1, 2, 3, 4]) }, (_, i) => {
    const it: any = { id: 'i' + i, text: rand() < .2 ? pick(NAMES).toUpperCase() : pick(NAMES), qty: pick([1, 2, 0.5, 250]), unit: pick(UNITS), done: rand() < .2 };
    if (rand() < .3) it.brand = 'Arla'; if (rand() < .4) it.cat = pick(CATS);
    const kind = pick(['plain', 'plain', 'linked', 'unlinked', 'emptyFrom']);
    if (kind === 'emptyFrom') it.from = [];
    else if (kind !== 'plain') it.from = [{ id: 1, name: 'R1', rp: 4, sp: 4 }];
    if (kind === 'unlinked') { it.unlinked = true; if (rand() < .5) it.orig = { qty: 9, unit: 'g' }; }
    return it;
  });
  const op = (k: string): Op => ({ k, n: Math.floor(rand() * 8), b: rand() < .5, v: pick(['name', 'qty', 'unit', 'cat', 'brand']) });
  const fill = (v: string, n: number): Op => ({ ...op('fill'), v, n });
  const flow = (): Op[] => {
    const f = pick(['add', 'add', 'merge', 'merge', 'conflict', 'conflict', 'invalid', 'history', 'toast', 'close']);
    const form = (): Op[] => [fill('name', pick([0, 1, 2, 3, 4, 5, 6])), fill('qty', pick([0, 1, 2, 3, 4, 5, 6])), fill('unit', pick([0, 1, 2, 3, 4, 5])), ...(rand() < .5 ? [fill('cat', pick([0, 1, 2, 3]))] : []), ...(rand() < .4 ? [fill('brand', pick([0, 1, 2, 3]))] : [])];
    if (f === 'add') return [...form(), op('submit'), pick([op('advance'), { ...op('advance'), n: 339 }]), ...(rand() < .4 ? [op('toastYes')] : [])];
    if (f === 'merge') return [fill('name', 7), fill('qty', pick([1, 2, 3, 4])), fill('unit', pick([0, 1, 2])), op('submit'), { ...op('advance'), n: 340 }];
    if (f === 'conflict') return [fill('name', 7), fill('qty', 1), fill('unit', pick([3, 4, 5])), op('submit'), pick([op('cfSeparate'), op('cfMerge'), op('cfCancel'), op('cfBackdrop'), op('cfSeparate')]), ...(rand() < .4 ? [op('cfSeparate')] : [])];
    if (f === 'invalid') return [fill('name', pick([0, 6])), fill('qty', pick([0, 2])), fill('unit', pick([0, 5])), op('submit')];
    if (f === 'history') return [op('record'), op('record'), op('record')];
    if (f === 'toast') return [...form(), op('submit'), op('toastYes'), op('toastYes')];
    return [...form(), op('submit'), op('dropItem'), op('cfSeparate'), op('cfMerge')];
  };
  const single = () => op(pick(['fill', 'submit', 'cfSeparate', 'cfMerge', 'cfCancel', 'cfBackdrop', 'advance', 'toastYes', 'record', 'dropItem']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 6); s < n; s++) { if (rand() < .75) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { items, hist: pick([0, 3, 498, 499, 500]), ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };
const VALUES: Record<string, string[]> = {
  name: ['milk', ' MILK ', 'eggs', 'tea', 'new thing', ' ', ''], qty: ['0', '1', '2.5', '0.005', '-1', 'x', '1.234'], unit: ['', 'pcs', 'g', 'kg', 'ml', 'l'], cat: ['', 'Dairy', 'Bakery', 'Spices'], brand: ['', 'Arla', ' arla ', 'Alpro'],
};

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], clk = clock();
  let ticks = 0, rnd = 7;
  Date.now = () => 1000 + Math.floor(ticks++ / 2); Math.random = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  g.setTimeout = clk.setTimeout; g.window = {};
  const els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  let created = 0;
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    createElement: (tag: string) => { const e = new El(log, tag + '#' + (++created)); log.push('create ' + e.id); return e; },
    createDocumentFragment: () => { const e = new El(log, 'frag#' + (++created)); log.push('create ' + e.id); return e; },
    createTextNode: (t: string) => { const e = new El(log, 'text#' + (++created)); log.push('text ' + e.id + ' ' + t); return e; },
  };
  store.setList('items', JSON.parse(JSON.stringify(sp.items)));
  store.setList('history', Array.from({ length: sp.hist }, (_, i) => ({ text: 'h' + i, unit: 'pcs', cat: '', last: 500 + ((i * 7) % 13) })));
  const items: any[] = store.items, hist: any[] = store.history;
  els.unit.value = 'pcs';
  let lastToast: any[] = [];
  const env = {
    items, itemHistory: hist, input: els.input, dlgItem: els.dlgItem, addSuggest: { hide: () => log.push('suggest.hide') },
    save: () => log.push('save ' + JSON.stringify(items)), saveHist: () => log.push('saveHist ' + hist.length), render: () => log.push('render'),
    withAnim: (kind: string, fn: () => void, lock?: boolean) => { log.push('withAnim ' + kind + ' ' + lock); fn(); },
    showToast: (...a: any[]) => { log.push('toast ' + JSON.stringify(a.map((x) => (typeof x === 'function' ? 'fn' : x)))); lastToast = a; },
    openItemDialog: () => log.push('openItemDialog'), openDesc: (it: any) => log.push('openDesc ' + it.id),
  };
  const api: any = impl === 'old' ? makeOldAdding(env) : createAdding(env as any);
  const snap = () => JSON.stringify([items, hist.length, hist.slice(0, 3), ['qty', 'unit', 'addCat', 'brand', 'input'].map((i) => els[i].value), els.dlgConflict.open, els.dlgItem.open, els.cfExisting.children.length, els.cfNew.children.length]);
  els.dlgItem.open = true;
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.n + ' ' + o.b + ' ' + o.v);
    try {
      switch (o.k) {
        case 'fill': { const f = o.v === 'name' ? 'input' : o.v === 'cat' ? 'addCat' : o.v; const vals = VALUES[o.v];
          if (o.v === 'name' && o.n === 7) els[f].value = items.length ? items[0].text : 'milk'; else if (o.v === 'unit' && o.n >= 3 && items.length) els[f].value = ['pcs', 'g', 'kg', 'ml', 'l', 'pcs'][(o.n + 1) % 5]; else els[f].value = vals[o.n % vals.length]; break; }
        case 'submit': els.form.fire('submit'); break;
        case 'cfSeparate': els.cfSeparate.fire('click'); break;
        case 'cfMerge': els.cfMerge.fire('click'); break;
        case 'cfCancel': els.cfCancel.fire('click'); break;
        case 'cfBackdrop': els.dlgConflict.fire('click', { target: o.b ? els.dlgConflict : els.other }); break;
        case 'advance': clk.advance(o.n >= 300 ? o.n : [0, 1, 339, 340, 400][o.n % 5]); break;
        case 'toastYes': { const f = lastToast[1]; if (typeof f === 'function') f(); break; }
        case 'record': api.recordHistory([[{ text: ' Milk ', unit: 'g', cat: 'Dairy' }], [{ text: 'tea' }], [{ text: '' }, null, { text: 'h1', unit: '', cat: '' }], [{ text: 'brand new ' + o.n, unit: 'kg' }, { text: 'BRAND NEW ' + o.n, cat: 'X' }]][o.n % 4] as any); break;
        case 'dropItem': if (items.length) items.splice(o.n % items.length, 1); break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  clk.advance(100000);
  const txt = log.join('\n');
  if (count) {
    if (/toast \["Item added\. Add another\?","fn",7000,"Yes"\]/.test(txt)) hit('item added'); if (/-- submit[^\n]*\n(?:(?!state)[^\n]*\n)*?create li/.test(txt)) hit('conflict window filled');
    if (/withAnim list undefined/.test(txt)) hit('list redrawn after 340 ms'); if (/-- submit[^\n]*\n(?:[^\n]*preventDefault[^\n]*\n)?state/.test(txt)) hit('submit refused or silent');
    if (/openDesc/.test(txt)) hit('merge: opens the item'); if (/-- cfSeparate[^\n]*\n(?:(?!state)[^\n]*\n)*?toast/.test(txt)) hit('separate entry added');
    if (/-- cfCancel/.test(txt) && /dlgConflict\.close/.test(txt)) hit('conflict cancelled'); if (/-- cfBackdrop \d true/.test(txt)) hit('backdrop on conflict');
    if (/"unlinked":true,"manual":true/.test(txt)) hit('linked item merged (un-linked and manual)'); if (/"orig":\{"qty":\d/.test(txt)) hit('orig remembered');
    if (/saveHist 500/.test(txt)) hit('history at 500'); if (/saveHist 50[1-9]/.test(txt)) hit('history over the limit (must not happen)');
    if (/saveHist 49[89]/.test(txt)) hit('history near the limit'); if (/threw/.test(txt)) hit('threw');
    if (/"cat":"Dairy"/.test(txt)) hit('category used');
  }
  return { log, items: JSON.parse(JSON.stringify(items)), hist: JSON.parse(JSON.stringify(hist)) };
}

describe('the Add item form, the history and the conflict window (new adding.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 3000 random sessions (merging, converting units, conflicts, history limit of 500)', () => {
    const rand = rng(90210);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 3000; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['item added', 'conflict window filled', 'list redrawn after 340 ms', 'submit refused or silent', 'merge: opens the item', 'separate entry added', 'conflict cancelled', 'backdrop on conflict', 'linked item merged (un-linked and manual)', 'orig remembered', 'history at 500', 'history near the limit', 'category used']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 180000);
});

// ---- the same, with the expected behaviour written out (no old code involved) ----
function mini(itemsIn: any[], histIn: any[] = []) {
  const log: string[] = [], els: Record<string, El> = {}, clk = clock();
  for (const id of IDS) els[id] = new El(log, id);
  let created = 0; Date.now = () => 5000; g.setTimeout = clk.setTimeout; g.window = {};
  g.document = { getElementById: (id: string) => els[id], createElement: (t: string) => new El(log, t + '#' + (++created)), createDocumentFragment: () => new El(log, 'f' + (++created)), createTextNode: () => new El(log, 't' + (++created)) };
  store.setList('items', itemsIn); store.setList('history', histIn);
  const calls: string[] = [], toasts: any[][] = [];
  const api = createAdding({ items: store.items, itemHistory: store.history, input: els.input as any, dlgItem: els.dlgItem as any, addSuggest: { hide: () => calls.push('hide') },
    save: () => calls.push('save'), saveHist: () => calls.push('saveHist'), render: () => calls.push('render'), withAnim: (k, fn) => { calls.push('anim ' + k); fn(); },
    showToast: (...a: any[]) => { toasts.push(a); }, openItemDialog: () => calls.push('openItemDialog'), openDesc: (it) => calls.push('openDesc ' + it.id) } as any);
  const submit = (v: Record<string, string>) => { els.input.value = v.name ?? ''; els.qty.value = v.qty ?? ''; els.unit.value = v.unit ?? ''; els.addCat.value = v.cat ?? ''; els.brand.value = v.brand ?? ''; els.form.fire('submit'); };
  return { els, api, calls, toasts, clk, items: store.items as any[], hist: store.history as any[], submit };
}
const mkItem = (id: string, text: string, qty: number, unit: string, extra: any = {}) => ({ id, text, qty, unit, done: false, ...extra });

describe('the Add item form, behaviour', () => {
  it('adds a new item with its category and brand, clears the form, closes the window and offers "Add another?" for 7 s', () => {
    const m = mini([]); m.submit({ name: ' Oat milk ', qty: '2', unit: 'pcs', cat: 'Dairy', brand: ' Alpro ' });
    expect(m.items.length).toBe(1); const n = m.items[0];
    expect([n.text, n.qty, n.unit, n.done, n.cat, n.brand, typeof n.id]).toEqual(['Oat milk', 2, 'pcs', false, 'Dairy', 'Alpro', 'string']);
    expect([m.els.qty.value, m.els.unit.value, m.els.input.value, m.els.addCat.value, m.els.brand.value, m.els.dlgItem.open]).toEqual(['', 'pcs', '', '', '', false]);
    expect([m.calls, m.toasts[0].slice(0, 1), m.toasts[0][2], m.toasts[0][3]]).toEqual([['saveHist', 'hide', 'save'], ['Item added. Add another?'], 7000, 'Yes']);
    m.toasts[0][1](); expect(m.calls.at(-1)).toBe('openItemDialog');
    m.clk.advance(339); expect(m.calls.includes('anim list')).toBe(false); m.clk.advance(1); expect(m.calls.slice(-2)).toEqual(['anim list', 'render']);
    m.submit({ name: 'x', qty: '1', unit: 'g' }); expect(m.items[1].cat).toBe(undefined); expect('brand' in m.items[1]).toBe(false);
  });
  it('needs a name, a positive amount and a unit', () => {
    const m = mini([]);
    for (const v of [{ name: ' ', qty: '1', unit: 'g' }, { name: 'a', qty: '0', unit: 'g' }, { name: 'a', qty: '-2', unit: 'g' }, { name: 'a', qty: 'x', unit: 'g' }, { name: 'a', qty: '1', unit: '' }]) { m.submit(v); expect([m.items.length, m.toasts.length]).toEqual([0, 0]); }
  });
  it('the same name (any capitals) and brand with a convertible unit adds to that item, rounded to 2 decimals, and fills its category only when empty', () => {
    const a = mkItem('a', 'Flour', 1.5, 'kg'), m = mini([a]); m.submit({ name: 'flour', qty: '250', unit: 'g', cat: 'Bakery' });
    expect([m.items.length, a.qty, a.cat]).toEqual([1, 1.75, 'Bakery']); m.submit({ name: 'FLOUR', qty: '1', unit: 'g', cat: 'Dairy' }); expect([a.qty, a.cat]).toEqual([1.75, 'Bakery']);   // 1.751 rounds to 1.75
    const b = mkItem('b', 'rice', 1, 'kg'), m2 = mini([b]); m2.submit({ name: 'rice', qty: '3', unit: 'g' }); expect(b.qty).toBe(1); m2.submit({ name: 'rice', qty: '10', unit: 'g' }); expect(b.qty).toBe(1.01);
    const c = mkItem('c', 'milk', 1, 'l', { brand: 'Arla' }), m3 = mini([c]); m3.submit({ name: 'milk', qty: '1', unit: 'l', brand: 'arla' }); expect([m3.items.length, c.qty]).toEqual([1, 2]);
    m3.submit({ name: 'milk', qty: '1', unit: 'l', brand: '' }); expect(m3.items.length).toBe(1 + 1);   // another brand: the window for the same name opens? no: no item has that name without a brand
  });
  it('an item that is ticked off is never merged into; a linked item becomes un-linked and manual and remembers its original amount once', () => {
    const done = mkItem('d', 'tea', 1, 'pcs', { done: true }), m = mini([done]); m.submit({ name: 'tea', qty: '1', unit: 'pcs' }); expect([m.items.length, done.qty]).toEqual([2, 1]);
    const l = mkItem('l', 'egg', 6, 'pcs', { from: [{ id: 1, name: 'R' }] }), m2 = mini([l]); m2.submit({ name: 'egg', qty: '2', unit: 'pcs' });
    expect([l.qty, l.unlinked, l.manual, l.orig]).toEqual([8, true, true, { qty: 6, unit: 'pcs' }]); m2.submit({ name: 'egg', qty: '2', unit: 'pcs' }); expect([l.qty, l.orig]).toEqual([10, { qty: 6, unit: 'pcs' }]);
    const e = mkItem('e', 'salt', 1, 'kg', { from: [] }), m4 = mini([e]); m4.submit({ name: 'salt', qty: '1', unit: 'kg' }); expect([e.qty, e.unlinked, e.manual, e.orig]).toEqual([2, undefined, undefined, undefined]);   // an empty list of recipes is not a link
    const p = mkItem('p', 'oil', 1, 'l'), m3 = mini([p]); m3.submit({ name: 'oil', qty: '1', unit: 'l' }); expect([p.unlinked, p.manual, p.orig]).toEqual([undefined, undefined, undefined]);
  });
  it('a name already on the list whose unit cannot be converted opens the conflict window with both amounts; Separate adds it as its own entry', () => {
    const a = mkItem('a', 'Flour', 2, 'pcs'), m = mini([a]); m.submit({ name: 'flour', qty: '300', unit: 'g', cat: 'Bakery' });
    expect([m.els.dlgConflict.open, m.items.length, m.els.cfExisting.children.length, m.els.cfNew.children.length, m.toasts.length]).toEqual([true, 1, 1, 1, 0]);
    m.els.cfSeparate.fire('click'); expect([m.els.dlgConflict.open, m.items.length, m.items[1].text, m.items[1].qty, m.items[1].unit, m.items[1].cat]).toEqual([false, 2, 'flour', 300, 'g', 'Bakery']);
    m.els.cfSeparate.fire('click'); expect(m.items.length).toBe(2);   // a second click does nothing
  });
  it('in the conflict window, Merge clears the form and opens the existing item; Cancel and a click on the backdrop just close it', () => {
    const mk = () => { const a = mkItem('a', 'Flour', 2, 'pcs'), m = mini([a]); m.submit({ name: 'flour', qty: '300', unit: 'g' }); return { a, m }; };
    const { m } = mk(); m.els.cfMerge.fire('click'); expect([m.els.dlgConflict.open, m.els.dlgItem.open, m.els.input.value, m.els.qty.value, m.els.unit.value, m.calls, m.items.length]).toEqual([false, false, '', '', 'pcs', ['hide', 'openDesc a'], 1]);
    m.els.cfSeparate.fire('click'); expect(m.items.length).toBe(1);   // the pending entry is gone
    const c = mk().m; c.els.dlgItem.open = true; c.els.cfCancel.fire('click'); expect([c.els.dlgConflict.open, c.els.dlgItem.open, c.els.input.value]).toEqual([false, true, 'flour']); c.els.cfSeparate.fire('click'); expect(c.items.length).toBe(1);
    const b = mk().m; b.els.dlgConflict.fire('click', { target: b.els.other }); expect(b.els.dlgConflict.open).toBe(true); b.els.dlgConflict.fire('click'); expect(b.els.dlgConflict.open).toBe(false);
  });
  it('the history: new names go in, known ones (any capitals) are refreshed, empty ones are skipped, and at most 500 are kept (the newest)', () => {
    const m = mini([], [{ text: 'Milk', unit: 'l', cat: '', last: 1 }]);
    m.api.recordHistory([{ text: ' milk ', unit: 'g', cat: 'Dairy' }, { text: '' }, null as any, { text: 'tea' }]);
    expect(m.hist).toEqual([{ text: 'milk', unit: 'g', cat: 'Dairy', last: 5000 }, { text: 'tea', unit: '', cat: '', last: 5000 }]);
    m.api.recordHistory([{ text: 'milk' }]); expect(m.hist[0]).toEqual({ text: 'milk', unit: 'g', cat: 'Dairy', last: 5000 });   // no unit or category given: the old ones stay
    const full = mini([], Array.from({ length: 500 }, (_, i) => ({ text: 'h' + i, unit: '', cat: '', last: 100 + i })));
    full.api.recordHistory([{ text: 'refreshed h0' }]); expect(full.hist.length).toBe(500); expect(full.hist.some((h) => h.text === 'h0')).toBe(false); expect(full.hist.some((h) => h.text === 'refreshed h0')).toBe(true);
    full.api.recordHistory([{ text: 'h0' }]); expect(full.hist.length).toBe(500);
    const ex = mini([], Array.from({ length: 499 }, (_, i) => ({ text: 'h' + i, unit: '', cat: '', last: 100 + i }))); ex.api.recordHistory([{ text: 'new' }]); expect(ex.hist.length).toBe(500); expect(ex.hist.some((h) => h.text === 'h0')).toBe(true);
    expect(m.calls.filter((c) => c === 'saveHist').length).toBe(2);
  });
});
