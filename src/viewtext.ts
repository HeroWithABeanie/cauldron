// Small pure text helpers of the list and recipe views.
import { isMulti } from './sorting';
import { shortTitle } from './names';
import type { Item } from './types';

export function ingText(r: { items?: unknown[] }): string {
  const n = (r.items || []).length;
  return n + (n === 1 ? ' ingredient' : ' ingredients');
}

export function portionsText(n: number): string {
  return 'up to ' + n + (n === 1 ? ' portion' : ' portions');
}

// Portions come first; only when the recipes are sorted by ingredient count does that come first.
export function infoLine(r: { items?: unknown[]; portions: number }, rsort: string): string {
  const a = portionsText(r.portions), b = ingText(r);
  return (rsort === 'iu' || rsort === 'id') ? b + ' \u00b7 ' + a : a + ' \u00b7 ' + b;
}

// Line above the name: recipe when sorted by recipe, category when sorted by category, nothing for A to Z.
// Recipe names longer than 20 characters are cut after the 20th character and end in three dots.
export function topLine(it: Pick<Item, 'from' | 'manual' | 'cat'>, sortMode: string): string | null {
  if (sortMode === 'recipe') {
    if (isMulti(it)) return 'Multiple recipes';
    return it.from && it.from.length === 1 ? shortTitle(it.from[0].name) : '';
  }
  if (sortMode === 'cat') return it.cat || '';
  return null;
}
