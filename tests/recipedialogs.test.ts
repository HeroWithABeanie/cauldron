import { describe, it, expect, afterEach } from 'vitest';
import * as store from '../src/store';
import { createRecipeDialogs } from '../src/recipedialogs';
import { makeOldRecipeDialogs } from './reference/oldRecipeDialogs';
import { rng, clock, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { random: Math.random, now: Date.now, setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, setInterval: g.setInterval, clearInterval: g.clearInterval };
afterEach(() => { delete g.document; delete g.window; delete g.getComputedStyle; Math.random = real.random; Date.now = real.now; Object.assign(g, { setTimeout: real.setTimeout, clearTimeout: real.clearTimeout, setInterval: real.setInterval, clearInterval: real.clearInterval }); });

const IDS = ['dlg', 'ingRecipeName', 'ingQty', 'ingUnit', 'ingName', 'ingCat', 'ingBrand', 'ingPortionsInfo', 'dlgClose', 'ingForm', 'suggestR',
  'dlgShop', 'shopPortions', 'shopRecipe', 'shopPortionsInfo', 'shopPreview', 'shopWarn', 'shopWarnText', 'shopSubmit', 'dlgShopClose', 'shopForm',
  'dlgChange', 'changeName', 'changePortions', 'dlgChangeClose', 'changeForm'];
const NAMES = ['milk', 'eggs', 'flour', 'tea', 'rice'], UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp'], CATS = ['Dairy', 'Bakery', 'Spices'];

interface RecipeSpec { id: number; name: string; portions: number; items: any[] }
interface Sp { items: any[]; recipes: RecipeSpec[]; ops: Op[] }
type Op = { k: string; i: number; j: number; b: boolean; v: string };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const recipes: RecipeSpec[] = [1, 2, 3].map((id) => ({ id, name: 'R' + id, portions: pick([0, 1, 2, 4, 6]) || 4, items:
    Array.from({ length: pick([0, 1, 2, 3, 4, 5]) }, () => { const it: any = { text: pick(NAMES), qty: pick([.5, 1, 2, 3.5]), unit: pick(UNITS) }; if (rand() < .3) it.brand = 'Arla'; if (rand() < .4) it.cat = pick(CATS); return it; }) }));
  const items = Array.from({ length: pick([0, 1, 2, 3, 4]) }, (_, n) => {
    const it: any = { id: 'i' + n, text: pick(NAMES), qty: pick([1, 2, 3]), unit: pick(UNITS), done: rand() < .15 };
    if (rand() < .3) it.brand = 'Arla'; if (rand() < .4) it.cat = pick(CATS);
    const kind = pick(['plain', 'linked', 'linked', 'unlinked', 'manual']);
    if (kind !== 'plain') it.from = [{ id: pick([1, 2, 3]), name: 'R1', rp: 4, sp: pick([0, 2, 4]) }];
    if (kind === 'unlinked') it.unlinked = true;
    if (kind === 'manual') { it.unlinked = true; it.manual = true; }
    return it;
  });
  const op = (k: string): Op => ({ k, i: Math.floor(rand() * 9), j: Math.floor(rand() * 5), b: rand() < .5, v: pick(['name', 'qty', 'unit', 'cat', 'brand']) });
  const flow = (): Op[] => {
    const f = pick(['ing', 'ing', 'shop', 'shop', 'shop', 'change', 'change', 'add']);
    if (f === 'ing') return [op('openIng'), op('ingFill'), op('ingFill'), op('ingFill'), op('ingSubmit'), ...(rand() < .5 ? [op('undoToast')] : []), ...(rand() < .3 ? [op('closeIng')] : [])];
    if (f === 'shop') return [op('openShop'), ...(rand() < .6 ? [op('shopPortions')] : []), ...(rand() < .6 ? [op('shopToggle'), op('shopToggle')] : []), op('shopSubmit'), ...(rand() < .6 ? [op('undoToast')] : []), ...(rand() < .2 ? [op('shopClose')] : [])];
    if (f === 'change') return [op('openChange'), ...(rand() < .8 ? [op('changeFill'), op('changeFill')] : []), ...pick([[op('changeSubmit')], [op('requestCloseChange'), op('confirmDiscard')], [op('changeClose')], [op('changeBackdrop')]]), ...(rand() < .5 ? [op('undoToast')] : [])];
    return [op('add'), ...(rand() < .6 ? [op('undoToast')] : [])];
  };
  const single = () => op(pick(['openIng', 'ingSubmit', 'ingFill', 'closeIng', 'ingBackdrop', 'openShop', 'shopSubmit', 'shopToggle', 'shopPortions', 'shopClose', 'shopBackdrop', 'openChange', 'changeSubmit', 'changeFill', 'requestCloseChange', 'confirmDiscard', 'undoToast', 'add', 'dismiss']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 5); s < n; s++) { if (rand() < .65) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { items, recipes, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], clk = clock();
  store.setList('items', JSON.parse(JSON.stringify(sp.items)));
  const items = store.items;
  const recipes: RecipeSpec[] = JSON.parse(JSON.stringify(sp.recipes));
  let created = 0, lastUndo: (() => void) | null = null, pendingDiscard: (() => void) | null = null, seed = 7, nowN = 0;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  Date.now = () => 1700000000000 + (++nowN);
  const els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    createElement: (tag: string) => { const e = new El(log, tag + '#' + (++created)); log.push('create ' + e.id); return e; },
    createDocumentFragment: () => { const e = new El(log, 'frag#' + (++created)); log.push('create ' + e.id); return e; },
    createTextNode: (t: string) => { const e = new El(log, 'text#' + (++created)); log.push('text ' + e.id + ' ' + t); return e; },
  };
  g.window = {};
  g.getComputedStyle = () => ({ borderBottomWidth: '1px' });
  g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clear; g.setInterval = clk.setInterval; g.clearInterval = clk.clear;
  const linkedFrom = (r: RecipeSpec) => { let f0: any = null; items.forEach((x: any) => { (x.from || []).forEach((f: any) => { if (f.id === r.id && !f0) f0 = f; }); }); return f0; };
  const env = {
    items, unitHTML: 'U', COOK_HTML: 'C', viewList: els.dlg,
    save: () => log.push('save ' + JSON.stringify(items)), saveR: () => log.push('saveR ' + JSON.stringify(recipes)), render: () => log.push('render'), renderRecipes: () => log.push('renderRecipes'),
    recordHistory: (e: unknown) => log.push('history ' + JSON.stringify(e)), dismissSearch: () => log.push('dismissSearch'),
    openDiscard: (then: () => void) => { log.push('openDiscard'); pendingDiscard = then; },
    openAddList: (r: RecipeSpec, item: unknown) => log.push('openAddList ' + r.id + ' ' + JSON.stringify(item)),
    ensureOpt: (sel: El, v: unknown) => log.push('ensureOpt ' + sel.id + ' ' + v),
    linkedToRecipe: (r: RecipeSpec) => !!linkedFrom(r),
    listedPortions: (r: RecipeSpec) => { let m = 0; items.forEach((x: any) => { (x.from || []).forEach((f: any) => { if (f.id === r.id && f.sp > m) m = f.sp; }); }); return m; },
    makeSuggest: (inp: El, box: El) => { log.push('makeSuggest ' + inp.id + ' ' + box.id); return { hide: () => log.push('suggest.hide') }; },
    showToast: (msg: string, undo?: () => void, ms?: number, label?: string) => { log.push('toast ' + msg + ' ' + ms + ' ' + label); lastUndo = undo || null; },
  };
  const api: any = impl === 'old' ? makeOldRecipeDialogs(env) : createRecipeDialogs(env as any);
  const snap = () => JSON.stringify([items, recipes, ['dlg', 'dlgShop', 'dlgChange'].map((i) => els[i].open), els.ingName.value, els.changeName.value, els.shopPortions.value, els.shopSubmit.disabled]);
  const rec = (o: Op) => recipes[o.i % recipes.length];
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.i + ' ' + o.j);
    try {
      switch (o.k) {
        case 'openIng': api.openIngredient(rec(o)); break;
        case 'ingFill': { const f = o.v === 'name' ? els.ingName : o.v === 'qty' ? els.ingQty : o.v === 'unit' ? els.ingUnit : o.v === 'cat' ? els.ingCat : els.ingBrand;
          f.value = o.v === 'qty' ? ['', '0', '-1', '2', '2.5', 'x'][o.j] : o.v === 'unit' ? ['', 'g', 'pcs', 'tbsp', 'kg'][o.j] : o.v === 'cat' ? ['', 'Dairy', 'Bakery', 'Spices', 'Dairy'][o.j] : o.v === 'brand' ? ['', ' Arla ', 'Alpro', ' ', 'x'][o.j] : [' ', 'milk', ' eggs ', 'flour', 'rice'][o.j]; break; }
        case 'ingSubmit': els.ingForm.fire('submit'); break;
        case 'closeIng': els.dlgClose.fire('click'); break;
        case 'ingBackdrop': els.dlg.fire('click', { target: o.b ? els.dlg : els.ingName }); break;
        case 'openShop': api.openShop(rec(o)); break;
        case 'shopPortions': els.shopPortions.value = ['', '0', '1', '2', '8', 'x'][o.j]; els.shopPortions.fire('change'); break;
        case 'shopToggle': { const rows = els.shopPreview.children; const lab = rows[o.i % Math.max(1, rows.length)]?.children[0]; const cb = lab?.children[0]; if (cb) { cb.checked = !cb.checked; cb.fire('change'); } break; }
        case 'shopSubmit': els.shopForm.fire('submit'); break;
        case 'shopClose': els.dlgShopClose.fire('click'); break;
        case 'shopBackdrop': els.dlgShop.fire('click', { target: o.b ? els.dlgShop : els.shopPreview }); break;
        case 'openChange': api.openChange(rec(o)); break;
        case 'changeFill': if (o.b) els.changeName.value = [' ', 'Pasta', ' R1 ', 'Soup', 'R2'][o.j]; else els.changePortions.value = ['', '0', '1', '4', '6'][o.j]; break;
        case 'changeSubmit': els.changeForm.fire('submit'); break;
        case 'requestCloseChange': api.requestCloseChange(); break;
        case 'changeClose': els.dlgChangeClose.fire('click'); break;
        case 'changeBackdrop': els.dlgChange.fire('click', { target: o.b ? els.dlgChange : els.changeName }); break;
        case 'confirmDiscard': { const f = pendingDiscard; pendingDiscard = null; if (f) f(); break; }
        case 'undoToast': { const f = lastUndo; lastUndo = null; if (f) f(); break; }
        case 'dismiss': els.dlgChange._closing = o.b; break;
        case 'add': { const r = rec(o); const list = r.items.slice(0, 1 + (o.j % 3)).map((x: any) => ({ text: x.text, brand: x.brand, qty: x.qty, unit: x.unit, cat: x.cat })); const u = api.addToShopping(list, o.b ? r : null, o.j + 1, o.i % 2 === 0); lastUndo = u; break; }
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  const txt = log.join('\n');
  if (count) {
    if (/dlg\.showModal/.test(txt)) hit('ingredient window');
    if (/openAddList/.test(txt)) hit('asked to add to the list');
    if (/toast Item added\. Add another\? 7000 Yes/.test(txt)) hit('add another toast');
    if (/dlgShop\.showModal/.test(txt)) hit('shop window');
    if (/shopWarn\.hidden=false/.test(txt)) hit('already on the list');
    if (/Not added last time/.test(txt)) hit('skipped hint');
    if (/shopPreview\.style\.maxHeight="\d+px"|shopPreview\.style\.maxHeight=\d+px/.test(txt)) hit('preview capped');
    if (/toast Ingredients for/.test(txt)) hit('ingredients added');
    if (/dlgShop\.close/.test(txt)) hit('shop closed');
    if (/shopSubmit\.disabled=true/.test(txt)) hit('add button disabled');
    if (/dlgChange\.showModal/.test(txt)) hit('change window');
    if (/toast Recipe updated\./.test(txt)) hit('recipe renamed');
    if (/openDiscard/.test(txt)) hit('discard asked');
    if (/-- undoToast[\s\S]{0,400}save/.test(txt)) hit('undo');
    if (/-- add /.test(txt) && /"from":\[\{"id":\d,"name":"R\d","rp":\d,"sp":\d\}\]/.test(txt)) hit('linked item created');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log, items: JSON.parse(JSON.stringify(items)), recipes };
}

describe('the recipe windows (new recipedialogs.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 1500 random sessions (adding ingredients, shopping, renaming, undo)', () => {
    const rand = rng(424242);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 1500; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['ingredient window', 'asked to add to the list', 'add another toast', 'shop window', 'already on the list', 'skipped hint', 'preview capped', 'ingredients added', 'shop closed', 'add button disabled', 'change window', 'recipe renamed', 'discard asked', 'undo', 'linked item created']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 120000);
});

