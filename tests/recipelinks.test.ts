import { describe, it, expect, afterEach } from 'vitest';
import { linkedFrom, linkedToRecipe, listedPortions, recipeCardEl, ensureOpt, pressFlash } from '../src/recipelinks';
import { makeOldLinks } from './reference/oldLinks';
import { rng, clock, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout };
afterEach(() => { delete g.document; Object.assign(g, real); });

const IDS: unknown[] = [1, 2, 3, '1', 0, undefined];
const SPS: unknown[] = [undefined, null, 0, 1, 2, 3, 4, 6, '3', -2, NaN];
const PORTIONS: unknown[] = [undefined, null, 0, 1, 1, 1, 2, 4, NaN, '2'];
const pick = <T,>(rand: () => number, a: T[]) => a[Math.floor(rand() * a.length)];

function randomItems(rand: () => number): any[] {
  return Array.from({ length: Math.floor(rand() * 7) }, (_, i) => {
    const it: any = { id: 'i' + i, text: 't' + i };
    const k = rand();
    if (k < .15) return it;                       // no from at all
    if (k < .2) { it.from = null; return it; }
    it.from = Array.from({ length: Math.floor(rand() * 4) }, () => ({ id: pick(rand, IDS), name: 'n', sp: pick(rand, SPS) }));
    return it;
  });
}
const locate = (items: any[], f: any) => { if (!f) return null; for (let i = 0; i < items.length; i++) { const k = (items[i].from || []).indexOf(f); if (k > -1) return [i, k]; } return 'foreign'; };

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

describe('linkedFrom, linkedToRecipe and listedPortions (new vs the old code from app.js)', () => {
  it('give the same answers as the old code on 5000 random lists', () => {
    const rand = rng(2468);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 5000; n++) {
      const items = randomItems(rand), r = { id: pick(rand, IDS) };
      const old = makeOldLinks({ items, recipes: [] });
      const a = old.linkedFrom(r), b = linkedFrom(items, r);
      expect(locate(items, b)).toEqual(locate(items, a));
      expect(linkedToRecipe(items, r)).toBe(old.linkedToRecipe(r));
      const pa = old.listedPortions(r), pb = listedPortions(items, r);
      expect(Object.is(pb, pa)).toBe(true);
      if (a) hit('a match'); else hit('no match');
      if (a && locate(items, a)![0] !== 0) hit('match in a later item');
      if (items.some((x) => (x.from || []).filter((f: any) => f.id === r.id).length > 1)) hit('the recipe twice');
      if (items.some((x) => x.from === null)) hit('from is null');
      if (items.some((x) => x.from === undefined)) hit('no from');
      if (pa === 0) hit('portions 0'); else if (pa > 0) hit('portions > 0');
      if (typeof pa === 'string') hit('portions from a text value');
      if (items.some((x) => (x.from || []).some((f: any) => f.id === r.id && (f.sp === undefined || f.sp === null || Number.isNaN(f.sp) || f.sp < 0)))) hit('unusable sp skipped');
      if (items.length === 0) hit('empty list');
    }
    for (const k of ['a match', 'no match', 'match in a later item', 'the recipe twice', 'from is null', 'no from', 'portions 0', 'portions > 0', 'portions from a text value', 'unusable sp skipped', 'empty list']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  });

  const L = (...froms: any[][]) => froms.map((from, i) => ({ id: 'i' + i, text: 't', from })) as any[];
  it('linkedToRecipe is true as soon as one item came from the recipe; ids are compared strictly', () => {
    const items = L([{ id: 2, name: 'a' }], [{ id: 1, name: 'b' }, { id: 3, name: 'c' }]);
    expect(linkedToRecipe(items, { id: 3 })).toBe(true);
    expect(linkedToRecipe(items, { id: 4 })).toBe(false);
    expect(linkedToRecipe(items, { id: '1' })).toBe(false);
    expect(linkedToRecipe([], { id: 1 })).toBe(false);
    expect(linkedToRecipe([{ id: 'x', text: 'y' } as any], { id: 1 })).toBe(false);
  });
  it('linkedFrom returns the first entry from that recipe', () => {
    const a = { id: 5, name: 'a', sp: 2 }, b = { id: 5, name: 'b', sp: 9 };
    const items = L([{ id: 1, name: 'x' }, a], [b]);
    expect(linkedFrom(items, { id: 5 })).toBe(a);
    expect(linkedFrom(items, { id: 6 })).toBe(null);
  });
  it('listedPortions is the highest sp of that recipe over all items, and 0 when none is set', () => {
    const items = L([{ id: 1, name: 'x', sp: 2 }, { id: 2, name: 'y', sp: 8 }], [{ id: 1, name: 'x', sp: 6 }], [{ id: 1, name: 'x' }], [{ id: 1, name: 'x', sp: 4 }]);
    expect(listedPortions(items, { id: 1 })).toBe(6);
    expect(listedPortions(items, { id: 2 })).toBe(8);
    expect(listedPortions(items, { id: 3 })).toBe(0);
    expect(listedPortions(L([{ id: 1, name: 'x' }]), { id: 1 })).toBe(0);
    expect(listedPortions(L([{ id: 1, name: 'x', sp: 0 }]), { id: 1 })).toBe(0);
    expect(listedPortions(L([{ id: 1, name: 'x', sp: -3 }]), { id: 1 })).toBe(0);
  });
});

