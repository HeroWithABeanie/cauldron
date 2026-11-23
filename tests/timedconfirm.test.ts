import { describe, it, expect, afterEach, vi } from 'vitest';
import { timedConfirm } from '../src/timedconfirm';
import { timedConfirm as oldTimedConfirm } from './reference/oldHelpers';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.window; });

// ---- fake window parts that timedConfirm touches ----
function makeParts(canAnimate = true) {
  const log: string[] = [];
  const closeHandlers: (() => void)[] = [];
  const dlg: any = {
    open: false,
    addEventListener: (t: string, f: () => void) => { if (t === 'close') closeHandlers.push(f); log.push('listen ' + t); },
    showModal() { this.open = true; log.push('showModal'); },
    setAttribute: (k: string, v: string) => { log.push('dlg.' + k + '=' + v); },
    focus: (o: unknown) => { log.push('focus ' + JSON.stringify(o)); },
  };
  const classes = new Set<string>();
  const btn: any = {
    classList: { add: (c: string) => { classes.add(c); }, remove: (c: string) => { classes.delete(c); }, contains: (c: string) => classes.has(c) },
    setAttribute: (k: string, v: string) => { log.push('btn.' + k + '=' + v); },
  };
  const fill: any = canAnimate ? { animate: (kf: unknown, o: unknown) => { log.push('fill.animate ' + JSON.stringify([kf, o])); return { cancel: () => { log.push('fill.cancel'); } }; } } : {};
  const lbl: any = { textContent: '', animate: (kf: unknown[], o: unknown) => { log.push('lbl.shake ' + kf.length + ' ' + JSON.stringify(o)); } };
  const close = () => { dlg.open = false; closeHandlers.forEach((f) => f()); };
  return { log, dlg, btn, fill, lbl, close, classes };
}

describe('timedConfirm', () => {
  it('opens the window with the button locked and a countdown, then unlocks it', () => {
    vi.useFakeTimers();
    g.window = { matchMedia: () => ({ matches: true }) };   // reduced motion: no fill animation
    const p = makeParts();
    const c = timedConfirm(p.dlg, p.btn, p.fill, p.lbl, 'Yes', 3);
    c.open();
    expect(p.dlg.open).toBe(true);
    expect(p.classes.has('locked')).toBe(true);
    expect(p.lbl.textContent).toBe('Yes (3)');
    vi.advanceTimersByTime(1000); expect(p.lbl.textContent).toBe('Yes (2)');
    vi.advanceTimersByTime(1000); expect(p.lbl.textContent).toBe('Yes (1)');
    expect(c.locked()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(p.lbl.textContent).toBe('Yes');
    expect(p.classes.has('locked')).toBe(false);
    expect(p.log.indexOf('btn.aria-disabled=false') > -1).toBe(true);
    expect(c.locked()).toBe(false);
  });
  it('locked() shakes the label while locked, and only then', () => {
    vi.useFakeTimers();
    g.window = { matchMedia: () => ({ matches: false }) };
    const p = makeParts();
    const c = timedConfirm(p.dlg, p.btn, p.fill, p.lbl, 'No', 2);
    expect(c.locked()).toBe(false);                      // before open() the button is not locked
    expect(p.log.some((l) => l.startsWith('lbl.shake'))).toBe(false);
    c.open();
    expect(c.locked()).toBe(true);
    expect(p.log.filter((l) => l.startsWith('lbl.shake')).length).toBe(1);
  });
  it('does nothing when the window is already open', () => {
    vi.useFakeTimers();
    g.window = { matchMedia: () => ({ matches: false }) };
    const p = makeParts();
    p.dlg.open = true;
    timedConfirm(p.dlg, p.btn, p.fill, p.lbl, 'Yes', 5).open();
    expect(p.classes.has('locked')).toBe(false);
    expect(p.log.indexOf('showModal')).toBe(-1);
  });
  it('stops the countdown and cancels the fill animation when the window closes', () => {
    vi.useFakeTimers();
    g.window = { matchMedia: () => ({ matches: false }) };
    const p = makeParts();
    const c = timedConfirm(p.dlg, p.btn, p.fill, p.lbl, 'Yes', 5);
    c.open();
    expect(p.log.some((l) => l.startsWith('fill.animate'))).toBe(true);
    vi.advanceTimersByTime(2000);
    p.close();
    expect(p.log.indexOf('fill.cancel') > -1).toBe(true);
    const text = p.lbl.textContent;
    vi.advanceTimersByTime(10000);
    expect(p.lbl.textContent).toBe(text);               // the interval is gone
  });
});

// ---- the new function against the old one, same random sequences of actions ----
function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function drive(impl: typeof timedConfirm, seed: number) {
  const rand = rng(seed);
  vi.useFakeTimers();
  g.window = { matchMedia: () => ({ matches: rand() < .3 }) };
  const p = makeParts(rand() < .8);
  const secs = 1 + Math.floor(rand() * 6);
  const c = impl(p.dlg, p.btn, p.fill, p.lbl, rand() < .5 ? 'Yes' : 'No', secs);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = rand();
    if (a < .3) c.open();
    else if (a < .5) out.push('locked=' + c.locked());
    else if (a < .65) p.close();
    else vi.advanceTimersByTime(Math.floor(rand() * 2500));
    out.push(i + ': ' + p.lbl.textContent + ' | ' + [...p.classes].join(',') + ' | open=' + p.dlg.open);
  }
  vi.useRealTimers();
  return { out, log: p.log };
}

describe('timedConfirm (new vs the old code from app.js)', () => {
  it('behaves exactly like the old code in 300 random sequences', () => {
    for (let k = 0; k < 300; k++) {
      const a = drive(oldTimedConfirm as any, 1000 + k), b = drive(timedConfirm, 1000 + k);
      expect(b).toEqual(a);
    }
  });
});
