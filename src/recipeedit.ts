// The Recipes view's "Edit item" window (the pencil on an ingredient) and the small "Rename in the Shopping list?" window that can
// follow it. The window code is the code that used to be in app.js (step 1c-6a); only the typing is new.
//
// A rename in the recipe follows into the Shopping list: linked items from this recipe only are renamed and stay linked.
// Un-linked items from this recipe only are offered the same rename (which also links them again) in a window of their own.
import { CAT_HTML } from './categories';
import { unitLabel } from './units';
import { nameFrag } from './ui';
import type { Item, Recipe, RecipeItem, RecipeSource } from './types';

/** What the windows need from the app. */
export interface RecipeEditCtx {
  /** The Shopping list; it is only ever changed in place, so it can be passed directly. */
  readonly items: Item[];
  dismissSearch(): void;
  recordHistory(entries: { text: string; unit: string; cat?: string }[]): void;
  save(): void;
  saveR(): void;
  render(): void;
  renderRecipes(): void;
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void;
  /** Asks "Discard changes?"; `then` runs when it is confirmed. */
  openDiscard(then: () => void): void;
  ensureOpt(sel: HTMLSelectElement, v: unknown): void;
  makeSuggest(inp: HTMLInputElement, box: HTMLElement, unitSel: unknown, qtySel: { value: unknown; focus?: () => void }, catSel: { value: string } | null): { hide: () => void };
  recipeCardEl(f: RecipeSource): HTMLElement;
  /** The unit list of the Add item window, and the cooking units that follow it. */
  readonly unitHTML: string;
  readonly COOK_HTML: string;
}

export interface RecipeEdit {
  openRecipeEdit(r: Recipe, it: RecipeItem): void;
  /** What Esc / a swipe down runs for the Edit item window: ask first when something was typed. */
  requestCloseRE(): void;
}

type Dlg = HTMLDialogElement & { _closing?: boolean };
interface Prev { text: string; qty: number; unit: string; cat?: string; brand?: string }
/** Everything the rename step needs once the form has been checked. */
interface Commit {
  r: Recipe; it: RecipeItem; t: string; qty: number; unit: string; cat: string; brand: string;
  prev: Prev; hit: Item[]; cands: Item[]; renamed: boolean; amtChg: boolean;
}
interface Snap { x: Item; text: string; brand?: string; qty: number; unit: string; unlinked?: boolean; orig?: Item['orig'] }

