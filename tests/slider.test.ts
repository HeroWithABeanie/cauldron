import { describe, it, expect, afterEach } from 'vitest';
import { setupSlider } from '../src/slider';
import { oldSetupSlider } from './reference/oldSlider';

const g = globalThis as any;
afterEach(() => { delete g.window; delete g.getComputedStyle; delete g.DOMMatrix; delete g.ResizeObserver; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

type Handler = { fn: (e: any) => void; capture: boolean };
/** A fake element: records every style write, class toggle and attribute change, and keeps its listeners. */
function node(name: string, log: string[]) {
  const handlers: Record<string, Handler[]> = {};
  const style = new Proxy({} as Record<string, string>, { set(o, k: string, v) { o[k] = v; log.push(name + '.style.' + k + '=' + v); return true; } });
  const el: any = {
    name, style, handlers, children: [] as any[], firstChild: null,
    addEventListener(t: string, fn: (e: any) => void, capture?: boolean) { log.push(name + '.listen ' + t + ' ' + !!capture); (handlers[t] = handlers[t] || []).push({ fn, capture: !!capture }); },
    classList: { toggle(c: string, on: boolean) { log.push(name + '.toggle ' + c + ' ' + on); } },
    setAttribute(k: string, v: unknown) { log.push(name + '.attr ' + k + '=' + String(v)); },
    removeAttribute(k: string) { log.push(name + '.rm ' + k); },
    setPointerCapture(id: number) { log.push(name + '.capture ' + id); },
    observe(x: any) { log.push(name + '.observe ' + x.name); },
  };
  return el;
}
function fire(el: any, type: string, ev: any, log: string[]) {
  ev.preventDefault = () => log.push('preventDefault ' + type);
  ev.stopPropagation = () => log.push('stopPropagation ' + type);
  for (const h of el.handlers[type] || []) h.fn(ev);
}

interface Setup { n: number; withDots: boolean; clientWidth: number; gap: number; heights: number[]; hasRO: boolean; reduced: boolean; matrix: string | 'throw'; }
function build(s: Setup, log: string[]) {
  const sl = node('sl', log), tr = node('tr', log);
  sl.clientWidth = s.clientWidth; sl.firstChild = tr;
  const slides = Array.from({ length: s.n }, (_, i) => { const e = node('slide' + i, log); e.offsetLeft = i * (s.clientWidth + s.gap); e.offsetHeight = s.heights[i]; return e; });
  tr.children = slides;
  let dots: any = null;
  if (s.withDots) { dots = node('dots', log); dots.children = slides.map((_, i) => node('dot' + i, log)); }
  const roCbs: (() => void)[] = [];
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? s.reduced : false }) };
  delete g.ResizeObserver;
  if (s.hasRO) g.window.ResizeObserver = g.ResizeObserver = class { constructor(cb: () => void) { roCbs.push(cb); } observe(x: any) { log.push('ro.observe ' + x.name); } disconnect() { } };
  g.getComputedStyle = () => ({ get transform() { if (s.matrix === 'throw') throw new Error('no style'); return s.matrix; } });
  g.DOMMatrix = class { m41: number; constructor(t: string) { const m = /matrix\(([^)]*)\)/.exec(t); this.m41 = m ? parseFloat(m[1].split(',')[4]) : NaN; } };
  return { sl, tr, slides, dots, roCbs };
}

