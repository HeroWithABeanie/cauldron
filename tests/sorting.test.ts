import { describe, it, expect } from 'vitest';
import { isMulti, sortedBase, sortedItems, sortedRecipes } from '../src/sorting';
import type { ListSort, RecipeSort } from '../src/sorting';
import { CATS } from '../src/categories';
import { oldSortedItems, oldSortedBase, oldSortedRecipes } from './reference/oldSorting';

const it_ = (o: any) => ({ id: o.text, qty: 1, unit: '', done: false, ...o });
const names = (l: any[]) => l.map((x) => x.text || x.name);

describe('isMulti', () => {
  it('is false without recipes', () => { expect(isMulti({})).toBe(false); expect(isMulti({ from: [] })).toBe(false); });
  it('is false for exactly one recipe', () => expect(isMulti({ from: [{ id: 1, name: 'a' }] })).toBe(false));
  it('is true for two recipes', () => expect(isMulti({ from: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] })).toBe(true));
  it('is true for one recipe plus a manual top-up', () => expect(isMulti({ from: [{ id: 1, name: 'a' }], manual: true })).toBe(true));
  it('is false for manual without recipes', () => expect(isMulti({ manual: true })).toBe(false));
});

describe('sortedItems', () => {
  const list = [it_({ text: 'pear' }), it_({ text: 'Apple', done: true }), it_({ text: 'cherry' }), it_({ text: 'banana', brand: 'Zed' })];
  it('sorts A to Z by brand + name, ignoring case, ticked items last', () => {
    expect(names(sortedItems(list as any, 'az'))).toEqual(['cherry', 'pear', 'banana', 'Apple']);
  });
  it('sorts Z to A', () => {
    expect(names(sortedItems(list as any, 'za'))).toEqual(['banana', 'pear', 'cherry', 'Apple']);
  });
  it('does not change the array it is given', () => {
    const copy = list.slice(); sortedItems(list as any, 'az'); expect(list).toEqual(copy);
  });
  it('sorts by category order, unknown categories last, stable inside a category', () => {
    const l = [it_({ text: 'a', cat: 'Household' }), it_({ text: 'b' }), it_({ text: 'c', cat: CATS[0] }), it_({ text: 'd', cat: CATS[0] })];
    expect(names(sortedBase(l as any, 'cat'))).toEqual(['c', 'd', 'a', 'b']);
  });
  it('groups by recipe in order of first appearance, multi-recipe items next, manual items last', () => {
    const l = [
      it_({ text: 'm1' }),
      it_({ text: 'r2a', from: [{ id: 2, name: 'Two' }] }),
      it_({ text: 'multi', from: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }] }),
      it_({ text: 'r1a', from: [{ id: 1, name: 'One' }] }),
      it_({ text: 'r2b', from: [{ id: 2, name: 'Two' }] }),
    ];
    expect(names(sortedBase(l as any, 'recipe'))).toEqual(['r2a', 'r2b', 'r1a', 'multi', 'm1']);
  });
});

describe('sortedRecipes', () => {
  const r = (name: string, portions: number, n: number) => ({ id: name, name, portions, items: Array.from({ length: n }, () => ({ text: 'x', qty: 1, unit: '' })) });
  const l = [r('b', 4, 3), r('a', 2, 3), r('C', 4, 1), r('d', 1, 5)];
  it('az / za', () => { expect(names(sortedRecipes(l as any, 'az'))).toEqual(['a', 'b', 'C', 'd']); expect(names(sortedRecipes(l as any, 'za'))).toEqual(['d', 'C', 'b', 'a']); });
  it('portions up / down, ties by name', () => { expect(names(sortedRecipes(l as any, 'pu'))).toEqual(['d', 'a', 'b', 'C']); expect(names(sortedRecipes(l as any, 'pd'))).toEqual(['b', 'C', 'a', 'd']); });
  it('ingredients up / down, ties by name', () => { expect(names(sortedRecipes(l as any, 'iu'))).toEqual(['C', 'a', 'b', 'd']); expect(names(sortedRecipes(l as any, 'id'))).toEqual(['d', 'a', 'b', 'C']); });
  it('copes with a recipe that has no items array', () => {
    expect(names(sortedRecipes([{ id: 1, name: 'x', portions: 1 } as any, r('y', 1, 1)] as any, 'iu'))).toEqual(['x', 'y']);
  });
});

// Old app.js logic against the new module on random data.
function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
describe('old app.js sorting vs sorting.ts (random)', () => {
  it('gives identical results in every mode', () => {
    const rnd = rng(7);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const words = ['Apple', 'apple', 'Äpfel', 'milk', 'Milk', 'rice', 'egg', 'flour', '', 'zucchini', 'Bean'];
    for (let n = 0; n < 300; n++) {
      const items = Array.from({ length: Math.floor(rnd() * 14) }, (_, i) => {
        const k = Math.floor(rnd() * 4);
        const from = k === 0 ? undefined : k === 1 ? [] : Array.from({ length: k === 2 ? 1 : 1 + Math.floor(rnd() * 3) }, () => ({ id: 1 + Math.floor(rnd() * 4), name: 'R' }));
        return it_({ id: 'i' + i, text: pick(words), brand: rnd() < 0.3 ? pick(words) : undefined, cat: rnd() < 0.2 ? undefined : pick([...CATS, 'Old cat']), done: rnd() < 0.3, from, manual: rnd() < 0.3 });
      });
      for (const m of ['recipe', 'cat', 'az', 'za'] as ListSort[]) {
        expect(sortedItems(items as any, m)).toEqual(oldSortedItems(items, m));
        expect(sortedBase(items as any, m)).toEqual(oldSortedBase(items, m));
      }
      const recipes = Array.from({ length: Math.floor(rnd() * 10) }, (_, i) => ({ id: i, name: pick(words), portions: 1 + Math.floor(rnd() * 4), items: rnd() < 0.1 ? undefined : Array.from({ length: Math.floor(rnd() * 4) }, () => ({})) }));
      for (const m of ['az', 'za', 'pu', 'pd', 'iu', 'id'] as RecipeSort[]) {
        expect(sortedRecipes(recipes as any, m)).toEqual(oldSortedRecipes(recipes, m));
      }
    }
  });
});
