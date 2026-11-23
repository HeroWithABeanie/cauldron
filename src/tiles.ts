import { nameParts } from './names';
import { unitLabel } from './units';
import { isDesk } from './ui';
import type { Unit } from './types';

// Tile titles may break after . , - _ : / \ * + ! ? and ) and before (, except between two digits (1.5, 0,5).
// The name shrinks to fit its box first; only when it still does not fit at the smallest size is it cut off with "...".
// Plain text nodes with <wbr> between them, so a name can never be read as HTML.
export function setTileName(el: HTMLElement, t: string, brand?: string): void {
  function addParts(into: HTMLElement, text: string): void {
    nameParts(text).forEach(function (part, i) {
      if (i) into.appendChild(document.createElement('wbr'));
      into.appendChild(document.createTextNode(part));
    });
  }
  el.textContent = '';
  if (brand) {
    const bb = document.createElement('b'); bb.className = 'brand';
    addParts(bb, brand);
    el.appendChild(bb);
    el.appendChild(document.createTextNode(' '));
  }
  addParts(el, t);
}

export function qtyText(it: { qty?: number; unit: Unit }): string {
  return it.qty ? it.qty + '\u00a0' + unitLabel(it.qty, it.unit) : '';
}

export function tileFit(el: HTMLElement, base: number, min: number, extra?: number): void {
  const tile = el.closest('.tile') as HTMLElement;
  const avail = tile.clientWidth - 39 - (extra || 0);
  let s = base;
  el.style.fontSize = s + 'px';
  while (el.scrollWidth > avail && s > min) { s -= .5; el.style.fontSize = s + 'px'; }
}

// Names wrap onto up to three lines and shrink to fill the free space; at the minimum size they are cut off.
// Shared by Shopping list tiles and recipe tiles: break at spaces and punctuation, shrink the font until the name fits
// its box, and only at the smallest size cut it off with "...".
export function tileFitName(el: HTMLElement, s?: number, min?: number, lines?: number): void {
  let size = s || 17.6; const lo = min || 9, n_ = lines || 3;
  const box = el.parentNode as HTMLElement;
  function over(): boolean { return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > box.clientHeight + 1 || el.scrollHeight > n_ * size * 1.4 + .4 * size + 2; }
  el.style.cssText = 'max-height:' + box.clientHeight + 'px;font-size:' + size + 'px;';
  while (over() && size > lo) { size -= .5; el.style.fontSize = size + 'px'; }
  if (over()) {
    const n = Math.min(n_, Math.max(1, Math.floor(box.clientHeight / (size * 1.4))));
    el.style.cssText += 'overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:' + n + ';';
  }
}

/** Fit the text of every tile in the Shopping list grid. */
export function fitAll(): void {
  (document.getElementById('list') as HTMLElement).querySelectorAll<HTMLElement>('.tile').forEach(function (t) {
    if (!t.offsetWidth) return;
    const c = t.querySelector<HTMLElement>('.tcat'); if (c) tileFit(c, 12.8, 8);
    tileFitName(t.querySelector<HTMLElement>('.tname') as HTMLElement);
    tileFit(t.querySelector<HTMLElement>('.tqty') as HTMLElement, 17, 10, 0);
  });
}

// Recipe tiles follow the same rules as Shopping list tiles; computers allow one more line.
export function fitRTiles(): void {
  document.querySelectorAll<HTMLElement>('.rtile .rname').forEach(function (el) {
    if (!el.offsetWidth) return;
    const d = isDesk();
    tileFitName(el, d ? 20 : 18.4, 9, d ? 4 : 3);
  });
}
