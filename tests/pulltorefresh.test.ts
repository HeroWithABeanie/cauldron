import { describe, it, expect } from 'vitest';
import { formatLastSync } from '../src/pulltorefresh';

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe('formatLastSync', () => {
  const now = at(2026, 11, 22, 15, 30);
  it('says "Not updated yet" without a date', () => expect(formatLastSync(null, now)).toBe('Not updated yet'));
  it('says Today for the same day, with a padded time', () => expect(formatLastSync(at(2026, 11, 22, 9, 5), now)).toBe('Last updated Today, 09:05'));
  it('says Today for a time that is (slightly) in the future', () => expect(formatLastSync(at(2026, 11, 22, 23, 59), now)).toBe('Last updated Today, 23:59'));
  it('says Yesterday for the day before, even just after midnight', () => {
    expect(formatLastSync(at(2026, 11, 21, 23, 59), at(2026, 11, 22, 0, 1))).toBe('Last updated Yesterday, 23:59');
  });
  it('uses the date for older days', () => {
    const s = formatLastSync(at(2026, 11, 10, 8, 0), now);
    expect(s.startsWith('Last updated ')).toBe(true);
    expect(s.endsWith(', 08:00')).toBe(true);
    expect(s).not.toMatch(/Today|Yesterday/);
  });
  it('works across a month boundary', () => {
    expect(formatLastSync(at(2026, 10, 31, 12, 0), at(2026, 11, 1, 12, 0))).toBe('Last updated Yesterday, 12:00');
  });
});
