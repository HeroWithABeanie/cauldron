import { describe, it, expect, afterEach } from 'vitest';
import { animateTabIcon, setSwap, setSwapAll } from '../src/tabicon';
import * as old from './reference/oldTabicon';

const g = globalThis as any;
afterEach(() => { delete g.document; delete g.window; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- a small fake page: elements that record every animate() and setProperty() call ----
class El {
  kids: Record<string, El[]> = {};
  offsetWidth = 0; offsetLeft = 0; canAnimate = true;
  props: Record<string, string> = {};
  constructor(public log: string[], public label: string) {}
  get animate(): any { return this.canAnimate ? (kf: unknown, o: unknown) => { this.log.push(this.label + '.animate ' + JSON.stringify([kf, o])); } : undefined; }
  querySelector(sel: string) { return (this.kids[sel] || [])[0] || null; }
  querySelectorAll(sel: string) { return this.kids[sel] || []; }
  get style() { return { setProperty: (k: string, v: string) => { this.props[k] = v; this.log.push(this.label + ' ' + k + '=' + v); } }; }
}

interface Spec { view: string; reduced: boolean; hasTab: boolean; hasSvg: boolean; canAnimate: boolean; bub: number; dot: number; ln: number; chips: { hasA: boolean; hasZ: boolean; aw: number; al: number; zw: number; zl: number }[] }
function randomSpec(rand: () => number): Spec {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  return {
    view: pick(['list', 'recipes', 'recipes', 'list', 'other']), reduced: rand() < .15, hasTab: rand() < .92, hasSvg: rand() < .92, canAnimate: rand() < .9,
    bub: Math.floor(rand() * 4), dot: Math.floor(rand() * 4), ln: Math.floor(rand() * 4),
    chips: Array.from({ length: Math.floor(rand() * 5) }, () => ({ hasA: rand() < .9, hasZ: rand() < .9, aw: pick([0, 10, 14.5, 20]), al: pick([0, 3, 8]), zw: pick([8, 12.25, 16]), zl: pick([12, 20, 31.5]) })),
  };
}

function run(impl: 'old' | 'new', sp: Spec) {
  const log: string[] = [];
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? sp.reduced : false }) };
  const svg = new El(log, 'svg'); svg.canAnimate = sp.canAnimate;
  const mk = (n: number, name: string) => Array.from({ length: n }, (_, i) => { const e = new El(log, name + i); e.canAnimate = sp.canAnimate; return e; });
  svg.kids = { '.bub': mk(sp.bub, 'bub'), '.dot': mk(sp.dot, 'dot'), '.ln': mk(sp.ln, 'ln') };
  const tab = new El(log, 'tab'); tab.kids = { svg: sp.hasSvg ? [svg] : [] };
  const chips = sp.chips.map((c, i) => {
    const el = new El(log, 'chip' + i), a = new El(log, 'a' + i), z = new El(log, 'z' + i);
    a.offsetWidth = c.aw; a.offsetLeft = c.al; z.offsetWidth = c.zw; z.offsetLeft = c.zl;
    el.kids = { '.la': c.hasA ? [a] : [], '.lz': c.hasZ ? [z] : [] };
    return el;
  });
  const asked: string[] = [];
  g.document = {
    querySelector: (sel: string) => { asked.push(sel); return sel === '.tab[data-view="' + sp.view + '"]' && sp.hasTab ? tab : null; },
    querySelectorAll: (sel: string) => { asked.push(sel); return sel === '.azchip' ? chips : []; },
  };
  const impls: any = impl === 'old' ? old : { animateTabIcon, setSwap, setSwapAll };
  impls.animateTabIcon(sp.view);
  impls.setSwapAll();
  if (chips.length) impls.setSwap(chips[0]);
  return { log, asked, props: chips.map((c) => c.props) };
}

