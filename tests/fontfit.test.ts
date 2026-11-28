(global as any).__realSetTimeout = (global as any).__realSetTimeout || setTimeout;
import { describe, it, expect, afterEach } from 'vitest';
import { watchFonts } from '../src/fontfit';
import { makeOldFontFit } from './reference/oldFontFit';
import { rng, clock } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout };
afterEach(() => { delete g.document; delete g.window; g.setTimeout = real.setTimeout; });

const pick = <T,>(rand: () => number, a: T[]) => a[Math.floor(rand() * a.length)];
const flush = () => new Promise<void>((r) => setImmediate(r));
type Kind = 'ok' | 'fail' | 'never';
interface Setup { hasFonts: boolean; loads: Kind[]; ready: Kind }
type Op = { k: 'flush' | 'loadingdone' | 'load' | 'wait'; n?: number };
const prom = (k: Kind): Promise<void> => (k === 'ok' ? Promise.resolve() : k === 'fail' ? Promise.reject(new Error('font')) : new Promise(() => { }));

async function exec(impl: 'old' | 'new', s: Setup, ops: Op[]) {
  const log: string[] = [], clk = clock(); g.setTimeout = clk.setTimeout;
  const fontL: Record<string, (() => void)[]> = {}, winL: Record<string, (() => void)[]> = {};
  let li = 0;
  g.document = s.hasFonts ? { fonts: {
    addEventListener: (t: string, f: () => void) => { log.push('fonts.listen ' + t); (fontL[t] = fontL[t] || []).push(f); },
    load: (spec: string, sample: string) => { log.push('fonts.load ' + spec + ' | ' + sample); return prom(s.loads[li++]); },
    ready: prom(s.ready),
  } } : {};
  g.window = { addEventListener: (t: string, f: () => void) => { log.push('win.listen ' + t); (winL[t] = winL[t] || []).push(f); } };
  const env = { fitAll: () => log.push('fitAll'), fitRTiles: () => log.push('fitRTiles') };
  if (impl === 'old') makeOldFontFit(env); else watchFonts(env);
  for (const op of ops) {
    log.push('-- ' + op.k + ' ' + (op.n ?? ''));
    if (op.k === 'flush') await flush();
    else if (op.k === 'loadingdone') (fontL.loadingdone || []).forEach((f) => f());
    else if (op.k === 'load') (winL.load || []).forEach((f) => f());
    else clk.advance(op.n as number);
  }
  clk.advance(5000); await flush();
  log.push('end');
  return log;
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };
const KINDS: Kind[] = ['ok', 'ok', 'ok', 'fail', 'never', 'never'];
const WAITS = [0, 1, 299, 300, 301, 1199, 1200, 1201, 3000];

