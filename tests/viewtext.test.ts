import { describe, it, expect } from 'vitest';
import { ingText, portionsText, infoLine, topLine } from '../src/viewtext';
import { makeOld } from './reference/oldViewtext';

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('ingText / portionsText', () => {
  it('use the singular for exactly one', () => {
    expect(ingText({ items: [1] })).toBe('1 ingredient');
    expect(portionsText(1)).toBe('up to 1 portion');
  });
  it('use the plural otherwise, also for none or a missing list', () => {
    expect(ingText({ items: [1, 2, 3] })).toBe('3 ingredients');
    expect(ingText({ items: [] })).toBe('0 ingredients');
    expect(ingText({})).toBe('0 ingredients');
    expect(portionsText(4)).toBe('up to 4 portions');
    expect(portionsText(0)).toBe('up to 0 portions');
  });
});

describe('infoLine', () => {
  const r = { items: [1, 2], portions: 4 };
  it('puts portions first, except when sorted by ingredient count', () => {
    expect(infoLine(r, 'az')).toBe('up to 4 portions \u00b7 2 ingredients');
    expect(infoLine(r, 'pu')).toBe('up to 4 portions \u00b7 2 ingredients');
    expect(infoLine(r, 'iu')).toBe('2 ingredients \u00b7 up to 4 portions');
    expect(infoLine(r, 'id')).toBe('2 ingredients \u00b7 up to 4 portions');
  });
});

describe('topLine', () => {
  it('shows the recipe when sorted by recipe', () => {
    expect(topLine({ from: [{ id: 1, name: 'Soup' }] } as any, 'recipe')).toBe('Soup');
    expect(topLine({ from: [{ id: 1, name: 'A very long recipe name indeed' }] } as any, 'recipe')).toBe('A very long recipe n...');
    expect(topLine({ from: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] } as any, 'recipe')).toBe('Multiple recipes');
    expect(topLine({} as any, 'recipe')).toBe('');
  });
  it('shows the category when sorted by category, and nothing for A to Z', () => {
    expect(topLine({ cat: 'Dairy' } as any, 'cat')).toBe('Dairy');
    expect(topLine({} as any, 'cat')).toBe('');
    expect(topLine({ cat: 'Dairy' } as any, 'az')).toBeNull();
    expect(topLine({ cat: 'Dairy' } as any, 'za')).toBeNull();
  });
  it('gives identical results to the old code in 2000 random cases', () => {
    const rand = rng(77), old = makeOld({});
    const modes = ['recipe', 'cat', 'az', 'za'], names = ['', 'Soup', 'x'.repeat(20), 'x'.repeat(21), 'A longer recipe title here'];
    for (let k = 0; k < 2000; k++) {
      const n = Math.floor(rand() * 4);
      const it: any = {};
      if (rand() < .8) it.from = Array.from({ length: n }, (_, i) => ({ id: i, name: names[Math.floor(rand() * names.length)] }));
      if (rand() < .3) it.manual = true;
      if (rand() < .6) it.cat = ['', 'Dairy', 'Fruit'][Math.floor(rand() * 3)];
      const m = modes[Math.floor(rand() * 4)];
      old.set({ sortMode: m });
      expect(topLine(it, m)).toBe(old.topLine(it));
    }
  });
  it('infoLine / ingText / portionsText match the old code in random cases', () => {
    const rand = rng(78), old = makeOld({});
    const sorts = ['az', 'za', 'pu', 'pd', 'iu', 'id'];
    for (let k = 0; k < 500; k++) {
      const r: any = { portions: Math.floor(rand() * 12), items: rand() < .1 ? undefined : new Array(Math.floor(rand() * 6)).fill(0) };
      const s = sorts[Math.floor(rand() * 6)];
      old.set({ rsort: s });
      expect(infoLine(r, s)).toBe(old.infoLine(r));
      expect(ingText(r)).toBe(old.ingText(r));
      expect(portionsText(r.portions)).toBe(old.portionsText(r.portions));
    }
  });
});
