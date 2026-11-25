// The five confirmation windows: delete a recipe, discard changes, "add to the Shopping list?" after adding an ingredient,
// clear the whole list and remove the checked items. The first, third (its "No" button), fourth and fifth keep their button
// locked for a few seconds (timedConfirm); each also closes on its Cancel / No button and when its backdrop is clicked.
import { timedConfirm } from './timedconfirm';
import type { Recipe, RecipeItem } from './types';

/** What the windows need from the app: the actions that follow a confirmation, and the helpers the "add to list" window uses. */
export interface ConfirmsCtx {
  dismissSearch(): void;
  performDelete(r: Recipe): void;
  doWipe(): void;
  removeChecked(): void;
  listedPortions(r: Recipe): number;
  addToShopping(list: { text: string; qty: number; unit: string; cat?: string; brand?: string }[], r: Recipe, sp: number, partial: boolean): () => void;
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void;
  openIngredient(r: Recipe): void;
}

export interface Confirms {
  openDelete(r: Recipe): void;
  /** Asks "Discard changes?"; `then` runs when it is confirmed (the caller's window closes). */
  openDiscard(then: () => void): void;
  openAddList(r: Recipe, item: RecipeItem | null): void;
  /** The "No" answer of the add-to-list window; also what closing that window any other way means. */
  onAddListNo(): void;
  openWipe(): void;
  openRemoveChecked(): void;
}

export function createConfirms(ctx: ConfirmsCtx): Confirms {
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };

  // ---- Delete recipe ----
  const dlgDelete = el('dlgDelete') as HTMLDialogElement,
    deleteYes = el('deleteYes'),
    deleteFill = el('deleteFill'),
    deleteLbl = el('deleteLbl');
  let deleteTarget: Recipe | null = null;
  const deleteConfirm = timedConfirm(dlgDelete, deleteYes, deleteFill, deleteLbl, 'Yes', 5);
  function openDelete(r: Recipe): void {
    deleteTarget = r;
    el('deleteName').textContent = r.name;
    el('deletePortions').textContent = 'up to ' + r.portions + (r.portions === 1 ? ' portion' : ' portions');
    el('deleteMsg').textContent = 'Delete this recipe and all of its ingredients?';
    deleteConfirm.open();
  }
  deleteYes.addEventListener('click', function () {
    if (deleteConfirm.locked()) return;
    if (!deleteTarget) return;
    const r = deleteTarget; deleteTarget = null;
    dlgDelete.close();
    ctx.dismissSearch();
    ctx.performDelete(r);
  });
  el('deleteCancel').addEventListener('click', function () { dlgDelete.close(); });
  el('deleteClose').addEventListener('click', function () { dlgDelete.close(); });
  dlgDelete.addEventListener('click', function (ev) { if (ev.target === dlgDelete) dlgDelete.close(); });

  // ---- Discard changes ----
  const dlgDiscard = el('dlgDiscard') as HTMLDialogElement,
    discardYes = el('discardYes'),
    discardFill = el('discardFill'),
    discardLbl = el('discardLbl');
  let discardThen: (() => void) | null = null;
  const discConfirm = timedConfirm(dlgDiscard, discardYes, discardFill, discardLbl, 'Yes', 2);
  function openDiscard(then: () => void): void {
    discardThen = then;
    discConfirm.open();
  }
  discardYes.addEventListener('click', function () {
    if (discConfirm.locked()) return;
    dlgDiscard.close();
    if (discardThen) discardThen();
  });
  el('discardCancel').addEventListener('click', function () { dlgDiscard.close(); });
  dlgDiscard.addEventListener('click', function (ev) { if (ev.target === dlgDiscard) dlgDiscard.close(); });

  // ---- Add the new ingredient to the Shopping list too? (its "No" button is the locked one) ----
  const dlgAddList = el('dlgAddList') as HTMLDialogElement,
    addListNo = el('addListNo'),
    addListFill = el('addListFill'),
    addListLbl = el('addListLbl');
  let addListTarget: Recipe | null = null, addListItem: RecipeItem | null = null;
  const addConfirm = timedConfirm(dlgAddList, addListNo, addListFill, addListLbl, 'No', 2);
  function openAddList(r: Recipe, item: RecipeItem | null): void {
    addListTarget = r; addListItem = item;
    el('addListName').textContent = r.name;
    el('addListPortions').textContent = 'up to ' + r.portions + (r.portions === 1 ? ' portion' : ' portions');
    addConfirm.open();
  }
  function onAddListNo(): void {
    if (!addListTarget) return;
    if (addConfirm.locked()) return;
    const r = addListTarget; addListTarget = null;
    dlgAddList.close();
    ctx.showToast('Item added. Add another?', function () { ctx.openIngredient(r); }, 7000, 'Yes');
  }
  addListNo.addEventListener('click', onAddListNo);
  dlgAddList.addEventListener('click', function (ev) { if (ev.target === dlgAddList) onAddListNo(); });
  el('addListYes').addEventListener('click', function () {
    if (!addListTarget) return;
    const r = addListTarget; addListTarget = null;
    dlgAddList.close();
    const sp = ctx.listedPortions(r) || r.portions, fac = sp / (r.portions || 1);
    const missing = addListItem ? [addListItem] : [];
    const undo = ctx.addToShopping(missing.map(function (it) {
      return { text: it.text, qty: Math.max(0.01, Math.round(it.qty * fac * 100) / 100), unit: it.unit, cat: it.cat, brand: it.brand };
    }), r, sp, true);
    ctx.showToast('Item added to Shopping list.', undo, 7000);
  });

  // ---- Clear the whole list ----
  const dlgWipe = el('dlgWipe') as HTMLDialogElement,
    wipeYes = el('wipeYes'),
    wipeFill = el('wipeFill'),
    wipeLbl = el('wipeLbl'),
    wipeConfirm = timedConfirm(dlgWipe, wipeYes, wipeFill, wipeLbl, 'Yes', 5);
  function openWipe(): void {
    wipeConfirm.open();
  }
  wipeYes.addEventListener('click', function () {
    if (wipeConfirm.locked()) return;
    dlgWipe.close();
    ctx.doWipe();
  });
  el('wipeNo').addEventListener('click', function () { dlgWipe.close(); });
  dlgWipe.addEventListener('click', function (ev) { if (ev.target === dlgWipe) dlgWipe.close(); });

  // ---- Remove the checked items ----
  const dlgRemove = el('dlgRemove') as HTMLDialogElement,
    removeYes = el('removeYes'),
    removeFill = el('removeFill'),
    removeLbl = el('removeLbl'),
    removeConfirm = timedConfirm(dlgRemove, removeYes, removeFill, removeLbl, 'Yes', 3);
  function openRemoveChecked(): void {
    removeConfirm.open();
  }
  removeYes.addEventListener('click', function () {
    if (removeConfirm.locked()) return;
    dlgRemove.close();
    ctx.removeChecked();
  });
  el('removeNo').addEventListener('click', function () { dlgRemove.close(); });
  dlgRemove.addEventListener('click', function (ev) { if (ev.target === dlgRemove) dlgRemove.close(); });

  return { openDelete, openDiscard, openAddList, onAddListNo, openWipe, openRemoveChecked };
}