describe('keeping the tile names fitted while fonts arrive (new watchFonts vs the old code from app.js)', () => {
  it('calls fitAll / fitRTiles at the same moments as the old code in 2500 random page loads', async () => {
    const rand = rng(4242);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 2500; n++) {
      const s: Setup = { hasFonts: rand() < .9, loads: [pick(rand, KINDS), pick(rand, KINDS), pick(rand, KINDS)], ready: pick(rand, KINDS.filter((k) => k !== 'fail')) };
      const ops: Op[] = Array.from({ length: Math.floor(rand() * 9) }, () => { const r = rand(); return r < .25 ? { k: 'flush' } : r < .4 ? { k: 'loadingdone' } : r < .6 ? { k: 'load' } : { k: 'wait', n: pick(rand, WAITS) }; });
      const a = await exec('old', s, ops), b = await exec('new', s, ops);
      expect(b).toEqual(a);
      const txt = a.join('\n'), fits = a.filter((l) => l === 'fitAll').length;
      if (!s.hasFonts) hit('no font API'); else hit('font API');
      if (s.hasFonts && s.loads.every((k) => k === 'ok')) hit('all weights loaded');
      if (s.hasFonts && s.loads.includes('fail')) hit('a weight failed');
      if (s.hasFonts && s.loads.includes('never')) hit('a weight never arrives');
      if (s.hasFonts && s.ready === 'never') hit('ready never comes');
      if (/-- loadingdone/.test(txt) && s.hasFonts) hit('loadingdone');
      if (/-- load \n/.test(txt) && s.hasFonts) hit('page load');
      if (fits === 0 && s.hasFonts) hit('never fitted');
      if (fits >= 4) hit('fitted four times or more');
      if (/-- load \n[^]*?-- wait (299|1199)\n/.test(txt)) hit('just before a timer');
      if (/-- load \n[^]*?-- wait (300|1200)\n/.test(txt)) hit('exactly at a timer');
    }
    for (const k of ['no font API', 'font API', 'all weights loaded', 'a weight failed', 'a weight never arrives', 'ready never comes', 'loadingdone', 'page load', 'never fitted', 'fitted four times or more', 'just before a timer', 'exactly at a timer'])
      expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 120000);

  const run = (s: Partial<Setup>, ops: Op[]) => exec('new', { hasFonts: true, loads: ['ok', 'ok', 'ok'], ready: 'ok', ...s }, ops);
  const fitCount = (log: string[]) => log.filter((l) => l === 'fitAll').length;
  it('does nothing on a page without the font API', async () => {
    const log = await run({ hasFonts: false }, [{ k: 'flush' }, { k: 'load' }, { k: 'wait', n: 2000 }]);
    expect(log.some((l) => l.startsWith('fonts') || l.startsWith('win.listen') || l === 'fitAll')).toBe(false);
  });
  it('asks for the 500, 600 and 700 weights of the handwriting font with accented sample text', async () => {
    const log = await run({}, []);
    expect(log.filter((l) => l.startsWith('fonts.load'))).toEqual(['500', '600', '700'].map((w) => 'fonts.load ' + w + ' 24px "Playpen Sans" | Skånemejerier crème fraîche Pågen Råg Æblegrød'));
  });
  it('fits once when all weights are in and once when ready fires (both fit both kinds of tiles), also when a weight fails', async () => {
    const ok = await run({}, [{ k: 'flush' }]);
    expect(ok.slice(ok.indexOf('-- flush '))).toEqual(['-- flush ', 'fitAll', 'fitRTiles', 'fitAll', 'fitRTiles', 'end']);
    const bad = await run({ loads: ['ok', 'fail', 'ok'] }, [{ k: 'flush' }]);
    expect(fitCount(bad)).toBe(2);
    const stuck = await run({ loads: ['never', 'ok', 'ok'] }, [{ k: 'flush' }]);
    expect(fitCount(stuck)).toBe(1);   // only ready
  });
  it('fits whenever a font finishes loading', async () => {
    const log = await run({ ready: 'never', loads: ['never', 'never', 'never'] }, [{ k: 'loadingdone' }, { k: 'loadingdone' }]);
    expect(fitCount(log)).toBe(2);
  });
  it('after the page has loaded it fits at once, and again 300 and 1200 ms later (not before)', async () => {
    const base: Partial<Setup> = { ready: 'never', loads: ['never', 'never', 'never'] };
    const at = async (w: number) => fitCount(await run(base, [{ k: 'load' }, { k: 'wait', n: w }, { k: 'flush' }]));
    // the final 5000 ms advance is included in exec, so measure by position: count the fits that come before a marker op
    const upTo = async (w: number) => { const log = await run(base, [{ k: 'load' }, { k: 'wait', n: w }, { k: 'flush' }]); const end = log.indexOf('-- flush '); return fitCount(log.slice(0, end)); };
    expect(await upTo(0)).toBe(1); expect(await upTo(299)).toBe(1); expect(await upTo(300)).toBe(2); expect(await upTo(1199)).toBe(2); expect(await upTo(1200)).toBe(3);
    expect(await at(0)).toBe(3);
  });
});