type Op = { op: 'down' | 'move' | 'up' | 'cancel' | 'click' | 'key' | 'dot' | 'ro' | 'motion'; id: number; x: number; y: number; dt: number; ptype: string; key: string };
const DX = [0, 3, 6, 7, -7, 40, 59, 60, 61, -59, -60, -61, 120, -120, 300, -300, 900, -900];
function randomSetup(rand: () => number): Setup {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const n = pick([0, 1, 2, 2, 3, 3, 4, 5]);
  return { n, withDots: rand() < .7, clientWidth: pick([300, 300, 320, 1]), gap: pick([0, 16, 16, 40]), heights: Array.from({ length: n }, () => pick([0, 50, 120, 121, 333])), hasRO: rand() < .8, reduced: rand() < .2,
    matrix: pick(['none', '', 'throw', 'matrix(1, 0, 0, 1, -316, 0)', 'matrix(1, 0, 0, 1, 25, 0)', 'matrix(1, 0, 0, 1, -100.5, 0)']) };
}
function randomOps(rand: () => number): Op[] {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const one = (): Op => ({
    op: pick(['down', 'down', 'move', 'move', 'move', 'up', 'up', 'cancel', 'click', 'key', 'dot', 'ro', 'motion'] as Op['op'][]),
    id: pick([1, 1, 1, 2]), x: pick(DX), y: pick([0, 0, 3, 7, -7, 30, -30]), dt: pick([0, 5, 10, 20, 50, 79, 80, 81, 100, 101, 150, 400]), ptype: pick(['touch', 'touch', 'pen', 'mouse']),
    key: pick(['ArrowLeft', 'ArrowRight', 'ArrowRight', 'Enter']),
  });
  const ops: Op[] = [];
  for (let seg = 0, segs = 1 + Math.floor(rand() * 4); seg < segs; seg++) {
    if (rand() < .55) {
      // a whole gesture: press, a few drags, release or cancel, then often the tap that follows a swipe
      const id = pick([1, 1, 1, 2]), ptype = pick(['touch', 'touch', 'pen', 'mouse']);
      ops.push({ ...one(), op: 'down', id, ptype, x: pick([0, 10, -10]) });
      for (let m = 0, ms = 1 + Math.floor(rand() * 5); m < ms; m++) ops.push({ ...one(), op: 'move', id: rand() < .9 ? id : 3 - id });
      ops.push({ ...one(), op: rand() < .85 ? 'up' : 'cancel', id });
      if (rand() < .6) ops.push({ ...one(), op: 'click' });
    } else for (let k = 0, ks = 1 + Math.floor(rand() * 8); k < ks; k++) ops.push(one());
  }
  return ops;
}
const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', s: Setup, ops: Op[], count: boolean) {
  const log: string[] = [];
  let reduced = s.reduced;
  const page = build(s, log);
  let threw: string | null = null;
  let api: any;
  try { api = (impl === 'old' ? oldSetupSlider : setupSlider)(page.sl, page.dots); } catch (e: any) { threw = String(e && e.message); }
  if (threw) { log.push('threw'); return { log, threw: true, ro: false }; }
  let t = 1000, px = 0, py = 0;
  for (const o of ops) {
    t += o.dt; log.push('-- ' + o.op);
    try {
      if (o.op === 'down') { px = o.x; py = o.y; fire(page.sl, 'pointerdown', { pointerType: o.ptype, pointerId: o.id, clientX: px, clientY: py, timeStamp: t }, log); }
      else if (o.op === 'move') { px += o.x; py += o.y; fire(page.sl, 'pointermove', { pointerId: o.id, clientX: px, clientY: py, timeStamp: t }, log); }
      else if (o.op === 'up') fire(page.sl, 'pointerup', { pointerId: o.id, clientX: px, clientY: py, timeStamp: t }, log);
      else if (o.op === 'cancel') fire(page.sl, 'pointercancel', { pointerId: o.id, clientX: px, clientY: py, timeStamp: t }, log);
      else if (o.op === 'click') fire(page.sl, 'click', {}, log);
      else if (o.op === 'key') fire(page.sl, 'keydown', { key: o.key }, log);
      else if (o.op === 'dot') { if (page.dots) fire(page.dots.children[Math.abs(o.x) % Math.max(1, page.dots.children.length)], 'click', {}, log); }
      else if (o.op === 'ro') page.roCbs.forEach((cb) => cb());
      else if (o.op === 'motion') { reduced = !reduced; g.window.matchMedia = (q: string) => ({ matches: q.includes('reduce') ? reduced : false }); }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
  }
  const txt = log.join('\n');
  if (count) {
    if (/preventDefault click/.test(txt)) hit('tap after a swipe suppressed');
    if (/capture/.test(txt)) hit('horizontal lock');
    if (/-- move[\s\S]*?(?=--|$)/.test(txt) && s.n > 1 && /tr\.style\.transform=translate3d\((\d+(\.\d+)?)px/.test(txt)) hit('overscroll past the first card');
    if (/translate3d\(-?\d/.test(txt) && /px,0,0\)/.test(txt)) hit('painted');
    if (/\.toggle on true/.test(txt)) hit('dot highlighted');
    if (/preventDefault keydown/.test(txt)) hit('arrow key');
    if (/transition=transform \.35s/.test(txt)) hit('animated move');
    if (/transition=none/.test(txt)) hit('instant move');
    if (/matrix/.test(JSON.stringify(s)) && ops.some((x) => x.op === 'down')) hit('live position read');
    if (s.matrix === 'throw' && ops.some((x) => x.op === 'down' && x.ptype !== 'mouse')) hit('live position unreadable');
    if (s.n === 1) hit('single card');
    if (!s.hasRO) hit('no ResizeObserver');
    if (ops.some((x) => x.op === 'ro')) hit('resize callback');
    if (ops.some((x) => x.op === 'down' && x.ptype === 'mouse')) hit('mouse ignored');
    if (ops.some((x) => x.op === 'cancel')) hit('pointercancel');
  }
  return { log, threw: false, ro: !!(api && api.ro) };
}

describe('the card slider (new slider.ts vs the old code from app.js)', () => {
  it('writes exactly the same styles, classes and listeners in 3000 random pages and gestures', () => {
    const rand = rng(20261126);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let k = 0; k < 3000; k++) {
      const s = randomSetup(rand), ops = randomOps(rand), a = run('old', s, ops, true), b = run('new', s, ops, false);
      expect(b).toEqual(a);
    }
    for (const k of ['tap after a swipe suppressed', 'horizontal lock', 'overscroll past the first card', 'dot highlighted', 'arrow key', 'animated move', 'instant move', 'live position read', 'live position unreadable', 'single card', 'no ResizeObserver', 'resize callback', 'mouse ignored', 'pointercancel']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 60000);

  // A tidy gesture, written out, so the expected behaviour is also stated without the old code.
  const swipe = (dxs: number[], dts: number[], n = 3) => {
    const log: string[] = [];
    const page = build({ n, withDots: true, clientWidth: 300, gap: 0, heights: [100, 200, 300], hasRO: false, reduced: false, matrix: 'none' }, log);
    setupSlider(page.sl, page.dots);
    let t = 0, x = 0;
    fire(page.sl, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, timeStamp: t }, log);
    dxs.forEach((d, i) => { t += dts[i]; x += d; fire(page.sl, 'pointermove', { pointerId: 1, clientX: x, clientY: 0, timeStamp: t }, log); });
    t += 200; fire(page.sl, 'pointerup', { pointerId: 1, clientX: x, clientY: 0, timeStamp: t }, log);
    return log.filter((l) => l.startsWith('tr.style.transform=')).pop();
  };
  it('moves to the next card after dragging more than a fifth of a card, and not at exactly a fifth', () => {
    expect(swipe([-61], [500])).toBe('tr.style.transform=translate3d(-300px,0,0)');
    expect(swipe([-60], [500])).toBe('tr.style.transform=translate3d(0px,0,0)');
    expect(swipe([61], [500])).toBe('tr.style.transform=translate3d(0px,0,0)');   // already on the first card
  });
  it('a quick flick goes on even when the drag was short, but exactly .4 px/ms does not', () => {
    const flick = (lastMs: number) => {
      const log: string[] = [];
      const page = build({ n: 3, withDots: false, clientWidth: 300, gap: 0, heights: [10, 10, 10], hasRO: false, reduced: false, matrix: 'none' }, log);
      setupSlider(page.sl, null);
      fire(page.sl, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }, log);
      fire(page.sl, 'pointermove', { pointerId: 1, clientX: -20, clientY: 0, timeStamp: 100 }, log);
      fire(page.sl, 'pointermove', { pointerId: 1, clientX: -28, clientY: 0, timeStamp: lastMs }, log);
      fire(page.sl, 'pointerup', { pointerId: 1, clientX: -28, clientY: 0, timeStamp: lastMs + 10 }, log);
      return log.filter((l) => l.startsWith('tr.style.transform=')).pop();
    };
    expect(flick(120)).toBe('tr.style.transform=translate3d(0px,0,0)');       // 8 px in 20 ms = exactly .4: stays
    expect(flick(119)).toBe('tr.style.transform=translate3d(-300px,0,0)');    // a little faster: next card
  });
  it('a flick to the right at exactly .4 px/ms stays, a little faster goes back one card', () => {
    const back = (lastMs: number) => {
      const log: string[] = [];
      const page = build({ n: 3, withDots: false, clientWidth: 300, gap: 0, heights: [10, 10, 10], hasRO: false, reduced: false, matrix: 'none' }, log);
      setupSlider(page.sl, null);
      // first go to the second card with the arrow key, then flick back
      fire(page.sl, 'keydown', { key: 'ArrowRight' }, log);
      fire(page.sl, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }, log);
      fire(page.sl, 'pointermove', { pointerId: 1, clientX: 20, clientY: 0, timeStamp: 100 }, log);
      fire(page.sl, 'pointermove', { pointerId: 1, clientX: 28, clientY: 0, timeStamp: lastMs }, log);
      fire(page.sl, 'pointerup', { pointerId: 1, clientX: 28, clientY: 0, timeStamp: lastMs + 10 }, log);
      return log.filter((l) => l.startsWith('tr.style.transform=')).pop();
    };
    expect(back(120)).toBe('tr.style.transform=translate3d(-300px,0,0)');    // exactly .4: stays on card 2
    expect(back(119)).toBe('tr.style.transform=translate3d(0px,0,0)');       // faster: back to card 1
  });
  it('a flick that was held still for 80 ms or more before the finger lifted does not count', () => {
    const log: string[] = [];
    const page = build({ n: 3, withDots: false, clientWidth: 300, gap: 0, heights: [10, 10, 10], hasRO: false, reduced: false, matrix: 'none' }, log);
    setupSlider(page.sl, null);
    fire(page.sl, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }, log);
    fire(page.sl, 'pointermove', { pointerId: 1, clientX: -20, clientY: 0, timeStamp: 100 }, log);
    fire(page.sl, 'pointermove', { pointerId: 1, clientX: -28, clientY: 0, timeStamp: 110 }, log);
    fire(page.sl, 'pointerup', { pointerId: 1, clientX: -28, clientY: 0, timeStamp: 190 }, log);
    expect(log.filter((l) => l.startsWith('tr.style.transform=')).pop()).toBe('tr.style.transform=translate3d(0px,0,0)');
  });
});
