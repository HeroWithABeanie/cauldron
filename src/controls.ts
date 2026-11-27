// The buttons around the lists: the two layout switches (Shopping list rows/tiles, Recipes cards/tiles), the "..." menu with its
// Clear / Uncheck / Wipe entries, and syncClear, which shows or hides all of them for the current tab. The code is the code that used to
// be in app.js (step 1c-6b); only the typing is new.
import { uiLocked } from './ui';
import type { Item, Recipe } from './types';

/** What the controls need from the app. The two layouts and the tab are shared with other parts of app.js, so they come in as properties. */
export interface ControlsCtx {
  /** The two lists are only ever changed in place (see store.setList), so they can be passed directly. */
  readonly items: Item[];
  readonly recipes: Recipe[];
  layoutMode: 'list' | 'grid';
  recipeLayout: 'card' | 'tile';
  readonly searchOpen: boolean;
  readonly currentView: string;
  /** localStorage keys the two layouts are saved under (app.js reads them at start-up). */
  readonly LKEY: string;
  readonly RLKEY: string;
  readonly fabbar: HTMLElement;
  readonly wipeBtn: HTMLElement;
  readonly clearBtn: HTMLElement;
  readonly uncheckBtn: HTMLElement;
  render(): void;
  renderRecipes(): void;
  closeSearch(commit: boolean): void;
}

export interface Controls {
  /** Shows or hides the buttons that belong to the current tab (and closes the menu when it has nothing to hold). */
  syncClear(): void;
  closeMenu(): void;
}

export function createControls(ctx: ControlsCtx): Controls {
  const items = ctx.items, recipes = ctx.recipes, fabbar = ctx.fabbar, wipeBtn = ctx.wipeBtn, clearBtn = ctx.clearBtn, uncheckBtn = ctx.uncheckBtn;
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };

  const layoutBtn = el('layoutBtn'), layoutBtnRow = el('layoutBtnRow'), layoutToggle = el('layoutToggle'), recipeLayoutBtn = el('recipeLayoutBtn');
  function syncLayoutBtn(): void {
    const g = ctx.layoutMode === 'grid';
    [layoutBtn, layoutBtnRow].forEach(function (b) {
      b.classList.toggle('grid', g);
      b.setAttribute('aria-checked', g ? 'true' : 'false');
    });
    const t = ctx.recipeLayout === 'tile', lbl = t ? 'Switch to list layout' : 'Switch to tile layout';
    layoutToggle.classList.toggle('tiles', t);
    layoutToggle.setAttribute('aria-checked', t ? 'true' : 'false');
    layoutToggle.setAttribute('aria-label', lbl); layoutToggle.title = lbl;
    recipeLayoutBtn.classList.toggle('grid', t);
    recipeLayoutBtn.setAttribute('aria-checked', t ? 'true' : 'false');
  }
  function flipRecipeLayout(): void {
    if (uiLocked) return;
    ctx.recipeLayout = ctx.recipeLayout === 'tile' ? 'card' : 'tile';
    try { localStorage.setItem(ctx.RLKEY, ctx.recipeLayout); } catch (e) { /* storage may be blocked */ }
    syncLayoutBtn(); ctx.renderRecipes();
  }
  layoutToggle.addEventListener('click', function () {
    layoutToggle.classList.add('pressed');
    setTimeout(function () { layoutToggle.classList.remove('pressed'); }, 125);
    flipRecipeLayout();
  });
  recipeLayoutBtn.addEventListener('click', flipRecipeLayout);
  function flipListLayout(): void {
    if (uiLocked) return;
    ctx.layoutMode = ctx.layoutMode === 'grid' ? 'list' : 'grid';
    try { localStorage.setItem(ctx.LKEY, ctx.layoutMode); } catch (e) { /* storage may be blocked */ }
    syncLayoutBtn(); ctx.render();
  }
  layoutBtn.addEventListener('click', flipListLayout);
  layoutBtnRow.addEventListener('click', flipListLayout);
  syncLayoutBtn();
  const menuBtn = el('menuBtn');
  function openMenu(): void {
    if (ctx.searchOpen) ctx.closeSearch(true);   // opening the menu dismisses an active search
    fabbar.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu(): void {
    fabbar.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', function () {
    if (fabbar.classList.contains('menu-open')) closeMenu(); else openMenu();
  });
  [wipeBtn, clearBtn, uncheckBtn].forEach(function (b) { b.addEventListener('click', closeMenu); });
  document.addEventListener('click', function (ev) {
    if (!fabbar.classList.contains('menu-open')) return;
    if ((ev.target as Element).closest('#menuBtn,#menu')) return;
    closeMenu();
  });
  function syncClear(): void {
    const n = items.filter(function (x) { return x.done; }).length;
    const onList = ctx.currentView === 'list', has = onList ? items.length > 0 : recipes.length > 0;
    wipeBtn.hidden = !onList || !items.length;
    clearBtn.hidden = !onList || n < 1;
    uncheckBtn.hidden = !onList || n < 2;
    menuBtn.hidden = !onList || !items.length;
    layoutToggle.hidden = onList || !recipes.length;
    recipeLayoutBtn.hidden = !recipes.length;
    if (!onList) closeMenu();
    el('menuSep').hidden = !onList || !items.length;
    layoutBtnRow.hidden = !items.length;
    const sb = document.querySelector('#fabRow .searchbtn') as HTMLElement | null; if (sb) sb.hidden = !has;
    if (!has) { closeMenu(); if (ctx.searchOpen) ctx.closeSearch(false); }
    syncLayoutBtn();
  }

  return { syncClear, closeMenu };
}