// ---- the same windows, with the expected behaviour written out (no old code involved) ----
function mini(itemsIn: any[], recipesIn: any[]) {
  const log: string[] = [], els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  store.setList('items', itemsIn);
  const items = store.items, recipes = recipesIn;
  let created = 0, undo: (() => void) | null = null, discard: (() => void) | null = null;
  const toasts: any[] = [], asked: any[] = [], hist: any[] = [];
  g.document = { getElementById: (id: string) => els[id] ?? null, createElement: (t: string) => new El(log, t + '#' + (++created)), createDocumentFragment: () => new El(log, 'frag#' + (++created)), createTextNode: () => new El(log, 'text#' + (++created)) };
  g.window = {}; g.getComputedStyle = () => ({ borderBottomWidth: '1px' });
  let n = 0; Date.now = () => 1700000000000 + (++n);
  let saves = 0, renders = 0;
  const api = createRecipeDialogs({
    items, unitHTML: 'U', COOK_HTML: 'C', viewList: els.dlg,
    save: () => { saves++; }, saveR: () => { }, render: () => { renders++; }, renderRecipes: () => { }, recordHistory: (e) => { hist.push(e); }, dismissSearch: () => { },
    openDiscard: (then) => { discard = then; }, openAddList: (r, it) => { asked.push([r.id, it]); }, ensureOpt: () => { },
    linkedToRecipe: (r) => items.some((x: any) => (x.from || []).some((f: any) => f.id === r.id)),
    listedPortions: (r) => { let m = 0; items.forEach((x: any) => (x.from || []).forEach((f: any) => { if (f.id === r.id && f.sp > m) m = f.sp; })); return m; },
    makeSuggest: () => ({ hide() { } }), showToast: (m, u, ms, label) => { toasts.push([m, ms, label]); undo = u || null; },
  } as any);
  return { els, api, items, recipes, toasts, asked, hist, get saves() { return saves; }, undo: () => { const f = undo; undo = null; f!(); }, discard: () => discard!, askedDiscard: () => discard !== null };
}
const rcp = (extra: any = {}) => ({ id: 1, name: 'Pasta', portions: 4, items: [{ text: 'flour', qty: 200, unit: 'g' }, { text: 'salt', qty: 1, unit: 'tsp' }, { text: 'egg', qty: 2, unit: 'pcs' }], ...extra });
const row = (m: any, i: number) => m.els.shopPreview.children[i].children[0];

