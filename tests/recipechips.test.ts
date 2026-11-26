(global as any).__realSetTimeout = (global as any).__realSetTimeout || setTimeout;
import { describe, it, expect, afterEach } from 'vitest';
import { createRecipeChips } from '../src/chips';
import { lockUI } from '../src/ui';
import { makeOldRecipeChips } from './reference/oldRecipeChips';

const g = globalThis as any;
const realStorage = g.localStorage;
afterEach(() => { delete g.window; delete g.document; g.localStorage = realStorage; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Setup { stored: Record<string, string>; storageThrows: boolean; reduced: boolean; canAnimate: boolean; chipKeys: string[]; rects: number; }
const KEYS = ['a', 'p', 'i', 'za', 'pd', 'id', 'x'];

function world(s: Setup, log: string[]) {
  const data = new Map<string, string>(Object.entries(s.stored));
  g.localStorage = {
    getItem(k: string) { if (s.storageThrows) throw new Error('blocked'); log.push('ls.get ' + k); return data.has(k) ? data.get(k)! : null; },
    setItem(k: string, v: string) { if (s.storageThrows) throw new Error('blocked'); log.push('ls.set ' + k + '=' + v); data.set(k, v); },
  };
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? s.reduced : false }) };
  const chips = s.chipKeys.map((k, i) => {
    const handlers: (() => void)[] = [];
    return { dataset: { rsort: k }, handlers, addEventListener(t: string, f: () => void) { if (t === 'click') handlers.push(f); },
      classList: { toggle: (c: string, on: boolean) => log.push('chip' + i + '.toggle ' + c + ' ' + on) }, setAttribute: (k2: string, v: unknown) => log.push('chip' + i + '.attr ' + k2 + '=' + String(v)) };
  });
  g.document = { documentElement: { classList: { add() { }, remove() { } } }, querySelectorAll: (sel: string) => (sel === '#recipeSort .chip' ? { forEach: (f: (c: any) => void) => chips.forEach(f) } : { forEach() { } }) };
  // The recipe list: its cards sit at positions that change every time it is rendered.
  let renders = 0, n = 0;
  const cards = Array.from({ length: s.rects }, (_, i) => {
    return { dataset: { rid: 'r' + i }, i, getBoundingClientRect() { return { top: ((i * 7 + renders * 13) % 5) * 40, left: 0, height: i === 0 ? 0 : 38 }; },
      animate: s.canAnimate ? (kf: unknown, o: unknown) => { log.push('card' + i + '.animate ' + JSON.stringify([kf, o])); return {}; } : undefined };
  });
  const parent = { insertBefore(a: any, b: any) { log.push('insertBefore ' + a.tag + ' ' + (b === recipesEl)); } };
  const mkEl = (tag: string): any => ({ tag, style: new Proxy({} as any, { set(o, k: string, v) { o[k] = v; log.push(tag + '.style.' + k + '=' + v); return true; } }), offsetTop: 77, offsetWidth: 360, parentNode: parent,
    removeAttribute(k: string) { log.push(tag + '.rm ' + k); }, setAttribute(k: string, v: unknown) { log.push(tag + '.attr ' + k + '=' + v); },
    animate: s.canAnimate ? (kf: unknown, o: unknown) => { const id = ++n; log.push(tag + '.animate#' + id + ' ' + JSON.stringify([kf, o])); return { cancel() { log.push(tag + '.cancel#' + id); } }; } : undefined,
    querySelectorAll: (sel: string) => ({ forEach: (f: (c: any) => void) => (sel === '.recipe[data-rid],.rtile[data-rid]' ? cards : []).forEach(f) }),
    cloneNode: (deep: boolean) => { log.push('cloneNode ' + deep); return mkEl('clone'); }, removeChild(c: any) { log.push('removeChild ' + c.tag); } });
  const recipesEl = mkEl('recipes'); recipesEl.parentNode = parent;
  const renderRecipes = () => { renders++; log.push('renderRecipes#' + renders); };
  return { chips, recipesEl, renderRecipes };
}

