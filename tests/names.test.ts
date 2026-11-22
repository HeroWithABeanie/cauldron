import { describe, it, expect } from 'vitest';
import { uid, fullName, shortTitle, nameParts, searchRe } from '../src/names';

describe('uid', () => {
  it('returns a non-empty base-36 string and is unique across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const id = uid();
      expect(id).toMatch(/^[0-9a-z]+$/);
      seen.add(id);
    }
    expect(seen.size).toBe(2000);
  });
});

describe('fullName', () => {
  it('puts the brand in front', () => expect(fullName({ text: 'Milk', brand: 'Arla' })).toBe('Arla Milk'));
  it('works without a brand', () => expect(fullName({ text: 'Milk' })).toBe('Milk'));
  it('treats an empty brand as no brand', () => expect(fullName({ text: 'Milk', brand: '' })).toBe('Milk'));
});

describe('shortTitle', () => {
  it('keeps titles up to 20 characters', () => expect(shortTitle('12345678901234567890')).toBe('12345678901234567890'));
  it('cuts longer titles at 20 and adds ...', () => expect(shortTitle('123456789012345678901')).toBe('12345678901234567890...'));
  it('handles missing input', () => { expect(shortTitle()).toBe(''); expect(shortTitle('')).toBe(''); });
});

describe('nameParts', () => {
  it('returns the text as one piece when nothing can break', () => expect(nameParts('Milk')).toEqual(['Milk']));
  it('breaks after a separator that is followed by a letter', () => expect(nameParts('Salt/pepper')).toEqual(['Salt/', 'pepper']));
  it('does not break before a space', () => expect(nameParts('Salt, pepper')).toEqual(['Salt, pepper']));
  it('never breaks between two digits', () => expect(nameParts('Milk 1.5%')).toEqual(['Milk 1.5%']));
  it('also keeps 1,5 together', () => expect(nameParts('Milk 1,5')).toEqual(['Milk 1,5']));
  it('breaks before ( when it follows a letter directly', () => expect(nameParts('Cheese(grated)')).toEqual(['Cheese', '(grated)']));
  it('does not break before ( after a space', () => expect(nameParts('Cheese (grated)')).toEqual(['Cheese (grated)']));
  it('pieces always join back to the original text', () => {
    ['Salt/pepper', 'a-b_c:d', 'x(y)z', '1.5.2', 'a.b,c', '', 'Ice-cream (vanilla)/2*3'].forEach((t) => {
      expect(nameParts(t).join('')).toBe(t);
    });
  });
});

describe('searchRe', () => {
  it('matches words separated by any non-letter/digit characters', () => {
    const re = searchRe('olive oil', 'i');
    expect(re.test('Olive-oil')).toBe(true);
    expect(re.test('olive,  oil')).toBe(true);
    expect(re.test('oliveoil')).toBe(false);
  });
  it('is case-insensitive only with the i flag', () => {
    expect(searchRe('milk', '').test('MILK')).toBe(false);
    expect(searchRe('milk', 'i').test('MILK')).toBe(true);
  });
  it('handles non-ASCII letters', () => expect(searchRe('smör', 'i').test('Smör 500 g')).toBe(true));
  it('escapes regex characters instead of throwing', () => {
    expect(() => searchRe('a(b', 'i')).not.toThrow();
    expect(() => searchRe('***', 'i')).not.toThrow();
    expect(searchRe('***', 'i').test('a***b')).toBe(true);
  });
  it('supports the g flag for highlighting', () => {
    expect('tea and tea'.match(searchRe('tea', 'gi'))).toHaveLength(2);
  });
});
