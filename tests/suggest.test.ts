import { describe, it, expect } from 'vitest';
import { nameCandidates } from '../src/suggest';
import { oldNameCandidates } from './reference/oldSuggest';

const li = (text: string, extra: any = {}) => ({ id: text, text, qty: 1, unit: 'pcs', done: false, ...extra });
const rec = (name: string, texts: string[]) => ({ id: name, name, portions: 2, items: texts.map((t) => ({ text: t, qty: 1, unit: 'g', cat: 'Dairy' })) });
const hist = (text: string) => ({ text, unit: 'pcs', cat: '', last: 1 });
const names = (l: any[]) => l.map((x) => x.name);

describe('nameCandidates', () => {
  it('finds names containing the text, those starting with it first, then A to Z', () => {
    const r = nameCandidates('ap', undefined, [li('Pineapple'), li('Apple')] as any, [], [hist('Grape'), hist('Apricot')] as any);
    expect(names(r)).toEqual(['Apple', 'Apricot', 'Grape', 'Pineapple']);
  });
  it('reports where a name comes from, the list winning over recipes and history', () => {
    const r = nameCandidates('milk', undefined, [li('Milk')] as any, [rec('R', ['milk', 'milk chocolate'])] as any, [hist('MILK'), hist('Oat milk')] as any);
    expect(r.map((x) => [x.name, x.src])).toEqual([['Milk', 'list'], ['milk chocolate', 'recipe'], ['Oat milk', 'history']]);
  });
  it('keeps the first spelling when two non-list sources differ only in case', () => {
    const r = nameCandidates('egg', undefined, [], [rec('R', ['Egg'])] as any, [hist('egg')] as any);
    expect(r).toEqual([{ name: 'Egg', src: 'recipe', unit: 'g', cat: 'Dairy' }]);
  });
  it('respects the limit', () => {
    const l = ['aa', 'ab', 'ac', 'ad'].map((t) => li(t));
    expect(names(nameCandidates('a', 2, l as any, [], []))).toEqual(['aa', 'ab']);
  });
  it('returns nothing when nothing matches', () => expect(nameCandidates('zzz', undefined, [li('a')] as any, [], [])).toEqual([]));
});

function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
describe('old app.js nameCandidates vs suggest.ts (random)', () => {
  it('gives identical results', () => {
    const rnd = rng(11);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const words = ['Apple', 'apple', 'Äpfel', 'milk', 'Milk', 'oat milk', 'rice', 'egg', 'Egg', 'flour', 'constructor', 'toString', 'Bean'];
    for (let n = 0; n < 400; n++) {
      const items = Array.from({ length: Math.floor(rnd() * 6) }, () => li(pick(words), { cat: rnd() < 0.5 ? 'Dairy' : undefined }));
      const recipes = Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => rec('R' + i, Array.from({ length: Math.floor(rnd() * 4) }, () => pick(words))));
      const history = Array.from({ length: Math.floor(rnd() * 6) }, () => hist(pick(words)));
      for (const q of ['a', 'm', 'milk', 'e', 'con', 'to', 'zz', 'ä']) {
        for (const limit of [undefined, 3]) {
          expect(nameCandidates(q, limit, items as any, recipes as any, history as any)).toEqual(oldNameCandidates(q, limit, items, recipes, history));
        }
      }
    }
  });
});
