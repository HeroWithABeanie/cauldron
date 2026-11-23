import { describe, it, expect, afterEach } from 'vitest';
import { syncChips, syncRChips, slideLists } from '../src/chips';
import { makeOld } from './reference/oldViewtext';

const g = globalThis as any;
afterEach(() => { delete g.window; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A chip that records everything done to it (attribute values as text, the way the DOM stores them). */
function chip(key: { sort?: string; rsort?: string }) {
  const log: string[] = [];
  const el: any = {
    dataset: key, log,
    classList: { toggle: (c: string, on: boolean) => { log.push('toggle ' + c + ' ' + on); } },
    setAttribute: (k: string, v: unknown) => { log.push('attr ' + k + ' ' + String(v)); },
  };
  return el;
}
const nodeList = (els: any[]): any => ({ forEach: (f: (e: any) => void) => els.forEach(f) });

describe('syncChips', () => {
  it('marks the active chip and labels the A to Z chip', () => {
    const a = chip({ sort: 'a' }), r = chip({ sort: 'recipe' });
    syncChips(nodeList([a, r]), 'za', 'za');
    expect(a.log).toEqual(['toggle on true', 'attr aria-pressed true', 'toggle rev true', 'attr aria-label Alphabetical, Z to A, tap to reverse']);
    expect(r.log).toEqual(['toggle on false', 'attr aria-pressed false']);
  });
  it('matches the old code for every combination', () => {
    const old = makeOld({});
    for (const sortMode of ['recipe', 'cat', 'az', 'za']) for (const dir of ['az', 'za']) {
      const keys = ['recipe', 'cat', 'a'].map((s) => ({ sort: s }));
      const A = keys.map(chip), B = keys.map(chip);
      old.set({ sortMode, listAzDir: dir, chips: nodeList(A) }); old.syncChips();
      syncChips(nodeList(B), sortMode, dir);
      expect(B.map((x) => x.log)).toEqual(A.map((x) => x.log));
    }
  });
});

describe('syncRChips', () => {
  it('labels the ingredient chip', () => {
    const c = chip({ rsort: 'i' });
    syncRChips(nodeList([c]), 'iu', 'az', 'id', 'pu');
    expect(c.log).toEqual(['toggle on true', 'attr aria-pressed true', 'toggle desc true', 'attr aria-label Ingredients, descending, tap to reverse']);
  });
  it('matches the old code in every combination of sort and directions', () => {
    const old = makeOld({});
    const sorts = ['az', 'za', 'pu', 'pd', 'iu', 'id'];
    for (const rsort of sorts) for (const az of ['az', 'za']) for (const pd of ['pu', 'pd']) for (const id of ['iu', 'id']) {
      const keys = ['a', 'p', 'i'].map((s) => ({ rsort: s }));
      const A = keys.map(chip), B = keys.map(chip);
      old.set({ rsort, rAzDir: az, rPDir: pd, rIDir: id, rchips: nodeList(A) }); old.syncRChips();
      syncRChips(nodeList(B), rsort, az, id, pd);
      expect(B.map((x) => x.log)).toEqual(A.map((x) => x.log));
    }
  });
});

// ---- slideLists ----
function slideWorld(canAnimate: boolean, hasParent = true) {
  const log: string[] = [];
  const anim = (name: string) => ({ cancel: () => { log.push(name + '.cancel'); }, onfinish: null as any, oncancel: null as any });
  const oa = anim('old'), na = anim('new');
  const parent = { insertBefore: (a: unknown, b: unknown) => { log.push('insertBefore ' + (a === old) + ' ' + (b === list)); } };
  const oldParent = { removeChild: (c: unknown) => { log.push('removeChild ' + (c === old)); } };
  const old: any = {
    removeAttribute: (k: string) => { log.push('old.removeAttr ' + k); },
    setAttribute: (k: string, v: string) => { log.push('old.attr ' + k + '=' + v); },
    style: {} as any, inert: false, parentNode: oldParent,
    animate: (kf: unknown, o: unknown) => { log.push('old.animate ' + JSON.stringify([kf, o])); return oa; },
  };
  const list: any = {
    offsetWidth: 360, parentNode: hasParent ? parent : null,
    animate: canAnimate ? (kf: unknown, o: unknown) => { log.push('list.animate ' + JSON.stringify([kf, o])); return na; } : undefined,
  };
  return { log, old, list, oa, na, finish: () => { na.onfinish(); } };
}

describe('slideLists', () => {
  it('does nothing with reduced motion', () => {
    g.window = { matchMedia: () => ({ matches: true }) };
    const w = slideWorld(true);
    slideLists(w.old, 10, 1, w.list);
    expect(w.log).toEqual([]);
  });
  it('does nothing when the list cannot animate', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    const w = slideWorld(false);
    slideLists(w.old, 10, 1, w.list);
    expect(w.log).toEqual([]);
  });
  it('matches the old code, including the clean-up when the animation finishes', () => {
    const old = makeOld({});
    for (const reduce of [false, true, undefined]) for (const can of [true, false]) for (const dir of [1, -1]) {
      g.window = reduce === undefined ? {} : { matchMedia: () => ({ matches: reduce }) };
      const a = slideWorld(can), b = slideWorld(can);
      old.slideLists(a.old, 42, dir, a.list);
      slideLists(b.old, 42, dir, b.list);
      expect(b.log).toEqual(a.log);
      expect(b.old.style.cssText).toBe(a.old.style.cssText);
      expect(b.old.inert).toBe(a.old.inert);
      if (a.na.onfinish) { a.finish(); b.finish(); expect(b.log).toEqual(a.log); }
    }
  });
});
