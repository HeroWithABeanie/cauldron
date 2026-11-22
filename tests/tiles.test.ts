import { describe, it, expect } from 'vitest';
import { qtyText } from '../src/tiles';

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
