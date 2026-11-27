// The two tabs (Shopping list / Recipes): switching the view, with the slide animation, and the tab buttons themselves. The code is the
// code that used to be in app.js (step 1c-6c); only the typing is new.

/** What the tabs need from the app. The current view and the "sliding" flag are shared with the rest of app.js, so they come in as properties. */
export interface TabsCtx {
  currentView: string;
  sliding: boolean;
  syncClear(): void;
  updateRow(v: string): void;
  closeSearch(commit: boolean): void;
  /** These come in through here because swipe.ts, tiles.ts and tabicon.ts need a real page to work. */
  closeOpenSwipe(): void;
  setSwapAll(): void;
  fitAll(): void;
  fitRTiles(): void;
  animateTabIcon(v: string): void;
}

export interface Tabs {
  /** Shows the other view; slides unless the person prefers reduced motion. (The tab buttons call this.) */
  switchView(v: string): void;
}

export function createTabs(ctx: TabsCtx): Tabs {
  const tabs = document.querySelectorAll<HTMLElement>('.tab'),
    views: Record<string, HTMLElement> = { list: document.getElementById('view-list') as HTMLElement, recipes: document.getElementById('view-recipes') as HTMLElement };
  function switchView(v: string): void {
    ctx.closeOpenSwipe();
    const from = views[ctx.currentView], to = views[v], dir = v === 'recipes' ? 1 : -1;
    ctx.currentView = v;
    ctx.syncClear();
    ctx.updateRow(v);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    to.hidden = false;
    ctx.setSwapAll(); ctx.fitAll(); ctx.fitRTiles();
    if (reduce || !to.animate) { from.hidden = true; return; }
    ctx.sliding = true;
    from.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0';
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    const fa = from.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + (-dir * 100) + '%)', opacity: 0 }], { duration: 320, easing: ease, fill: 'forwards' });
    const ta = to.animate([{ transform: 'translateX(' + (dir * 100) + '%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 320, easing: ease });
    ta.onfinish = ta.oncancel = function () { from.hidden = true; from.style.cssText = ''; fa.cancel(); ctx.sliding = false; };
  }

  tabs.forEach(function (tb) {
    tb.addEventListener('click', function () {
      const v = tb.dataset.view as string;
      if (v === ctx.currentView || ctx.sliding) return;
      ctx.closeSearch(false);
      ctx.animateTabIcon(v);
      tabs.forEach(function (x) { const on = x === tb; x.setAttribute('aria-selected', String(on)); x.classList.toggle('on', on); });
      switchView(v);
    });
  });

  return { switchView };
}
