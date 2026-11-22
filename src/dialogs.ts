// Dialog (window) behaviour for the whole app: slide in/out animations, the stack that keeps the toast banner
// in front, the shake of alert windows, Esc/cancel handling and the touch swipe-up-to-dismiss.
// initDialogs() must run once; it takes the functions that close the windows which have to ask first
// (for example "Discard changes?"), keyed by dialog id.
import { EASE, noMotion, shake } from './ui';
import { toast, setToastPlacer } from './toast';

interface Dlg extends HTMLDialogElement { _closing?: boolean; _lock?: boolean; _startY?: number; _closeMs?: number }

// Open windows sit in the browser's top layer and block everything outside them, so a banner kept in the page
// would hide behind them. The banner therefore moves into the topmost window that is open and not closing
// (and back to the page when none is), which keeps it in front and tappable.
const dlgStack: Dlg[] = [];
function topDialog(): Dlg | null {
  for (let i = dlgStack.length - 1; i >= 0; i--) { const d = dlgStack[i]; if (d.open && !d._closing) return d; }
  return null;
}
function placeToast(): void { const t = topDialog() || document.body; if (toast.parentNode !== t) t.appendChild(toast); }

function curTY(el: HTMLElement): number {
  try { const t = getComputedStyle(el).transform; return t && t !== 'none' ? new DOMMatrix(t).m42 : 0; } catch (e) { return 0; }
}

// ---- Swipe a window up to dismiss it (touch only). Warning windows and the Add to Shopping list prompt are left out. ----
interface Swipe { el: Element; x: number; y: number; ly: number; cy: number; on: boolean; dead: boolean; s: Array<{ t: number; y: number }> }

function swipeDismiss(dlg: Dlg, dismiss: () => void): void {
  let st: Swipe | null = null, ga: Animation | null = null, hid = false;
  function showT(): void { if (hid) { toast.style.visibility = ''; hid = false; } }
  function paint(y: number): void {
    dlg.style.transform = y ? 'translate3d(0,' + y + 'px,0)' : '';
    const p = Math.min(1, -y / ((dlg.offsetHeight || 1) * 1.2));
    dlg.style.setProperty('--bd', String(1 - p * .85));
  }
  function stopGlide(): number | null {
    if (!ga) return null;
    const y = curTY(dlg); ga.onfinish = null; ga.cancel(); ga = null; paint(y); return y;
  }
  // content that can still scroll down keeps the swipe for itself
  function canScroll(el: Node | null): boolean {
    while (el) {
      if (el.nodeType === 1) {
        const oy = getComputedStyle(el as Element).overflowY;
        const e = el as Element;
        if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1 && e.scrollTop + e.clientHeight < e.scrollHeight - 1) return true;
      }
      if (el === dlg) break;
      el = el.parentNode;
    }
    return false;
  }
  function back(y: number): void {
    stopGlide();
    const done = () => { paint(0); dlg.style.removeProperty('--bd'); dlg.style.willChange = ''; showT(); };
    if (noMotion() || !dlg.animate) { done(); return; }
    let b0 = parseFloat(dlg.style.getPropertyValue('--bd')); if (!(b0 >= 0)) b0 = 1;
    const a = dlg.animate([{ transform: 'translate3d(0,' + y + 'px,0)', '--bd': b0 }, { transform: 'translate3d(0,0,0)', '--bd': 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.3,.64,1)', fill: 'forwards' });
    ga = a;
    a.onfinish = () => { if (ga !== a) return; ga = null; a.onfinish = null; done(); a.cancel(); };
  }
  function fling(y: number, v: number): void {
    const r = dlg.getBoundingClientRect(), off = r.top - y + r.height + 20, speed = Math.max(-v, 1.2);
    dlg._startY = y; dlg._closeMs = Math.max(160, Math.min(320, (off + y) / speed));
    dismiss();
    // a window that stays open (for example the Discard changes question) bounces back
    if (dlg.open && !dlg._closing) { dlg._startY = 0; dlg._closeMs = 0; back(y); }
    showT();
  }
  // while a swipe is in progress, every scrollable section inside the window is frozen
  let frozen: Array<{ el: HTMLElement; v: string }> = [];
  function thawScroll(): void { frozen.forEach((f) => { f.el.style.overflowY = f.v; }); frozen = []; }
  function freezeScroll(): void {
    thawScroll();
    (Array.prototype.slice.call(dlg.querySelectorAll('*')) as HTMLElement[]).concat([dlg]).forEach((el) => {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) { frozen.push({ el, v: el.style.overflowY }); el.style.overflowY = 'hidden'; }
    });
  }
  function activate(): void {
    st!.on = true; dlg.style.willChange = 'transform'; freezeScroll();
    if (toast.parentNode === dlg) { toast.style.visibility = 'hidden'; hid = true; }
  }
  function vel(s: Swipe, now: number): number {
    const a = s.s[0], b = s.s[s.s.length - 1];
    if (!a || !b || now - b.t > 80 || b.t === a.t) return 0;
    return (b.y - a.y) / (b.t - a.t);
  }
  dlg.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || dlg._closing) { st = null; return; }
    const tg = e.target as Element;
    if (tg.closest && tg.closest('.grip,.toast')) { st = null; return; }
    const t = e.touches[0];
    st = { el: tg, x: t.clientX, y: t.clientY, ly: t.clientY, cy: 0, on: false, dead: false, s: [] };
    const g = stopGlide();
    if (g !== null) { st.cy = g; activate(); }   // catch a window that is still bouncing back
  }, { passive: true });
  dlg.addEventListener('touchmove', (e) => {
    const s = st; if (!s || s.dead) return;
    const t = e.touches[0];
    if (!s.on) {
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (dy < 0 && -dy > Math.abs(dx) * 1.2 && !canScroll(s.el)) { activate(); s.ly = t.clientY; }
      else { s.dead = true; return; }
    }
    if (e.cancelable) e.preventDefault();
    s.cy = Math.min(0, s.cy + (t.clientY - s.ly)); s.ly = t.clientY;
    const now = e.timeStamp;
    s.s.push({ t: now, y: s.cy });
    while (s.s.length > 2 && now - s.s[0].t > 100) s.s.shift();
    paint(s.cy);
  }, { passive: false });
  function end(e: TouchEvent): void {
    const s = st; st = null;
    if (!s || !s.on) return;
    thawScroll(); const y = s.cy, v = vel(s, e.timeStamp), h = dlg.offsetHeight || 1;
    const go = e.type === 'touchend' && y < -4 && v <= .3 && (v < -.45 || -y > Math.max(60, h * .33));
    if (go) fling(y, v); else { back(y); }
  }
  dlg.addEventListener('touchend', end);
  dlg.addEventListener('touchcancel', end);
  dlg.addEventListener('close', () => {
    if (ga) { ga.onfinish = null; ga.cancel(); ga = null; }
    dlg.style.transform = ''; dlg.style.removeProperty('--bd'); dlg.style.willChange = ''; st = null; thawScroll(); showT();
  });
}

