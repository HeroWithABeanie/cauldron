import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NOTES, TAGS, vnum } from '../src/notes';
import { SHOWCASE } from '../src/showcase';
import * as icons from '../src/icons';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const current = 'v' + String(pkg.version).split('.')[0];

describe('vnum', () => {
  it('reads the number out of a version key', () => {
    expect(vnum('v76')).toBe(76);
    expect(vnum('v5')).toBe(5);
    expect(vnum('nonsense')).toBe(0);
  });
});

describe('NOTES', () => {
  const keys = Object.keys(NOTES);
  it('has an entry for the version in package.json, and it is the newest', () => {
    expect(keys).toContain(current);
    expect(Math.max(...keys.map(vnum))).toBe(vnum(current));
  });
  it('uses keys like v76 and no number twice', () => {
    keys.forEach((k) => expect(k).toMatch(/^v\d+$/));
    expect(new Set(keys.map(vnum)).size).toBe(keys.length);
  });
  it('has a date and at least one entry for every version', () => {
    keys.forEach((k) => {
      expect(NOTES[k].date, k).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
      expect(NOTES[k].entries.length, k).toBeGreaterThan(0);
    });
  });
  it('gives every entry a known tag, a title and a text', () => {
    keys.forEach((k) => NOTES[k].entries.forEach((e) => {
      expect(Object.keys(TAGS), k).toContain(e.tag);
      expect(e.title.length, k).toBeGreaterThan(0);
      expect(e.text.length, k).toBeGreaterThan(0);
    }));
  });
  it('only points "See how it works" at showcases that exist', () => {
    keys.forEach((k) => NOTES[k].entries.forEach((e) => {
      if (e.demo) expect(Object.keys(SHOWCASE), k + ': ' + e.title).toContain(e.demo);
    }));
  });
});

describe('SHOWCASE', () => {
  it('has title, alt text, demo HTML and 3 steps for every entry', () => {
    Object.keys(SHOWCASE).forEach((k) => {
      const s = SHOWCASE[k];
      expect(k).toMatch(/^v\d+$/);
      expect(s.title.length, k).toBeGreaterThan(0);
      expect(s.alt.length, k).toBeGreaterThan(0);
      expect(s.demo.startsWith('<'), k).toBe(true);
      expect(s.steps.length, k).toBe(3);
    });
  });
  it('has no unfilled placeholders such as "undefined" in the demo HTML', () => {
    Object.keys(SHOWCASE).forEach((k) => expect(SHOWCASE[k].demo, k).not.toMatch(/undefined|\[object/));
  });
});

describe('icons', () => {
  it('are svg strings', () => {
    [icons.chkSvg(), icons.SW_TRASH, icons.CART_SVG, icons.UNLINK_SVG].forEach((s) => {
      expect(s.startsWith('<svg')).toBe(true);
      expect(s.endsWith('</svg>')).toBe(true);
    });
  });
  it('chkIn gives the check path, or the undo path for done items', () => {
    expect(icons.chkIn(false)).toBe(icons.CHK_PATH);
    expect(icons.chkIn(true)).toBe(icons.UNCHK_PATH);
  });
});
