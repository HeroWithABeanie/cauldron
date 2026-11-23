// The search filter: hides everything that does not match the search text, highlights the matches, and unfolds
// the matching ingredients under a recipe card. Runs again after every change of the search text or of a list.
import { searchRe, fullName } from './names';
import { unitLabel } from './units';
import { nameFrag } from './ui';
import { clearMarks, markText, toggleEl, markLast, setLi } from './rowfx';
import { fitRTiles } from './tiles';
import type { Item, Recipe } from './types';

/** What the filter needs to know about the app right now. app.js passes an object with getters, so it is always current. */
export interface FilterState {
  readonly list: HTMLElement;
  readonly recipesEl: HTMLElement;
  readonly items: readonly Item[];
  readonly recipes: readonly Recipe[];
  readonly query: string;
  readonly currentView: string;
  readonly recipeLayout: string;
}

/** The row effects the filter uses. Exposed only so tests can record the calls instead of running them in a browser. */
export const fx = { clearMarks, markText, toggleEl, markLast, setLi, fitRTiles };

/** Shopping list: animate = hide and show rows with the height-and-fade animation (false: instantly). */
export function applyListFilter(s: FilterState, animate: boolean): void {
  const q = s.currentView === 'list' ? s.query.trim().toLowerCase() : '';
  let any = false;
  const re = q ? searchRe(q, 'iu') : null, hre = q ? searchRe(q, 'giu') : null;
  const list = s.list;
  if (list.querySelector('ul.grid')) {
    list.querySelectorAll<HTMLElement>('.grid>li').forEach(function (li) {
      const show = !q || (re as RegExp).test(li.dataset.name as string);
      li.hidden = !show; if (show) any = true;
      const nm = li.querySelector<HTMLElement>('.tname');
      if (nm) { fx.clearMarks(nm); if (q) fx.markText(nm, hre as RegExp); }
    });
    fx.toggleEl(document.getElementById('noItems') as HTMLElement, !!q && !any && s.items.length > 0, false);
    return;
  }
  list.querySelectorAll<HTMLElement>('ul').forEach(function (ul) {
    if (ul.querySelector('li.empty')) { fx.markLast(ul); return; }
    const lis = ul.querySelectorAll<HTMLElement>('li'), shows: boolean[] = [];
    let n = 0;
    lis.forEach(function (li) {
      const show = !q || (re as RegExp).test(li.dataset.name as string); shows.push(show); if (show) n++;
      const nm = li.querySelector<HTMLElement>('.name');
      if (nm) { fx.clearMarks(nm); if (q) fx.markText(nm, hre as RegExp); }
    });
    if (ul.classList.contains('donegrp')) ul.dataset.count = String(n);
    const wasShown = ul.dataset.shown !== '0';
    if (n > 0) {
      any = true;
      if (!wasShown) {
        lis.forEach(function (li, i) { fx.setLi(li, shows[i], false); });
        ul.dataset.shown = '1'; fx.toggleEl(ul, true, animate);
      } else lis.forEach(function (li, i) { fx.setLi(li, shows[i], animate); });
    } else if (wasShown) { ul.dataset.shown = '0'; fx.toggleEl(ul, false, animate); }
    fx.markLast(ul);
  });
  fx.toggleEl(document.getElementById('noItems') as HTMLElement, !!q && !any && s.items.length > 0, animate);
}

/** Recipes: the same for the recipe cards and tiles. A match in the name or in any ingredient keeps a recipe visible. */
export function applyRecipeFilter(s: FilterState, animate: boolean): void {
  const q = s.currentView === 'recipes' ? s.query.trim().toLowerCase() : '';
  let any = false;
  const re = q ? searchRe(q, 'iu') : null, hre = q ? searchRe(q, 'giu') : null;
  s.recipesEl.querySelectorAll<HTMLElement>('.recipe,.rtile').forEach(function (card) {
    const r = s.recipes.find(function (x) { return String(x.id) === card.dataset.rid; });
    if (!r) return;
    const nameHit = !q || (re as RegExp).test(r.name);
    const hits = q ? r.items.filter(function (it) { return (re as RegExp).test(fullName(it)); }) : [];
    const visible = nameHit || hits.length > 0, shown = card.dataset.shown !== '0';
    if (card.classList.contains('rtile')) {
      card.hidden = !visible; card.dataset.shown = visible ? '1' : '0'; if (visible) any = true;
      const tnm = card.querySelector<HTMLElement>('.rname');
      if (tnm) { fx.clearMarks(tnm); if (q && visible) fx.markText(tnm, hre as RegExp); }
      return;
    }
    const title = card.querySelector<HTMLElement>('.ctitle') as HTMLElement;
    fx.clearMarks(title); if (q) fx.markText(title, hre as RegExp);
    // Matching ingredients unfold under the title; the card still opens the full recipe when tapped.
    const hb = card.querySelector<HTMLElement>('.hits') as HTMLElement, box = card.querySelector<HTMLElement>('.hrows') as HTMLElement;
    if (hits.length) {
      box.innerHTML = '';
      hits.forEach(function (it) {
        const row = document.createElement('span'); row.className = 'hrow';
        const a = document.createElement('span'); a.className = 'hq'; a.textContent = it.qty + '\u00a0' + unitLabel(it.qty, it.unit);
        const n = document.createElement('span'); n.className = 'hn'; n.appendChild(nameFrag(it));
        if (q) fx.markText(n, hre as RegExp);
        row.appendChild(a); row.appendChild(n); box.appendChild(row);
      });
    }
    hb.classList.toggle('open', hits.length > 0);
    hb.setAttribute('aria-hidden', hits.length ? 'false' : 'true');
    if (visible) {
      any = true;
      if (!shown) { card.dataset.shown = '1'; fx.toggleEl(card, true, animate); }
    } else if (shown) { card.dataset.shown = '0'; fx.toggleEl(card, false, animate); }
  });
  if (s.recipeLayout === 'tile') fx.fitRTiles();
  fx.toggleEl(document.getElementById('noRecipes') as HTMLElement, !!q && !any && s.recipes.length > 0, animate);
}
