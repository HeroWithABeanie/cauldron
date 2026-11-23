// Smooth changes: items or recipes that arrive from the server (or that you add yourself) are animated.
// Own deletions already have the swipe animation, so only deletions made on the server play the reverse animation.
import { EASE, noMotion, lockUI } from './ui';

const SPRING = 'cubic-bezier(.34,1.56,.64,1)', ANIM_MAX = 6;

/** What the animation needs to know about the app right now. app.js passes an object with getters, so it is always current. */
export interface AnimState {
  readonly list: HTMLElement;
  readonly recipesEl: HTMLElement;
  readonly sliding: boolean;
  readonly query: string;
  readonly currentView: string;
  readonly layoutMode: string;
  readonly recipeLayout: string;
}

interface Ctx { root: HTMLElement; sel: string; attr: string; mode: 'grid' | 'rows' | 'cards' }
interface Snap { keys: string[]; nodes: Record<string, HTMLElement>; rects: Record<string, DOMRect>; h: Record<string, number>; box: HTMLElement | null; boxH: number }

function rcOf(e: Element): DOMRect { return e.getBoundingClientRect(); }

function animCtx(s: AnimState, kind: string): Ctx | null {
  if (noMotion() || s.sliding || s.query.trim()) return null;
  if (kind === 'list') {
    if (s.currentView !== 'list' || !s.list.animate) return null;
    return { root: s.list, sel: 'li[data-key]', attr: 'key', mode: s.layoutMode === 'grid' ? 'grid' : 'rows' };
  }
  if (s.currentView !== 'recipes' || !s.recipesEl.animate) return null;
  return { root: s.recipesEl, sel: '.recipe[data-rid],.rtile[data-rid]', attr: 'rid', mode: s.recipeLayout === 'tile' ? 'grid' : 'cards' };
}

function snapAnim(c: Ctx): Snap {
  const o: Snap = { keys: [], nodes: {}, rects: {}, h: {}, box: c.root.firstElementChild as HTMLElement | null, boxH: 0 };
  Array.prototype.forEach.call(c.root.querySelectorAll<HTMLElement>(c.sel), function (e: HTMLElement) {
    const k = e.dataset[c.attr] as string, r = rcOf(e);
    o.keys.push(k); o.nodes[k] = e; o.rects[k] = r; o.h[k] = r.height;
  });
  if (o.box) o.boxH = rcOf(o.box).height;
  return o;
}

/**
 * Takes a picture of the list, runs the change fn (which redraws it) and then plays the difference.
 * kind is 'list' or 'recipes'. lock = block the screen for as long as the animation runs.
 */
export function withAnim(s: AnimState, kind: string, fn: () => void, lock?: boolean): void {
  let c: Ctx | null = null, o: Snap | null = null, ms = 0;
  try { c = animCtx(s, kind); if (c) o = snapAnim(c); } catch (e) { o = null; }
  fn();
  if (o) try { ms = playAnim(c as Ctx, o) || 0; } catch (e) { /* the change is already shown; only the animation is lost */ }
  if (lock && ms) lockUI(ms);
}

function flashEl(e: Element | null, c0: string, c1: string): void {
  if (e && e.animate) e.animate([{ backgroundColor: c0 }, { backgroundColor: c1 }], { duration: 1500, delay: 250, easing: 'ease-out' });
}
function flashNew(c: Ctx, e: HTMLElement): void {
  if (c.attr === 'rid') flashEl(e, 'rgba(92,191,134,.45)', getComputedStyle(e).backgroundColor);
  else flashEl(e.querySelector('.swfg') || e.querySelector('.tile'), '#fff3b0', '#ffffff');
}

function playAnim(c: Ctx, o: Snap): number {
  const els: HTMLElement[] = Array.prototype.slice.call(c.root.querySelectorAll(c.sel)), nk: Record<string, HTMLElement> = {};
  els.forEach(function (e) { nk[e.dataset[c.attr] as string] = e; });
  const added = els.filter(function (e) { return !((e.dataset[c.attr] as string) in o.nodes); });
  const gone = o.keys.filter(function (k) { return !(k in nk); });
  const n = added.length + gone.length;
  if (!n || n > ANIM_MAX) return 0;   // nothing changed, or too much at once (e.g. a first sync): just show it
  if (!o.keys.length || !els.length) edgeAnim(c, o, els, added);
  else if (c.mode === 'grid') gridAnim(c, o, els, added, gone);
  else stackAnim(c, o, els, nk, added, gone);
  return 700;
}

// First item in an empty list / last item removed: nothing to slide from or behind, so the old content fades out
// while the new content fades in (and the list box resizes).
function edgeAnim(c: Ctx, o: Snap, _els: HTMLElement[], added: HTMLElement[]): void {
  const root = c.root, ghost = o.box, tgt = root.firstElementChild as HTMLElement | null;
  if (!ghost || !tgt || ghost === tgt) return;
  const pos = root.style.position;
  root.style.position = 'relative';
  ghost.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:2;pointer-events:none;margin:0';
  ghost.setAttribute('aria-hidden', 'true');
  root.appendChild(ghost);
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).onfinish = function () { ghost.remove(); root.style.position = pos; };
  if (tgt.tagName === 'UL' && !tgt.classList.contains('grid') && o.boxH) {
    const h1 = rcOf(tgt).height;
    if (Math.abs(h1 - o.boxH) > 1) tgt.animate([{ height: o.boxH + 'px' }, { height: h1 + 'px' }], { duration: 380, easing: EASE });
  }
  tgt.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 480, easing: EASE });
  added.forEach(function (e) { flashNew(c, e); });
}

