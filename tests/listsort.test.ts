(global as any).__realSetTimeout = (global as any).__realSetTimeout || setTimeout;
import { describe, it, expect, afterEach } from 'vitest';
import { createListSort, loadListSort, SORT_KEY } from '../src/listsort';
import { RORDER } from '../src/chips';
import { lockUI } from '../src/ui';
import { makeOldListSort } from './reference/oldListSort';

const g = globalThis as any;
const realStorage = g.localStorage;
afterEach(() => { delete g.window; delete g.document; g.localStorage = realStorage; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Setup { stored: Record<string, string>; storageThrows: boolean; reduced: boolean; canAnimate: boolean; chipKeys: string[]; rows: number; }
const KEYS = ['recipe', 'cat', 'a', 'az', 'za', 'x'];

function world(s: Setup, log: string[]) {
  const data = new Map<string, string>(Object.entries(s.stored));
  g.localStorage = {
    getItem(k: string) { if (s.storageThrows) throw new Error('blocked'); log.push('ls.get ' + k); return data.has(k) ? data.get(k)! : null; },
    setItem(k: string, v: string) { if (s.storageThrows) throw new Error('blocked'); log.push('ls.set ' + k + '=' + v); data.set(k, v); },
  };
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? s.reduced : false }) };
  const chips = s.chipKeys.map((k, i) => {
    const handlers: (() => void)[] = [];
    return { dataset: { sort: k }, handlers, addEventListener(t: string, f: () => void) { if (t === 'click') handlers.push(f); },
      classList: { toggle: (c: string, on: boolean) => log.push('chip' + i + '.toggle ' + c + ' ' + on) }, setAttribute: (k2: string, v: unknown) => log.push('chip' + i + '.attr ' + k2 + '=' + String(v)) };
  });
  g.document = { documentElement: { classList: { add() { }, remove() { } } }, querySelectorAll: (sel: string) => (sel === '#view-list .chip' ? { forEach: (f: (c: any) => void) => chips.forEach(f) } : { forEach() { } }) };
  // The list: its rows sit at positions that change every time it is rendered.
  let renders = 0, n = 0;
  const rows = Array.from({ length: s.rows }, (_, i) => {
    return { dataset: { key: 'k' + i }, getBoundingClientRect() { return { top: ((i * 7 + renders * 13) % 5) * 40, left: 0, height: i === 0 ? 0 : 38 }; },
      animate: s.canAnimate ? (kf: unknown, o: unknown) => { log.push('row' + i + '.animate ' + JSON.stringify([kf, o])); return {}; } : undefined };
  });
  const parent = { insertBefore(a: any, b: any) { log.push('insertBefore ' + a.tag + ' ' + (b === list)); } };
  const mkEl = (tag: string): any => ({ tag, style: new Proxy({} as any, { set(o, k: string, v) { o[k] = v; log.push(tag + '.style.' + k + '=' + v); return true; } }), offsetTop: 77, offsetWidth: 360, parentNode: parent,
    removeAttribute(k: string) { log.push(tag + '.rm ' + k); }, setAttribute(k: string, v: unknown) { log.push(tag + '.attr ' + k + '=' + v); },
    animate: s.canAnimate ? (kf: unknown, o: unknown) => { const id = ++n; log.push(tag + '.animate#' + id + ' ' + JSON.stringify([kf, o])); return { cancel() { log.push(tag + '.cancel#' + id); } }; } : undefined,
    querySelectorAll: (sel: string) => ({ forEach: (f: (c: any) => void) => (sel === 'li[data-key]' ? rows : []).forEach(f) }),
    cloneNode: (deep: boolean) => { log.push('cloneNode ' + deep); return mkEl('clone'); }, removeChild(c: any) { log.push('removeChild ' + c.tag); } });
  const list = mkEl('list');
  const render = () => { renders++; log.push('render#' + renders); };
  return { chips, list, render };
}

