import { describe, it, expect } from 'vitest';
import { keyFor } from '../src/rowfx';

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
