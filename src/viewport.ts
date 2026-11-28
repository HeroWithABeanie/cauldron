// Page-level behaviour of the app shell: the soft fade at the top and bottom of the scrolling lists, the keyboard handling (the app shrinks to
// the part of the screen the keyboard leaves free and stays pinned to the top of what you see) and the lock that keeps the page itself from
// scrolling when the search field gets focus. The code is the code that used to be in app.js (step 1c-6c); only the typing is new.

/** What it needs from the page of the app. */
export interface ViewportCtx {
  readonly list: HTMLElement;
  readonly recipesEl: HTMLElement;
  readonly searchInput: HTMLInputElement;
}

export function createViewport(ctx: ViewportCtx): void {
  const list = ctx.list, recipesEl = ctx.recipesEl, searchInput = ctx.searchInput;

  function updateFade(sc: HTMLElement): void {
    const up = sc.scrollTop > 4, down = sc.scrollTop + sc.clientHeight < sc.scrollHeight - 4;
    sc.style.setProperty('--ft', up ? '32px' : '0px');
    sc.style.setProperty('--fb', down ? '32px' : '0px');
  }
  const scrollers = document.querySelectorAll<HTMLElement>('.scroller');
  scrollers.forEach(function (sc) {
    sc.addEventListener('scroll', function () { updateFade(sc); }, { passive: true });
    updateFade(sc);
  });
  if (window.ResizeObserver) {
    const fadeRO = new ResizeObserver(function () { scrollers.forEach(updateFade); });
    scrollers.forEach(function (sc) { fadeRO.observe(sc); });
    fadeRO.observe(list); fadeRO.observe(recipesEl);
  }

  // Keyboard handling: shrink the app to the part of the screen the keyboard leaves free, and keep that part
  // pinned to the top of what you see (Safari slides the page up when the keyboard opens).
  const mainEl = document.querySelector('main') as HTMLElement, rootEl = document.documentElement;
  function placeBar(): void {
    const v = window.visualViewport; if (!v) return;
    const kb = Math.round(window.innerHeight - (v.height + v.offsetTop)), open = kb > 80;
    rootEl.classList.toggle('kb', open);
    rootEl.style.height = open ? Math.round(v.height) + 'px' : '';
    mainEl.style.transform = open ? 'translateY(' + Math.round(v.offsetTop) + 'px)' : '';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', placeBar);
    window.visualViewport.addEventListener('scroll', placeBar);
  }
  // Tapping the field itself makes Safari scroll the whole page to reveal it. Focus it ourselves without scrolling,
  // and undo any page scroll that still sneaks through.
  function lockScroll(): void {
    if (window.scrollY || rootEl.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0); rootEl.scrollTop = 0; document.body.scrollTop = 0;
    }
  }
  window.addEventListener('scroll', lockScroll, { passive: true });
  searchInput.addEventListener('touchstart', function (ev) {
    if (document.activeElement !== searchInput) { ev.preventDefault(); searchInput.focus({ preventScroll: true }); }
  }, { passive: false });
  searchInput.addEventListener('focus', function () {
    [0, 60, 160, 320, 600].forEach(function (t) { setTimeout(lockScroll, t); });
  });
}

/**
 * Keeps the CSS variables --vvh and --vvt (height and top offset of the part of the screen that is visible) in step with the visual
 * viewport. The windows use --vvt to stay inside the visible part when the keyboard is open. The code is the code that used to be in
 * app.js (step 1c-8c); only the typing is new.
 */
export function trackVisualViewport(): void {
  function syncVV(): void {
    const v = window.visualViewport; if (!v) return;
    const st = document.documentElement.style;
    st.setProperty('--vvh', v.height + 'px');
    st.setProperty('--vvt', v.offsetTop + 'px');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncVV);
    window.visualViewport.addEventListener('scroll', syncVV);
    syncVV();
  }
}
