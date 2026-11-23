// The sort chips above the Shopping list and the recipes, and the slide between two differently sorted lists.
import { EASE, noMotion } from './ui';

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