export function createRecipeEdit(ctx: RecipeEditCtx): RecipeEdit {
  const items = ctx.items;
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };

  const dlgRE = el('dlgRecipeEdit') as Dlg,
    reName = el('reName') as HTMLInputElement,
    reQty = el('reQty') as HTMLInputElement,
    reUnit = el('reUnit') as HTMLSelectElement,
    reCat = el('reCat') as HTMLSelectElement,
    reBrand = el('reBrand') as HTMLInputElement;
  let reTarget: { r: Recipe; it: RecipeItem } | null = null;
  reUnit.innerHTML = ctx.unitHTML + ctx.COOK_HTML;
  reCat.innerHTML = CAT_HTML;
  const reSuggest = ctx.makeSuggest(reName, el('suggestRE'), reUnit, reQty, reCat);
  dlgRE.addEventListener('close', reSuggest.hide);
  function openRecipeEdit(r: Recipe, it: RecipeItem): void {
    reTarget = { r: r, it: it };
    el('reRecipe').textContent = r.name;
    el('reRecipePortions').textContent = 'up to ' + r.portions + (r.portions === 1 ? ' portion' : ' portions');
    reName.value = it.text; reBrand.value = it.brand || '';
    ctx.ensureOpt(reUnit, it.unit);
    reQty.value = String(it.qty);
    reUnit.value = it.unit;
    reCat.value = it.cat || '';
    dlgRE.showModal();
    dlgRE.setAttribute('tabindex', '-1');
    dlgRE.focus({ preventScroll: true });
  }
  function reDirty(): boolean {
    const t = reTarget && reTarget.it;
    return !!t && (reName.value.trim() !== t.text || reBrand.value.trim() !== (t.brand || '') || (parseFloat(reQty.value) || 0) !== (t.qty || 0) || reUnit.value !== (t.unit || '') || reCat.value !== (t.cat || ''));
  }
  function requestCloseRE(): void {
    if (dlgRE._closing) return;
    if (reDirty()) { ctx.openDiscard(function () { dlgRE.close(); }); }
    else dlgRE.close();
  }
  el('recipeEditClose').addEventListener('click', requestCloseRE);
  dlgRE.addEventListener('click', function (ev) { if (ev.target === dlgRE) requestCloseRE(); });

  const dlgRenUnl = el('dlgRenUnl') as HTMLDialogElement;
  let renCtx: Commit | null = null;
  function commitRecipeEdit(c: Commit, relinkCands: boolean): void {
    const r = c.r, it = c.it, prev = c.prev, snaps: Snap[] = [];
    ctx.dismissSearch();
    function snap(x: Item): void { snaps.push({ x: x, text: x.text, brand: x.brand, qty: x.qty, unit: x.unit, unlinked: x.unlinked, orig: x.orig ? Object.assign({}, x.orig) : undefined }); }
    it.text = c.t; it.qty = c.qty; it.unit = c.unit;
    if (c.brand) it.brand = c.brand; else delete it.brand;
    if (c.cat) it.cat = c.cat; else delete it.cat;
    ctx.recordHistory([{ text: c.t, unit: c.unit, cat: c.cat }]);
    c.hit.forEach(function (x) {
      snap(x);
      const follow = c.renamed && (x.from as RecipeSource[]).length === 1;
      if (follow) { x.text = c.t; if (c.brand) x.brand = c.brand; else delete x.brand; }
      if (!follow || c.amtChg) x.unlinked = true;
    });
    if (relinkCands) c.cands.forEach(function (x) {
      snap(x);
      x.text = c.t; if (c.brand) x.brand = c.brand; else delete x.brand;
      if (x.orig) { x.qty = x.orig.qty; x.unit = x.orig.unit; }
      delete x.unlinked; delete x.orig;
    });
    // un-linked items from this recipe remember the name they will return to on re-linking: bring it up to date
    if (c.renamed) items.forEach(function (x) {
      if (!x.unlinked || x.manual || !x.orig || x.orig.text === undefined || !x.from || x.from.length !== 1 || x.from[0].id !== r.id) return;
      if (x.orig.text.toLowerCase() !== prev.text.toLowerCase() || (x.orig.brand || '').toLowerCase() !== (prev.brand || '').toLowerCase()) return;
      snap(x);
      const o: Item['orig'] = { qty: x.orig.qty, unit: x.orig.unit, text: c.t };
      if (c.brand) (o as { brand?: string }).brand = c.brand;
      x.orig = o;
    });
    ctx.saveR(); ctx.save(); ctx.renderRecipes(); ctx.render();
    dlgRE.close();
    ctx.showToast('Item updated.', function () {
      it.text = prev.text; it.qty = prev.qty; it.unit = prev.unit;
      if (prev.brand) it.brand = prev.brand; else delete it.brand;
      if (prev.cat) it.cat = prev.cat; else delete it.cat;
      snaps.forEach(function (s) {
        const x = s.x; x.text = s.text; x.qty = s.qty; x.unit = s.unit;
        if (s.brand) x.brand = s.brand; else delete x.brand;
        if (s.unlinked) x.unlinked = s.unlinked; else delete x.unlinked;
        if (s.orig) x.orig = s.orig; else delete x.orig;
      });
      ctx.saveR(); ctx.save(); ctx.renderRecipes(); ctx.render();
    });
  }
  function openRenUnl(c: Commit): void {
    renCtx = c;
    const rc = el('renCard'); rc.innerHTML = '';
    rc.appendChild(ctx.recipeCardEl({ id: c.r.id, name: c.r.name }));
    const ul = el('renItems'); ul.innerHTML = '';
    c.cands.forEach(function (x) {
      const li = document.createElement('li'), span = document.createElement('span'); span.className = 'name';
      const q = document.createElement('strong'); q.className = 'qty';
      q.textContent = x.qty + '\u00a0' + unitLabel(x.qty, x.unit) + ' ';
      span.appendChild(q); span.appendChild(nameFrag(x));
      li.appendChild(span); ul.appendChild(li);
    });
    const many = c.cands.length > 1, restore = c.cands.some(function (x) { return !!x.orig; });
    el('renMsg').textContent = 'You renamed this ingredient in the recipe. ' + (many ? 'These items are' : 'This item is') + ' un-linked from it. Letting ' + (many ? 'them' : 'it') + ' be renamed will link ' + (many ? 'them' : 'it') + ' to the recipe again.' + (restore ? ' The original quantity and unit are restored as well.' : '');
    dlgRenUnl.showModal();
    dlgRenUnl.setAttribute('tabindex', '-1');
    dlgRenUnl.focus({ preventScroll: true });
  }
  function renChoose(relink: boolean): void { const c = renCtx; renCtx = null; dlgRenUnl.close(); if (c) commitRecipeEdit(c, relink); }
  el('renYes').addEventListener('click', function () { renChoose(true); });
  el('renKeep').addEventListener('click', function () { renChoose(false); });
  el('renCancel').addEventListener('click', function () { dlgRenUnl.close(); });
  dlgRenUnl.addEventListener('click', function (ev) { if (ev.target === dlgRenUnl) dlgRenUnl.close(); });
  dlgRenUnl.addEventListener('close', function () { renCtx = null; });
  el('recipeEditForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const r = (reTarget as NonNullable<typeof reTarget>).r, it = (reTarget as NonNullable<typeof reTarget>).it, t = reName.value.trim(), qty = parseFloat(reQty.value), unit = reUnit.value, cat = reCat.value, brand = reBrand.value.trim();
    if (!t || !(qty > 0) || !unit) return;
    const renamed = t !== it.text || brand !== (it.brand || ''), amtChg = qty !== it.qty || unit !== it.unit, core = renamed || amtChg;
    if (!core && cat === (it.cat || '')) { dlgRE.close(); return; }
    const prev: Prev = { text: it.text, qty: it.qty, unit: it.unit, cat: it.cat, brand: it.brand };
    function same(x: Item): boolean { return x.text.toLowerCase() === prev.text.toLowerCase() && (x.brand || '').toLowerCase() === (prev.brand || '').toLowerCase(); }
    const hit = !core ? [] : items.filter(function (x) {
      return !x.unlinked && x.unit === prev.unit && same(x) && (x.from || []).some(function (f) { return f.id === r.id; });
    });
    // un-linked items that come from this recipe alone and still carry the old name
    const cands = (renamed && !amtChg) ? items.filter(function (x) {
      return x.unlinked && !x.manual && x.from && x.from.length === 1 && x.from[0].id === r.id && same(x);
    }) : [];
    const c: Commit = { r: r, it: it, t: t, qty: qty, unit: unit, cat: cat, brand: brand, prev: prev, hit: hit, cands: cands, renamed: renamed, amtChg: amtChg };
    if (cands.length) openRenUnl(c); else commitRecipeEdit(c, false);
  });

  return { openRecipeEdit, requestCloseRE };
}
