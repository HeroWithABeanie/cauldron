// The search bar: the magnifier button of the current view opens it (the bar grows out of the button and the keyboard slides up
// together with it), typing filters the list or the recipes, and the x, Escape or a menu / tab change close it again.
// `query` and `searchOpen` stay variables of app.js (the filters, the menu and the tabs read them too); they come in through ctx,
// which is also where this module writes them.
import { noMotion, uiLocked } from './ui';
import { createSearchHint } from './searchph';

export interface SearchCtx {
  query: string;
  searchOpen: boolean;
  readonly currentView: string;
  readonly searchInput: HTMLInputElement;
  readonly fabbar: HTMLElement;
  closeMenu(): void;
  applyListFilter(animate: boolean): void;
  applyRecipeFilter(animate: boolean): void;
}

export interface Search {
  open(): void;
  close(animate: boolean): void;
  /** The x button and Escape: the x gives a little pop, then the bar collapses. */
  requestClose(): void;
  /** The wording of the add button and the search button of the new view ('list' or 'recipes'). */
  updateRow(v: string): void;
}

export function createSearch(ctx: SearchCtx): Search {
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };
  const searchbar = el('searchbar'), searchInput = ctx.searchInput, fabbar = ctx.fabbar,
    searchPhEl = el('searchPh'), searchPhText = el('searchPhText'), searchCloseBtn = el('searchClose');
  // Search bar timing, tuned to the roughly 250-300 ms decelerating slide of the iOS/Android keyboard.
  const KB_MS = 280, KB_EASE = 'cubic-bezier(.22,.9,.3,1)';
  // The search hint's slide animation (wait, slide, hold, jump back, repeat) lives in searchph.ts.
  const searchHint = createSearchHint({ searchPhEl, searchPhText, searchInput, get searchOpen() { return ctx.searchOpen; } });
  let closeWait = false;
  function stopPh(): void { searchHint.stop(); }
  function startPh(): void { searchHint.start(); }
  function currentSearchBtn(): HTMLElement { return document.querySelector('#fabRow .searchbtn') as HTMLElement; }
  function updateRow(v: string): void {
    const rec = v === 'recipes', sb = currentSearchBtn();
    const l1 = rec ? 'Add recipe' : 'Add item', l2 = rec ? 'Search recipes' : 'Search items';
    el('openItemLabel').textContent = l1;
    sb.setAttribute('aria-label', l2); sb.title = l2;
  }
  function applyCurrent(animate: boolean): void { if (ctx.currentView === 'list') ctx.applyListFilter(animate); else ctx.applyRecipeFilter(animate); }
  function open(): void {
    if (ctx.searchOpen || uiLocked) return;
    ctx.searchOpen = true;
    ctx.closeMenu();
    const btn = currentSearchBtn(), br = btn.getBoundingClientRect(), fr = fabbar.getBoundingClientRect();
    searchbar.style.height = br.height + 'px';
    const phText = ctx.currentView === 'list' ? 'Search ingredients or items...' : 'Search recipes or ingredients...';
    stopPh(); searchPhEl.classList.remove('hide'); searchPhText.textContent = phText;
    searchInput.setAttribute('aria-label', phText.replace(/\.+$/, ''));
    searchbar.hidden = false; btn.style.visibility = 'hidden'; fabbar.classList.add('searching');
    // Focus right away (iOS only allows it inside the tap) so the keyboard slides up while the bar expands.
    searchInput.focus({ preventScroll: true });
    if (!noMotion() && searchbar.animate) {
      const oa = searchbar.animate([{ left: (br.left - fr.left) + 'px', width: br.width + 'px' }, { left: '18px', width: (fr.width - 36) + 'px' }], { duration: KB_MS, easing: KB_EASE });
      oa.onfinish = function () { if (ctx.searchOpen) { fabbar.classList.add('covered'); startPh(); } };
      const mg = searchbar.querySelector('.sicon svg');
      if (mg && mg.animate) mg.animate([{ transform: 'scale(.78)' }, { transform: 'scale(1)' }], { duration: KB_MS * .6, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    } else { fabbar.classList.add('covered'); startPh(); }
  }
  function close(animate: boolean): void {
    if (!ctx.searchOpen) return;
    ctx.searchOpen = false;
    searchInput.blur();   // keyboard slides away while the bar collapses
    fabbar.classList.remove('searching', 'covered');
    ctx.query = ''; searchInput.value = '';
    searchHint.pause(); searchPhEl.classList.remove('hide');
    applyCurrent(animate);
    const btn = currentSearchBtn(), br = btn.getBoundingClientRect(), fr = fabbar.getBoundingClientRect();
    const done = function () { stopPh(); searchbar.hidden = true; btn.style.visibility = ''; };
    if (!animate || noMotion() || !searchbar.animate) { done(); return; }
    const a = searchbar.animate([{ left: '18px', width: (fr.width - 36) + 'px' }, { left: (br.left - fr.left) + 'px', width: br.width + 'px' }], { duration: KB_MS, easing: KB_EASE, fill: 'forwards' });
    a.onfinish = function () { done(); a.cancel(); };
  }
  function requestClose(): void {
    if (!ctx.searchOpen || closeWait) return;
    if (noMotion() || !searchCloseBtn.animate) { close(true); return; }
    closeWait = true;
    searchCloseBtn.animate([{ transform: 'scale(.78)' }, { transform: 'scale(1)' }], { duration: KB_MS * .6, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    setTimeout(function () { closeWait = false; close(true); }, KB_MS * .6 + 2);
  }
  document.querySelectorAll('.searchbtn').forEach(function (b) { b.addEventListener('click', open); });
  searchCloseBtn.addEventListener('click', requestClose);
  searchInput.addEventListener('input', function () {
    ctx.query = searchInput.value; applyCurrent(true);
    if (ctx.query) { searchPhEl.classList.add('hide'); stopPh(); }
    else { searchPhEl.classList.remove('hide'); startPh(); }
  });
  searchInput.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') requestClose(); });
  window.addEventListener('resize', function () { if (ctx.searchOpen && !searchInput.value && searchHint.resized()) startPh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ctx.searchOpen && !searchInput.value) startPh(); });
  return { open, close, requestClose, updateRow };
}
