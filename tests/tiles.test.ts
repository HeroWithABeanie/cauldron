import { describe, it, expect, afterEach } from 'vitest';
import { qtyText, fitRTiles } from '../src/tiles';
import { fitRTiles as oldFitRTiles } from './reference/oldHelpers';

const g = globalThis as any;
afterEach(() => { delete g.window; delete g.document; });

describe('qtyText', () => {
  it('is empty without a quantity', () => {
    expect(qtyText({ qty: 0, unit: 'pack' })).toBe('');
    expect(qtyText({ unit: 'pack' })).toBe('');
  });
  it('joins quantity and unit with a non-breaking space', () => {
    expect(qtyText({ qty: 500, unit: 'ml' })).toBe('500\u00a0ml');
  });
  it('uses the singular for 1 and the plural otherwise', () => {
    expect(qtyText({ qty: 1, unit: 'pack' })).toBe('1\u00a0pack');
    expect(qtyText({ qty: 2, unit: 'pack' })).toBe('2\u00a0packs');
    expect(qtyText({ qty: 1, unit: 'pcs' })).toBe('1\u00a0pc');
  });
  it('keeps a blank unit as is', () => {
    expect(qtyText({ qty: 3, unit: '' })).toBe('3\u00a0');
  });
});

// ---- fitRTiles: recipe tile names are fitted like list tiles; computers allow one more line ----
function fakeName(o: { offsetWidth: number; scrollWidth: number; clientWidth: number; scrollHeight: number; boxH: number }) {
  return { offsetWidth: o.offsetWidth, scrollWidth: o.scrollWidth, clientWidth: o.clientWidth, scrollHeight: o.scrollHeight, parentNode: { clientHeight: o.boxH }, style: { cssText: '', fontSize: '' } };
}
function setup(desk: boolean, els: any[]) {
  g.window = { matchMedia: (q: string) => ({ matches: desk && q === '(hover:hover) and (pointer:fine)' }) };
  g.document = { querySelectorAll: (sel: string) => { if (sel !== '.rtile .rname') throw new Error('wrong selector ' + sel); return els; } };
}

describe('fitRTiles', () => {
  it('starts at 18.4px on phones and 20px on computers', () => {
    const fits = { offsetWidth: 100, scrollWidth: 50, clientWidth: 100, scrollHeight: 20, boxH: 80 };
    const a = fakeName(fits); setup(false, [a]); fitRTiles();
    expect(a.style.cssText).toBe('max-height:80px;font-size:18.4px;');
    const b = fakeName(fits); setup(true, [b]); fitRTiles();
    expect(b.style.cssText).toBe('max-height:80px;font-size:20px;');
  });
  it('skips names that are not visible', () => {
    const a = fakeName({ offsetWidth: 0, scrollWidth: 50, clientWidth: 100, scrollHeight: 20, boxH: 80 });
    setup(false, [a]); fitRTiles();
    expect(a.style.cssText).toBe('');
  });
  it('shrinks and cuts off long names exactly like the old code (random sizes)', () => {
    let seed = 99; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let k = 0; k < 300; k++) {
      const spec = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
        offsetWidth: rnd() < .15 ? 0 : 100, scrollWidth: Math.floor(rnd() * 400), clientWidth: 60 + Math.floor(rnd() * 100),
        scrollHeight: Math.floor(rnd() * 160), boxH: 30 + Math.floor(rnd() * 90),
      }));
      const desk = rnd() < .5;
      const a = spec.map(fakeName), b = spec.map(fakeName);
      setup(desk, a); oldFitRTiles();
      setup(desk, b); fitRTiles();
      expect(b.map((x) => x.style)).toEqual(a.map((x) => x.style));
    }
  });
});
