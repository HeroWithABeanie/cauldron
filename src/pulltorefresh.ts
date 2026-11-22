// Pull to refresh: pull a list down from its top to check the server and update the copy on this device.
// The app passes in what this module needs (refresh, last sync time, reduced-motion check, and the function that
// locks the rest of the screen while a refresh runs), so it has no other ties to app.js.

export interface RefreshResult { changed?: boolean }
export interface PullOptions {
  scrollers: ArrayLike<HTMLElement>;
  refresh: () => Promise<RefreshResult | void>;
  lastSyncDate: () => Date | null;
  noMotion: () => boolean;
  /** Called with true when a refresh starts and false when it is over. */
  setLock: (on: boolean) => void;
}

const PTR_TH = 60, PTR_HOLD = 64;
let ptrBusy = false;      // shared by all lists: only one refresh at a time

const p2 = (v: number): string => String(v).padStart(2, '0');

/** The caption under the spinner, e.g. "Last updated Today, 09:05". */
export function formatLastSync(d: Date | null, now: Date = new Date()): string {
  if (!d) return 'Not updated yet';
  const k = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return 'Last updated ' + (k <= 0 ? 'Today' : k === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

function setupPull(sc: HTMLElement, o: PullOptions): void {
  const lastSyncText = () => formatLastSync(o.lastSyncDate());
  const clip = document.createElement('div'); clip.className = 'ptrclip';
  clip.innerHTML='<div class="ptr"><div class="ptrorb"><svg class="ptrspin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"></svg><svg class="ptrok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><svg class="ptrbad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg></div><span class="ptrcap" role="status" aria-live="polite"></span></div>';
  sc.parentNode!.insertBefore(clip, sc);
  const ptr = clip.firstChild as HTMLElement;
  const cap = ptr.querySelector('.ptrcap') as HTMLElement;
  const sp = ptr.querySelector('.ptrspin') as SVGElement;
  const spokes: SVGLineElement[] = [], fade: number[] = [];
  for (let i = 0; i < 12; i++) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', '12'); l.setAttribute('y1', '3'); l.setAttribute('x2', '12'); l.setAttribute('y2', '7.5');
    l.setAttribute('transform', 'rotate(' + (i * 30) + ' 12 12)');
    sp.appendChild(l); spokes.push(l); fade.push(Math.max(.2, 1 - ((12 - i) % 12) * .075));
  }
  let state = 'idle', pull = 0, active = false, decided = false, sy = 0, sx = 0, armedOnce = false;
  function setSpokes(prog: number, load?: boolean): void { spokes.forEach((s, j) => { s.style.opacity = String(load ? fade[j] : (j < prog * 12 ? .9 : .15)); }); }
  function setPull(p: number, anim: boolean): void {
    pull = p;
    const mv = anim && !o.noMotion() ? 'transform .45s cubic-bezier(.34,1.3,.64,1)' : 'none';
    ptr.style.transition = mv;
    sc.style.transition = mv === 'none' ? 'none' : mv + ',--ft .25s ease,--fb .25s ease';
    sc.style.transform = p ? 'translateY(' + p + 'px)' : '';
    ptr.style.transform = 'translateY(' + (p - PTR_HOLD) + 'px)';
    ptr.style.opacity = String(Math.min(1, p / 28));
  }
  function reset(delay: number): void {
    setTimeout(() => {
      state = 'idle'; ptrBusy = false; o.setLock(false); armedOnce = false; ptr.className = 'ptr'; setSpokes(0); sc.style.transition = '';
    }, delay);
  }
  function finish(r: { ok: boolean; changed?: boolean }): void {
    let hold: number;
    ptr.classList.remove('loading');
    if (!r.ok) {
      ptr.classList.add('bad'); cap.textContent = 'Offline \u00b7 showing saved copy'; hold = 1500;
    } else {
      if (r.changed) ptr.classList.add('ok');
      cap.textContent = lastSyncText();
      if (cap.animate && !o.noMotion()) cap.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 300 });
      hold = r.changed ? 800 : 350;
    }
    setTimeout(() => { setPull(0, true); reset(480); }, hold);
  }
  function run(): void {
    state = 'loading'; ptrBusy = true; o.setLock(true);
    ptr.classList.add('loading'); setSpokes(1, true);
    cap.textContent = lastSyncText();
    setPull(PTR_HOLD, true);
    const t0 = Date.now();
    const job = o.refresh();
    job.then((r) => ({ ok: true, changed: !!(r && r.changed) }), () => ({ ok: false, changed: false })).then((r) => {
      setTimeout(() => { finish(r); }, Math.max(0, 600 - (Date.now() - t0)));
    });
  }
  sc.addEventListener('touchstart', (e) => {
    const tg = e.target as Element;
    if (state !== 'idle' || ptrBusy || sc.scrollTop > 0 || e.touches.length !== 1 || (tg.closest && tg.closest('dialog'))) { active = false; return; }
    active = true; decided = false; armedOnce = false;
    sy = e.touches[0].clientY; sx = e.touches[0].clientX;
    clip.style.top = sc.offsetTop + 'px';
    cap.textContent = lastSyncText();
  }, { passive: true });
  sc.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0], dy = t.clientY - sy, dx = t.clientX - sx;
    if (!decided) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (dy > 0 && dy > Math.abs(dx) * 1.2) decided = true; else { active = false; return; }
    }
    if (sc.scrollTop > 0) { active = false; setPull(0, false); return; }
    if (dy <= 0) { setPull(0, false); return; }
    if (e.cancelable) e.preventDefault();
    const p = 120 * (1 - Math.exp(-dy / 200)), prog = Math.min(1, p / PTR_TH);
    setPull(p, false); setSpokes(prog);
    if (p >= PTR_TH && !armedOnce) { armedOnce = true; if (navigator.vibrate) navigator.vibrate(10); }
    else if (p < PTR_TH) armedOnce = false;
  }, { passive: false });
  function end(): void {
    if (!active) return;
    active = false;
    if (!decided) return;
    if (pull >= PTR_TH) run(); else { setPull(0, true); reset(250); }
  }
  sc.addEventListener('touchend', end);
  sc.addEventListener('touchcancel', end);
  setSpokes(0);
}

/** Adds pull to refresh to every given scroll container. */
export function initPullToRefresh(o: PullOptions): void {
  Array.prototype.forEach.call(o.scrollers, (sc: HTMLElement) => setupPull(sc, o));
}
