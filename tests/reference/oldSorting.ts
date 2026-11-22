// Verbatim copy of the sorting logic from app.js before it moved to src/sorting.ts (state passed in as arguments).
import { CATS } from '../../src/categories';
import { fullName } from '../../src/names';

export function oldIsMulti(it: any) { return !!(it.from && (it.from.length > 1 || (it.from.length === 1 && it.manual))); }
export function oldSortedBase(items: any[], sortMode: string) {
  var list = items.slice();
  if (sortMode === 'az' || sortMode === 'za') {
    var sorted = list.sort(function (a, b) { return fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }); });
    return sortMode === 'za' ? sorted.reverse() : sorted;
  }
  if (sortMode === 'cat') {
    var ci = function (it: any) { var i = CATS.indexOf(it.cat); return i < 0 ? CATS.length : i; };
    return list.sort(function (a, b) { return ci(a) - ci(b); });
  }
  var order: any[] = [];
  items.forEach(function (it) {
    if (it.from && it.from.length && !oldIsMulti(it) && order.indexOf(it.from[0].id) < 0) order.push(it.from[0].id);
  });
  function rank(it: any) {
    if (oldIsMulti(it)) return order.length;
    if (it.from && it.from.length === 1) return order.indexOf(it.from[0].id);
    return order.length + 1;
  }
  return list.sort(function (a, b) { return rank(a) - rank(b); });
}
export function oldSortedItems(items: any[], sortMode: string) {
  var l = oldSortedBase(items, sortMode);
  return l.filter(function (i) { return !i.done; }).concat(l.filter(function (i) { return i.done; }));
}
export function oldSortedRecipes(recipes: any[], rsort: string) {
  var l = recipes.slice();
  var byName = function (a: any, b: any) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); };
  if (rsort === 'az') l.sort(byName);
  else if (rsort === 'za') l.sort(function (a, b) { return byName(b, a); });
  else if (rsort === 'pu') l.sort(function (a, b) { return (a.portions - b.portions) || byName(a, b); });
  else if (rsort === 'pd') l.sort(function (a, b) { return (b.portions - a.portions) || byName(a, b); });
  else if (rsort === 'iu') l.sort(function (a, b) { return ((a.items || []).length - (b.items || []).length) || byName(a, b); });
  else l.sort(function (a, b) { return ((b.items || []).length - (a.items || []).length) || byName(a, b); });
  return l;
}
