// The banner at the bottom ("Item deleted. Undo"): show, swap the text, hide, swipe down to dismiss.
// It moves into the topmost open window so it stays visible (see placeToast in app.js, which is handed in
// with setToastPlacer).
import { EASE, noMotion } from './ui';

export const toast = document.getElementById('toast') as HTMLElement;
const toastMsg = document.getElementById('toastMsg') as HTMLElement;
const toastClip = document.getElementById('toastClip') as HTMLElement;
const toastRow = document.getElementById('toastRow') as HTMLElement;
const undoBtn = document.getElementById('toastUndo') as HTMLButtonElement;

type Timer = ReturnType<typeof setTimeout>;
let toastTimer: Timer | undefined;
let toastAction: (() => void) | null = null;
let toastAnim: Animation | null = null;
let hiding = false;
let toastKind = 'undo';
let placeToast: () => void = () => { /* replaced by setToastPlacer */ };

export function setToastPlacer(fn: () => void): void { placeToast = fn; }

function toastDist(): number { return toast.offsetHeight + 160; }

export function hideToast(): void {
  toastAction = null;
  clearTimeout(toastTimer);
  if (toast.hidden || hiding) return;
  if (noMotion() || !toast.animate) { toast.hidden = true; return; }
  hiding = true;
  toast.style.pointerEvents = 'none';
  const a = toast.animate([
    { transform: 'translate(-50%,0)', opacity: 1 },
    { transform: 'translate(-50%,' + toastDist() + 'px)', opacity: 0 },
  ], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  toastAnim = a;
  a.onfinish = () => {
    if (toastAnim !== a) return;
    toast.hidden = true; hiding = false; toastAnim = null;
    toast.style.pointerEvents = '';
    a.cancel();
  };
}

/** Shows the banner. With `undo` the button runs it; `label` renames the button (and then it is not an "undo" banner). */
export function showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void {
  placeToast();
  toastClip.style.height = ''; toastRow.style.height = '';
  toastMsg.textContent = msg;
  toastAction = undo || null; toastKind = label ? 'custom' : 'undo';
  undoBtn.textContent = label || 'Undo';
  undoBtn.hidden = !undo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms || 7000);
  const wasVisible = !toast.hidden && !hiding;
  if (hiding) {
    if (toastAnim) toastAnim.cancel();
    hiding = false; toastAnim = null;
    toast.style.pointerEvents = '';
  }
  toast.hidden = false;
  if (wasVisible || noMotion() || !toast.animate) return;
  toast.animate([
    { transform: 'translate(-50%,' + toastDist() + 'px)', opacity: 0 },
    { transform: 'translate(-50%,0)', opacity: 1 },
  ], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

/** Replaces the text of the visible banner with a sliding animation (used for "Changes undone."). */
export function swapToast(msg: string, ms: number): void {
  if (noMotion() || !toastRow.animate) { showToast(msg, null, ms); return; }
  const h = toastRow.offsetHeight;
  toastClip.style.height = h + 'px'; toastRow.style.height = h + 'px';
  const old = toastRow.cloneNode(true) as HTMLElement;
  old.removeAttribute('id');
  old.querySelectorAll('[id]').forEach((n) => { n.removeAttribute('id'); });
  old.inert = true;
  old.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:' + h + 'px';
  toastClip.appendChild(old);
  toastMsg.textContent = msg; toastAction = null;
  undoBtn.hidden = true;
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, ms);
  const oa = old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], { duration: 320, easing: EASE, fill: 'forwards' });
  const na = toastRow.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 320, easing: EASE });
  na.onfinish = na.oncancel = () => {
    oa.cancel();
    if (old.parentNode) old.parentNode.removeChild(old);
  };
}

undoBtn.addEventListener('click', () => {
  if (undoBtn.classList.contains('pressed')) return;
  undoBtn.classList.add('pressed');
  const act = toastAction;
  setTimeout(() => {
    undoBtn.classList.remove('pressed');
    const kind = toastKind;
    if (act) act();
    if (kind === 'undo') swapToast('Changes undone.', 2500); else hideToast();
  }, 175);
});

// ---- Swipe the banner down to dismiss it ----
let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
toast.addEventListener('pointerdown', (ev) => {
  if (hiding || (ev.target as Element).closest('button') || toast.getAnimations().length) return;
  dragging = true; sx = ev.clientX; sy = ev.clientY; dx = 0; dy = 0;
  clearTimeout(toastTimer);
  toast.setPointerCapture(ev.pointerId);
});
toast.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  dy = Math.max(0, ev.clientY - sy);
  toast.style.transform = 'translate(calc(-50% + ' + dx + 'px),' + dy + 'px)';
  toast.style.opacity = String(Math.max(.3, 1 - Math.max(Math.abs(dx) / 300, dy / 150)));
});
function endDrag(): void {
  if (!dragging) return;
  dragging = false;
  const cur = { transform: toast.style.transform || 'translate(-50%,0)', opacity: toast.style.opacity || 1 };
  toast.style.transform = ''; toast.style.opacity = '';
  const far = dy > 40;
  if (!far) {
    if (toast.animate) toast.animate([cur, { transform: 'translate(-50%,0)', opacity: 1 }], { duration: 180, easing: EASE });
    toastTimer = setTimeout(hideToast, 3000);
    return;
  }
  toastAction = null;
  if (noMotion() || !toast.animate) { toast.hidden = true; return; }
  const tx = 0, ty = toastDist();
  hiding = true; toast.style.pointerEvents = 'none';
  const a = toast.animate([cur, { transform: 'translate(calc(-50% + ' + tx + 'px),' + ty + 'px)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  toastAnim = a;
  a.onfinish = () => {
    if (toastAnim !== a) return;
    toast.hidden = true; hiding = false; toastAnim = null;
    toast.style.pointerEvents = '';
    a.cancel();
  };
}
toast.addEventListener('pointerup', endDrag);
toast.addEventListener('pointercancel', () => { dx = 0; dy = 0; endDrag(); });
