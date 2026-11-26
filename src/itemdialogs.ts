// The four windows around one Shopping list item: Description (opens when you tap an item), Edit item (the pencil in the
// Description window), "Unlink and save?" (when an edit would change a recipe-linked amount) and Re-link (the broken chain).
// They call each other, so they live together. The window code is the code that used to be in app.js; the only thing left out is
// the Edit item window's old card slider (setupEditSlider was never called, so its clean-up never had anything to do).
import { CAT_HTML } from './categories';
import { unitLabel } from './units';
import { nameFrag, shake } from './ui';
import { isMulti } from './sorting';
import { timedConfirm } from './timedconfirm';
import { brokenLink } from './tips';
import { setupSlider } from './slider';
import type { Item, Recipe, RecipeSource } from './types';

/** What the windows need from the app: the data (as getters, because the lists get replaced) and a few helpers. */
export interface ItemDialogsCtx {
  readonly items: Item[];
  readonly recipes: Recipe[];
  save(): void;
  render(): void;
  recordHistory(entries: { text: string; unit: string; cat?: string }[]): void;
  /** Asks "Discard changes?"; `then` runs when it is confirmed. */
  openDiscard(then: () => void): void;
  ensureOpt(sel: HTMLSelectElement, v: unknown): void;
  recipeCardEl(f: RecipeSource): HTMLElement;
  makeSuggest(inp: HTMLInputElement, box: HTMLElement, unitSel: unknown, qtySel: { value: unknown; focus?: () => void }, catSel: { value: string } | null): { hide: () => void };
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void;
  /** The unit list of the Add item window, and the cooking units that follow it. */
  readonly unitHTML: string;
  readonly COOK_HTML: string;
}

export interface ItemDialogs {
  openDesc(it: Item): void;
  openRelink(it: Item, fromEdit?: boolean): void;
  openEdit(it: Item): void;
  /** What Esc / a swipe down runs for these two windows: ask first when something was typed. */
  requestCloseDesc(): void;
  requestCloseEdit(): void;
}

type Dlg = HTMLDialogElement & { _closing?: boolean };
type Slide = { ro: ResizeObserver | null } | null;
interface Pending { it: Item; t: string; qty: number; unit: string; cat: string; brand: string }

