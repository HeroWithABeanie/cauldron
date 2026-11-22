import { describe, it, expect } from 'vitest';
import { unitLabel, convertQty, scaleQty } from '../src/units';

describe('unitLabel', () => {
  it('uses the singular for 1', () => expect(unitLabel(1, 'pack')).toBe('pack'));
  it('pluralises known units', () => {
    expect(unitLabel(2, 'pack')).toBe('packs');
    expect(unitLabel(2, 'box')).toBe('boxes');
    expect(unitLabel(3, 'loaf')).toBe('loaves');
    expect(unitLabel(0, 'bunch')).toBe('bunches');
    expect(unitLabel(1.5, 'can')).toBe('cans');
  });
  it('shows pcs as pc for exactly 1', () => {
    expect(unitLabel(1, 'pcs')).toBe('pc');
    expect(unitLabel(2, 'pcs')).toBe('pcs');
  });
  it('leaves units without a plural unchanged', () => {
    expect(unitLabel(5, 'g')).toBe('g');
    expect(unitLabel(1, 'kg')).toBe('kg');
    expect(unitLabel(2, 'unknown')).toBe('unknown');
  });
});

describe('convertQty', () => {
  it('returns the same number for the same unit, even for unknown units', () => {
    expect(convertQty(3, 'g', 'g')).toBe(3);
    expect(convertQty(3, 'pack', 'pack')).toBe(3);
  });
  it('converts mass', () => {
    expect(convertQty(1, 'kg', 'g')).toBe(1000);
    expect(convertQty(500, 'g', 'kg')).toBe(0.5);
  });
  it('converts volume', () => {
    expect(convertQty(1, 'l', 'ml')).toBe(1000);
    expect(convertQty(2, 'dl', 'cl')).toBe(20);
    expect(convertQty(3, 'tsp', 'ml')).toBe(15);
    expect(convertQty(2, 'tbsp', 'tsp')).toBe(6);
  });
  it('returns null across mass and volume', () => {
    expect(convertQty(1, 'g', 'ml')).toBeNull();
    expect(convertQty(1, 'l', 'kg')).toBeNull();
  });
  it('returns null when a unit is not convertible', () => {
    expect(convertQty(1, 'pack', 'g')).toBeNull();
    expect(convertQty(1, 'g', 'pcs')).toBeNull();
  });
});

describe('scaleQty', () => {
  it('scales and rounds to 2 decimals', () => {
    expect(scaleQty(2, 1.5)).toBe(3);
    expect(scaleQty(1, 1 / 3)).toBe(0.33);
    expect(scaleQty(250, 0.5)).toBe(125);
  });
  it('never goes below 0.01', () => {
    expect(scaleQty(1, 0)).toBe(0.01);
    expect(scaleQty(0.001, 1)).toBe(0.01);
  });
});
