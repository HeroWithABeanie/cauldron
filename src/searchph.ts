// The search hint ("Search items") slides to its end only when it is wider than the search bar: wait, slide, hold,
// jump back, repeat. start() (re)starts the animation if it is needed, stop() ends it.
import { noMotion } from './ui';

export interface SearchHintCtx {
  readonly searchPhEl: HTMLElement;     // the box that clips the hint
  readonly searchPhText: HTMLElement;   // the hint text that slides
  readonly searchInput: HTMLInputElement;
  readonly searchOpen: boolean;
}

export interface SearchHint {
  start(): void;
  stop(): void;
  /** Freezes the slide where it is (the bar is closing). */
  pause(): void;
  /** True when the box has changed width since the animation was last started. */
  resized(): boolean;
}

export function createSearchHint(ctx: SearchHintCtx): SearchHint {
  const PH_HOLD = 1200, PH_END = 900, PH_SPEED = 0.045;
  let phAnim: Animation | null = null, phW = 0;
  function stop(): void { if (phAnim) { phAnim.cancel(); phAnim = null; } }
  function start(): void {
    stop();
    if (!ctx.searchOpen || ctx.searchInput.value || noMotion() || !ctx.searchPhText.animate) return;
    phW = ctx.searchPhEl.clientWidth;
    const dist = ctx.searchPhText.scrollWidth - phW;
    if (dist <= 2) return;
    const move = dist / PH_SPEED, total = PH_HOLD + move + PH_END, a = 'translateX(0)', b = 'translateX(-' + dist + 'px)';
    phAnim = ctx.searchPhText.animate([
      { transform: a, offset: 0 },
      { transform: a, offset: PH_HOLD / total },
      { transform: b, offset: (PH_HOLD + move) / total },
      { transform: b, offset: 1 }
    ], { duration: total, iterations: Infinity, easing: 'linear' });
  }
  return {
    start, stop,
    pause: function () { if (phAnim) phAnim.pause(); },
    resized: function () { return ctx.searchPhEl.clientWidth !== phW; },
  };
}
