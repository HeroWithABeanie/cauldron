import { CATS } from './categories';
import { fullName } from './names';
import type { Item, Recipe } from './types';

export type ListSort = 'recipe' | 'cat' | 'az' | 'za';
export type RecipeSort = 'az' | 'za' | 'pu' | 'pd' | 'iu' | 'id';

/** An item counts as coming from multiple recipes when it lists several recipes, or one recipe plus a manual top-up. */
export function isMulti(it: Pick<Item, 'from' | 'manual'>): boolean {
  return !!(it.from && (it.from.length > 1 || (it.from.length === 1 && it.manual)));
}

/** The list in the chosen order (ticked items are not moved to the end here; see sortedItems). */
export function sortedBase(items: Item[], mode: ListSort): Item[] {
  const list = items.slice();
  if (mode === 'az' || mode === 'za') {
    const sorted = list.sort((a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }));
    return mode === 'za' ? sorted.reverse() : sorted;
  }
  if (mode === 'cat') {
    const ci = (it: Item): number => { const i = CATS.indexOf(it.cat as string); return i < 0 ? CATS.length : i; };
    return list.sort((a, b) => ci(a) - ci(b));
  }
  const order: Array<number | string> = [];
  items.forEach((it) => {
    if (it.from && it.from.length && !isMulti(it) && order.indexOf(it.from[0].id) < 0) order.push(it.from[0].id);
  });
  const rank = (it: Item): number => {
    if (isMulti(it)) return order.length;
    if (it.from && it.from.length === 1) return order.indexOf(it.from[0].id);
    return order.length + 1;
  };
  return list.sort((a, b) => rank(a) - rank(b));
}

/** Ticked items always come after unticked ones; inside each part the chosen sort order is kept. */
export function sortedItems(items: Item[], mode: ListSort): Item[] {
  const l = sortedBase(items, mode);
  return l.filter((i) => !i.done).concat(l.filter((i) => i.done));
}

export function sortedRecipes(recipes: Recipe[], mode: RecipeSort): Recipe[] {
  const l = recipes.slice();
  const byName = (a: Recipe, b: Recipe): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const n = (r: Recipe): number => (r.items || []).length;
  if (mode === 'az') l.sort(byName);
  else if (mode === 'za') l.sort((a, b) => byName(b, a));
  else if (mode === 'pu') l.sort((a, b) => (a.portions - b.portions) || byName(a, b));
  else if (mode === 'pd') l.sort((a, b) => (b.portions - a.portions) || byName(a, b));
  else if (mode === 'iu') l.sort((a, b) => (n(a) - n(b)) || byName(a, b));
  else l.sort((a, b) => (n(b) - n(a)) || byName(a, b));
  return l;
}