describe('the recipe windows, behaviour', () => {
  it('adds a new item with its recipe link, brand and category, and undo takes it away again', () => {
    const m = mini([], [rcp()]);
    const undo = m.api.addToShopping([{ text: 'flour', brand: 'Kung', qty: 200, unit: 'g', cat: 'Bakery' }], m.recipes[0], 4);
    expect(m.items.length).toBe(1);
    const { id, ...rest } = m.items[0]; expect(typeof id).toBe('string');
    expect(rest).toEqual({ text: 'flour', brand: 'Kung', qty: 200, unit: 'g', cat: 'Bakery', done: false, from: [{ id: 1, name: 'Pasta', rp: 4, sp: 4 }] });
    undo(); expect(m.items.length).toBe(0);
  });
  it('adds to a linked item with the same name and unit, and adds the portions of the same recipe up', () => {
    const it: any = { id: 'a', text: 'flour', qty: 100, unit: 'g', done: false, from: [{ id: 1, name: 'Pasta', rp: 4, sp: 2 }] }, m = mini([it], [rcp()]);
    const undo = m.api.addToShopping([{ text: 'flour', qty: 50, unit: 'g' }], m.recipes[0], 2);
    expect(m.items.length).toBe(1); expect(it.qty).toBe(150); expect(it.from[0].sp).toBe(4);
    m.api.addToShopping([{ text: 'flour', qty: 10, unit: 'g' }], m.recipes[0], 2, true); expect(it.from[0].sp).toBe(4);   // a single ingredient topped up: portions stay
    undo(); expect(it.qty).toBe(110); expect(it.from[0].sp).toBe(2);   // undoing the first add restores the label as it was before that add
  });
  it('tops up an item that was added by hand: it gets the recipe, becomes unlinked and manual, and undo takes that back', () => {
    const it: any = { id: 'a', text: 'flour', qty: 100, unit: 'g', done: false }, m = mini([it], [rcp()]);
    const undo = m.api.addToShopping([{ text: 'flour', qty: 50, unit: 'g' }], m.recipes[0], 4);
    expect([it.qty, it.unlinked, it.manual, it.from]).toEqual([150, true, true, [{ id: 1, name: 'Pasta', rp: 4, sp: 4 }]]);
    undo(); expect(it.qty).toBe(100); expect('from' in it).toBe(false); expect('unlinked' in it).toBe(false); expect('manual' in it).toBe(false);
  });
  it('merges into an unlinked item that still lists recipes when the units can be converted, and not into ticked-off items or other units', () => {
    const un: any = { id: 'u', text: 'flour', qty: 1, unit: 'kg', done: false, unlinked: true, from: [{ id: 2, name: 'Cake', rp: 4, sp: 4 }] };
    const m = mini([un], [rcp()]);
    m.api.addToShopping([{ text: 'flour', qty: 250, unit: 'g' }], m.recipes[0], 4);
    expect(m.items.length).toBe(1); expect(un.qty).toBe(1.25); expect(un.from.length).toBe(2);
    const done: any = { id: 'd', text: 'egg', qty: 1, unit: 'pcs', done: true }, m2 = mini([done], [rcp()]);
    m2.api.addToShopping([{ text: 'egg', qty: 2, unit: 'pcs' }], m2.recipes[0], 4); expect(m2.items.length).toBe(2);
    const m3 = mini([{ id: 'x', text: 'flour', qty: 1, unit: 'pcs', done: false, from: [{ id: 1, name: 'Pasta' }] }], [rcp()]);
    m3.api.addToShopping([{ text: 'flour', qty: 1, unit: 'g' }], m3.recipes[0], 4); expect(m3.items.length).toBe(2);
  });
  it('the shop window scales the quantities with the portions, leaves cooking units unticked and disables the button when nothing is ticked', () => {
    const m = mini([], [rcp()]);
    m.api.openShop(m.recipes[0]);
    expect(m.els.shopPreview.children.length).toBe(3);
    expect(row(m, 0).children[0].checked).toBe(true); expect(row(m, 1).children[0].checked).toBe(false);   // tsp is a cooking unit
    expect(row(m, 0).children[1].children[0].textContent).toContain('200');
    m.els.shopPortions.value = '2'; m.els.shopPortions.fire('change');
    expect(row(m, 0).children[1].children[0].textContent).toContain('100');
    expect(m.els.shopSubmit.disabled).toBe(false);
    for (const i of [0, 2]) { row(m, i).children[0].checked = false; row(m, i).children[0].fire('change'); }
    expect(m.els.shopSubmit.disabled).toBe(true);
  });
  it('a recipe that is already on the list is warned about, and ingredients that were skipped last time come back ticked with a hint', () => {
    const it: any = { id: 'a', text: 'flour', qty: 200, unit: 'g', done: false, from: [{ id: 1, name: 'Pasta', rp: 4, sp: 4 }] }, m = mini([it], [rcp()]);
    m.api.openShop(m.recipes[0]);
    expect(m.els.shopWarn.hidden).toBe(false); expect(m.els.shopWarnText.textContent).toBe('This recipe is already on your list for 4 portions.');
    expect(row(m, 2).children[0].checked).toBe(true);                                                  // egg was skipped
    expect(row(m, 1).children[0].checked).toBe(true);                                                  // so was the salt: skipped rows are ticked even with a cooking unit
    expect(row(m, 0).children[0].checked).toBe(true);
    expect(row(m, 2).children.length).toBe(2);                                                         // checkbox + the wrapper that holds the hint
  });
  it('4 or more ingredients make the list scroll, capped at 3 and a half rows', () => {
    const many = rcp({ items: [1, 2, 3, 4].map((n) => ({ text: 'x' + n, qty: 1, unit: 'g' })) }), m = mini([], [many]);
    m.api.openShop(many); expect(m.els.shopPreview.style.maxHeight).toBe(Math.round(61 * 3.5 + 3) + 'px'); expect(m.els.shopPreview.style.overflowY).toBe('auto');
    const few = rcp({ items: [1, 2, 3].map((n) => ({ text: 'x' + n, qty: 1, unit: 'g' })) }), m2 = mini([], [few]);
    m2.api.openShop(few); expect(m2.els.shopPreview.style.maxHeight).toBe('');
  });
  it('adding from the shop window puts the scaled ingredients on the list and says so; undo removes them', () => {
    const m = mini([], [rcp()]);
    m.api.openShop(m.recipes[0]); m.els.shopPortions.value = '8'; m.els.shopForm.fire('submit');
    expect(m.items.map((x: any) => [x.text, x.qty])).toEqual([['flour', 400], ['egg', 4]]);   // the tsp salt was not ticked
    expect(m.els.dlgShop.open).toBe(false); expect(m.toasts[0][0]).toBe('Ingredients for Pasta added to list');
    m.undo(); expect(m.items.length).toBe(0);
  });
  it('the shop window does nothing with 0 portions or when nothing is ticked', () => {
    const m = mini([], [rcp()]);
    m.api.openShop(m.recipes[0]); m.els.shopPortions.value = '0'; m.els.shopForm.fire('submit'); expect(m.items.length).toBe(0); expect(m.els.dlgShop.open).toBe(true);
    m.els.shopPortions.value = '4'; for (let i = 0; i < 3; i++) row(m, i).children[0].checked = false; m.els.shopForm.fire('submit'); expect(m.items.length).toBe(0);
  });
  it('an ingredient needs a name, a positive amount and a unit; a good one is added to the recipe and the window closes', () => {
    const m = mini([], [rcp()]), r = m.recipes[0];
    m.api.openIngredient(r); expect(m.els.ingPortionsInfo.textContent).toBe('up to 4 portions');
    m.els.ingName.value = ' honey '; m.els.ingQty.value = '0'; m.els.ingUnit.value = 'g'; m.els.ingForm.fire('submit'); expect(r.items.length).toBe(3);
    m.els.ingQty.value = '2'; m.els.ingUnit.value = ''; m.els.ingForm.fire('submit'); expect(r.items.length).toBe(3);
    m.els.ingUnit.value = 'tbsp'; m.els.ingBrand.value = ' Bee '; m.els.ingCat.value = 'Pantry'; m.els.ingForm.fire('submit');
    expect(r.items[3]).toEqual({ text: 'honey', qty: 2, unit: 'tbsp', brand: 'Bee', cat: 'Pantry' });
    expect(m.els.dlg.open).toBe(false); expect(m.els.ingName.value).toBe(''); expect(m.els.ingUnit.value).toBe('pcs');
    expect(m.toasts[0]).toEqual(['Item added. Add another?', 7000, 'Yes']); m.undo(); expect(m.els.dlg.open).toBe(true);
  });
  it('an ingredient added to a recipe that is already on the list asks about the list instead of the toast', () => {
    const m = mini([{ id: 'a', text: 'flour', qty: 1, unit: 'g', done: false, from: [{ id: 1, name: 'Pasta' }] }], [rcp()]);
    m.api.openIngredient(m.recipes[0]); m.els.ingName.value = 'honey'; m.els.ingQty.value = '1'; m.els.ingUnit.value = 'g'; m.els.ingForm.fire('submit');
    expect(m.asked.length).toBe(1); expect(m.asked[0][0]).toBe(1); expect(m.toasts.length).toBe(0);
  });
  it('the ingredient window forgets what was typed when it closes', () => {
    const m = mini([], [rcp()]);
    m.api.openIngredient(m.recipes[0]); m.els.ingName.value = 'abc'; m.els.ingQty.value = '3'; m.els.ingBrand.value = 'x'; m.els.dlg.close();
    expect([m.els.ingName.value, m.els.ingQty.value, m.els.ingBrand.value, m.els.ingUnit.value]).toEqual(['', '', '', 'pcs']);
  });
  it('renaming a recipe renames it on the list items too, and undo puts both back', () => {
    const it: any = { id: 'a', text: 'flour', qty: 1, unit: 'g', done: false, from: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Cake' }] }, m = mini([it], [rcp()]);
    m.api.openChange(m.recipes[0]); m.els.changeName.value = ' Noodles '; m.els.changePortions.value = '6'; m.els.changeForm.fire('submit');
    expect([m.recipes[0].name, m.recipes[0].portions, it.from[0].name, it.from[1].name]).toEqual(['Noodles', 6, 'Noodles', 'Cake']);
    expect(m.els.dlgChange.open).toBe(false); expect(m.toasts[0][0]).toBe('Recipe updated.');
    m.undo(); expect([m.recipes[0].name, m.recipes[0].portions, it.from[0].name]).toEqual(['Pasta', 4, 'Pasta']);
  });
  it('the change window closes without asking when nothing changed, asks when something did, and ignores an empty name or 0 portions', () => {
    const m = mini([], [rcp()]);
    m.api.openChange(m.recipes[0]); m.api.requestCloseChange(); expect(m.els.dlgChange.open).toBe(false); expect(m.askedDiscard()).toBe(false);
    m.api.openChange(m.recipes[0]); m.els.changeName.value = 'Other'; m.api.requestCloseChange(); expect(m.els.dlgChange.open).toBe(true); expect(m.askedDiscard()).toBe(true);
    m.els.changeName.value = ' Pasta '; m.els.changePortions.value = '4'; m.els.changeForm.fire('submit'); expect(m.els.dlgChange.open).toBe(false); expect(m.toasts.length).toBe(0);
    m.api.openChange(m.recipes[0]); m.els.changeName.value = '  '; m.els.changeForm.fire('submit'); expect(m.els.dlgChange.open).toBe(true);
    m.els.changeName.value = 'A'; m.els.changePortions.value = '0'; m.els.changeForm.fire('submit'); expect(m.els.dlgChange.open).toBe(true);
  });
  it('a recipe with no portions is shown with 4 in the change window', () => {
    const m = mini([], [rcp({ portions: 0 })]);
    m.api.openChange(m.recipes[0]); expect(m.els.changePortions.value).toBe('4'); m.api.requestCloseChange(); expect(m.askedDiscard()).toBe(false);
  });
});