// Tiles: the others glide to their new places, a new tile pops in, a removed tile shrinks away.
function gridAnim(c: Ctx, o: Snap, els: HTMLElement[], added: HTMLElement[], gone: string[]): void {
  const ul = els[0].parentNode as HTMLElement, pos = ul.style.position;
  els.forEach(function (e) {
    const r0 = o.rects[e.dataset[c.attr] as string]; if (!r0) return;
    const r = rcOf(e), dx = r0.left - r.left, dy = r0.top - r.top;
    if (dx || dy) e.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 520, easing: EASE });
  });
  added.forEach(function (e) {
    e.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 460, delay: 140, easing: SPRING, fill: 'backwards' });
    flashNew(c, e);
  });
  if (gone.length) {
    ul.style.position = 'relative';
    const ur = rcOf(ul);
    let left = gone.length;
    gone.forEach(function (k) {
      const g = o.nodes[k], r0 = o.rects[k];
      g.style.cssText = 'position:absolute;pointer-events:none;margin:0;left:' + (r0.left - ur.left) + 'px;top:' + (r0.top - ur.top) + 'px;width:' + r0.width + 'px;height:' + r0.height + 'px';
      g.setAttribute('aria-hidden', 'true');
      ul.appendChild(g);
      g.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).onfinish = function () { g.remove(); if (!--left) ul.style.position = pos; };
    });
  }
}

// Rows and cards: a new one slides out from behind the one above while the rest make room; a removed one slides
// back behind the one above while the rest close up.
function stackAnim(c: Ctx, o: Snap, _els: HTMLElement[], nk: Record<string, HTMLElement>, added: HTMLElement[], gone: string[]): void {
  const rows = c.mode === 'rows', root = c.root, opt = { duration: 520, easing: EASE };
  added.forEach(function (e) {
    if (rows) {
      const u = e.parentNode as HTMLElement, sole = u.children.length === 1, tg = sole ? u : e, fg = (e.querySelector('.swfg') || e.firstElementChild) as HTMLElement;
      const th = rcOf(tg).height, tcs = getComputedStyle(tg), a0: Record<string, string | number> = { height: '0px', opacity: 0 }, a1: Record<string, string | number> = { height: th + 'px', opacity: 1 };
      if (sole) { a0.marginTop = '0px'; a1.marginTop = tcs.marginTop; }
      else { a0.borderBottomWidth = '0px'; a1.borderBottomWidth = tcs.borderBottomWidth; }
      tg.style.overflow = 'hidden';
      tg.animate([a0, a1], opt).onfinish = function () { tg.style.overflow = ''; };
      fg.animate([{ transform: 'translateY(-100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], opt);
    } else {
      const h = rcOf(e).height, mb = getComputedStyle(e).marginBottom;
      e.style.overflow = 'hidden';
      e.animate([{ height: '0px', marginBottom: '0px', opacity: 0 }, { height: h + 'px', marginBottom: mb, opacity: 1 }], opt).onfinish = function () { e.style.overflow = ''; };
    }
    flashNew(c, e);
  });
  gone.slice().reverse().forEach(function (k) {
    const g = o.nodes[k], idx = o.keys.indexOf(k), h = o.h[k];
    let prev: HTMLElement | null = null;
    for (let j = idx - 1; j >= 0; j--) { if (nk[o.keys[j]]) { prev = nk[o.keys[j]]; break; } }
    g.style.pointerEvents = 'none'; g.setAttribute('aria-hidden', 'true');
    if (prev) (prev.parentNode as Node).insertBefore(g, prev.nextSibling);
    else if (rows) { const fu = root.querySelector('ul') as HTMLElement; fu.insertBefore(g, fu.firstChild); }
    else root.insertBefore(g, root.firstChild);
    g.style.height = h + 'px'; g.style.overflow = 'hidden';
    const done = function () { g.remove(); };
    if (rows) {
      g.animate([{ height: h + 'px', borderBottomWidth: '2px' }, { height: '0px', borderBottomWidth: '0px' }], { duration: 420, easing: EASE, fill: 'forwards' }).onfinish = done;
      const gf = g.querySelector('.swfg');
      if (gf) gf.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], { duration: 420, easing: EASE, fill: 'forwards' });
    } else {
      const mb = getComputedStyle(g).marginBottom;
      g.animate([{ height: h + 'px', marginBottom: mb, opacity: 1 }, { height: '0px', marginBottom: '0px', opacity: 0 }], { duration: 420, easing: EASE, fill: 'forwards' }).onfinish = done;
    }
  });
}
