import { describe, it, expect, afterEach } from 'vitest';
import { trackVisualViewport } from '../src/viewport';
import { makeOldVV } from './reference/oldVV';
import { rng } from './helpers/fakepage';

const g = globalThis as any;
afterEach(() => { delete g.window; delete g.document; });

const pick = <T,>(rand: () => number, a: T[]) => a[Math.floor(rand() * a.length)];
const HEIGHTS = [0, 320.5, 400, 667, 812.25, 1000];
const TOPS = [0, 12.5, 100, 0.25];
type Op = { k: 'resize' | 'scroll' | 'remove'; h?: number; t?: number };

function exec(impl: 'old' | 'new', hasVV: boolean, h0: number, t0: number, ops: Op[]) {
  const log: string[] = [], L: Record<string, (() => void)[]> = {};
  const vv: any = hasVV ? { height: h0, offsetTop: t0, addEventListener: (t: string, f: () => void) => { log.push('vv.listen ' + t); (L[t] = L[t] || []).push(f); } } : undefined;
  g.window = { visualViewport: vv };
  g.document = { documentElement: { style: { setProperty: (k: string, v: string) => log.push('set ' + k + ' ' + v) } } };
  if (impl === 'old') makeOldVV(); else trackVisualViewport();
  for (const op of ops) {
    log.push('-- ' + op.k);
    if (op.k === 'remove') { g.window.visualViewport = undefined; Object.values(L).forEach((a) => a.forEach((f) => f())); continue; }
    if (vv) { vv.height = op.h; vv.offsetTop = op.t; }
    (L[op.k] || []).forEach((f) => f());
  }
  return log;
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

describe('the visual viewport variables (new trackVisualViewport vs the old code from app.js)', () => {
  it('sets --vvh and --vvt like the old code in 3000 random sessions', () => {
    const rand = rng(777);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 3000; n++) {
      const hasVV = rand() < .9, h0 = pick(rand, HEIGHTS), t0 = pick(rand, TOPS);
      const ops: Op[] = Array.from({ length: Math.floor(rand() * 7) }, () => { const r = rand(); return r < .4 ? { k: 'resize', h: pick(rand, HEIGHTS), t: pick(rand, TOPS) } : r < .85 ? { k: 'scroll', h: pick(rand, HEIGHTS), t: pick(rand, TOPS) } : { k: 'remove' }; });
      const a = exec('old', hasVV, h0, t0, ops), b = exec('new', hasVV, h0, t0, ops);
      expect(b).toEqual(a);
      if (!hasVV) hit('no visual viewport'); else hit('visual viewport');
      if (a.some((l) => l.startsWith('-- resize')) && hasVV) hit('resize');
      if (a.some((l) => l.startsWith('-- scroll')) && hasVV) hit('scroll');
      if (a.includes('-- remove') && hasVV) hit('gone later');
      if (hasVV && a.some((l) => /^set --vvt \d+\.\d+px$/.test(l))) hit('fractional offset');
    }
    for (const k of ['no visual viewport', 'visual viewport', 'resize', 'scroll', 'gone later', 'fractional offset']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  });
  it('sets the height and top offset once at the start and again on every resize and scroll of the viewport', () => {
    const log = exec('new', true, 700, 0, [{ k: 'resize', h: 400, t: 0 }, { k: 'scroll', h: 400, t: 150 }]);
    expect(log).toEqual(['vv.listen resize', 'vv.listen scroll', 'set --vvh 700px', 'set --vvt 0px', '-- resize', 'set --vvh 400px', 'set --vvt 0px', '-- scroll', 'set --vvh 400px', 'set --vvt 150px']);
  });
  it('does nothing on a browser without a visual viewport, and when it disappears later', () => {
    expect(exec('new', false, 0, 0, [])).toEqual([]);
    const log = exec('new', true, 500, 0, [{ k: 'remove' }]);
    expect(log.slice(4)).toEqual(['-- remove']);
  });
});
