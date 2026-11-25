// The Recipes tab on screen (cards or tiles, with the swipe-to-add-to-shopping-list gesture) and the recipe window that opens
// when a card is tapped (the ingredient list with swipe-to-delete and drag-to-reorder).
import { fullName } from './names';
import { unitLabel } from './units';
import { setTileName, fitRTiles } from './tiles';
import { tileSwipe, swipeRow } from './swipe';
import type { TileSwipe } from './swipe';
import { nameFrag, isDesk } from './ui';
import { popList, spinPlus } from './rowfx';
import { CART_SVG } from './icons';
import { ingText, portionsText, infoLine } from './viewtext';
import type { Item, Recipe, RecipeItem } from './types';

/**
 * What the recipe view needs from the app. The DOM elements are handed in once; the state comes through getters (so it is
 * always current); the actions are the app's own functions (hoisted function declarations or late-bound wrappers in app.js).
 * showToast comes in through here because toast.ts touches the page when it is imported.
 */
export interface RecipeViewCtx {
  readonly recipesEl: HTMLElement;
  readonly dlgView: HTMLDialogElement;
  readonly viewList: HTMLElement;
  readonly recipes: Recipe[];
  readonly items: Item[];
  readonly recipeLayout: string;
  readonly rsort: string;
  readonly query: string;
  sortedRecipes(): Recipe[];
  save(): void;
  saveR(): void;
  render(): void;
  applyRecipeFilter(animate: boolean): void;
  syncClear(): void;
  dismissSearch(): void;
  enableDrag(grip: HTMLElement, li: HTMLElement, ul: HTMLElement, r: Recipe): void;
  openShop(r: Recipe): void;
  openRecipeEdit(r: Recipe, it: RecipeItem): void;
  showToast(msg: string, undo: () => void): void;
}

export interface RecipeView {
  renderRecipes(): void;
  /** Sizes the ingredient list so six rows and half of the seventh show (the rest scrolls). */
  fitView(): void;
  /** The recipe that is open in the recipe window, or null when the window is closed. */
  getTarget(): Recipe | null;
}

