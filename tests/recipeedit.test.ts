import { describe, it, expect, afterEach } from 'vitest';
import * as store from '../src/store';
import { createRecipeEdit } from '../src/recipeedit';
import { makeOldRecipeEdit } from './reference/oldRecipeEdit';
import { rng, El } from './helpers/fakepage';

const g = globalThis as any;
afterEach(() => { delete g.document; delete g.window; });

const IDS = ['dlgRecipeEdit', 'reName', 'reQty', 'reUnit', 'reCat', 'reBrand', 'suggestRE', 'reRecipe', 'reRecipePortions', 'recipeEditClose', 'recipeEditForm',
  'dlgRenUnl', 'renCard', 'renItems', 'renMsg', 'renYes', 'renKeep', 'renCancel'];
const NAMES = ['milk', 'eggs', 'flour', 'tea'], UNITS = ['pcs', 'g', 'kg'], CATS = ['Dairy', 'Bakery', 'Spices'];

interface Sp { items: any[]; recipes: any[]; ops: Op[] }
type Op = { k: string; i: number; j: number; b: boolean; v: string };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const recipes = [1, 2, 3].map((id) => ({ id, name: 'R' + id, portions: pick([0, 1, 2, 4]),
    items: Array.from({ length: pick([1, 2, 3, 4]) }, () => { const it: any = { text: pick(NAMES), qty: pick([0, .5, 1, 2, 3.5]), unit: pick(UNITS) }; if (rand() < .3) it.brand = 'Arla'; if (rand() < .4) it.cat = pick(CATS); return it; }) }));
  // list items are made from recipe ingredients, so that names and units match and renames really find them
  const items: any[] = [];
  for (let n = 0, m = pick([0, 1, 2, 3, 4, 5]); n < m; n++) {
    const r = pick(recipes), src = pick(r.items);
    const it: any = { id: 'i' + n, text: rand() < .15 ? src.text.toUpperCase() : src.text, qty: pick([1, 2, 3]), unit: rand() < .8 ? src.unit : pick(UNITS), done: rand() < .1 };
    if (src.brand && rand() < .8) it.brand = src.brand;
    if (rand() < .4) it.cat = pick(CATS);
    const kind = pick(['plain', 'linked', 'linked', 'unlinked', 'unlinked', 'manual', 'multi', 'umulti']);
    if (kind !== 'plain') it.from = [{ id: r.id, name: r.name, rp: 4, sp: pick([0, 2, 4]) }];
    if (kind === 'multi' || kind === 'umulti') it.from.push({ id: pick([1, 2, 3]) === r.id ? 9 : 2, name: 'Other', rp: 4, sp: 4 });
    if (kind === 'unlinked' || kind === 'manual' || kind === 'umulti') it.unlinked = true;
    if (kind === 'manual') it.manual = true;
    if ((kind === 'unlinked' || kind === 'manual' || kind === 'umulti') && rand() < .7) { it.orig = { qty: pick([1, 2, 5]), unit: pick(UNITS) }; if (rand() < .7) it.orig.text = rand() < .8 ? src.text : 'milk'; if (rand() < .3) it.orig.brand = 'Arla'; }
    items.push(it);
  }
  // twins: several un-linked items from one recipe alone with the same name, so the rename window lists more than one
  if (rand() < .5) { const r = pick(recipes), src = pick(r.items); for (let n = 0, m = 2 + Math.floor(rand() * 2); n < m; n++) { const it: any = { id: 't' + n, text: src.text, qty: pick([1, 2]), unit: src.unit, done: false, from: [{ id: r.id, name: r.name, rp: 4, sp: 4 }], unlinked: true }; if (src.brand) it.brand = src.brand; if (rand() < .5) it.orig = { qty: 3, unit: src.unit, text: src.text }; items.push(it); } }
  const op = (k: string): Op => ({ k, i: Math.floor(rand() * 9), j: Math.floor(rand() * 7), b: rand() < .5, v: pick(['name', 'qty', 'unit', 'cat', 'brand']) });
  const flow = (): Op[] => {
    const f = pick(['rename', 'rename', 'rename', 'amount', 'cat', 'nochange', 'dirtyClose', 'cleanClose', 'invalid', 'backdrop']);
    const tail = (): Op[] => [...pick<Op[]>([[], [], [op('renYes')], [op('renKeep')], [op('renCancel')], [op('renBackdrop')], [op('renEsc')]]), ...(rand() < .5 ? [op('undoToast')] : [])];
    const fill = (v: string, j: number): Op => ({ ...op('fill'), v, j });
    if (f === 'rename') return [op('open'), fill('name', pick([2, 3, 4, 5])), ...(rand() < .4 ? [fill('brand', pick([0, 0, 1, 2, 3]))] : []), op('submit'), ...tail()];
    if (f === 'amount') return [op('open'), fill(pick(['qty', 'unit']), pick([3, 4, 6, 1, 2])), ...(rand() < .3 ? [fill('name', 3)] : []), op('submit'), ...tail()];
    if (f === 'cat') return [op('open'), fill('cat', pick([0, 2, 3])), op('submit'), ...tail()];
    if (f === 'nochange') return [op('open'), ...(rand() < .5 ? [fill('name', 0), fill('qty', 3)] : []), op('submit'), ...tail()];
    if (f === 'dirtyClose') return [op('open'), fill(pick(['name', 'qty', 'unit', 'cat', 'brand']), pick([1, 2, 3, 4])), ...pick<Op[]>([[op('closeX')], [op('requestClose')], [op('backdrop')], [op('esc')]]), ...(rand() < .7 ? [op('confirmDiscard')] : [])];
    if (f === 'cleanClose') return [op('open'), ...(rand() < .5 ? [fill('name', 1), fill('name', 0)] : []), ...pick<Op[]>([[op('closeX')], [op('requestClose')], [op('backdrop')]])];
    if (f === 'invalid') return [op('open'), fill(pick(['name', 'qty', 'unit']), pick([0, 1, 5])), op('submit')];
    return [op('open'), op('backdrop'), op('open'), op('dismiss'), op('closeX'), op('dismiss'), op('closeX')];
  };
  const single = () => op(pick(['open', 'fill', 'submit', 'closeX', 'backdrop', 'requestClose', 'confirmDiscard', 'undoToast', 'renYes', 'renKeep', 'renCancel', 'renBackdrop', 'esc', 'renEsc', 'dismiss', 'reset']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 5); s < n; s++) { if (rand() < .7) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { items, recipes, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [];
  store.setList('items', JSON.parse(JSON.stringify(sp.items)));
  const items = store.items;
  const recipes: any[] = JSON.parse(JSON.stringify(sp.recipes));
  let created = 0, lastUndo: (() => void) | null = null, pendingDiscard: (() => void) | null = null;
  const els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    createElement: (tag: string) => { const e = new El(log, tag + '#' + (++created)); log.push('create ' + e.id); return e; },
    createDocumentFragment: () => { const e = new El(log, 'frag#' + (++created)); log.push('create ' + e.id); return e; },
    createTextNode: (t: string) => { const e = new El(log, 'text#' + (++created)); log.push('text ' + e.id + ' ' + t); return e; },
  };
  g.window = {};
  const env = {
    items, unitHTML: 'U', COOK_HTML: 'C',
    save: () => log.push('save ' + JSON.stringify(items)), saveR: () => log.push('saveR ' + JSON.stringify(recipes)), render: () => log.push('render'), renderRecipes: () => log.push('renderRecipes'),
    recordHistory: (e: unknown) => log.push('history ' + JSON.stringify(e)), dismissSearch: () => log.push('dismissSearch'),
    openDiscard: (then: () => void) => { log.push('openDiscard'); pendingDiscard = then; },
    ensureOpt: (sel: El, v: unknown) => log.push('ensureOpt ' + sel.id + ' ' + v),
    makeSuggest: (inp: El, box: El, u: El, q: El, c: El) => { log.push('makeSuggest ' + [inp, box, u, q, c].map((x) => x.id).join(' ')); return { hide: () => log.push('suggest.hide') }; },
    recipeCardEl: (f: unknown) => { log.push('recipeCardEl ' + JSON.stringify(f)); return new El(log, 'card#' + (++created)); },
    showToast: (msg: string, undo?: () => void, ms?: number, label?: string) => { log.push('toast ' + msg + ' ' + ms + ' ' + label); lastUndo = undo || null; },
  };
  const api: any = impl === 'old' ? makeOldRecipeEdit(env) : createRecipeEdit(env as any);
  let cur: any = null, guardHit = false;
  const snap = () => JSON.stringify([items, recipes, ['dlgRecipeEdit', 'dlgRenUnl'].map((i) => els[i].open), els.reName.value, els.reQty.value, els.reUnit.value, els.reCat.value, els.reBrand.value, els.renMsg.textContent, els.renItems.children.length]);
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.i + ' ' + o.j + ' ' + o.v);
    try {
      switch (o.k) {
        case 'open': { const r = recipes[o.i % recipes.length]; cur = r.items[o.j % r.items.length]; api.openRecipeEdit(r, cur); break; }
        case 'fill': { if (!cur) break; const c = cur;
          if (o.v === 'name') els.reName.value = [c.text, ' ' + c.text + ' ', 'milk', 'eggs', ' ', c.text.toUpperCase(), 'x'][o.j];
          else if (o.v === 'brand') els.reBrand.value = ['', c.brand || '', ' Arla ', 'Alpro', ' ', 'x', 'y'][o.j];
          else if (o.v === 'qty') els.reQty.value = ['', '0', '-1', String(c.qty), String(c.qty + 1), 'x', '1.5'][o.j];
          else if (o.v === 'unit') els.reUnit.value = ['', c.unit, 'g', 'kg', 'pcs', 'tbsp', 'l'][o.j];
          else els.reCat.value = ['', c.cat || '', 'Dairy', 'Bakery', 'Spices', 'x', 'y'][o.j];
          break; }
        case 'reset': if (cur) { els.reName.value = cur.text; els.reBrand.value = cur.brand || ''; els.reQty.value = cur.qty; els.reUnit.value = cur.unit; els.reCat.value = cur.cat || ''; } break;
        case 'submit': els.recipeEditForm.fire('submit'); break;
        case 'closeX': if (els.dlgRecipeEdit._closing && els.dlgRecipeEdit.open) guardHit = true; els.recipeEditClose.fire('click'); break;
        case 'backdrop': els.dlgRecipeEdit.fire('click', { target: o.b ? els.dlgRecipeEdit : els.reName }); break;
        case 'requestClose': if (els.dlgRecipeEdit._closing && els.dlgRecipeEdit.open) guardHit = true; api.requestCloseRE(); break;
        case 'esc': els.dlgRecipeEdit.close(); break;
        case 'dismiss': els.dlgRecipeEdit._closing = o.b; break;
        case 'confirmDiscard': { const f = pendingDiscard; pendingDiscard = null; if (f) f(); break; }
        case 'undoToast': { const f = lastUndo; lastUndo = null; if (f) f(); break; }
        case 'renYes': els.renYes.fire('click'); break;
        case 'renKeep': els.renKeep.fire('click'); break;
        case 'renCancel': els.renCancel.fire('click'); break;
        case 'renBackdrop': els.dlgRenUnl.fire('click', { target: o.b ? els.dlgRenUnl : els.renItems }); break;
        case 'renEsc': els.dlgRenUnl.close(); break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  const txt = log.join('\n');
  if (count) {
    if (/dlgRecipeEdit\.showModal/.test(txt)) hit('edit window');
    if (/dlgRenUnl\.showModal/.test(txt)) hit('rename window');
    if (/These items are/.test(txt)) hit('several candidates');
    if (/This item is/.test(txt)) hit('one candidate');
    if (/restored as well/.test(txt)) hit('restore note');
    if (/toast Item updated\. undefined undefined/.test(txt)) hit('item updated');
    if (/-- renYes [^\n]*\n(?:(?!state)[^\n]*\n)*?toast Item updated/.test(txt)) hit('re-linked');
    if (/-- renKeep [^\n]*\n(?:(?!state)[^\n]*\n)*?toast Item updated/.test(txt)) hit('kept un-linked');
    if (/-- renCancel/.test(txt) && /dlgRenUnl\.close/.test(txt)) hit('rename cancelled');
    if (/-- renBackdrop 0 0 \w+\n(.*\n)*?.*dlgRenUnl\.close/.test(txt)) hit('rename backdrop');
    if (/-- undoToast [^\n]*\n(?:(?!state)[^\n]*\n)*?saveR/.test(txt)) hit('undo');
    if (/openDiscard/.test(txt)) hit('discard asked');
    if (/-- confirmDiscard [^\n]*\n(?:(?!state)[^\n]*\n)*?dlgRecipeEdit\.close/.test(txt)) hit('discard confirmed');
    if (/"unlinked":true/.test(txt) && /-- submit/.test(txt)) hit('unlinked items');
    if (/"orig":\{[^}]*"text"/.test(txt)) hit('orig with text');
    if (/threw/.test(txt)) hit('threw');
    if (guardHit) hit('closing guard');
    if (/-- submit[\s\S]{0,60}\nstate/.test(txt)) hit('submit without change');
    if (/history \[\{"text":[^\n]*"cat":"Dairy"/.test(txt)) hit('category history');
  }
  return { log, items: JSON.parse(JSON.stringify(items)), recipes };
}

describe('the recipe Edit item window (new recipeedit.ts vs the old code from app.js)', () => {
  it('behaves exactly like the old code in 2500 random sessions (renames, amounts, un-linking, re-linking, undo, closing)', () => {
    const rand = rng(1066);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 2500; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['edit window', 'rename window', 'several candidates', 'one candidate', 'restore note', 'item updated', 're-linked', 'kept un-linked', 'rename cancelled', 'undo', 'discard asked', 'discard confirmed', 'unlinked items', 'orig with text', 'closing guard', 'submit without change', 'category history']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 180000);
});

// ---- the same windows, with the expected behaviour written out (no old code involved) ----
function mini(itemsIn: any[], recipesIn: any[]) {
  const log: string[] = [], els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  store.setList('items', itemsIn);
  const items = store.items, recipes = recipesIn;
  let created = 0, undo: (() => void) | null = null, discard: (() => void) | null = null;
  const toasts: any[] = [], hist: any[] = [], cards: any[] = [];
  g.document = { getElementById: (id: string) => els[id] ?? null, createElement: (t: string) => new El(log, t + '#' + (++created)), createDocumentFragment: () => new El(log, 'frag#' + (++created)), createTextNode: () => new El(log, 'text#' + (++created)) };
  g.window = {};
  let saves = 0, saveRs = 0;
  const api = createRecipeEdit({
    items, unitHTML: 'U', COOK_HTML: 'C',
    save: () => { saves++; }, saveR: () => { saveRs++; }, render: () => { }, renderRecipes: () => { }, recordHistory: (e) => { hist.push(e); }, dismissSearch: () => { },
    openDiscard: (then) => { discard = then; }, ensureOpt: () => { }, makeSuggest: () => ({ hide() { } }), recipeCardEl: (f) => { cards.push(f); return new El(log, 'card'); },
    showToast: (m, u) => { toasts.push(m); undo = u || null; },
  } as any);
  return { els, api, items, recipes, toasts, hist, cards, get saves() { return saves; }, get saveRs() { return saveRs; }, undo: () => { const f = undo; undo = null; f!(); }, discard: () => discard!, asked: () => discard !== null,
    edit(r: any, it: any, f: Record<string, string>) { api.openRecipeEdit(r, it); for (const k of Object.keys(f)) (els as any)[k].value = f[k]; els.recipeEditForm.fire('submit'); } };
}
const rec = () => ({ id: 1, name: 'Pasta', portions: 4, items: [{ text: 'flour', qty: 200, unit: 'g' }, { text: 'egg', qty: 2, unit: 'pcs' }] });
const lnk = (extra: any = {}) => ({ id: 'a', text: 'flour', qty: 200, unit: 'g', done: false, from: [{ id: 1, name: 'Pasta', rp: 4, sp: 4 }], ...extra });

describe('the recipe Edit item window, behaviour', () => {
  it('opens filled with the ingredient, its portions text and the unit and category lists', () => {
    const r = rec(); r.items[0] = { text: 'flour', qty: 200, unit: 'g', brand: 'Kung', cat: 'Bakery' } as any;
    const m = mini([], [r]); m.api.openRecipeEdit(r, r.items[0]);
    expect([m.els.reName.value, m.els.reBrand.value, m.els.reQty.value, m.els.reUnit.value, m.els.reCat.value]).toEqual(['flour', 'Kung', '200', 'g', 'Bakery']);
    expect([m.els.reRecipe.textContent, m.els.reRecipePortions.textContent, m.els.dlgRecipeEdit.open]).toEqual(['Pasta', 'up to 4 portions', true]);
    expect(m.els.reUnit.innerHTML).toBe('UC');
    const one = { ...rec(), portions: 1 }; m.api.openRecipeEdit(one, one.items[0]); expect(m.els.reRecipePortions.textContent).toBe('up to 1 portion');
  });
  it('a rename follows into linked items from this recipe alone and stays linked; undo puts everything back', () => {
    const a = lnk({ brand: 'Kung' }), m = mini([a], [rec()]), r = m.recipes[0], it = r.items[0]; (it as any).brand = 'Kung';
    m.edit(r, it, { reName: ' Flour ', reBrand: '' });
    expect([it.text, 'brand' in it, a.text, 'brand' in a, a.unlinked]).toEqual(['Flour', false, 'Flour', false, undefined]);
    expect(m.els.dlgRecipeEdit.open).toBe(false); expect(m.toasts).toEqual(['Item updated.']); expect(m.hist).toEqual([[{ text: 'Flour', unit: 'g', cat: '' }]]);
    m.undo(); expect([it.text, a.text, a.brand, a.unlinked]).toEqual(['flour', 'flour', 'Kung', undefined]);
  });
  it('a change of amount or unit un-links the matching items without renaming them; a linked item from two recipes is un-linked even by a rename', () => {
    const a = lnk(), m = mini([a], [rec()]), r = m.recipes[0], it = r.items[0];
    m.edit(r, it, { reQty: '250' }); expect([it.qty, a.qty, a.unlinked, a.text]).toEqual([250, 200, true, 'flour']);
    m.undo(); expect([it.qty, a.unlinked]).toEqual([200, undefined]);
    const two = lnk({ from: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Cake' }] }), m2 = mini([two], [rec()]);
    m2.edit(m2.recipes[0], m2.recipes[0].items[0], { reName: 'Rye' }); expect([two.text, two.unlinked]).toEqual(['flour', true]);
  });
  it('items with another unit, another name, ticked-off recipe links of other recipes or un-linked ones are left alone', () => {
    const items = [lnk({ id: 'u', unit: 'kg' }), lnk({ id: 'n', text: 'sugar' }), lnk({ id: 'o', from: [{ id: 2, name: 'Cake' }] }), lnk({ id: 'x', unlinked: true, manual: true })];
    const m = mini(items, [rec()]), r = m.recipes[0]; m.edit(r, r.items[0], { reQty: '300' });
    expect(items.map((x: any) => x.unlinked)).toEqual([undefined, undefined, undefined, true]);
  });
  it('a change of category alone only changes the recipe item and says so; no change closes without a toast', () => {
    const a = lnk(), m = mini([a], [rec()]), r = m.recipes[0], it = r.items[0];
    m.edit(r, it, { reCat: 'Bakery' }); expect([it.cat, a.unlinked, m.toasts.length]).toEqual(['Bakery', undefined, 1]);
    const m2 = mini([], [rec()]); m2.edit(m2.recipes[0], m2.recipes[0].items[0], {}); expect([m2.els.dlgRecipeEdit.open, m2.toasts.length, m2.saves]).toEqual([false, 0, 0]);
  });
  it('needs a name, a positive amount and a unit', () => {
    const m = mini([], [rec()]), r = m.recipes[0];
    for (const f of [{ reName: '  ' }, { reQty: '0' }, { reQty: '-1' }, { reQty: 'x' }, { reUnit: '' }]) { m.edit(r, r.items[0], f); expect([m.els.dlgRecipeEdit.open, m.toasts.length, r.items[0].text]).toEqual([true, 0, 'flour']); }
  });
  it('an un-linked item from this recipe alone is offered the rename, and Yes links it again with its original amount', () => {
    const u = lnk({ unlinked: true, qty: 5, unit: 'kg', orig: { qty: 200, unit: 'g', text: 'flour' } }), m = mini([u], [rec()]), r = m.recipes[0], it = r.items[0];
    m.edit(r, it, { reName: 'Rye' });
    expect(m.els.dlgRenUnl.open).toBe(true); expect(it.text).toBe('flour'); expect(m.cards).toEqual([{ id: 1, name: 'Pasta' }]);
    expect(m.els.renMsg.textContent).toBe('You renamed this ingredient in the recipe. This item is un-linked from it. Letting it be renamed will link it to the recipe again. The original quantity and unit are restored as well.');
    expect(m.els.renItems.children.length).toBe(1);
    m.els.renYes.fire('click');
    expect([m.els.dlgRenUnl.open, m.els.dlgRecipeEdit.open, it.text, u.text, u.qty, u.unit, 'unlinked' in u, 'orig' in u]).toEqual([false, false, 'Rye', 'Rye', 200, 'g', false, false]);
    m.undo(); expect([it.text, u.text, u.qty, u.unit, u.unlinked, u.orig]).toEqual(['flour', 'flour', 5, 'kg', true, { qty: 200, unit: 'g', text: 'flour' }]);
  });
  it('Keep leaves the un-linked item as it is (but brings the name it will return to up to date); Cancel and a backdrop click change nothing', () => {
    const mk = () => lnk({ unlinked: true, orig: { qty: 200, unit: 'g', text: 'flour' } });
    const u = mk(), m = mini([u], [rec()]), r = m.recipes[0]; m.edit(r, r.items[0], { reName: 'Rye' });
    m.els.renKeep.fire('click'); expect([r.items[0].text, u.text, u.unlinked, u.orig]).toEqual(['Rye', 'flour', true, { qty: 200, unit: 'g', text: 'Rye' }]);
    for (const how of ['renCancel', 'backdrop', 'esc']) {
      const u2 = mk(), m2 = mini([u2], [rec()]), r2 = m2.recipes[0]; m2.edit(r2, r2.items[0], { reName: 'Rye' });
      if (how === 'renCancel') m2.els.renCancel.fire('click'); else if (how === 'backdrop') m2.els.dlgRenUnl.fire('click'); else m2.els.dlgRenUnl.close();
      expect([how, m2.els.dlgRenUnl.open, r2.items[0].text, u2.text, m2.saves, m2.els.dlgRecipeEdit.open]).toEqual([how, false, 'flour', 'flour', 0, true]);
      m2.els.renYes.fire('click'); expect([how, r2.items[0].text, m2.saves]).toEqual([how, 'flour', 0]);   // after closing, a stray Yes does nothing
    }
  });
  it('the rename window says "These items are" for several, and does not mention restoring when no amount was remembered', () => {
    const m = mini([lnk({ id: 'a', unlinked: true }), lnk({ id: 'b', unlinked: true })], [rec()]), r = m.recipes[0]; m.edit(r, r.items[0], { reName: 'Rye' });
    expect(m.els.renMsg.textContent).toBe('You renamed this ingredient in the recipe. These items are un-linked from it. Letting them be renamed will link them to the recipe again.');
  });
  it('closing asks first only when something was typed, and not at all while the window is already closing', () => {
    const m = mini([], [rec()]), r = m.recipes[0];
    m.api.openRecipeEdit(r, r.items[0]); m.els.recipeEditClose.fire('click'); expect([m.els.dlgRecipeEdit.open, m.asked()]).toEqual([false, false]);
    m.api.openRecipeEdit(r, r.items[0]); m.els.reQty.value = '201'; m.api.requestCloseRE(); expect([m.els.dlgRecipeEdit.open, m.asked()]).toEqual([true, true]);
    m.discard()(); expect(m.els.dlgRecipeEdit.open).toBe(false);
    m.api.openRecipeEdit(r, r.items[0]); m.els.reCat.value = 'Dairy'; m.els.dlgRecipeEdit._closing = true; m.api.requestCloseRE(); expect(m.els.dlgRecipeEdit.open).toBe(true);
    m.els.dlgRecipeEdit._closing = false; m.els.dlgRecipeEdit.fire('click', { target: m.els.reName }); expect(m.els.dlgRecipeEdit.open).toBe(true);
    m.els.reCat.value = ''; m.els.dlgRecipeEdit.fire('click'); expect(m.els.dlgRecipeEdit.open).toBe(false);
  });
  it('typing nothing into the amount of an ingredient that has none (0) is not a change', () => {
    const r = { ...rec(), items: [{ text: 'salt', qty: 0, unit: 'g' }] }, m = mini([], [r]);
    m.api.openRecipeEdit(r, r.items[0]); m.els.reQty.value = ''; m.api.requestCloseRE(); expect([m.els.dlgRecipeEdit.open, m.asked()]).toEqual([false, false]);
    m.api.openRecipeEdit(r, r.items[0]); m.els.reQty.value = '1'; m.api.requestCloseRE(); expect(m.asked()).toBe(true);
  });
  it('re-linking an item that has a brand, when the new name has none, takes the brand away; undo gives it back', () => {
    const r = rec(); (r.items[0] as any).brand = 'Kung';
    const u = lnk({ unlinked: true, brand: 'Kung', orig: { qty: 200, unit: 'g', text: 'flour', brand: 'Kung' } }), m = mini([u], [r]);
    m.edit(r, r.items[0], { reName: 'Rye', reBrand: '' }); m.els.renYes.fire('click');
    expect([u.text, 'brand' in u, 'orig' in u, 'unlinked' in u]).toEqual(['Rye', false, false, false]);
    m.undo(); expect([u.text, u.brand, u.unlinked, u.orig]).toEqual(['flour', 'Kung', true, { qty: 200, unit: 'g', text: 'flour', brand: 'Kung' }]);
  });
  it('Keep updates the name that un-linked items will return to, but only for items of this recipe alone and not for by-hand items', () => {
    const mk = (extra: any) => lnk({ unlinked: true, orig: { qty: 200, unit: 'g', text: 'flour' }, ...extra });
    const solo = mk({ id: 's' }), manual = mk({ id: 'm', manual: true }), two = mk({ id: 't', from: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Cake' }] });
    const other = mk({ id: 'o', from: [{ id: 2, name: 'Cake' }] }), noText = mk({ id: 'n', orig: { qty: 200, unit: 'g' } }), oldName = mk({ id: 'w', orig: { qty: 200, unit: 'g', text: 'sugar' } });
    const m = mini([solo, manual, two, other, noText, oldName], [rec()]), r = m.recipes[0];
    m.edit(r, r.items[0], { reName: 'Rye', reBrand: ' Bee ' }); m.els.renKeep.fire('click');
    expect(solo.orig).toEqual({ qty: 200, unit: 'g', text: 'Rye', brand: 'Bee' });
    expect([manual.orig!.text, two.orig!.text, other.orig!.text, noText.orig!.text, oldName.orig!.text]).toEqual(['flour', 'flour', 'flour', undefined, 'sugar']);
  });
  it('a second click on Yes while the window is still closing does not commit twice', () => {
    const u = lnk({ unlinked: true, orig: { qty: 200, unit: 'g', text: 'flour' } }), m = mini([u], [rec()]), r = m.recipes[0];
    m.edit(r, r.items[0], { reName: 'Rye' }); m.els.dlgRenUnl.close = () => { };   // in a browser the close event comes a moment later
    m.els.renYes.fire('click'); m.els.renYes.fire('click'); m.els.renKeep.fire('click');
    expect(m.toasts).toEqual(['Item updated.']); expect(m.hist.length).toBe(1);
  });
});
