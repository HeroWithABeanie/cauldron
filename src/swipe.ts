import { noMotion } from './ui';
import { SW_TRASH } from './icons';

// ---- Swipe gestures shared by the Shopping list, the recipe tiles and the recipe window ----
// Only one swiped-open row exists at a time; opening another (or tapping elsewhere) closes it.
const SW_W = 88, SW_GAP = 10, SW_EASE = 'cubic-bezier(.2,.7,.2,1)';

interface OpenSwipe { li: HTMLElement; open: boolean; close(): void }
let swOpen: OpenSwipe | null = null;

export function closeOpenSwipe(): void { if (swOpen) swOpen.close(); }

/** A tap anywhere outside the open row closes it. Called once at start-up. */
export function initSwipe(): void {
  document.addEventListener('pointerdown', function (e) {
    if (swOpen && !swOpen.li.contains(e.target as Node)) swOpen.close();
  });
}

export interface TileSwipeOpts {
  leftAct?: HTMLElement | null; onLeft?: () => void;
  lock?: number; size?: number; commit?: number; keep?: boolean;
  onHop?: (icon: HTMLElement | null) => void; onArm?: (icon: HTMLElement | null) => void;
}
export interface TileSwipe extends OpenSwipe {
  x: number; W: number; gone: boolean; moved: boolean; hopped: boolean; armed: 'd' | 'c' | null; raf: number;
}

