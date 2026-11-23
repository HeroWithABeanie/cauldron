// A confirmation window whose button stays locked for a few seconds (countdown + sweeping fill), used before
// destructive actions (delete, wipe, unlink, discard ...).
import { noMotion, shake } from './ui';

export interface TimedConfirm { open(): void; locked(): boolean }

/**
 * open() shows the window and starts the countdown; locked() tells the click handler that the button may not be
 * used yet (and shakes the label to say so).
 */
export function timedConfirm(dlg: HTMLDialogElement, btn: HTMLElement, fill: HTMLElement, lbl: HTMLElement, word: string, secs: number): TimedConfirm {
  let timer: ReturnType<typeof setInterval> | undefined;
  let anim: Animation | null = null;
  dlg.addEventListener('close', function () {
    clearInterval(timer);
    if (anim) { anim.cancel(); anim = null; }
  });
  return {
    open: function () {
      if (dlg.open) return;
      btn.classList.add('locked'); btn.setAttribute('aria-disabled', 'true');
      let left = secs;
      lbl.textContent = word + ' (' + left + ')';
      clearInterval(timer);
      timer = setInterval(function () {
        left--;
        if (left > 0) { lbl.textContent = word + ' (' + left + ')'; }
        else { clearInterval(timer); lbl.textContent = word; btn.classList.remove('locked'); btn.setAttribute('aria-disabled', 'false'); }
      }, 1000);
      if (anim) anim.cancel();
      if (fill.animate && !noMotion()) {
        anim = fill.animate([{ width: '0%' }, { width: '100%' }], { duration: secs * 1000, easing: 'linear', fill: 'forwards' });
      }
      dlg.showModal();
      dlg.setAttribute('tabindex', '-1');
      dlg.focus({ preventScroll: true });
    },
    locked: function () {
      if (!btn.classList.contains('locked')) return false;
      shake(lbl);
      return true;
    },
  };
}