describe('tab icon animation and sort chip swap (new tabicon.ts vs the old code from app.js)', () => {
  it('gives identical results in 1500 random pages', () => {
    const rand = rng(1234321);
    const seen = { recipes: 0, list: 0, other: 0, reduced: 0, noTab: 0, noSvg: 0, noAnim: 0, chipsSet: 0, chipSkipped: 0 };
    for (let k = 0; k < 1500; k++) {
      const sp = randomSpec(rand), a = run('old', sp), b = run('new', sp);
      expect(b).toEqual(a);
      if (sp.reduced) seen.reduced++; else if (!sp.hasTab) seen.noTab++; else if (!sp.hasSvg) seen.noSvg++; else if (!sp.canAnimate) seen.noAnim++;
      else if (sp.view === 'recipes') seen.recipes++; else if (sp.view === 'list') seen.list++; else seen.other++;
      if (a.log.some((l) => l.includes('--da='))) seen.chipsSet++;
      if (sp.chips.some((c) => !c.hasA || !c.hasZ || !c.aw)) seen.chipSkipped++;
    }
    for (const [k, v] of Object.entries(seen)) expect([k, v > 30]).toEqual([k, true]);
  });

  const page = (reduced = false) => {
    const log: string[] = [];
    g.window = { matchMedia: () => ({ matches: reduced }) };
    return log;
  };
  it('the Recipes icon bounces and its bubbles rise one after the other', () => {
    const log = page(), svg = new El(log, 'svg'), tab = new El(log, 'tab'); tab.kids = { svg: [svg] };
    const b0 = new El(log, 'b0'), b1 = new El(log, 'b1'); svg.kids = { '.bub': [b0, b1] };
    g.document = { querySelector: (s: string) => (s === '.tab[data-view="recipes"]' ? tab : null) };
    animateTabIcon('recipes');
    expect(log.length).toBe(3);
    expect(log[0]).toContain('svg.animate');
    expect(log[1]).toContain('"delay":0');
    expect(log[2]).toContain('"delay":45');
    expect(log[2]).toContain('-6.5px');   // -5 - 1 * 1.5
  });
  it('the List icon wobbles, its dots pop and its lines squeeze', () => {
    const log = page(), svg = new El(log, 'svg'), tab = new El(log, 'tab'); tab.kids = { svg: [svg] };
    svg.kids = { '.dot': [new El(log, 'd0')], '.ln': [new El(log, 'l0'), new El(log, 'l1')] };
    g.document = { querySelector: () => tab };
    animateTabIcon('list');
    expect(log.length).toBe(4);
    expect(log[0]).toContain('rotate(-5deg)');
    expect(log[3]).toContain('"delay":70');
  });
  it('does nothing with reduced motion, or when the tab or its icon is missing', () => {
    let log = page(true); const svg = new El(log, 'svg'), tab = new El(log, 'tab'); tab.kids = { svg: [svg] };
    g.document = { querySelector: () => tab };
    animateTabIcon('list'); expect(log).toEqual([]);
    log = page(false); g.document = { querySelector: () => null };
    animateTabIcon('list'); expect(log).toEqual([]);
  });
  it('setSwap measures how far the two letters travel; a hidden chip is skipped', () => {
    const log: string[] = [], chip = new El(log, 'chip'), a = new El(log, 'a'), z = new El(log, 'z');
    a.offsetWidth = 10; a.offsetLeft = 4; z.offsetWidth = 12; z.offsetLeft = 20;
    chip.kids = { '.la': [a], '.lz': [z] };
    setSwap(chip as any);
    expect(chip.props).toEqual({ '--da': (20 + 12 - 10 - 4) + 'px', '--dz': (4 - 20) + 'px' });
    const hidden = new El(log, 'hidden'); hidden.kids = { '.la': [new El(log, 'a2')], '.lz': [new El(log, 'z2')] };
    setSwap(hidden as any);
    expect(hidden.props).toEqual({});
  });
});