// Touch swipe on a tile. Swipe left: the text slides out while a red Delete button grows from the right edge.
// Swipe right (only when opts.leftAct is given): a green check button grows from the left edge.
// Past 20% of the tile width, letting go locks the button at 40% coverage (tap it to act, tap elsewhere to close).
// Past 70%, letting go performs the action. A mouse does not swipe; it uses the hover buttons instead.
export function tileSwipe(li: HTMLElement, act: HTMLElement, tin: HTMLElement, onDelete: () => void, cancelPress: () => void, opts?: TileSwipeOpts): TileSwipe {
  const o_: TileSwipeOpts = opts || {};
  // thresholds as a share of the width: lock = minimum swipe to stay open, size = open button width, commit = swipe that triggers the action
  const T_LOCK = o_.lock || .2, T_SIZE = o_.size || .4, T_COMMIT = o_.commit || .7;
  const lact = o_.leftAct || null, onLeft = o_.onLeft || function () {};
  const ic = act.firstChild as HTMLElement | null, lic = lact ? lact.firstChild as HTMLElement | null : null;
  const r: TileSwipe = { li: li, x: 0, W: 0, open: false, gone: false, moved: false, hopped: false, armed: null, raf: 0, close: function () {} };
  function wOf(v: number): number { return Math.max(0, Math.abs(v) - 8); }
  function opOf(v: number): number { return Math.min(1, Math.max(0, (wOf(v) - 16) / 24)); }
  // x > 0: swiped left (Delete side); x < 0: swiped right (Check side)
  function paint(x: number): void {
    r.x = x; const wd = x > 0 ? wOf(x) : 0, wc = x < 0 ? wOf(x) : 0;
    tin.style.transform = x ? 'translate3d(' + (-x) + 'px,0,0)' : '';
    act.style.width = wd + 'px'; act.style.borderRadius = Math.min(16, wd / 2) + 'px';
    if (ic) ic.style.opacity = String(x > 0 ? opOf(x) : 0);
    if (lact) { lact.style.width = wc + 'px'; lact.style.borderRadius = Math.min(16, wc / 2) + 'px'; if (lic) lic.style.opacity = String(x < 0 ? opOf(x) : 0); }
  }
  let ga: Animation[] | null = null;
  function curX(): number {
    try { const t = getComputedStyle(tin).transform; return t && t !== 'none' ? -new DOMMatrix(t).m41 : 0; } catch (e) { return r.x; }
  }
  function stopAnim(): void {
    if (r.raf) { cancelAnimationFrame(r.raf); r.raf = 0; }
    if (ga) {
      const x = curX(), old = ga; ga = null;
      old.forEach(function (n) { n.onfinish = null; n.cancel(); });
      paint(x);
    }
  }
  function glide(to: number, ms: number, done?: () => void): void {
    stopAnim();
    if (noMotion() || !tin.animate) { paint(to); if (done) done(); return; }
    const from = r.x;
    function on(v: number, side: number): boolean { return side > 0 ? v > 0 : v < 0; }
    function geo(v: number, side: number) { return { width: (on(v, side) ? wOf(v) : 0) + 'px', borderRadius: '16px' }; }
    function opS(v: number, side: number): number { return on(v, side) ? opOf(v) : 0; }
    const o: KeyframeAnimationOptions = { duration: ms, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'forwards' };
    const a1 = tin.animate([{ transform: 'translate3d(' + (-from) + 'px,0,0)' }, { transform: 'translate3d(' + (-to) + 'px,0,0)' }], o);
    const a2 = act.animate([geo(from, 1), geo(to, 1)], o);
    const anims = [a1, a2];
    if (ic && ic.animate) anims.push(ic.animate([{ opacity: opS(from, 1) }, { opacity: opS(to, 1) }], o));
    if (lact) {
      anims.push(lact.animate([geo(from, -1), geo(to, -1)], o));
      if (lic && lic.animate) anims.push(lic.animate([{ opacity: opS(from, -1) }, { opacity: opS(to, -1) }], o));
    }
    ga = anims;
    a1.onfinish = function () {
      if (ga !== anims) return;
      ga = null;
      paint(to);
      anims.forEach(function (n) { n.onfinish = null; n.cancel(); });
      if (done) done();
    };
  }
  // side: 'd' (delete), 'c' (check) or null
  function arm(side: 'd' | 'c' | null): void {
    if (r.armed === side) return; r.armed = side;
    act.classList.toggle('armed', side === 'd');
    if (lact) lact.classList.toggle('armed', side === 'c');
    if (side === 'd' && o_.onArm) o_.onArm(ic);
    if (side && navigator.vibrate) navigator.vibrate(8);
  }
  function hop(side: number): void {
    if (r.hopped) return; r.hopped = true;
    const el = side < 0 ? lic : ic;
    if (side > 0 && o_.onHop) o_.onHop(ic);
    if (noMotion() || !el || !el.animate) return;
    el.animate([
      { transform: 'translateY(0) scale(1,1)' },
      { transform: 'translateY(2px) scale(1.1,.88)', offset: .15 },
      { transform: 'translateY(-8px) scale(.92,1.12)', offset: .4 },
      { transform: 'translateY(0) scale(1.08,.92)', offset: .68 },
      { transform: 'translateY(-2px) scale(.98,1.03)', offset: .84 },
      { transform: 'translateY(0) scale(1,1)' }
    ], { duration: 540, easing: 'ease-out' });
  }
  r.close = function () {
    arm(null); glide(0, 300); r.open = false; act.tabIndex = -1; if (lact) lact.tabIndex = -1;
    if (swOpen === r) swOpen = null;
  };
  function lockIt(side: number): void {
    if (swOpen && swOpen !== r) swOpen.close();
    arm(null); glide(side * r.W * T_SIZE, 300, function () { hop(side); });
    r.open = true; swOpen = r; ((side > 0 ? act : lact) as HTMLElement).tabIndex = 0;
  }
  function commit(side: number): void {
    if (r.gone) return;
    r.gone = true; arm(side > 0 ? 'd' : 'c');
    const btn = (side > 0 ? act : lact) as HTMLElement, fn = side > 0 ? onDelete : onLeft;
    glide(side * (r.W - 8), 200, (side < 0 || o_.keep) ? function () { btn.blur(); fn(); r.gone = false; r.close(); } : fn);
  }
  let sx = 0, sy = 0, base = 0, lock: 'h' | 'v' | null = null, pid: number | null = null;
  li.addEventListener('pointerdown', function (e) {
    const tg = e.target as Element;
    if (e.pointerType === 'mouse' || r.gone || (tg.closest && tg.closest('.tact'))) return;
    stopAnim(); r.W = li.clientWidth; sx = e.clientX; sy = e.clientY; base = r.x; lock = null; r.moved = false; pid = e.pointerId; r.hopped = r.open;
  });
  li.addEventListener('pointermove', function (e) {
    if (pid !== e.pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!lock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lock === 'h') {
        li.setPointerCapture(e.pointerId); cancelPress();
        if (swOpen && swOpen !== r) swOpen.close();
      }
    }
    if (lock !== 'h') return;
    r.moved = true;
    const max = r.W - 8; let x = base - dx;
    if (x < 0 && !lact) x = x * .25;
    else if (x < -max) x = -max + (x + max) * .25;
    else if (x > max) x = max + (x - max) * .25;
    paint(x);
    if (x >= r.W * T_SIZE) hop(1); else if (lact && x <= -r.W * T_SIZE) hop(-1);
    arm(x >= r.W * T_COMMIT ? 'd' : (lact && x <= -r.W * T_COMMIT) ? 'c' : null);
  });
  function end(e: PointerEvent): void {
    if (pid !== e.pointerId) return;
    pid = null;
    if (lock !== 'h') return;
    if (r.x >= r.W * T_COMMIT) commit(1);
    else if (lact && r.x <= -r.W * T_COMMIT) commit(-1);
    else if (r.x > r.W * T_LOCK) lockIt(1);
    else if (lact && r.x < -r.W * T_LOCK) lockIt(-1);
    else r.close();
  }
  li.addEventListener('pointerup', end);
  li.addEventListener('pointercancel', end);
  // after a drag a tap must not open or change the tile
  li.addEventListener('click', function (e) {
    const tg = e.target as Element;
    if (tg.closest && tg.closest('.tact')) { r.moved = false; return; }
    if (r.moved) { r.moved = false; e.preventDefault(); e.stopPropagation(); }
  }, true);
  li.addEventListener('keydown', function (e) {
    const tg = e.target as Element;
    if (e.key === 'Delete' && tg.classList && tg.classList.contains('tile')) { e.preventDefault(); onDelete(); }
  });
  act.addEventListener('click', function () { r.W = li.clientWidth; commit(1); });
  if (lact) lact.addEventListener('click', function () { r.W = li.clientWidth; commit(-1); });
  return r;
}

