// The sort chips above the Shopping list and the recipes, and the slide between two differently sorted lists.
import { EASE, noMotion, uiLocked } from './ui';
import { flipReorder } from './rowfx';

/** Marks the chip of the current Shopping list sort as on and keeps the A to Z chip's direction and label up to date. */
export function syncChips(chips: NodeListOf<HTMLElement>, sortMode: string, listAzDir: string): void {
  chips.forEach(function (c) {
    const k = c.dataset.sort, on = k === 'a' ? (sortMode === 'az' || sortMode === 'za') : k === sortMode;
    c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    if (k === 'a') {
      c.classList.toggle('rev', listAzDir === 'za');
      c.setAttribute('aria-label', 'Alphabetical, ' + (listAzDir === 'za' ? 'Z to A' : 'A to Z') + (on ? ', tap to reverse' : ', tap to apply'));
    }
  });
}

/** The same for the recipe chips: A to Z, portions and ingredient count each remember their own direction. */
export function syncRChips(rchips: NodeListOf<HTMLElement>, rsort: string, rAzDir: string, rIDir: string, rPDir: string): void {
  rchips.forEach(function (c) {
    const k = c.dataset.rsort, on = k === 'p' ? (rsort === 'pu' || rsort === 'pd') : k === 'i' ? (rsort === 'iu' || rsort === 'id') : k === 'a' ? (rsort === 'az' || rsort === 'za') : k === rsort;
    c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    if (k === 'a') {
      c.classList.toggle('rev', rAzDir === 'za');
      c.setAttribute('aria-label', 'Alphabetical, ' + (rAzDir === 'za' ? 'Z to A' : 'A to Z') + (on ? ', tap to reverse' : ', tap to apply'));
    }
    if (k === 'i') {
      c.classList.toggle('desc', rIDir === 'id');
      c.setAttribute('aria-label', 'Ingredients, ' + (rIDir === 'id' ? 'descending' : 'ascending') + (on ? ', tap to reverse' : ', tap to apply'));
    }
    if (k === 'p') {
      c.classList.toggle('desc', rPDir === 'pd');
      c.setAttribute('aria-label', 'Portions, ' + (rPDir === 'pd' ? 'descending' : 'ascending') + (on ? ', tap to reverse' : ', tap to apply'));
    }
  });
}

/**
 * Changing the sort order slides the old list out and the new one in. `old` is a copy of the list from before the
 * change, `top` its offsetTop, dir is 1 (old goes left) or -1 (old goes right).
 */
export function slideLists(old: HTMLElement, top: number, dir: number, list: HTMLElement): void {
  if (noMotion() || !list.animate) return;
  old.removeAttribute('id');
  old.setAttribute('aria-hidden', 'true');
  old.inert = true;
  old.style.cssText = 'position:absolute;left:0;right:0;top:' + top + 'px';
  list.parentNode!.insertBefore(old, list);
  const dist = list.offsetWidth;
  const oa = old.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + (-dir * dist) + 'px)', opacity: 0 }], { duration: 320, easing: EASE, fill: 'forwards' });
  const na = list.animate([{ transform: 'translateX(' + (dir * dist) + 'px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 320, easing: EASE });
  na.onfinish = na.oncancel = function () { oa.cancel(); if (old.parentNode) old.parentNode.removeChild(old); };
}

export interface RecipeChipsCtx {
  /** The current recipe sort ('az', 'za', 'pu', 'pd', 'iu' or 'id'); app.js keeps it (the recipe view reads it), this module writes it. */
  rsort: string;
  readonly recipesEl: HTMLElement;
  renderRecipes(): void;
}

/**
 * The sort chips above the recipes. Alphabetical, portions and ingredient count each remember their own direction; tapping the
 * chip that is already on reverses it. Moving between two kinds slides the old list out; a reversal re-orders in place.
 */
export function createRecipeChips(ctx: RecipeChipsCtx): void {
  const RORDER = ['az', 'za', 'pu', 'pd', 'iu', 'id'];
  let rAzDir = 'az', rPDir = 'pu', rIDir = 'iu';
  try {
    if (localStorage.getItem('shopping-list-razdir') === 'za') rAzDir = 'za';
    if (localStorage.getItem('shopping-list-rpdir') === 'pd') rPDir = 'pd';
    if (localStorage.getItem('shopping-list-ridir') === 'id') rIDir = 'id';
  } catch (e) { /* storage not available: keep the defaults */ }
  if (ctx.rsort === 'az' || ctx.rsort === 'za') rAzDir = ctx.rsort; else if (ctx.rsort === 'pu' || ctx.rsort === 'pd') rPDir = ctx.rsort; else rIDir = ctx.rsort;
  const rchips = document.querySelectorAll<HTMLElement>('#recipeSort .chip');
  const sync = function (): void { syncRChips(rchips, ctx.rsort, rAzDir, rIDir, rPDir); };
  rchips.forEach(function (c) {
    c.addEventListener('click', function () {
      if (uiLocked) return;
      const prev = ctx.rsort; let next = c.dataset.rsort as string;
      if (next === 'p') { next = (prev === 'pu' || prev === 'pd') ? (prev === 'pu' ? 'pd' : 'pu') : rPDir; rPDir = next; }
      if (next === 'a') { next = (prev === 'az' || prev === 'za') ? (prev === 'az' ? 'za' : 'az') : rAzDir; rAzDir = next; }
      if (next === 'i') { next = (prev === 'iu' || prev === 'id') ? (prev === 'iu' ? 'id' : 'iu') : rIDir; rIDir = next; }
      if (next === prev) return;
      const fam = function (m: string): number { return m === 'az' || m === 'za' ? 0 : (m === 'pu' || m === 'pd' ? 1 : 2); };
      const slide = fam(prev) !== fam(next);
      const old = slide ? ctx.recipesEl.cloneNode(true) as HTMLElement : null, top = ctx.recipesEl.offsetTop;
      ctx.rsort = next;
      try { localStorage.setItem('shopping-list-rsort', ctx.rsort); localStorage.setItem('shopping-list-razdir', rAzDir); localStorage.setItem('shopping-list-rpdir', rPDir); localStorage.setItem('shopping-list-ridir', rIDir); } catch (e) { /* not saved */ }
      sync();
      if (slide) {
        ctx.renderRecipes();
        slideLists(old as HTMLElement, top, RORDER.indexOf(next) > RORDER.indexOf(prev) ? 1 : -1, ctx.recipesEl);
      } else flipReorder(ctx.recipesEl, '.recipe[data-rid],.rtile[data-rid]', 'rid', ctx.renderRecipes);
    });
  });
  sync();
}
