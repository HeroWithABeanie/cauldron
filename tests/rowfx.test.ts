import { describe, it, expect, afterEach } from 'vitest';
import { keyFor, popList, spinPlus } from '../src/rowfx';
import { popList as oldPopList, spinPlus as oldSpinPlus } from './reference/oldHelpers';

const g = globalThis as any;
afterEach(() => { delete g.window; });

describe('keyFor', () => {
  it('gives the same object the same key every time', () => {
    const a = {};
    expect(keyFor(a)).toBe(keyFor(a));
  });
  it('gives different objects different keys, counting up', () => {
    const a = {}, b = {}, c = {};
    const ka = keyFor(a), kb = keyFor(b), kc = keyFor(c);
    expect(kb).toBe(ka + 1);
    expect(kc).toBe(kb + 1);
  });
  it('does not change a key when other objects are added', () => {
    const a = {}; const ka = keyFor(a);
    keyFor({}); keyFor({});
    expect(keyFor(a)).toBe(ka);
  });
});

// ---- popList / spinPlus: the icons of the swipe-to-add-to-list gesture ----
function fakeSvg() {
  const calls: string[] = [];
  const part = (name: string) => ({ animate: (kf: unknown, o: unknown) => { calls.push(name + ' ' + JSON.stringify([kf, o])); } });
  const svg: any = { animate: () => {}, querySelector: (sel: string) => (sel === '.lns' ? part('lns') : sel === '.pls' ? part('pls') : null) };
  return { svg, calls };
}

describe('popList / spinPlus', () => {
  it('animate the lines and the plus sign, exactly like the old code', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    const a = fakeSvg(), b = fakeSvg(), c = fakeSvg(), d = fakeSvg();
    popList(a.svg); oldPopList(b.svg);
    spinPlus(c.svg); oldSpinPlus(d.svg);
    expect(a.calls.length).toBe(2);
    expect(c.calls.length).toBe(1);
    expect(a.calls).toEqual(b.calls);
    expect(c.calls).toEqual(d.calls);
  });
  it('do nothing with reduced motion', () => {
    g.window = { matchMedia: () => ({ matches: true }) };
    const a = fakeSvg();
    popList(a.svg); spinPlus(a.svg);
    expect(a.calls.length).toBe(0);
  });
  it('do nothing without an svg or when it cannot animate', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    popList(null); spinPlus(undefined);
    const a = fakeSvg(); a.svg.animate = undefined;
    popList(a.svg); spinPlus(a.svg);
    expect(a.calls.length).toBe(0);
  });
  it('skip parts that are missing', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    const calls: string[] = [];
    const svg: any = { animate: () => {}, querySelector: (sel: string) => (sel === '.pls' ? { animate: () => { calls.push('pls'); } } : null) };
    popList(svg); spinPlus(svg);
    expect(calls).toEqual(['pls', 'pls']);
  });
});