function pageWith(log: string[]) {
  let n = 0;
  g.document = { createElement: (tag: string) => new El(log, tag + (++n)) };
}
const dump = (e: El): any => ({ id: e.id, cls: e.className, text: e.textContent, kids: e.children.map(dump) });

describe('recipeCardEl (new vs the old code from app.js)', () => {
  it('builds the same card as the old code for 3000 random recipes and links', () => {
    const rand = rng(1357);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 3000; n++) {
      const recipes: any[] = Array.from({ length: Math.floor(rand() * 5) }, (_, i) => ({ id: pick(rand, IDS), name: 'R' + i, portions: pick(rand, PORTIONS), items: [] }));
      const f = { id: pick(rand, IDS) as any, name: pick(rand, ['', 'Old name', 'x']) };
      const l1: string[] = [], l2: string[] = [];
      pageWith(l1); const a = makeOldLinks({ items: [], recipes }).recipeCardEl(f);
      pageWith(l2); const b = recipeCardEl(recipes, f);
      expect(l2).toEqual(l1); expect(dump(b as any)).toEqual(dump(a));
      const rc = recipes.find((x) => x.id === f.id);
      if (!rc) hit('recipe gone: the saved name'); else hit('recipe found: its name');
      if (rc && rc.portions === 1) hit('1 portion'); else if (rc && rc.portions && rc.portions !== 1) hit('portions');
      if (rc && !rc.portions) hit('no portions line');
      if (rc && recipes.filter((x) => x.id === f.id).length > 1) hit('two recipes with that id');
      if (!rc && f.name === '') hit('gone and nameless');
    }
    for (const k of ['recipe gone: the saved name', 'recipe found: its name', '1 portion', 'portions', 'no portions line', 'two recipes with that id', 'gone and nameless']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  });
  it('shows the name of the recipe and "up to N portions" (1 portion in the singular)', () => {
    const log: string[] = []; pageWith(log);
    const recipes: any[] = [{ id: 1, name: 'Soup', portions: 4, items: [] }, { id: 2, name: 'Toast', portions: 1, items: [] }, { id: 3, name: 'Air', portions: 0, items: [] }];
    const t = (f: any) => dump(recipeCardEl(recipes, f) as any);
    expect(t({ id: 1, name: 'old' })).toEqual({ id: 'div1', cls: 'shophead', text: '', kids: [{ id: 'p2', cls: 'shopname', text: 'Soup', kids: [] }, { id: 'p3', cls: 'portions', text: 'up to 4 portions', kids: [] }] });
    expect(t({ id: 2, name: 'old' }).kids[1].text).toBe('up to 1 portion');
    expect(t({ id: 3, name: 'old' }).kids.length).toBe(1);
    const gone = t({ id: 9, name: 'Deleted recipe' });
    expect(gone.kids.length).toBe(1); expect(gone.kids[0].text).toBe('Deleted recipe');
  });
});

class Sel extends El { get options() { return this.children; } }