export function createItemDialogs(ctx: ItemDialogsCtx): ItemDialogs {
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };

  // ---- Edit item ----
  const dlgEdit = el('dlgEdit') as Dlg,
    editName = el('editName') as HTMLInputElement,
    editCat = el('editCat') as HTMLSelectElement;
  let editTarget: Item | null = null;
  const editBrand = el('editBrand') as HTMLInputElement;
  editCat.innerHTML = CAT_HTML;
  const editQty = el('editQty') as HTMLInputElement, editUnit = el('editUnit') as HTMLSelectElement;
  editUnit.innerHTML = ctx.unitHTML + ctx.COOK_HTML;

  let unlinkSlide: Slide = null;
  function teardownUnlinkSlider(): void {
    if (unlinkSlide && unlinkSlide.ro) unlinkSlide.ro.disconnect();
    unlinkSlide = null;
  }
  // Builds the swipeable recipe cards (and the dots when there are several) inside a container.
  function buildCardSlider(box: HTMLElement, froms: RecipeSource[]): { sl: HTMLElement; dots: HTMLElement | null } {
    box.innerHTML = '';
    const sl = document.createElement('div'), tr = document.createElement('div');
    let dots: HTMLElement | null = null;
    sl.className = 'cslider'; tr.className = 'ctrack'; sl.appendChild(tr);
    sl.setAttribute('role', 'group'); sl.setAttribute('aria-roledescription', 'carousel'); sl.setAttribute('aria-label', 'Source recipes');
    if (froms.length > 1) sl.tabIndex = 0;
    froms.forEach(function (f, fi) {
      const card = ctx.recipeCardEl(f);
      card.setAttribute('role', 'group'); card.setAttribute('aria-roledescription', 'slide'); card.setAttribute('aria-label', (fi + 1) + ' of ' + froms.length);
      tr.appendChild(card);
    });
    box.appendChild(sl);
    if (froms.length > 1) {
      dots = document.createElement('div'); dots.className = 'cdots';
      froms.forEach(function (_f, fi) {
        const d = document.createElement('button'); d.type = 'button'; d.className = 'cdot';
        d.setAttribute('aria-label', 'Show recipe ' + (fi + 1) + ' of ' + froms.length);
        (dots as HTMLElement).appendChild(d);
      });
      box.appendChild(dots);
    }
    return { sl: sl, dots: dots };
  }
  function openEdit(it: Item): void {
    editTarget = it;
    editName.value = it.text; editBrand.value = it.brand || '';
    editQty.value = it.qty ? String(it.qty) : '';
    if (it.unit) ctx.ensureOpt(editUnit, it.unit);
    editUnit.value = it.unit || '';
    editCat.value = it.cat || '';
    dlgEdit.showModal();
    dlgEdit.setAttribute('tabindex', '-1');
    dlgEdit.focus({ preventScroll: true });
  }

  // ---- Description window (v72): tapping an item opens this first; the pencil leads to the Edit item window ----
  const dlgDesc = el('dlgDesc') as Dlg, descText = el('descText') as HTMLTextAreaElement, descCount = el('descCount');
  let descTarget: Item | null = null, descSlide: Slide = null;
  const DESC_MAX = 100;
  function teardownDesc(): void { if (descSlide && descSlide.ro) descSlide.ro.disconnect(); descSlide = null; }
  function syncDescCount(): void {
    const n = descText.value.length;
    descCount.textContent = n + '/' + DESC_MAX; descCount.classList.toggle('full', n >= DESC_MAX);
  }
  // Rebuilds everything except the text box, so unsaved text survives a trip to the Edit item window.
  function refreshDesc(): void {
    const it = descTarget;
    if (!it || ctx.items.indexOf(it) < 0) { if (dlgDesc.open) dlgDesc.close(); return; }
    const nm = el('descName'); nm.textContent = ''; nm.appendChild(nameFrag(it));
    el('descSub').textContent = [it.cat || '', it.qty ? it.qty + '\u00a0' + unitLabel(it.qty, it.unit) : ''].filter(Boolean).join(' \u00b7 ');
    const cards = el('descCards'), from = it.from, linked = !!(from && from.length);
    let sl: HTMLElement | null = null, dots: HTMLElement | null = null, tr: HTMLElement;
    cards.innerHTML = ''; teardownDesc();
    if (from && linked) {
      const lb = document.createElement('span'); lb.className = 'flabel'; lb.textContent = from.length > 1 ? 'From recipes' : 'From recipe'; cards.appendChild(lb);
      sl = document.createElement('div'); sl.className = 'cslider';
      tr = document.createElement('div'); tr.className = 'ctrack'; sl.appendChild(tr);
      if (from.length > 1) sl.tabIndex = 0;
      sl.setAttribute('role', 'group'); sl.setAttribute('aria-roledescription', 'carousel'); sl.setAttribute('aria-label', 'Source recipes');
      from.forEach(function (f, fi) {
        const rc = ctx.recipes.find(function (x) { return x.id === f.id; });
        const card = document.createElement('div'); card.className = 'shophead' + (it.unlinked ? ' hasbrk' : '');
        card.setAttribute('role', 'group'); card.setAttribute('aria-roledescription', 'slide'); card.setAttribute('aria-label', (fi + 1) + ' of ' + from.length);
        const n = document.createElement('p'); n.className = 'shopname'; n.textContent = rc ? rc.name : f.name;
        card.appendChild(n);
        if (rc && rc.portions) {
          const p = document.createElement('p'); p.className = 'portions';
          p.textContent = 'up to ' + rc.portions + (rc.portions === 1 ? ' portion' : ' portions');
          card.appendChild(p);
        }
        if (it.unlinked) { const canRe = !!(it.orig && from.length === 1 && !isMulti(it)); card.appendChild(brokenLink('cardbrk', canRe ? function () { openRelink(it, true); } : null, isMulti(it) ? 'Re-linking not possible' : null)); }
        tr.appendChild(card);
      });
      cards.appendChild(sl);
      if (from.length > 1) {
        dots = document.createElement('div'); dots.className = 'cdots';
        from.forEach(function (_f, fi) {
          const d = document.createElement('button'); d.type = 'button'; d.className = 'cdot';
          d.setAttribute('aria-label', 'Show recipe ' + (fi + 1) + ' of ' + from.length);
          (dots as HTMLElement).appendChild(d);
        });
        cards.appendChild(dots);
      }
    }
    cards.hidden = !linked;
    if (sl) descSlide = setupSlider(sl, dots);
  }
  function openDesc(it: Item): void {
    descTarget = it; descText.value = it.desc || ''; syncDescCount();
    dlgDesc.showModal();
    dlgDesc.setAttribute('tabindex', '-1');
    dlgDesc.focus({ preventScroll: true });   // the text box is deliberately not focused
    refreshDesc(); descText.scrollTop = 0;
  }
  function descDirty(): boolean { const it = descTarget; return !!it && descText.value.trim() !== (it.desc || ''); }
  function requestCloseDesc(): void {
    if (dlgDesc._closing) return;
    if (descDirty()) { ctx.openDiscard(function () { dlgDesc.close(); }); }
    else dlgDesc.close();
  }
  // Quantity and unit are edited in the Edit item window; this window only saves the description, which never unlinks the item.
  function saveDesc(): void {
    const it = descTarget; if (!it) return;
    if (!descDirty()) { dlgDesc.close(); return; }
    const v = descText.value.trim(), prev = it.desc;
    if (v) it.desc = v; else delete it.desc;
    ctx.save();
    dlgDesc.close();
    ctx.showToast('Item updated.', function () {
      if (prev) it.desc = prev; else delete it.desc;
      ctx.save();
    });
  }
  descText.addEventListener('input', function (e) {
    syncDescCount();
    // a paste that was cut off by the limit also shakes the counter
    if ((e as InputEvent).inputType === 'insertFromPaste' && descText.value.length >= DESC_MAX) shake(descCount);
  });
  // typing when the box is already full (and nothing is selected to be replaced) shakes the counter
  descText.addEventListener('beforeinput', function (e) {
    const t = (e as InputEvent).inputType;
    if (t && t.indexOf('insert') === 0 && t !== 'insertFromPaste' && descText.value.length >= DESC_MAX && descText.selectionStart === descText.selectionEnd) shake(descCount);
  });
  el('descEdit').addEventListener('click', function () { if (descTarget) openEdit(descTarget); });
  el('descSave').addEventListener('click', saveDesc);
  el('dlgDescClose').addEventListener('click', requestCloseDesc);
  dlgDesc.addEventListener('click', function (ev) { if (ev.target === dlgDesc) requestCloseDesc(); });
  dlgDesc.addEventListener('close', function () { descTarget = null; teardownDesc(); });

  // ---- Closing the Edit item window ----
  function editDirty(): boolean {
    const it = editTarget;
    return !!it && (editName.value.trim() !== it.text || editBrand.value.trim() !== (it.brand || '') || (parseFloat(editQty.value) || 0) !== (it.qty || 0) || editUnit.value !== (it.unit || '') || editCat.value !== (it.cat || ''));
  }
  function requestCloseEdit(): void {
    if (dlgEdit._closing || dlgEdit.getAttribute('data-x')) return;
    if (editDirty()) { ctx.openDiscard(function () { dlgEdit.close(); }); }
    else dlgEdit.close();
  }
  el('dlgEditClose').addEventListener('click', requestCloseEdit);
  dlgEdit.addEventListener('click', function (ev) { if (ev.target === dlgEdit) requestCloseEdit(); });

  // ---- Unlink: an edit that changes the amount of a recipe-linked item asks first ----
  const dlgUnlink = el('dlgUnlink') as HTMLDialogElement;
  let pendingEdit: Pending | null = null;
  const unlinkTimer = timedConfirm(dlgUnlink, el('unlinkConfirm'), el('unlinkFill'), el('unlinkLbl'), 'Unlink and save', 3);
  function applyEdit(it: Item, t: string, qty: number, unit: string, cat: string, brand: string): void {
    const prev = { text: it.text, qty: it.qty, unit: it.unit, cat: it.cat, brand: it.brand, unlinked: it.unlinked };
    const amountChanged = t !== it.text || qty !== it.qty || unit !== it.unit;
    if (brand) it.brand = brand; else delete it.brand;
    it.text = t; it.qty = qty; it.unit = unit;
    if (cat) it.cat = cat; else delete it.cat;
    ctx.recordHistory([{ text: t, unit: unit, cat: cat }]);
    if (amountChanged && it.from && it.from.length) { if (!prev.unlinked) it.orig = { qty: prev.qty, unit: prev.unit, text: prev.text, brand: prev.brand }; it.unlinked = true; }
    ctx.save(); ctx.render();
    dlgEdit.close();
    ctx.showToast('Item updated.', function () {
      it.text = prev.text; it.qty = prev.qty; it.unit = prev.unit;
      if (prev.cat) it.cat = prev.cat; else delete it.cat;
      if (prev.brand) it.brand = prev.brand; else delete it.brand;
      if (prev.unlinked) it.unlinked = true; else { delete it.unlinked; delete it.orig; }
      ctx.save(); ctx.render();
    });
  }
  el('unlinkConfirm').addEventListener('click', function () {
    if (unlinkTimer.locked()) return;
    const p = pendingEdit; pendingEdit = null;
    dlgUnlink.close();
    if (p) applyEdit(p.it, p.t, p.qty, p.unit, p.cat, p.brand);
  });
  el('unlinkNo').addEventListener('click', function () { dlgUnlink.close(); });
  // Cancelling (button, tap outside or Esc) simply falls back to the Edit item window underneath.
  dlgUnlink.addEventListener('click', function (ev) { if (ev.target === dlgUnlink) dlgUnlink.close(); });
  dlgUnlink.addEventListener('close', function () { pendingEdit = null; });
  dlgUnlink.addEventListener('close', teardownUnlinkSlider);

  // ---- Re-link: tapping the broken chain on an item that was unlinked by changing it restores its original quantity and unit ----
  const dlgRelink = el('dlgRelink') as HTMLDialogElement;
  let relinkTarget: Item | null = null;
  const relinkTimer = timedConfirm(dlgRelink, el('relinkConfirm'), el('relinkFill'), el('relinkLbl'), 'Confirm', 3);
  let relinkFromEdit = false;
  function openRelink(it: Item, fromEdit?: boolean): void {
    if (!it || !it.from || it.from.length !== 1 || !it.orig || isMulti(it)) return;
    relinkTarget = it; relinkFromEdit = !!fromEdit;
    el('relinkMsg').textContent = 'This item will be re-linked to the following recipe:';
    const uc = el('relinkCards'); uc.innerHTML = '';
    it.from.forEach(function (f) { uc.appendChild(ctx.recipeCardEl(f)); });
    relinkTimer.open();
  }
  el('relinkConfirm').addEventListener('click', function () {
    if (relinkTimer.locked()) return;
    const it = relinkTarget, fe = relinkFromEdit; relinkTarget = null; relinkFromEdit = false;
    dlgRelink.close();
    if (!it || ctx.items.indexOf(it) < 0 || !it.unlinked || !it.orig) return;
    if (fe && dlgEdit.open) dlgEdit.close();   // the Edit window would still show the old quantity and unit
    const prev = { qty: it.qty, unit: it.unit, text: it.text, brand: it.brand, orig: it.orig, manual: it.manual }, o = prev.orig;
    it.qty = o.qty; it.unit = o.unit;
    // the name comes back too (items unlinked before v72 have no saved name and keep theirs)
    if (o.text !== undefined) { it.text = o.text; if (o.brand) it.brand = o.brand; else delete it.brand; }
    delete it.unlinked; delete it.orig; delete it.manual;
    ctx.save(); ctx.render(); if (dlgDesc.open) refreshDesc();
    ctx.showToast('Item re-linked.', function () {
      it.qty = prev.qty; it.unit = prev.unit; it.text = prev.text; if (prev.brand) it.brand = prev.brand; else delete it.brand; it.unlinked = true; it.orig = prev.orig; if (prev.manual) it.manual = true;
      ctx.save(); ctx.render();
    });
  });
  el('relinkNo').addEventListener('click', function () { dlgRelink.close(); });
  dlgRelink.addEventListener('click', function (ev) { if (ev.target === dlgRelink) dlgRelink.close(); });
  dlgRelink.addEventListener('close', function () { relinkTarget = null; relinkFromEdit = false; });

  // ---- Saving the Edit item form ----
  el('editForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const it = editTarget, t = editName.value.trim(), qty = parseFloat(editQty.value), unit = editUnit.value, cat = editCat.value, brand = editBrand.value.trim();
    if (!it || !t) return;
    if (!(qty > 0) || !unit) { shake(editQty); editQty.focus(); return; }
    const amountChanged = t !== it.text || qty !== it.qty || unit !== it.unit;
    if (!amountChanged && cat === (it.cat || '') && brand === (it.brand || '')) { dlgEdit.close(); return; }
    if (amountChanged && it.from && it.from.length && !it.unlinked) {
      pendingEdit = { it: it, t: t, qty: qty, unit: unit, cat: cat, brand: brand };
      const bs = buildCardSlider(el('unlinkCards'), it.from);
      el('unlinkMsg').textContent = (it.from.length > 1 ? 'This item is linked to these recipes.' : 'This item is linked to this recipe.') + ' Saving your changes will unlink it from ' + (it.from.length > 1 ? 'those recipes' : 'that recipe') + '. The recipe label stays on the item.';
      unlinkTimer.open();
      teardownUnlinkSlider(); unlinkSlide = setupSlider(bs.sl, bs.dots);
      return;
    }
    applyEdit(it, t, qty, unit, cat, brand);
  });

  // ---- The name suggestions in the Edit item window, and what closing it cleans up ----
  const editSuggest = ctx.makeSuggest(editName, el('suggestE'), null, { value: 1 }, editCat);
  dlgEdit.addEventListener('close', editSuggest.hide);
  dlgEdit.addEventListener('close', function () { if (dlgDesc.open) refreshDesc(); });

  return { openDesc: openDesc, openRelink: openRelink, openEdit: openEdit, requestCloseDesc: requestCloseDesc, requestCloseEdit: requestCloseEdit };
}