function randomSetup(rand: () => number): Setup {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const stored: Record<string, string> = {};
  const put = (k: string, vals: string[]) => { const v = pick([undefined, ...vals] as (string | undefined)[]); if (v !== undefined) stored[k] = v; };
  put('shopping-list-rsort', ['az', 'za', 'pu', 'pd', 'iu', 'id', 'bogus']); put('shopping-list-razdir', ['za', 'az', 'x']); put('shopping-list-rpdir', ['pd', 'pu', 'x']); put('shopping-list-ridir', ['id', 'iu', 'x']);
  return { stored, storageThrows: rand() < .1, reduced: rand() < .25, canAnimate: rand() < .85, chipKeys: ['a', 'p', 'i'].concat(rand() < .3 ? [pick(KEYS)] : []), rects: pick([0, 1, 3, 5]) };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', s: Setup, clicks: number[], count: boolean) {
  const log: string[] = [], w = world(s, log);
  let get: () => string;
  if (impl === 'old') {
    const o = makeOldRecipeChips({ recipesEl: w.recipesEl, renderRecipes: w.renderRecipes, recipes: [] });
    get = () => o.rsort;
  } else {
    // what app.js itself still does before it hands over: load the saved sort
    let rsort = 'az'; const RORDER = ['az', 'za', 'pu', 'pd', 'iu', 'id'];
    try { const rs = g.localStorage.getItem('shopping-list-rsort'); if (RORDER.indexOf(rs) > -1) rsort = rs; } catch (e) { /* default */ }
    createRecipeChips({ get rsort() { return rsort; }, set rsort(v: string) { rsort = v; }, recipesEl: w.recipesEl, renderRecipes: w.renderRecipes });
    get = () => rsort;
  }
  log.push('start ' + get());
  for (const c of clicks) { const chip = w.chips[c % w.chips.length]; log.push('-- click ' + chip.dataset.rsort); chip.handlers.forEach((f) => f()); log.push('rsort ' + get()); }
  const txt = log.join('\n');
  if (count) {
    if (/insertBefore/.test(txt)) hit('slide to another kind');
    if (/card\d\.animate/.test(txt)) hit('re-order in place with motion');
    if (/rsort za/.test(txt)) hit('Z to A');
    if (/rsort pd/.test(txt)) hit('portions down');
    if (/rsort id/.test(txt)) hit('ingredients down');
    if (/ls\.set shopping-list-rsort/.test(txt)) hit('saved');
    if (s.storageThrows) hit('storage blocked');
    if (/start (pu|pd|iu|id|za)/.test(txt)) hit('started from a stored sort');
    if (/-- click[^\n]*\nrsort (az|za|pu|pd|iu|id)\n-- click/.test(txt) && !/renderRecipes/.test(txt.split('-- click')[1] || '')) hit('click that changes nothing');
    if (s.reduced) hit('reduced motion');
  }
  return log;
}

describe('the recipe sort chips (new createRecipeChips vs the old code from app.js)', () => {
  it('saves, slides, re-orders and reverses exactly like the old code in 3000 random pages and click sequences', () => {
    const rand = rng(31337);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let k = 0; k < 3000; k++) {
      const s = randomSetup(rand), clicks = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => Math.floor(rand() * 4));
      const a = run('old', s, clicks, true), b = run('new', s, clicks, false);
      expect(b).toEqual(a);
    }
    for (const k of ['slide to another kind', 're-order in place with motion', 'Z to A', 'portions down', 'ingredients down', 'saved', 'storage blocked', 'started from a stored sort', 'reduced motion']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 60000);

  const make = (stored: Record<string, string> = {}) => {
    const log: string[] = [];
    const w = world({ stored, storageThrows: false, reduced: true, canAnimate: false, chipKeys: ['a', 'p', 'i'], rects: 0 }, log);
    let rsort = 'az'; const rs = g.localStorage.getItem('shopping-list-rsort'); if (['az', 'za', 'pu', 'pd', 'iu', 'id'].indexOf(rs) > -1) rsort = rs;   // what app.js does before handing over
    createRecipeChips({ get rsort() { return rsort; }, set rsort(v: string) { rsort = v; }, recipesEl: w.recipesEl, renderRecipes: w.renderRecipes });
    const click = (i: number) => w.chips[i].handlers.forEach((f) => f());
    return { log, click, get rsort() { return rsort; }, ls: () => log.filter((l) => l.startsWith('ls.set')) };
  };
  it('tapping the A to Z chip that is already on reverses it, and back', () => {
    const m = make();
    m.click(0); expect(m.rsort).toBe('za'); m.click(0); expect(m.rsort).toBe('az');
  });
  it('each kind remembers its own direction when you come back to it', () => {
    const m = make();
    m.click(1); expect(m.rsort).toBe('pu'); m.click(1); expect(m.rsort).toBe('pd');
    m.click(2); expect(m.rsort).toBe('iu');
    m.click(1); expect(m.rsort).toBe('pd');          // portions come back descending
    m.click(0); expect(m.rsort).toBe('az');
  });
  it('writes the sort and the three directions to storage on a change', () => {
    const m = make(); m.click(1);
    expect(m.ls()).toEqual(['ls.set shopping-list-rsort=pu', 'ls.set shopping-list-razdir=az', 'ls.set shopping-list-rpdir=pu', 'ls.set shopping-list-ridir=iu']);
  });
  it('starts from the stored directions', () => {
    const m = make({ 'shopping-list-rsort': 'pd', 'shopping-list-razdir': 'za', 'shopping-list-ridir': 'id' });
    m.click(2); expect(m.rsort).toBe('id');          // ingredients: the remembered descending direction
    m.click(0); expect(m.rsort).toBe('za');
  });
  it('does nothing while the page is locked for server animations', async () => {
    const m = make();
    lockUI(5);
    m.click(1); expect(m.rsort).toBe('az'); expect(m.ls()).toEqual([]);
    await new Promise((r) => (global as any).__realSetTimeout(r, 20));
  });
});
