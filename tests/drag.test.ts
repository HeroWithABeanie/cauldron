import { describe, it, expect, afterEach, vi } from 'vitest';
import { enableDrag } from '../src/drag';
import { makeOldEnableDrag } from './reference/oldHelpers';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.document; });

// ---- a tiny fake page: rows with positions, a grip that records its listeners, a body ----
function makeRow(top: number, height: number, log: string[], name: string) {
  const classes = new Set<string>();
  const style: Record<string, string> = { transform: '', transition: '' };
  return {
    name, style,
    classList: { add: (c: string) => { classes.add(c); }, remove: (c: string) => { classes.delete(c); } },
    getBoundingClientRect: () => ({ top, height }),
    snap: () => name + '|' + [...classes].sort().join(',') + '|' + style.transform + '|' + style.transition,
  };
}

interface Scenario {
  heights: number[]; gaps: number[]; from: number;
  pointerType: string; button: number; searching: boolean;
  moves: number[]; end: 'up' | 'cancel' | 'none'; startY: number;
}

/** Runs one drag with the given implementation and returns everything observable. */
function run(impl: 'old' | 'new', sc: Scenario) {
  vi.useFakeTimers();
  const log: string[] = [];
  const body = { style: { userSelect: '' } };
  g.document = { body };
  let top = 100;
  const rows = sc.heights.map((h, i) => { const r = makeRow(top, h, log, 'r' + i); top += h + sc.gaps[i]; return r; });
  const ul = { querySelectorAll: (sel: string) => { log.push('qsa ' + sel); return rows; } };
  const handlers: Record<string, ((e: any) => void)[]> = {};
  const grip = {
    addEventListener: (t: string, f: any) => { (handlers[t] = handlers[t] || []).push(f); log.push('add ' + t); },
    removeEventListener: (t: string, f: any) => { handlers[t] = (handlers[t] || []).filter((x) => x !== f); log.push('remove ' + t); },
    setPointerCapture: (id: number) => { log.push('capture ' + id); },
  };
  const items = rows.map((_, i) => ({ text: 'ing' + i }));
  const r = { items };
  let reorders = 0;
  const env = { query: sc.searching ? ' milk ' : '  ', saveR: () => { reorders++; log.push('save'); }, renderRecipes: () => { log.push('render'); } };
  if (impl === 'old') makeOldEnableDrag(env)(grip, rows[sc.from], ul, r);
  else enableDrag(grip as any, rows[sc.from] as any, ul as any, r, () => !!env.query.trim(), () => { env.saveR(); env.renderRecipes(); });

  const trace: string[] = [];
  const snap = (label: string) => trace.push(label + ' :: ' + rows.map((x) => x.snap()).join(' ; ') + ' :: us=' + body.style.userSelect);
  let prevented = 0;
  const fire = (t: string, e: any) => { (handlers[t] || []).slice().forEach((f) => f(e)); };
  fire('pointerdown', { pointerType: sc.pointerType, button: sc.button, clientY: sc.startY, pointerId: 7, preventDefault: () => { prevented++; } });
  snap('down');
  sc.moves.forEach((y, i) => { fire('pointermove', { clientY: y }); snap('move' + i); });
  if (sc.end !== 'none') {
    fire(sc.end === 'up' ? 'pointerup' : 'pointercancel', {});
    snap('end');
    vi.advanceTimersByTime(159); snap('t159');
    vi.advanceTimersByTime(5); snap('t164');
  }
  const listeners = Object.keys(handlers).sort().map((k) => k + '=' + handlers[k].length).join(',');
  return { trace, log, order: items.map((x) => x.text), reorders, prevented, listeners };
}

// ---- a seeded random number generator, so a failure can be reproduced ----
function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function randomScenario(rand: () => number): Scenario {
  const n = Math.floor(rand() * 8) + 1;
  const heights = Array.from({ length: n }, () => 30 + Math.floor(rand() * 60));
  const gaps = Array.from({ length: n }, () => Math.floor(rand() * 8));
  const from = Math.floor(rand() * n);
  const startY = 100 + Math.floor(rand() * 400);
  const moves = Array.from({ length: Math.floor(rand() * 6) }, () => startY + Math.floor(rand() * 700) - 350);
  const pr = rand();
  return {
    heights, gaps, from, startY, moves,
    pointerType: pr < .5 ? 'touch' : pr < .8 ? 'mouse' : 'pen',
    button: rand() < .85 ? 0 : 2,
    searching: rand() < .15,
    end: rand() < .8 ? 'up' : rand() < .6 ? 'cancel' : 'none',
  };
}

describe('enableDrag (new drag.ts vs the old code from app.js)', () => {
  it('behaves exactly like the old code in 600 random drags', () => {
    const rand = rng(20240607);
    let reordered = 0;
    for (let k = 0; k < 600; k++) {
      const sc = randomScenario(rand);
      const a = run('old', sc), b = run('new', sc);
      expect(b).toEqual(a);
      if (a.reorders) reordered++;
    }
    // make sure the random scenarios really exercised the reorder path (the comparison would be empty otherwise)
    expect(reordered).toBeGreaterThan(50);
  });

  const three: Scenario = { heights: [40, 40, 40], gaps: [0, 0, 0], from: 0, pointerType: 'touch', button: 0, searching: false, moves: [], end: 'up', startY: 120 };
  it('moves the first ingredient to the end when dragged past the others', () => {
    // the dragged row is taller than the others here; see the note in the commit message about equal heights
    const r = run('new', { ...three, heights: [60, 40, 40], moves: [150, 200, 260] });
    expect(r.order).toEqual(['ing1', 'ing2', 'ing0']);
    expect(r.reorders).toBe(1);
    expect(r.log.indexOf('save') < r.log.indexOf('render')).toBe(true);
  });
  it('moves the last ingredient to the top when dragged up', () => {
    const r = run('new', { ...three, from: 2, startY: 240, moves: [200, 150, 90] });
    expect(r.order).toEqual(['ing2', 'ing0', 'ing1']);
  });
  it('changes nothing when released where it started', () => {
    const r = run('new', { ...three, moves: [125, 118] });
    expect(r.order).toEqual(['ing0', 'ing1', 'ing2']);
    expect(r.reorders).toBe(0);
  });
  it('does not start while a search is active', () => {
    const r = run('new', { ...three, searching: true, moves: [260] });
    expect(r.order).toEqual(['ing0', 'ing1', 'ing2']);
    expect(r.prevented).toBe(0);
    expect(r.log.indexOf('capture 7')).toBe(-1);
  });
  it('ignores the right mouse button, but not touch', () => {
    expect(run('new', { ...three, pointerType: 'mouse', button: 2, moves: [260] }).prevented).toBe(0);
    expect(run('new', { ...three, pointerType: 'touch', button: 2, moves: [260] }).prevented).toBe(1);
  });
  it('does not start with a single ingredient', () => {
    const r = run('new', { heights: [40], gaps: [0], from: 0, pointerType: 'touch', button: 0, searching: false, moves: [300], end: 'up', startY: 120 });
    expect(r.prevented).toBe(0);
    expect(r.reorders).toBe(0);
  });
  it('removes its move/up/cancel listeners when released', () => {
    const r = run('new', { ...three, moves: [260] });
    expect(r.listeners).toBe('pointercancel=0,pointerdown=1,pointermove=0,pointerup=0');
  });
});