describe('ensureOpt (new vs the old code from app.js)', () => {
  it('adds an option exactly when it is missing, like the old code, for 3000 random drop-downs', () => {
    const rand = rng(97531);
    for (const k of Object.keys(seen)) delete seen[k];
    const VALS: unknown[] = ['pcs', 'g', '4', 4, 0, '', undefined, null, 12, '12', 'x'];
    for (let n = 0; n < 3000; n++) {
      const have = Array.from({ length: Math.floor(rand() * 5) }, () => pick(rand, ['pcs', 'g', '4', '12', 'x', '', 'undefined', 'null']));
      const v = pick(rand, VALS);
      const run = (mk: (s: Sel) => void) => { const log: string[] = []; pageWith(log); const s = new Sel(log, 'sel'); have.forEach((h, i) => { const o = new El(log, 'o' + i); o.value = h; s.children.push(o); }); log.length = 0; mk(s); return { log, vals: s.children.map((c) => c.value) }; };
      const a = run((s) => makeOldLinks({ items: [], recipes: [] }).ensureOpt(s, v)), b = run((s) => ensureOpt(s as any, v));
      expect(b).toEqual(a);
      if (b.vals.length > have.length) hit('added'); else hit('already there');
      if (typeof v === 'number' && have.includes(String(v))) hit('number matches the text option');
      if (v === undefined || v === null) hit('undefined or null');
      if (have.length === 0) hit('empty drop-down');
    }
    for (const k of ['added', 'already there', 'number matches the text option', 'undefined or null', 'empty drop-down']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  });
  it('keeps an existing option (4 and "4" are the same) and appends a missing one with its text', () => {
    const log: string[] = []; pageWith(log);
    const s = new Sel(log, 'sel'); const o = new El(log, 'o'); o.value = '4'; s.children.push(o);
    ensureOpt(s as any, 4); expect(s.children.length).toBe(1);
    ensureOpt(s as any, 6); expect(s.children.length).toBe(2);
    expect(s.children[1].value).toBe('6'); expect(s.children[1].textContent).toBe(6 as any);
    ensureOpt(s as any, 6); expect(s.children.length).toBe(2);
  });
});

describe('pressFlash (new vs the old code from app.js)', () => {
  type Op = { k: 'click' | 'wait'; n: number };
  const WAITS = [0, 1, 124, 125, 249, 250, 251, 500];
  function exec(impl: 'old' | 'new', ops: Op[], twoButtons: boolean) {
    const log: string[] = [], clk = clock();
    g.setTimeout = clk.setTimeout;
    const btn = new El(log, 'btn'), other = new El(log, 'other');
    let calls = 0;
    const fn = () => { calls++; log.push('fn#' + calls); };
    const wire = impl === 'old' ? makeOldLinks({ items: [], recipes: [] }).pressFlash : pressFlash;
    wire(btn as any, fn); if (twoButtons) wire(other as any, () => log.push('other fn'));
    for (const op of ops) { if (op.k === 'click') { log.push('-- click'); btn.fire('click'); if (twoButtons && op.n % 2) other.fire('click'); } else { log.push('-- wait ' + op.n); clk.advance(op.n); } }
    clk.advance(1000); log.push('end calls=' + calls);
    return log;
  }
  it('flashes, ignores taps meanwhile and then acts, exactly like the old code (3000 random tap sequences)', () => {
    const rand = rng(86420);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 3000; n++) {
      const ops: Op[] = Array.from({ length: 1 + Math.floor(rand() * 8) }, () => rand() < .5 ? { k: 'click', n: Math.floor(rand() * 4) } : { k: 'wait', n: pick(rand, WAITS) });
      const two = rand() < .3;
      const a = exec('old', ops, two), b = exec('new', ops, two);
      expect(b).toEqual(a);
      const txt = a.join('\n');
      if (/btn\.remove pressed/.test(txt)) hit('the flash ended');
      if (/-- click\n(?:(?!-- wait)[^\n]*\n)*-- click/.test(txt)) hit('two taps without a wait');
      if (/-- wait 249\n-- click/.test(txt)) hit('tap at 249');
      if (/-- wait 250\n-- click/.test(txt)) hit('tap at 250');
      if (/end calls=0/.test(txt)) hit('never acted');
      if (/end calls=[2-9]/.test(txt)) hit('acted more than once');
      if (two) hit('two buttons');
    }
    for (const k of ['the flash ended', 'two taps without a wait', 'tap at 249', 'tap at 250', 'never acted', 'acted more than once', 'two buttons']) expect([k, (seen[k] || 0) > 50]).toEqual([k, true]);
  });
  it('tapping lights the button at once and the action runs after 250 ms, not before', () => {
    const log: string[] = [], clk = clock(); g.setTimeout = clk.setTimeout;
    const btn = new El(log, 'btn'); let calls = 0;
    pressFlash(btn as any, () => { calls++; });
    btn.fire('click'); expect(btn.classes.has('pressed')).toBe(true); expect(calls).toBe(0);
    clk.advance(249); expect(calls).toBe(0); expect(btn.classes.has('pressed')).toBe(true);
    clk.advance(1); expect(calls).toBe(1); expect(btn.classes.has('pressed')).toBe(false);
  });
  it('a second tap while the button is lit does nothing; after the flash it works again', () => {
    const log: string[] = [], clk = clock(); g.setTimeout = clk.setTimeout;
    const btn = new El(log, 'btn'); let calls = 0;
    pressFlash(btn as any, () => { calls++; });
    btn.fire('click'); clk.advance(100); btn.fire('click'); clk.advance(150); expect(calls).toBe(1);
    btn.fire('click'); clk.advance(250); expect(calls).toBe(2);
  });
});
