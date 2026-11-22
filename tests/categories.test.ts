import { describe, it, expect } from 'vitest';
import { CATS, CAT_HTML, fixCats } from '../src/categories';

describe('CATS', () => {
  it('has 13 unique categories and no old name', () => {
    expect(CATS).toHaveLength(13);
    expect(new Set(CATS).size).toBe(13);
    expect(CATS).not.toContain('Milk & Cheese');
    expect(CATS).toContain('Dairy & egg products');
  });
});

describe('CAT_HTML', () => {
  it('starts with a None option and has one option per category', () => {
    expect(CAT_HTML.startsWith('<option value="">None</option>')).toBe(true);
    expect((CAT_HTML.match(/<option /g) || []).length).toBe(CATS.length + 1);
  });
  it('escapes & as &amp;', () => {
    expect(CAT_HTML).toContain('<option value="Fruits &amp; Vegetables">Fruits &amp; Vegetables</option>');
    expect(CAT_HTML).not.toMatch(/&(?!amp;)/);
  });
});

describe('fixCats', () => {
  it('renames the old category in place and reports a change', () => {
    const a = [{ cat: 'Milk & Cheese' }, { cat: 'Pantry' }];
    expect(fixCats(a)).toBe(true);
    expect(a.map((x) => x.cat)).toEqual(['Dairy & egg products', 'Pantry']);
  });
  it('reports no change when nothing needs renaming', () => {
    expect(fixCats([{ cat: 'Pantry' }, { cat: '' }, {}])).toBe(false);
  });
  it('goes into nested recipe items', () => {
    const r = [{ cat: 'Pantry', items: [{ cat: 'Milk & Cheese' }] }];
    expect(fixCats(r)).toBe(true);
    expect(r[0].items![0].cat).toBe('Dairy & egg products');
  });
  it('tolerates null, undefined and null entries', () => {
    expect(fixCats(null)).toBe(false);
    expect(fixCats(undefined)).toBe(false);
    expect(fixCats([null as any, { cat: 'Milk & Cheese' }])).toBe(true);
  });
  it('is idempotent', () => {
    const a = [{ cat: 'Milk & Cheese' }];
    fixCats(a);
    expect(fixCats(a)).toBe(false);
  });
});
