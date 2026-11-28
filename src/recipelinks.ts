// Small helpers about recipes that app.js hands to several windows: which recipe(s) the items on the Shopping list came from
// (linkedToRecipe, listedPortions), the recipe card shown in the Unlink / Re-link / Edit item windows (recipeCardEl), ensureOpt
// (makes sure a drop-down has the option it is about to select) and pressFlash (a button that lights up for a moment before it acts).
// The code is the code that used to be in app.js (step 1c-8b); only the typing is new, and the lists are now passed in.
import type { Item, Recipe, RecipeSource } from './types';

/** The first entry among all the items' `from` lists that comes from this recipe, or null when no item does. */
export function linkedFrom(items: Item[], r: { id: number | string }): RecipeSource | null {
  let f0: RecipeSource | null = null;
  items.forEach(function (x) { (x.from || []).forEach(function (f) { if (f.id === r.id && !f0) f0 = f; }); });
  return f0;
}

/** True when some item on the list came from this recipe. */
export function linkedToRecipe(items: Item[], r: { id: number | string }): boolean { return !!linkedFrom(items, r); }

/** The most portions of this recipe that any item on the list covers (items can differ when ingredients were skipped once). */
export function listedPortions(items: Item[], r: { id: number | string }): number {
  let m = 0;
  items.forEach(function (x) { (x.from || []).forEach(function (f) { if (f.id === r.id && (f.sp as number) > m) m = f.sp as number; }); });
  return m;
}

/** The little recipe card (name, and "up to N portions" when the recipe still exists) shown above an ingredient. */
export function recipeCardEl(recipes: Recipe[], f: { id: number | string; name: string }): HTMLElement {
  const rc = recipes.find(function (x) { return x.id === f.id; });
  const card = document.createElement('div'); card.className = 'shophead';
  const n = document.createElement('p'); n.className = 'shopname'; n.textContent = rc ? rc.name : f.name;
  card.appendChild(n);
  if (rc && rc.portions) {
    const p = document.createElement('p'); p.className = 'portions';
    p.textContent = 'up to ' + rc.portions + (rc.portions === 1 ? ' portion' : ' portions');
    card.appendChild(p);
  }
  return card;
}

/** Adds the option `v` to the drop-down when it has no such option yet (so a value that is no longer in the list can still be shown). */
export function ensureOpt(sel: HTMLSelectElement, v: unknown): void {
  const has = Array.prototype.some.call(sel.options, function (o: HTMLOptionElement) { return o.value === String(v); });
  if (!has) {
    const o = document.createElement('option'); o.value = v as string; o.textContent = v as string; sel.appendChild(o);
  }
}

/** The button shows its pressed look for 250 ms and then runs fn; taps during that time are ignored. */
export function pressFlash(btn: HTMLElement, fn: () => void): void {
  btn.addEventListener('click', function () {
    if (btn.classList.contains('pressed')) return;
    btn.classList.add('pressed');
    setTimeout(function () { btn.classList.remove('pressed'); fn(); }, 250);
  });
}