// ---- Swipe to delete ----
// Touch: the row slides left over a red shape that grows from a sliver into a pill (swipe past about half the
// row to delete it outright). Mouse or trackpad: no swiping, a Delete pill shows on hover or keyboard focus.
export type SwipeFg = HTMLDivElement & { finish(): void };
interface RowSwipe extends OpenSwipe { x: number; raf: number; h: number; hopped: boolean; gone: boolean; lift: boolean; op: number }

// Returns the element that holds the row's content; the caller fills it and then calls .finish().
export function swipeRow(li: HTMLElement, onDelete: () => void, label: string): SwipeFg {
  li.classList.add('sw');
  const act = document.createElement('button'); act.type = 'button'; act.className = 'swact'; act.tabIndex = -1;
  act.setAttribute('aria-label', 'Delete ' + label); act.innerHTML = SW_TRASH;
  const fg = document.createElement('div') as SwipeFg; fg.className = 'swfg';
  const hdel = document.createElement('button'); hdel.type = 'button'; hdel.className = 'swdel';
  hdel.setAttribute('aria-label', 'Delete ' + label); hdel.innerHTML = SW_TRASH + 'Delete';
  li.appendChild(act); li.appendChild(fg);
  fg.finish = function () { fg.appendChild(hdel); };
  const r: RowSwipe = { li: li, x: 0, open: false, raf: 0, h: 0, hopped: false, gone: false, lift: false, op: -1, close: function () {} };
  function paint(x: number): void {
    r.x = x;
    fg.style.transform = 'translate3d(' + x + 'px,0,0)';
    const lift = x < -1; if (lift !== r.lift) { r.lift = lift; fg.classList.toggle('lifted', lift); }
    const h = r.h || (r.h = li.clientHeight - 16), w = Math.max(0, -x - 2 * SW_GAP);
    act.style.width = w + 'px';
    act.style.borderRadius = (Math.min(w, h) / 2) + 'px';
    const o = Math.min(1, Math.max(0, (w - 20) / 24)); if (o !== r.op) { r.op = o; (act.firstChild as HTMLElement).style.opacity = String(o); }
  }
  let ga: Animation[] | null = null;
  function curX(): number {
    try { const t = getComputedStyle(fg).transform; return t && t !== 'none' ? new DOMMatrix(t).m41 : 0; } catch (e) { return r.x; }
  }
  // if a settle animation is still running, freeze the row where it currently is
  function stop(): void {
    if (r.raf) { cancelAnimationFrame(r.raf); r.raf = 0; }
    if (ga) {
      const x = curX(), old = ga; ga = null;
      old.forEach(function (n) { n.onfinish = null; n.cancel(); });
      paint(x);
    }
  }
  // while dragging the position is painted straight from the pointer event (no requestAnimationFrame,
  // which iOS Low Power Mode caps at 30 fps)
  function drag(x: number): void { paint(x); }
  // settle animations use the Web Animations API: the transform runs on the compositor
  function glide(x: number, ms: number, done?: () => void): void {
    stop();
    if (noMotion() || !fg.animate) { paint(x); if (done) done(); return; }
    const from = r.x, h = r.h || (r.h = li.clientHeight - 16), ic = act.firstChild as HTMLElement | null;
    function wOf(v: number): number { return Math.max(0, -v - 2 * SW_GAP); }
    function geo(v: number) { const w = wOf(v); return { width: w + 'px', borderRadius: (h / 2) + 'px' }; }
    function opOf(v: number): number { return Math.min(1, Math.max(0, (wOf(v) - 20) / 24)); }
    if (x < -1 && !r.lift) { r.lift = true; fg.classList.add('lifted'); }
    const o: KeyframeAnimationOptions = { duration: ms || 300, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'forwards' };
    const a1 = fg.animate([{ transform: 'translate3d(' + from + 'px,0,0)' }, { transform: 'translate3d(' + x + 'px,0,0)' }], o);
    const a2 = act.animate([geo(from), geo(x)], o);
    const anims = [a1, a2];
    if (ic && ic.animate) anims.push(ic.animate([{ opacity: opOf(from) }, { opacity: opOf(x) }], o));
    ga = anims;
    a1.onfinish = function () {
      if (ga !== anims) return;
      ga = null;
      paint(x);
      anims.forEach(function (n) { n.onfinish = null; n.cancel(); });
      if (done) done();
    };
  }
  // the icon hops once per gesture, when the shape reaches its full pill size
  function hop(): void {
    if (r.hopped) return;
    r.hopped = true;
    const s = act.firstChild as HTMLElement | null;
    if (noMotion() || !s || !s.animate) return;
    s.animate([
      { transform: 'translateY(0) scale(1,1)' },
      { transform: 'translateY(2px) scale(1.1,.88)', offset: .15 },
      { transform: 'translateY(-8px) scale(.92,1.12)', offset: .4 },
      { transform: 'translateY(0) scale(1.08,.92)', offset: .68 },
      { transform: 'translateY(-2px) scale(.98,1.03)', offset: .84 },
      { transform: 'translateY(0) scale(1,1)' }
    ], { duration: 540, easing: 'ease-out' });
  }
  r.close = function () {
    act.classList.remove('armed');
    glide(0, 300, function () { fg.style.willChange = ''; });
    r.open = false; act.tabIndex = -1;
    if (swOpen === r) swOpen = null;
  };
  function openIt(): void {
    if (swOpen && swOpen !== r) swOpen.close();
    act.classList.remove('armed');
    glide(-SW_W, 300, hop);
    r.open = true; swOpen = r; act.tabIndex = 0;
  }
  function collapse(): void {
    if (noMotion() || !li.animate) { onDelete(); return; }
    const ul = li.parentNode as HTMLElement | null;
    // Last row of the whole list: morph the box into the empty-state message instead of collapsing it to a sliver
    if (ul && ul.querySelectorAll('li').length === 1 && (ul.id === 'viewList' || (ul.parentNode as HTMLElement).querySelectorAll(':scope > ul').length === 1)) {
      const h0 = ul.getBoundingClientRect().height;
      onDelete();
      const nu = ul.id === 'viewList' ? ul : (document.getElementById('list') as HTMLElement).querySelector('ul');
      if (!nu || !nu.animate) return;
      const h1 = nu.getBoundingClientRect().height, ov = nu.style.overflow;
      nu.style.overflow = 'hidden';
      const a1 = nu.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 280, easing: SW_EASE });
      const ph = nu.querySelector('li');
      if (ph && ph.animate) ph.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: SW_EASE });
      a1.onfinish = a1.oncancel = function () { nu.style.overflow = ov; };
      return;
    }
    const h = li.getBoundingClientRect().height;
    li.style.overflow = 'hidden';
    const a = li.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: SW_EASE, fill: 'forwards' });
    a.onfinish = function () { onDelete(); };
  }
  function remove(): void { if (r.gone) return; r.gone = true; collapse(); }
  // swiping past the threshold (or tapping the pill) stretches the shape across the row, then removes it
  function commit(): void {
    if (r.gone) return;
    r.gone = true; r.h = li.clientHeight - 16;
    act.classList.add('armed');
    glide(-li.clientWidth, 260, collapse);
  }
  let sx = 0, sy = 0, base = 0, lock: 'h' | 'v' | null = null, moved = false, x = 0, pid: number | null = null, armed = false, full = 0, thr = 0;
  fg.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || r.gone || (e.target as Element).closest('.grip')) return;
    stop(); fg.style.willChange = 'transform';
    r.h = li.clientHeight - 16; r.hopped = r.open; full = li.clientWidth; thr = full * .55; armed = false;
    sx = e.clientX; sy = e.clientY; base = r.x; lock = null; moved = false; x = base; pid = e.pointerId;
  });
  fg.addEventListener('pointermove', function (e) {
    if (pid !== e.pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!lock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lock === 'h') {
        fg.setPointerCapture(e.pointerId);
        if (swOpen && swOpen !== r) swOpen.close();
      }
    }
    if (lock !== 'h') return;
    moved = true;
    x = base + dx;
    if (x > 0) x = x * .25;
    else if (x < -full) x = -full + (x + full) * .25;
    drag(x);
    if (x <= -SW_W) hop();
    const arm = x < -thr;
    if (arm !== armed) { armed = arm; act.classList.toggle('armed', arm); if (arm && navigator.vibrate) navigator.vibrate(8); }
  });
  function end(e: PointerEvent): void {
    if (pid !== e.pointerId) return;
    pid = null;
    if (lock === 'h') { if (x < -thr) commit(); else if (x < -SW_W / 2) openIt(); else r.close(); }
    else if (!r.open) fg.style.willChange = '';
  }
  fg.addEventListener('pointerup', end);
  fg.addEventListener('pointercancel', end);
  // after a drag, or while a row is open, a tap only closes things; it never ticks or edits the item
  fg.addEventListener('click', function (e) {
    if (moved) { moved = false; e.preventDefault(); e.stopPropagation(); return; }
    if (r.open) { e.preventDefault(); e.stopPropagation(); r.close(); return; }
    if (swOpen) { e.preventDefault(); e.stopPropagation(); swOpen.close(); }
  }, true);
  fg.addEventListener('keydown', function (e) {
    if (e.key === 'Delete') { e.preventDefault(); remove(); }
  });
  act.addEventListener('click', commit);
  hdel.addEventListener('click', function (e) { e.stopPropagation(); remove(); });
  return fg;
}
