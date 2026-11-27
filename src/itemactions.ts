// The actions that change the lists and answer with an Undo banner: delete an item, remove the ticked-off items, tick items off (and back),
// uncheck all, clear the whole list, and delete a recipe. The code is the code that used to be in app.js (step 1c-7a); only the typing is new.
import * as store from './store';
import type { Item, Recipe } from './types';

/** What the actions need from the app. */
export interface ItemActionsCtx {
  /** Both lists are only ever changed in place (see store.setList), so they can be passed directly. */
  readonly items: Item[];
  readonly recipes: Recipe[];
  /** The Shopping list's element; ticked rows and tiles are updated in it directly. */
  readonly list: HTMLElement;
  /** The "Uncheck all" and "Clear entire list" buttons of the menu. */
  readonly uncheckBtn: HTMLElement;
  readonly wipeBtn: HTMLElement;
  save(): void;
  saveR(): void;
  render(): void;
  renderRecipes(): void;
  withAnim(kind: string, fn: () => void, lock?: boolean): void;
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number): void;
  syncClear(): void;
  reorderSoon(ms: number, its: Item[]): void;
  /** Asks "Clear entire list?"; the answer comes back as doWipe. */
  openWipe(): void;
  keyFor(o: object): number | string;
}

export interface ItemActions {
  deleteItem(it: Item, anim?: boolean): void;
  removeChecked(): void;
  performDelete(r: Recipe): void;
  /** The banner that follows ticking an item off. */
  checkedToast(it: Item): void;
  setChecked(arr: Item[], val: boolean): void;
  doWipe(): void;
}

export function createItemActions(ctx: ItemActionsCtx): ItemActions {
  const items = ctx.items, recipes = ctx.recipes, list = ctx.list, uncheckBtn = ctx.uncheckBtn, wipeBtn = ctx.wipeBtn;
  const save = ctx.save, saveR = ctx.saveR, render = ctx.render, renderRecipes = ctx.renderRecipes, withAnim = ctx.withAnim, showToast = ctx.showToast;

  function deleteItem(it: Item, anim?: boolean): void {
    const idx = items.indexOf(it);
    if (idx < 0) return;
    store.setList('items', items.filter(function (x) { return x !== it; }));
    save();
    if (anim) withAnim('list', render); else render();
    showToast('Item removed.', function () {
      items.splice(Math.min(idx, items.length), 0, it);
      save();
      if (anim) withAnim('list', render); else render();
    });
  }
  function removeChecked(): void {
    const gone: { it: Item; idx: number }[] = [];
    items.forEach(function (it, i) { if (it.done) gone.push({ it: it, idx: i }); });
    store.setList('items', items.filter(function (i) { return !i.done; }));
    save(); render();
    showToast(gone.length === 1 ? 'Item removed.' : 'Items removed.', function () {
      gone.forEach(function (g) { items.splice(Math.min(g.idx, items.length), 0, g.it); });
      save(); render();
    });
  }
  function performDelete(r: Recipe): void {
    const idx = recipes.indexOf(r);
    store.setList('recipes', recipes.filter(function (x) { return x !== r; }));
    saveR(); renderRecipes();
    showToast('Recipe deleted.', function () {
      recipes.splice(Math.min(idx, recipes.length), 0, r);
      saveR(); renderRecipes();
    });
  }

  // Checking an item off shows a banner with an instant Undo.
  function checkedToast(it: Item): void {
    showToast('Item checked off.', function () { if (items.indexOf(it) > -1) setChecked([it], false); });
  }
  function setChecked(arr: Item[], val: boolean): void {
    arr.forEach(function (x) {
      x.done = val;
      const li = list.querySelector<HTMLElement>('li[data-key="' + ctx.keyFor(x) + '"]');
      if (!li) return;
      li.classList.toggle('done', val);
      const cb = li.querySelector<HTMLInputElement>('input[type=checkbox]');
      if (cb) cb.checked = val;
      const tl = li.querySelector<HTMLElement>('.tile');
      if (tl) tl.classList.toggle('done', val);
    });
    save(); ctx.syncClear(); ctx.reorderSoon(300, arr);
  }
  uncheckBtn.addEventListener('click', function () {
    const was = items.filter(function (x) { return x.done; });
    if (was.length < 2) return;
    setChecked(was, false);
    showToast('Items unchecked.', function () { setChecked(was, true); }, 7000);
  });
  wipeBtn.addEventListener('click', function () { if (items.length) ctx.openWipe(); });
  function doWipe(): void {
    if (!items.length) return;
    const all = items.slice();
    store.setList('items', []);
    save(); render();
    showToast('List cleared.', function () { store.setList('items', all.slice()); save(); render(); }, 7000);
  }

  return { deleteItem, removeChecked, performDelete, checkedToast, setChecked, doWipe };
}