/** closers: what Esc / swipe-up runs for windows that must ask first, by dialog id. Other windows just close. */
export function initDialogs(closers: Record<string, () => void>): void {
  setToastPlacer(placeToast);
  const nativeShow = HTMLDialogElement.prototype.showModal, nativeClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function (this: Dlg): void {
    if (this._closing) return;
    nativeShow.call(this);
    const si = dlgStack.indexOf(this); if (si > -1) dlgStack.splice(si, 1); dlgStack.push(this); placeToast();
    if (noMotion() || !this.animate) return;
    const r = this.getBoundingClientRect(), d = -(r.top + r.height + 20);
    this.animate([{ transform: 'translateY(' + d + 'px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 380, easing: EASE });
    try { this.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, pseudoElement: '::backdrop' }); } catch (e) { /* no ::backdrop animation */ }
    // Alert windows shake once after sliding in and ignore taps, Esc and the backdrop until that is over.
    if (this.hasAttribute('data-alert')) {
      const al = this; al._lock = true; al.inert = true;
      setTimeout(() => { if (al.open) shake(al); }, 400);
      setTimeout(() => { al._lock = false; al.inert = false; if (al.open) al.focus({ preventScroll: true }); }, 830);
    }
  };
  HTMLDialogElement.prototype.close = function (this: Dlg, rv?: string): void {
    const dlg = this;
    if (dlg._lock) return;
    if (!dlg.open || dlg._closing || noMotion() || !dlg.animate) { nativeClose.call(dlg, rv); placeToast(); return; }
    dlg._closing = true; placeToast();
    const r = dlg.getBoundingClientRect(), sy = dlg._startY || 0, ms = dlg._closeMs || 320, ez = dlg._closeMs ? 'cubic-bezier(.25,.5,.75,1)' : 'cubic-bezier(.4,0,1,1)'; dlg._startY = 0; dlg._closeMs = 0;
    const d = -(r.top - sy + r.height + 20);
    const a = dlg.animate([{ transform: 'translateY(' + sy + 'px)', opacity: 1 }, { transform: 'translateY(' + d + 'px)', opacity: 0 }], { duration: ms, easing: ez, fill: 'forwards' });
    let b: Animation | null = null;
    try { b = dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards', pseudoElement: '::backdrop' }); } catch (e) { /* no ::backdrop animation */ }
    a.onfinish = () => {
      dlg._closing = false;
      a.cancel(); if (b) b.cancel();
      nativeClose.call(dlg, rv); placeToast();
    };
  };
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      const c = closers[dlg.id];
      if (c) c(); else dlg.close();
    });
  });
  document.querySelectorAll('dialog').forEach((d) => {
    if (d.hasAttribute('data-alert')) return;
    swipeDismiss(d as Dlg, closers[d.id] && d.id !== 'dlgAddList' ? closers[d.id] : () => { d.close(); });
  });
}
