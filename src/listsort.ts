// The sort chips above the Shopping list (By recipe, By category, A to Z / Z to A) and the saved sort. The code is the code that used to
// be in app.js (step 1c-8a); only the typing is new.
import { uiLocked } from './ui';
import { flipReorder } from './rowfx';
import { syncChips, slideLists } from './chips';
import type { ListSort } from './sorting';

/** localStorage key the Shopping list sort is saved under. */
export const SORT_KEY = 'shopping-list-sort';
const AZDIR_KEY = 'shopping-list-azdir';

/** The saved sort: 'recipe' when nothing valid is saved or the storage is blocked. */
export function loadListSort(): ListSort {
  let mode: ListSort = 'recipe';
  try { const sm = localStorage.getItem(SORT_KEY); if (sm === 'az' || sm === 'za' || sm === 'cat') mode = sm; } catch (e) { /* storage not available: keep the default */ }
  return mode;
}

export interface ListSortCtx {
  /** The current Shopping list sort. app.js keeps it (the list view, the top line and sortedItems read it), this module writes it. */
  sortMode: ListSort;
  readonly list: HTMLElement;
  render(): void;
}

/**
 * Makes the sort chips work. The A to Z chip remembers its direction; tapping the chip that is already on reverses it.
 * Moving between By recipe, By category and A to Z slides the old list out; A to Z <-> Z to A re-orders the rows in place.
 */
export function createListSort(ctx: ListSortCtx): void {
  const list = ctx.list;
  let listAzDir = 'az';
  try { if (localStorage.getItem(AZDIR_KEY) === 'za') listAzDir = 'za'; } catch (e) { /* storage not available: keep the default */ }
  if (ctx.sortMode === 'az' || ctx.sortMode === 'za') listAzDir = ctx.sortMode;
  const chips = document.querySelectorAll<HTMLElement>('#view-list .chip');
  const sync = function (): void { syncChips(chips, ctx.sortMode, listAzDir); };
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      if (uiLocked) return;
      const prev: string = ctx.sortMode, ord = ['recipe', 'cat', 'az', 'za'];
      let next = c.dataset.sort as string;
      if (next === 'a') { next = (prev === 'az' || prev === 'za') ? (prev === 'az' ? 'za' : 'az') : listAzDir; listAzDir = next; }
      if (next === prev) return;
      const slide = !((prev === 'az' || prev === 'za') && (next === 'az' || next === 'za'));
      const old = slide ? list.cloneNode(true) as HTMLElement : null, top = list.offsetTop;
      ctx.sortMode = next as ListSort;
      try { localStorage.setItem(SORT_KEY, ctx.sortMode); localStorage.setItem(AZDIR_KEY, listAzDir); } catch (e) { /* not saved */ }
      sync();
      if (slide) {
        ctx.render();
        slideLists(old as HTMLElement, top, ord.indexOf(next) > ord.indexOf(prev) ? 1 : -1, list);
      } else flipReorder(list, 'li[data-key]', 'key', ctx.render);
    });
  });
  sync();
}
