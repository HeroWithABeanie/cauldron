(global as any).__realSetTimeout = (global as any).__realSetTimeout || setTimeout;
import { describe, it, expect, afterEach } from 'vitest';
import { createRecipeForm } from '../src/recipeform';
import { makeOldRecipeForm } from './reference/oldRecipeForm';
import { rng, clock, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout, now: Date.now };
afterEach(() => { delete g.document; g.setTimeout = real.setTimeout; Date.now = real.now; });

const pick = <T,>(rand: () => number, a: T[]) => a[Math.floor(rand() * a.length)];
const NAMES = ['', '   ', 'Pasta', '  Soup  ', 'x'.repeat(120), 'Æbleskiver'];
const PORTIONS = ['', '0', '1', '3', 'abc', '2.7', '-1', '08', ' 4', '1e2'];
const WAITS = [0, 1, 339, 340, 341, 1000];
type Op = { k: 'name' | 'portions' | 'open' | 'submit' | 'wait' | 'closeBtn' | 'backdrop' | 'inside' | 'closeNow'; v?: string | number };

function exec(impl: 'old' | 'new', ops: Op[], preset: number) {
  const log: string[] = [], clk = clock(); g.setTimeout = clk.setTimeout;
  let t = 1000; Date.now = () => (t += 7);
  const els = new Map<string, El>();
  g.document = { getElementById: (id: string) => { log.push('get ' + id); if (!els.has(id)) els.set(id, new El(log, id)); return els.get(id)!; } };
  const recipes: any[] = Array.from({ length: preset }, (_, i) => ({ id: i, name: 'R' + i, portions: 2, items: [] }));
  const ctx = { recipes, saveR: () => log.push('saveR'), withAnim: (kind: string, fn: () => void, lock?: boolean) => { log.push('withAnim ' + kind + ' ' + lock); fn(); }, renderRecipes: () => log.push('renderRecipes') };
  if (impl === 'old') makeOldRecipeForm(ctx); else createRecipeForm(ctx);
  const el = (id: string) => { if (!els.has(id)) els.set(id, new El(log, id)); return els.get(id)!; };   // the page's own elements: same in both runs
  for (const op of ops) {
    log.push('-- ' + op.k + ' ' + (op.v ?? ''));
    if (op.k === 'name') el('recipeName').value = op.v as string;
    else if (op.k === 'portions') el('recipePortions').value = op.v as string;
    else if (op.k === 'open') el('dlgRecipe').showModal();
    else if (op.k === 'submit') el('recipeForm').fire('submit');
    else if (op.k === 'wait') clk.advance(op.v as number);
    else if (op.k === 'closeBtn') el('dlgRecipeClose').fire('click');
    else if (op.k === 'backdrop') el('dlgRecipe').fire('click', { target: el('dlgRecipe') });
    else if (op.k === 'inside') el('dlgRecipe').fire('click', { target: el('recipeName') });
    else if (op.k === 'closeNow') el('dlgRecipe').close();
  }
  clk.advance(2000);
  return { log, recipes: JSON.stringify(recipes) };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

describe('the Add recipe window (new createRecipeForm vs the old code from app.js)', () => {
  it('behaves exactly like the old code in 4000 random sessions', () => {
    const rand = rng(5150);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 4000; n++) {
      const ops: Op[] = Array.from({ length: 2 + Math.floor(rand() * 14) }, () => {
        const r = rand();
        if (r < .17) return { k: 'name', v: pick(rand, NAMES) };
        if (r < .34) return { k: 'portions', v: pick(rand, PORTIONS) };
        if (r < .42) return { k: 'open' };
        if (r < .64) return { k: 'submit' };
        if (r < .76) return { k: 'wait', v: pick(rand, WAITS) };
        if (r < .82) return { k: 'closeBtn' };
        if (r < .88) return { k: 'backdrop' };
        if (r < .94) return { k: 'inside' };
        return { k: 'closeNow' };
      });
      if (rand() < .3) ops.push({ k: 'name', v: pick(rand, NAMES) }, { k: 'portions', v: pick(rand, PORTIONS) }, { k: 'submit' }, { k: 'name', v: pick(rand, NAMES) }, { k: 'portions', v: pick(rand, PORTIONS) }, { k: 'submit' });   // sessions with several tries
      const preset = pick(rand, [0, 0, 2, 5]);
      const a = exec('old', ops, preset), b = exec('new', ops, preset);
      expect(b).toEqual(a);
      const txt = a.log.join('\n');
      if (/-- submit[^]*?preventDefault/.test(txt)) hit('submit');
      if (/saveR/.test(txt)) hit('a recipe added');
      if (/withAnim recipes undefined/.test(txt)) hit('the list drawn after the delay');
      if (/recipeName.value=""\n/.test(txt)) hit('fields cleared');
      if (/dlgRecipe\.close\nget recipeName\nrecipeName\.value=""\nget recipePortions\nrecipePortions\.value=""/.test(txt)) hit('fields cleared by the close event');
      if (/-- backdrop[^]*?dlgRecipe\.close/.test(txt)) hit('backdrop tap closes');
      if (/-- inside/.test(txt)) hit('tap inside');
      if (/-- closeBtn[^]*?dlgRecipe\.close/.test(txt)) hit('Close button closes');
      if (/-- name  \n-- submit/.test(txt) || /-- name    \n/.test(txt)) hit('empty name');
      if (/-- portions abc/.test(txt) || /-- portions 0/.test(txt) || /-- portions -1/.test(txt)) hit('bad portions');
      if (/-- wait 339\n/.test(txt)) hit('wait 339');
      if (/-- wait 340\n/.test(txt)) hit('wait 340');
      if (JSON.parse(a.recipes).length > preset + 1) hit('two recipes added');
      if (preset > 0 && JSON.parse(a.recipes).length > preset) hit('added in front of existing recipes');
    }
    for (const k of ['submit', 'a recipe added', 'the list drawn after the delay', 'fields cleared', 'fields cleared by the close event', 'backdrop tap closes', 'tap inside', 'Close button closes', 'empty name', 'bad portions', 'wait 339', 'wait 340', 'two recipes added', 'added in front of existing recipes'])
      expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 180000);

  // Scripted flows for the boundaries.
  const fill = (name: string, p: string): Op[] => [{ k: 'open' }, { k: 'name', v: name }, { k: 'portions', v: p }, { k: 'submit' }];
  it('matches the old code at exactly 339 / 340 ms after adding and for every kind of portions text', () => {
    for (const w of [0, 1, 338, 339, 340, 341])
      for (const p of PORTIONS) for (const name of ['A', ' A ', '', ' '])
        expect(exec('new', [...fill(name, p), { k: 'wait', v: w }], 1)).toEqual(exec('old', [...fill(name, p), { k: 'wait', v: w }], 1));
  });

  const sess = (ops: Op[], preset = 0) => exec('new', ops, preset);
  it('adds the recipe at the top with the trimmed name and the whole number of portions, saves, clears the fields and closes', () => {
    const r = sess(fill('  Soup  ', '4'), 2);
    const list = JSON.parse(r.recipes);
    expect(list.length).toBe(3);
    expect(list[0]).toEqual({ id: 1007, name: 'Soup', portions: 4, items: [] });
    expect(list[1].name).toBe('R0');
    expect(r.log.filter((l) => l === 'saveR').length).toBe(1);
    expect(r.log.filter((l) => l === 'dlgRecipe.close').length).toBe(1);
    expect(r.log.filter((l) => l === 'recipeName.value=""').length).toBe(2);       // by the form and by the close event
  });
  it('does nothing (and keeps the window open) for an empty name or portions that are not a positive number', () => {
    for (const [n, p] of [['', '3'], ['   ', '3'], ['A', ''], ['A', '0'], ['A', '-1'], ['A', 'abc']]) {
      const r = sess(fill(n, p));
      expect(JSON.parse(r.recipes)).toEqual([]);
      expect(r.log.includes('saveR')).toBe(false);
      expect(r.log.includes('dlgRecipe.close')).toBe(false);
      expect(r.log.includes('recipeForm.preventDefault')).toBe(true);
    }
  });
  it('draws the list again 340 ms after adding, not before', () => {
    const at = (w: number) => sess([...fill('A', '2'), { k: 'wait', v: w }]);
    const count = (r: any, w: number) => { const log: string[] = []; const clk = clock(); void clk; return r.log.filter((l: string) => l.startsWith('withAnim')).length; };
    // exec advances 2000 ms at the end, so look at the log order instead: the markers show when it ran
    const r339 = sess([...fill('A', '2'), { k: 'wait', v: 339 }, { k: 'name', v: 'marker' }]).log, r340 = sess([...fill('A', '2'), { k: 'wait', v: 340 }, { k: 'name', v: 'marker' }]).log;
    expect(r339.indexOf('withAnim recipes undefined') > r339.indexOf('-- name marker')).toBe(true);
    expect(r340.indexOf('withAnim recipes undefined') < r340.indexOf('-- name marker')).toBe(true);
    expect(count(at(0), 0)).toBe(1);
  });
  it('closes by the Close button or a tap on the backdrop, not by a tap inside, and clears the fields whenever it closes', () => {
    const r = sess([{ k: 'open' }, { k: 'name', v: 'A' }, { k: 'inside' }]);
    expect(r.log.includes('dlgRecipe.close')).toBe(false);
    const b = sess([{ k: 'open' }, { k: 'name', v: 'A' }, { k: 'backdrop' }]);
    expect(b.log.filter((l) => l === 'dlgRecipe.close').length).toBe(1); expect(b.log.includes('recipePortions.value=""')).toBe(true);
    const c = sess([{ k: 'open' }, { k: 'closeBtn' }]);
    expect(c.log.filter((l) => l === 'dlgRecipe.close').length).toBe(1);
  });
  it('open() shows the window, makes it focusable and focuses it without scrolling', () => {
    const log: string[] = []; const els = new Map<string, El>();
    g.document = { getElementById: (id: string) => { if (!els.has(id)) els.set(id, new El(log, id)); return els.get(id)!; } };
    const f = createRecipeForm({ recipes: [], saveR() { }, withAnim() { }, renderRecipes() { } });
    log.length = 0; f.open();
    expect(log).toEqual(['dlgRecipe.showModal', 'dlgRecipe.attr tabindex=-1', 'dlgRecipe.focus {"preventScroll":true}']);
  });
});
