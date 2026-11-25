import { describe, it, expect, afterEach } from 'vitest';
import { createSearchHint } from '../src/searchph';
import { makeOldHint } from './reference/oldSearchph';

const g = globalThis as any;
afterEach(() => { delete g.window; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The page parts the hint uses: a clipping box with a width, a text with a scroll width and an animate() that hands out recorded animations. */
function makePage(log: string[], canAnimate: boolean) {
  let n = 0;
  const box = { clientWidth: 200 };
  const text: any = {
    scrollWidth: 300,
    animate: canAnimate ? (kf: unknown, o: unknown) => {
      const id = ++n; log.push('animate#' + id + ' ' + JSON.stringify([kf, o]));
      return { cancel() { log.push('cancel#' + id); }, pause() { log.push('pause#' + id); } };
    } : undefined,
  };
  return { box, text };
}

type Op = { op: 'start' | 'stop' | 'pause' | 'resized' | 'open' | 'type' | 'width' | 'scroll' | 'motion'; v: number };
function randomOps(rand: () => number): Op[] {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  return Array.from({ length: 4 + Math.floor(rand() * 14) }, () => ({ op: pick(['start', 'start', 'start', 'stop', 'pause', 'resized', 'resized', 'open', 'type', 'width', 'scroll', 'motion'] as Op['op'][]), v: Math.floor(rand() * 600) }));
}

function run(impl: 'old' | 'new', ops: Op[], canAnimate: boolean) {
  const log: string[] = [];
  let reduced = false;
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? reduced : false }) };
  const { box, text } = makePage(log, canAnimate);
  const state = { open: true, value: '' };
  const hint: any = impl === 'old'
    ? makeOldHint(box, text, state)
    : createSearchHint({ searchPhEl: box as any, searchPhText: text, searchInput: { get value() { return state.value; } } as any, get searchOpen() { return state.open; } });
  const out: string[] = [];
  for (const o of ops) {
    if (o.op === 'start') hint.start();
    else if (o.op === 'stop') hint.stop();
    else if (o.op === 'pause') hint.pause();
    else if (o.op === 'resized') out.push('resized=' + hint.resized());
    else if (o.op === 'open') state.open = !state.open;
    else if (o.op === 'type') state.value = state.value ? '' : 'mi';
    else if (o.op === 'width') box.clientWidth = o.v;
    else if (o.op === 'scroll') text.scrollWidth = o.v;
    else if (o.op === 'motion') reduced = !reduced;
    out.push(log.length + '');
  }
  return { log, out };
}

describe('the search hint animation (new searchph.ts vs the old code from app.js)', () => {
  it('gives identical results in 2000 random sequences', () => {
    const rand = rng(424242);
    const seen = { animated: 0, cancelled: 0, paused: 0, resizedTrue: 0, resizedFalse: 0, tooNarrow: 0 };
    for (let k = 0; k < 2000; k++) {
      const ops = randomOps(rand), can = rand() < .9, a = run('old', ops, can), b = run('new', ops, can);
      expect(b).toEqual(a);
      const s = a.log.join('\n'), o = a.out.join(' ');
      if (/animate#/.test(s)) seen.animated++;
      if (/cancel#/.test(s)) seen.cancelled++;
      if (/pause#/.test(s)) seen.paused++;
      if (o.includes('resized=true')) seen.resizedTrue++;
      if (o.includes('resized=false')) seen.resizedFalse++;
      if (ops.some((x) => x.op === 'start') && !/animate#/.test(s)) seen.tooNarrow++;
    }
    for (const [k, v] of Object.entries(seen)) expect([k, v > 50]).toEqual([k, true]);
  });

  const hintFor = (o: { open?: boolean; value?: string; canAnimate?: boolean; reduced?: boolean; box?: number; scroll?: number } = {}) => {
    const log: string[] = [];
    g.window = { matchMedia: () => ({ matches: !!o.reduced }) };
    const { box, text } = makePage(log, o.canAnimate !== false);
    box.clientWidth = o.box ?? 200; text.scrollWidth = o.scroll ?? 300;
    const state = { open: o.open !== false, value: o.value || '' };
    const hint = createSearchHint({ searchPhEl: box as any, searchPhText: text, searchInput: { get value() { return state.value; } } as any, get searchOpen() { return state.open; } });
    return { hint, log, box, text, state };
  };
  it('slides the hint by the amount it overflows: wait, slide, hold, jump back, forever', () => {
    const { hint, log } = hintFor();   // 100px of overflow
    hint.start();
    expect(log.length).toBe(1);
    const [kf, opts] = JSON.parse(log[0].replace(/^animate#1 /, ''));
    expect(opts).toEqual({ duration: 1200 + 100 / 0.045 + 900, iterations: null, easing: 'linear' });   // Infinity is written as null by JSON
    expect(kf.map((k: any) => k.transform)).toEqual(['translateX(0)', 'translateX(0)', 'translateX(-100px)', 'translateX(-100px)']);
    expect(kf[0].offset).toBe(0); expect(kf[3].offset).toBe(1);
  });
  it('does not slide when the hint fits (or overflows by 2px or less)', () => {
    for (const scroll of [150, 200, 201, 202]) { const { hint, log } = hintFor({ scroll }); hint.start(); expect(log).toEqual([]); }
  });
  it('slides from an overflow of 3px', () => {
    const { hint, log } = hintFor({ scroll: 203 });
    hint.start(); expect(log.length).toBe(1);
    expect(log[0]).toContain('translateX(-3px)');
  });
  it('does not slide when the bar is closed, something is typed, motion is reduced or animate() is missing', () => {
    for (const o of [{ open: false }, { value: 'x' }, { reduced: true }, { canAnimate: false }]) {
      const { hint, log } = hintFor(o); hint.start(); expect(log).toEqual([]);
    }
  });
  it('starting again cancels the running animation first; stop() cancels it once', () => {
    const { hint, log } = hintFor();
    hint.start(); hint.start(); hint.stop(); hint.stop();
    expect(log.map((l) => l.split(' ')[0])).toEqual(['animate#1', 'cancel#1', 'animate#2', 'cancel#2']);
  });
  it('pause() freezes a running animation and is harmless without one', () => {
    const { hint, log } = hintFor();
    hint.pause(); expect(log).toEqual([]);
    hint.start(); hint.pause(); expect(log[1]).toBe('pause#1');
  });
  it('resized() compares with the width measured at the last start', () => {
    const { hint, box } = hintFor();
    expect(hint.resized()).toBe(true);    // nothing measured yet (0 vs 200)
    hint.start(); expect(hint.resized()).toBe(false);
    box.clientWidth = 250; expect(hint.resized()).toBe(true);
  });
});
