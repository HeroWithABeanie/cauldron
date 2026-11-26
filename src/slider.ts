// The card slider of the recipe-description, unlink/relink and edit-item windows: several recipe cards side by side that
// can be swiped (touch and pen; a mouse uses the dots or the arrow keys), with dots below and a height that follows the card.
import { noMotion } from './ui';

export interface SliderHandle {
  /** Watches the cards so the slider re-fits when one changes size; null where ResizeObserver does not exist. The caller disconnects it. */
  ro: ResizeObserver | null;
}

/** `sl` is the clipping box whose first child is the track holding the cards; `dots` is the optional row of dot buttons. */
export function setupSlider(sl: HTMLElement, dots?: HTMLElement | null): SliderHandle {
  const tr = sl.firstChild as HTMLElement, slides = Array.prototype.slice.call(tr.children) as HTMLElement[], n = slides.length,
    dotEls = (dots ? Array.prototype.slice.call(dots.children) : []) as HTMLElement[], PAD = 16,
    EZ = 'cubic-bezier(.2,.7,.2,1)', MS = '.35s';
  let idx = 0, cx = 0;
  function step(): number { return n > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : sl.clientWidth; }
  function hAt(p: number): number {
    p = Math.max(0, Math.min(n - 1, p));
    const a = Math.floor(p), b = Math.min(n - 1, a + 1), f = p - a, ha = slides[a].offsetHeight, hb = slides[b].offsetHeight;
    return Math.round(ha + (hb - ha) * f) + PAD;
  }
  function paint(x: number): void {
    cx = x;
    tr.style.transform = 'translate3d(' + x + 'px,0,0)';
    const st = step() || 1, p = Math.max(0, Math.min(n - 1, -x / st)), cur = Math.round(p);
    sl.style.height = hAt(p) + 'px';
    dotEls.forEach(function (d, i) {
      const on = i === cur; d.classList.toggle('on', on);
      if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
  }
  // lock onto exactly one card
  function go(i: number, animate: boolean): void {
    idx = Math.max(0, Math.min(n - 1, i));
    if (animate && !noMotion()) { tr.style.transition = 'transform ' + MS + ' ' + EZ; sl.style.transition = 'height ' + MS + ' ' + EZ; }
    else { tr.style.transition = 'none'; sl.style.transition = 'none'; }
    paint(-idx * step());
  }
  dotEls.forEach(function (d, i) { d.addEventListener('click', function () { go(i, true); }); });
  let sx = 0, sy = 0, base = 0, lock: 'h' | 'v' | null = null, pid: number | null = null, moved = false, samples: { t: number; x: number }[] = [];
  sl.addEventListener('pointerdown', function (e: PointerEvent) {
    if (e.pointerType === 'mouse' || n < 2) return;
    let live = -idx * step();
    try { const t = getComputedStyle(tr).transform; if (t && t !== 'none') live = new DOMMatrix(t).m41; } catch (err) { /* keep the resting position */ }
    tr.style.transition = 'none'; sl.style.transition = 'none'; paint(live);
    base = live; sx = e.clientX; sy = e.clientY; lock = null; moved = false; pid = e.pointerId; samples = [];
  });
  sl.addEventListener('pointermove', function (e: PointerEvent) {
    if (pid !== e.pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!lock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lock === 'h') sl.setPointerCapture(e.pointerId);
    }
    if (lock !== 'h') return;
    moved = true;
    const min = -(n - 1) * step(); let x = base + dx;
    if (x > 0) x *= .25; else if (x < min) x = min + (x - min) * .25;
    samples.push({ t: e.timeStamp, x: e.clientX });
    while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
    paint(x);
  });
  function end(e: PointerEvent): void {
    if (pid !== e.pointerId) return;
    pid = null;
    if (lock !== 'h') { go(idx, true); return; }
    const st = step(), off = cx + idx * st, a = samples[0], b = samples[samples.length - 1];
    let v = 0, next = idx;
    if (a && b && b.t > a.t && e.timeStamp - b.t < 80) v = (b.x - a.x) / (b.t - a.t);
    if (off < -st * .2 || v < -.4) next = idx + 1;
    else if (off > st * .2 || v > .4) next = idx - 1;
    go(next, true);
  }
  sl.addEventListener('pointerup', end);
  sl.addEventListener('pointercancel', end);
  // after a swipe a tap must not trigger anything on the card
  sl.addEventListener('click', function (e) { if (moved) { moved = false; e.preventDefault(); e.stopPropagation(); } }, true);
  sl.addEventListener('keydown', function (e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1, true); }
  });
  let ro: ResizeObserver | null = null;
  if (window.ResizeObserver) { const obs = ro = new ResizeObserver(function () { if (pid === null) go(idx, false); }); slides.forEach(function (x) { obs.observe(x); }); }
  go(0, false);
  return { ro };
}