export function createRecipeView(ctx: RecipeViewCtx): RecipeView {
  const recipesEl = ctx.recipesEl, dlgView = ctx.dlgView, viewList = ctx.viewList;
  let viewTarget: Recipe | null = null;

  // ---- Swipe a recipe left to add it to the Shopping list (same gesture as swipe-to-delete, but filled accent colour) ----
  function addSwipe(host: HTMLElement, tin: HTMLElement, r: Recipe, mount: HTMLElement, isTile: boolean): TileSwipe | null {
    if (!r.items.length) return null;
    const act = document.createElement('button'); act.type = 'button'; act.className = 'tact add'; act.tabIndex = -1;
    act.setAttribute('aria-label', 'Add ' + r.name + ' to shopping list'); act.innerHTML = CART_SVG;
    host.appendChild(act);
    const sw = tileSwipe(host, act, tin, function () { ctx.openShop(r); }, function () {}, { keep: true, onHop: popList, onArm: spinPlus, lock: isTile ? 0 : .15, size: isTile ? 0 : .25, commit: isTile ? 0 : .55 });
    // mouse and trackpad do not swipe: a button shows on hover instead
    const hb = document.createElement('button'); hb.type = 'button'; hb.className = isTile ? 'tdel add' : 'radd';
    hb.setAttribute('aria-label', 'Add ' + r.name + ' to shopping list'); hb.title = 'Add to shopping list'; hb.innerHTML = CART_SVG;
    hb.addEventListener('click', function (e) {
      e.stopPropagation();
      if (hb.classList.contains('busy')) return;
      hb.classList.add('busy');
      popList(hb.firstChild as HTMLElement); spinPlus(hb.firstChild as HTMLElement);
      setTimeout(function () { hb.classList.remove('busy'); ctx.openShop(r); }, 350);
    });
    if (isTile) {
      const zone = document.createElement('div'); zone.className = 'tzone';
      zone.appendChild(hb); host.appendChild(zone);
    } else mount.appendChild(hb);
    return sw;
  }

  function renderRecipes(): void {
    recipesEl.innerHTML = '';
    const recipes = ctx.recipes, recipeLayout = ctx.recipeLayout, rsort = ctx.rsort;
    if (!recipes.length) {
      const p = document.createElement('p'); p.className = 'empty';
      p.textContent = 'No recipes yet. Add your first recipe below.';
      recipesEl.appendChild(p);
    }
    let host = recipesEl;
    if (recipeLayout === 'tile' && recipes.length) { host = document.createElement('div'); host.className = 'rgrid'; recipesEl.appendChild(host); }
    ctx.sortedRecipes().forEach(function (r) {
      if (recipeLayout === 'tile') {
        const tile = document.createElement('div'); tile.className = 'rtile'; tile.dataset.rid = String(r.id);
        const top = document.createElement('button'); top.type = 'button'; top.className = 'topen';
        top.setAttribute('aria-label', r.name + ', ' + ((rsort === 'iu' || rsort === 'id') ? ingText(r) + ', ' + portionsText(r.portions) : portionsText(r.portions) + ', ' + ingText(r)));
        const nw = document.createElement('span'); nw.className = 'rnw';
        const nm = document.createElement('span'); nm.className = 'rname';
        setTileName(nm, r.name);
        nw.appendChild(nm);
        const tp = document.createElement('span'); tp.className = 'portions'; tp.textContent = portionsText(r.portions);
        const ti = document.createElement('span'); ti.className = 'portions'; ti.textContent = ingText(r);
        const sub = document.createElement('span'); sub.className = 'rsub'; const ingFirst = (rsort === 'iu' || rsort === 'id'); sub.appendChild(ingFirst ? ti : tp); sub.appendChild(ingFirst ? tp : ti);
        top.appendChild(nw); top.appendChild(sub);
        const rin = document.createElement('div'); rin.className = 'rin'; rin.appendChild(top); tile.appendChild(rin);
        const sw = addSwipe(tile, rin, r, tile, true);
        top.addEventListener('click', function (e) { if (sw && sw.open) { sw.close(); return; } if (e.detail > 0 && isDesk()) return; openView(r); });
        tile.addEventListener('contextmenu', function (e) { if (isDesk()) { e.preventDefault(); openView(r); } });
        host.appendChild(tile);
        return;
      }
      const card = document.createElement('section'); card.className = 'recipe';
      card.dataset.rid = String(r.id);
      const head = document.createElement('div'); head.className = 'chead';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'cbtn';
      const t = document.createElement('span'); t.className = 'ctitle'; t.textContent = r.name;
      const pt = document.createElement('span'); pt.className = 'portions'; pt.textContent = infoLine(r, rsort);
      open.appendChild(t); open.appendChild(pt);
      head.appendChild(open);
      const more = document.createElement('button'); more.type = 'button'; more.className = 'cbtn cbhits'; more.tabIndex = -1;
      more.innerHTML = '<span class="hits"><span><span class="hrows"></span></span></span>';
      const rin = document.createElement('div'); rin.className = 'rin';
      rin.appendChild(head); rin.appendChild(more); card.appendChild(rin);
      const sw = addSwipe(card, rin, r, head, false);
      const openIt = function (e?: MouseEvent): void { if (sw && sw.open) { sw.close(); return; } if (e && e.detail > 0 && isDesk()) return; openView(r); };
      open.addEventListener('click', openIt);
      more.addEventListener('click', openIt);
      card.addEventListener('contextmenu', function (e) { if (isDesk()) { e.preventDefault(); openView(r); } });
      host.appendChild(card);
    });
    if (viewTarget) {
      const id = String(viewTarget.id);
      const nr = recipes.find(function (x) { return String(x.id) === id; });
      if (nr) viewTarget = nr;
      else { viewTarget = null; if (dlgView.open) dlgView.close(); }
    }
    if (viewTarget && dlgView.open) renderView();
    ctx.applyRecipeFilter(false);
    fitRTiles(); ctx.syncClear();
  }

  // ---- The recipe window: opens when a card is tapped. Only the ingredient list scrolls (6 rows and half of the 7th).
  function fitView(): void {
    viewList.style.maxHeight = '';
    const rows = viewList.querySelectorAll<HTMLElement>('li:not(.empty)');
    if (rows.length > 6) {
      const a = rows[0], g = rows[6];
      viewList.style.maxHeight = (g.offsetTop + g.offsetHeight / 2 - a.offsetTop + 3) + 'px';
    }
  }

  function renderView(): void {
    const r = viewTarget; if (!r) return;
    (document.getElementById('viewTitle') as HTMLElement).textContent = r.name;
    (document.getElementById('viewPortions') as HTMLElement).textContent = infoLine(r, ctx.rsort);
    const st = viewList.scrollTop;
    viewList.innerHTML = '';
    if (!r.items.length) {
      const e = document.createElement('li'); e.className = 'empty'; e.textContent = 'No ingredients yet.'; viewList.appendChild(e);
    }
    r.items.forEach(function (it) {
      const li = document.createElement('li');
      const span = document.createElement('span'); span.className = 'name';
      const q = document.createElement('strong'); q.className = 'qty';
      q.textContent = it.qty + '\u00a0' + unitLabel(it.qty, it.unit) + ' ';
      span.appendChild(q); span.appendChild(nameFrag(it));
      const doDel = function (): void {
        const idx = r.items.indexOf(it);
        r.items = r.items.filter(function (x) { return x !== it; });
        const hit = ctx.items.filter(function (x) {
          return !x.unlinked && x.unit === it.unit && fullName(x).toLowerCase() === fullName(it).toLowerCase() && (x.from || []).some(function (f) { return f.id === r.id; });
        });
        hit.forEach(function (x) { x.unlinked = true; });
        ctx.dismissSearch();
        ctx.saveR(); ctx.save(); renderRecipes(); ctx.render();
        ctx.showToast('Item removed.', function () {
          r.items.splice(Math.min(idx, r.items.length), 0, it);
          hit.forEach(function (x) { delete x.unlinked; });
          ctx.saveR(); ctx.save(); renderRecipes(); ctx.render();
        });
      };
      const grip = document.createElement('span'); grip.className = 'grip'; grip.title = 'Drag to reorder';
      grip.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
      const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'itembtn';
      eb.setAttribute('aria-label', 'Edit ' + it.text);
      eb.appendChild(span);
      eb.addEventListener('click', function () { ctx.openRecipeEdit(r, it); });
      const fg = swipeRow(li, doDel, it.text); fg.appendChild(grip); fg.appendChild(eb); fg.finish(); viewList.appendChild(li);
      if (ctx.query.trim()) { grip.style.opacity = '.35'; grip.style.cursor = 'default'; grip.title = 'Reordering is off while searching'; }
      ctx.enableDrag(grip, li, viewList, r);
    });
    if (dlgView.open) { fitView(); viewList.scrollTop = st; }
  }

  function openView(r: Recipe): void {
    viewTarget = r;
    renderView();
    dlgView.showModal();
    dlgView.setAttribute('tabindex', '-1');
    dlgView.focus({ preventScroll: true });
    fitView(); viewList.scrollTop = 0;
  }

  dlgView.addEventListener('close', function () { viewTarget = null; });

  return { renderRecipes, fitView, getTarget: function () { return viewTarget; } };
}