function randomSetup(rand: () => number): Setup {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const stored: Record<string, string> = {};
  const put = (k: string, vals: string[]) => { const v = pick([undefined, ...vals] as (string | undefined)[]); if (v !== undefined) stored[k] = v; };
  put('shopping-list-sort', ['az', 'za', 'cat', 'recipe', 'bogus']); put('shopping-list-azdir', ['za', 'az', 'x']);
  return { stored, storageThrows: rand() < .1, reduced: rand() < .25, canAnimate: rand() < .85, chipKeys: ['recipe', 'cat', 'a'].concat(rand() < .3 ? [pick(KEYS)] : []), rows: pick([0, 1, 3, 5]) };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', s: Setup, clicks: number[], count: boolean) {
  const log: string[] = [], w = world(s, log);
  let get: () => string;
  if (impl === 'old') {
    const o = makeOldListSort({ list: w.list, render: w.render });
    get = () => o.sortMode;
  } else {
    let sortMode = loadListSort();   // app.js: var sortMode=loadListSort();
    createListSort({ get sortMode() { return sortMode; }, set sortMode(v) { sortMode = v; }, list: w.list, render: w.render });
    get = () => sortMode;
  }
  log.push('start ' + get());
  for (const c of clicks) {
    const chip = w.chips[c % w.chips.length], before = get();
    log.push('-- click ' + chip.dataset.sort); chip.handlers.forEach((f) => f()); log.push('sort ' + get());
    if (count) {
      const after = get(), k = chip.dataset.sort;
      if (k === 'a' && after === 'za' && before !== 'az' && before !== 'za') hit('A to Z chip came back with the remembered Z to A');
      if (k === 'a' && before === 'az' && after === 'za') hit('A to Z chip reversed');
      if (k === 'a' && before === 'za' && after === 'az') hit('Z to A chip reversed back');
      if (after === before) hit('click that changes nothing');
    }
  }
  const txt = log.join('\n');
  if (count) {
    if (/clone\.animate#\d+ .*translateX\(-360px\)/.test(txt)) hit('slide forward');
    if (/clone\.animate#\d+ .*translateX\(360px\)/.test(txt)) hit('slide back');
    if (/insertBefore/.test(txt)) hit('slide to another kind');
    if (/row\d\.animate/.test(txt)) hit('re-order in place with motion');
    if (/ls\.set shopping-list-sort/.test(txt)) hit('saved');
    if (s.storageThrows) hit('storage blocked');
    if (/start (az|za)/.test(txt)) hit('started from a stored A to Z sort');
    if (/start cat/.test(txt)) hit('started from By category');
    if (s.reduced) hit('reduced motion');
    if (s.chipKeys.length > 3) hit('a fourth chip');
    if (/sort az\n/.test(txt) && /sort za\n/.test(txt)) hit('both directions in one session');
  }
  return log;
}

const COVER = ['slide forward', 'slide back', 'slide to another kind', 're-order in place with motion', 'saved', 'storage blocked', 'started from a stored A to Z sort', 'started from By category',
  'reduced motion', 'a fourth chip', 'both directions in one session', 'click that changes nothing', 'A to Z chip came back with the remembered Z to A', 'A to Z chip reversed', 'Z to A chip reversed back'];

describe('the Shopping list sort chips (new createListSort vs the old code from app.js)', () => {
  it('saves, slides, re-orders and reverses exactly like the old code in 3000 random pages and click sequences', () => {
    const rand = rng(8128);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let k = 0; k < 3000; k++) {
      const s = randomSetup(rand), clicks = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => Math.floor(rand() * 4));
      const a = run('old', s, clicks, true), b = run('new', s, clicks, false);
      expect(b).toEqual(a);
    }
    for (const k of COVER) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 60000);

  // Scripted flows for the rare paths: every sort reached from every other one, with and without the stored direction.
  it('matches the old code in every move from one sort to another', () => {
    const base = { storageThrows: false, reduced: false, canAnimate: true, chipKeys: ['recipe', 'cat', 'a', 'az', 'za', 'x'], rows: 3 };
    for (const start of ['recipe', 'cat', 'az', 'za'])
      for (const dir of ['az', 'za'])
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) for (let k = 0; k < 6; k++) {
          const s: Setup = { ...base, stored: { 'shopping-list-sort': start, 'shopping-list-azdir': dir } };
          expect(run('new', s, [i, j, k], false)).toEqual(run('old', s, [i, j, k], false));
        }
    // Two chips with sorts the page does not have (so neither is in the slide order): the direction of the slide must still match.
    const odd = { ...base, chipKeys: ['x', 'y', 'recipe', 'a'] };
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) expect(run('new', { ...odd, stored: {} }, [i, j, k], false)).toEqual(run('old', { ...odd, stored: {} }, [i, j, k], false));
    const slid = run('new', { ...odd, stored: {} }, [0, 1], false).join('\n');
    expect(/clone\.animate#\d+ .*translateX\(360px\)/.test(slid)).toBe(true);   // x -> y: both unknown, so the slide goes back
  }, 60000);

  const make = (stored: Record<string, string> = {}, o: Partial<Setup> = {}) => {
    const log: string[] = [];
    const w = world({ stored, storageThrows: false, reduced: true, canAnimate: false, chipKeys: ['recipe', 'cat', 'a'], rows: 0, ...o }, log);
    let sortMode = loadListSort();
    createListSort({ get sortMode() { return sortMode; }, set sortMode(v) { sortMode = v; }, list: w.list, render: w.render });
    const click = (i: number) => w.chips[i].handlers.forEach((f) => f());
    return { log, click, get sortMode() { return sortMode; }, ls: () => log.filter((l) => l.startsWith('ls.set')), chipLog: () => log.filter((l) => l.startsWith('chip')) };
  };
  it('starts By recipe when nothing valid is saved, and from the saved sort otherwise', () => {
    expect(make().sortMode).toBe('recipe');
    expect(make({ 'shopping-list-sort': 'bogus' }).sortMode).toBe('recipe');
    expect(make({ 'shopping-list-sort': 'recipe' }).sortMode).toBe('recipe');
    expect(make({ 'shopping-list-sort': 'cat' }).sortMode).toBe('cat');
    expect(make({ 'shopping-list-sort': 'za' }).sortMode).toBe('za');
    expect(make({}, { storageThrows: true }).sortMode).toBe('recipe');
    expect(SORT_KEY).toBe('shopping-list-sort');
  });
  it('tapping the A to Z chip that is already on reverses it, and back', () => {
    const m = make();
    m.click(2); expect(m.sortMode).toBe('az'); m.click(2); expect(m.sortMode).toBe('za'); m.click(2); expect(m.sortMode).toBe('az');
  });
  it('the A to Z chip remembers its direction when you come back to it', () => {
    const m = make();
    m.click(2); m.click(2); expect(m.sortMode).toBe('za');
    m.click(1); expect(m.sortMode).toBe('cat');
    m.click(2); expect(m.sortMode).toBe('za');
    m.click(0); expect(m.sortMode).toBe('recipe');
  });
  it('starts from the stored direction', () => {
    expect(make({ 'shopping-list-azdir': 'za' }).sortMode).toBe('recipe');
    const m = make({ 'shopping-list-azdir': 'za' }); m.click(2); expect(m.sortMode).toBe('za');
    const n = make({ 'shopping-list-sort': 'az', 'shopping-list-azdir': 'za' }); n.click(2); expect(n.sortMode).toBe('za');   // the sort itself wins over the stored direction
  });
  it('writes the sort and the direction to storage on a change, and nothing when nothing changes', () => {
    const m = make(); m.click(1);
    expect(m.ls()).toEqual(['ls.set shopping-list-sort=cat', 'ls.set shopping-list-azdir=az']);
    m.click(1); expect(m.ls().length).toBe(2);
  });
  it('marks the chip of the current sort as on', () => {
    const m = make({ 'shopping-list-sort': 'cat' });
    expect(m.chipLog().filter((l) => l.startsWith('chip1.toggle on'))).toEqual(['chip1.toggle on true']);
    expect(m.chipLog().filter((l) => l.startsWith('chip0.toggle on'))).toEqual(['chip0.toggle on false']);
  });
  it('slides (re-draws the list) between different kinds and re-orders in place between A to Z and Z to A', () => {
    const m = make({}, { reduced: false, canAnimate: true, rows: 3 });
    m.click(1); expect(m.log.filter((l) => l === 'cloneNode true').length).toBe(1); expect(m.log.filter((l) => l.startsWith('render#')).length).toBe(1);
    m.click(2); expect(m.log.filter((l) => l === 'cloneNode true').length).toBe(2);
    m.click(2); expect(m.log.filter((l) => l === 'cloneNode true').length).toBe(2); expect(m.log.filter((l) => l.startsWith('render#')).length).toBe(3);
  });
  it('does nothing while the page is locked for server animations', async () => {
    const m = make();
    lockUI(5);
    m.click(1); expect(m.sortMode).toBe('recipe'); expect(m.ls()).toEqual([]);
    await new Promise((r) => (global as any).__realSetTimeout(r, 20));
  });
  it('shares the recipe order with chips.ts', () => {
    expect(RORDER).toEqual(['az', 'za', 'pu', 'pd', 'iu', 'id']);
  });
});
