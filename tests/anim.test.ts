import { describe, it, expect, afterEach, vi } from 'vitest';
import { withAnim } from '../src/anim';
import { makeOldAnim } from './reference/oldAnim';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.window; delete g.document; delete g.getComputedStyle; });

// ---------------------------------------------------------------------------------------------------------
// A small fake page: elements with children, styles, rectangles, and an animate() that records what it is asked.
// ---------------------------------------------------------------------------------------------------------
class World {
  log: string[] = [];
  all: FakeEl[] = [];
  anims: { onfinish: null | (() => void) }[] = [];
  n = 0;
}
class FakeEl {
  children: FakeEl[] = [];
  parentNode: FakeEl | null = null;
  cls = new Set<string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  rect = { left: 0, top: 0, width: 90, height: 40 };
  label: string;
  constructor(public w: World, public tagName: string, label?: string) { this.label = label || tagName + (w.n++); w.all.push(this); }
  get classList() { const s = this.cls; return { contains: (c: string) => s.has(c) }; }
  get firstChild() { return this.children[0] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; }
  getBoundingClientRect() { return this.rect; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; this.w.log.push(this.label + '.attr ' + k + '=' + v); }
  animate(kf: unknown, o: unknown) {
    this.w.log.push(this.label + '.animate ' + JSON.stringify([kf, o]));
    const a = { onfinish: null as null | (() => void) }; this.w.anims.push(a); return a;
  }
  detach() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  remove() { this.w.log.push(this.label + '.remove'); this.detach(); }
  appendChild(c: FakeEl) { c.detach(); c.parentNode = this; this.children.push(c); this.w.log.push(this.label + '.append ' + c.label); }
  insertBefore(c: FakeEl, ref: FakeEl | null) {
    c.detach(); c.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    this.w.log.push(this.label + '.insertBefore ' + c.label + ' ' + (ref ? ref.label : 'null'));
  }
  descendants(): FakeEl[] { return this.children.reduce((a: FakeEl[], c) => a.concat([c], c.descendants()), []); }
  querySelector(sel: string): FakeEl | null {
    const cls = sel.startsWith('.') ? sel.slice(1) : null;
    return this.descendants().find((d) => (cls ? d.cls.has(cls) : d.tagName.toLowerCase() === sel)) || null;
  }
  querySelectorAll(sel: string): FakeEl[] {
    // 'li[data-key]'  or  '.recipe[data-rid],.rtile[data-rid]'
    return this.descendants().filter((d) => ('key' in d.dataset && sel.startsWith('li')) || ('rid' in d.dataset && sel.startsWith('.recipe')));
  }
}

type Mode = 'rows' | 'grid' | 'cards';

/** Builds the content of `root` for the given keys, the way the app's render() does (the old elements are thrown away). */
function fill(w: World, root: FakeEl, keys: string[], mode: Mode, attr: 'key' | 'rid', tag: string) {
  root.children.forEach((c) => { c.parentNode = null; }); root.children = [];
  if (!keys.length) { const empty = new FakeEl(w, 'div', 'empty'); empty.rect = { left: 0, top: 0, width: 300, height: 60 }; root.children.push(empty); empty.parentNode = root; return; }
  const host = mode === 'cards' ? root : new FakeEl(w, 'ul', mode === 'grid' ? 'ulg' : 'ulr');
  if (mode === 'grid') host.cls.add('grid');
  if (host !== root) { root.children.push(host); host.parentNode = root; host.rect = { left: 0, top: 0, width: 300, height: keys.length * 50 }; }
  keys.forEach((k, i) => {
    const li = new FakeEl(w, mode === 'cards' ? 'div' : 'li', k);
    li.dataset[attr] = k.replace(/^i-/, '');
    if (mode === 'cards') li.cls.add(tag);
    li.rect = mode === 'grid' ? { left: (i % 3) * 100, top: Math.floor(i / 3) * 100, width: 90, height: 80 } : { left: 0, top: i * 50, width: 300, height: 40 + (i % 3) * 5 };
    if (mode === 'rows') { const fg = new FakeEl(w, 'div', k + '.fg'); fg.cls.add('swfg'); li.children.push(fg); fg.parentNode = li; }
    if (mode === 'grid') { const t = new FakeEl(w, 'div', k + '.tile'); t.cls.add('tile'); li.children.push(t); t.parentNode = li; }
    host.children.push(li); li.parentNode = host;
  });
}

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Scenario {
  kind: 'list' | 'recipes'; mode: Mode; before: string[]; after: string[];
  noMotion: boolean; sliding: boolean; query: string; view: string; canAnimate: boolean; lock: boolean; throwInFn: boolean;
}

function run(impl: 'old' | 'new', sc: Scenario) {
  vi.useFakeTimers();
  const w = new World();
  const html = { classList: { add: (c: string) => { w.log.push('html+' + c); }, remove: (c: string) => { w.log.push('html-' + c); } } };
  g.document = { documentElement: html };
  g.window = { matchMedia: () => ({ matches: sc.noMotion }) };
  g.getComputedStyle = () => ({ marginBottom: '8px', marginTop: '4px', borderBottomWidth: '2px', backgroundColor: 'rgb(1,2,3)' });
  const isList = sc.kind === 'list';
  const attr = isList ? 'key' : 'rid';
  const list = new FakeEl(w, 'div', 'LIST'), recipesEl = new FakeEl(w, 'div', 'RECIPES');
  if (!sc.canAnimate) { /* animate must be missing on the root */ }
  const root = isList ? list : recipesEl;
  if (!sc.canAnimate) (root as any).animate = undefined;
  const mode: Mode = sc.mode;
  fill(w, root, sc.before, mode, attr, 'recipe');
  w.log.length = 0;
  const state = { list, recipesEl, sliding: sc.sliding, query: sc.query, currentView: sc.view, layoutMode: mode === 'grid' && isList ? 'grid' : 'list', recipeLayout: mode === 'grid' && !isList ? 'tile' : 'card' };
  const fn = () => { w.log.push('FN'); if (sc.throwInFn) { /* the change itself must still run */ } fill(w, root, sc.after, mode, attr, 'recipe'); };
  let threw = false;
  try {
    if (impl === 'old') { const o = makeOldAnim(state); o.withAnim(sc.kind, fn, sc.lock); }
    else withAnim(state as any, sc.kind, fn, sc.lock);
  } catch { threw = true; }
  // let every animation finish, in the order they were started, then let the lock run out
  w.anims.slice().forEach((a) => { if (a.onfinish) a.onfinish(); });
  vi.advanceTimersByTime(1000);
  const dump = w.all.map((e) => e.label + '|' + [...e.cls].join(',') + '|' + JSON.stringify(e.style) + '|' + JSON.stringify(e.attrs) + '|parent=' + (e.parentNode ? e.parentNode.label : '-') + '|kids=' + e.children.map((c) => c.label).join(','));
  return { log: w.log, dump, threw };
}

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
function randomScenario(rand: () => number): Scenario {
  const pick = () => KEYS.filter(() => rand() < .45);
  const before = pick();
  let after: string[];
  const r = rand();
  if (r < .3) after = before.filter(() => rand() < .8);                            // some removed
  else if (r < .55) after = before.concat(KEYS.filter((k) => !before.includes(k) && rand() < .3)); // some added at the end
  else if (r < .8) { after = pick(); }                                              // anything
  else after = before.slice();                                                      // unchanged
  if (rand() < .2 && after.length > 1) after.reverse();
  // the first item into an empty list, and the last item out of a list, are their own animation: make sure they come up
  const e = rand();
  if (e < .08) { before.length = 0; after = KEYS.filter(() => rand() < .2).slice(0, 3); }
  else if (e < .16) { after = []; before.splice(3); }
  const kind = rand() < .5 ? 'list' : 'recipes';
  const mode: Mode = kind === 'list' ? (rand() < .5 ? 'grid' : 'rows') : (rand() < .5 ? 'grid' : 'cards');
  return {
    kind, mode, before, after,
    noMotion: rand() < .08, sliding: rand() < .08, query: rand() < .1 ? ' q ' : '',
    view: rand() < .9 ? kind : (kind === 'list' ? 'recipes' : 'list'),
    canAnimate: rand() < .95, lock: rand() < .5, throwInFn: false,
  };
}

describe('withAnim (new anim.ts vs the old code from app.js)', () => {
  it('behaves exactly like the old code in 1500 random changes', () => {
    const rand = rng(424242);
    let animated = 0, edge = 0, grid = 0, stack = 0, locked = 0;
    for (let k = 0; k < 1500; k++) {
      const sc = randomScenario(rand);
      const a = run('old', sc), b = run('new', sc);
      expect(b).toEqual(a);
      const s = a.log.join('\n');
      if (/\.animate/.test(s)) animated++;
      if (/ghost|html\+animlock/.test(s) || /html\+animlock/.test(s)) locked++;
      if (/\.animate.*"opacity":0.*\},\{"opacity":0,"offset":0.35/.test(s)) edge++;
      if (sc.mode === 'grid' && /scale\(\.6\)/.test(s)) grid++;
      if (sc.mode !== 'grid' && /translateY\(-100%\)|"marginBottom":"0px"/.test(s)) stack++;
    }
    // the random scenarios must really have exercised each kind of animation, or the comparison would be empty
    expect(animated).toBeGreaterThan(300);
    expect(edge).toBeGreaterThan(20);
    expect(grid).toBeGreaterThan(60);
    expect(stack).toBeGreaterThan(100);
    expect(locked).toBeGreaterThan(50);
  });

  const base: Scenario = { kind: 'list', mode: 'rows', before: ['a', 'b', 'c'], after: ['a', 'b', 'c', 'd'], noMotion: false, sliding: false, query: '', view: 'list', canAnimate: true, lock: false, throwInFn: false };
  it('plays the animation and the change when one item is added', () => {
    const r = run('new', base);
    expect(r.log[0]).toBe('FN');
    expect(r.log.some((l) => l.startsWith('d.animate'))).toBe(true);
  });
  it('only runs the change, with no animation, with reduced motion', () => {
    const r = run('new', { ...base, noMotion: true });
    expect(r.log).toEqual(['FN']);
  });
  it('only runs the change while sorting slides, while searching, or on another tab', () => {
    expect(run('new', { ...base, sliding: true }).log).toEqual(['FN']);
    expect(run('new', { ...base, query: 'milk' }).log).toEqual(['FN']);
    expect(run('new', { ...base, view: 'recipes' }).log).toEqual(['FN']);
  });
  it('shows a big change (more than 6 items) without animating it', () => {
    const r = run('new', { ...base, before: [], after: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(r.log.some((l) => l.includes('.animate'))).toBe(false);
  });
  it('locks the screen while the animation runs, only when asked to', () => {
    expect(run('new', { ...base, lock: true }).log.filter((l) => l.startsWith('html')).join()).toBe('html+animlock,html-animlock');
    expect(run('new', { ...base, lock: false }).log.filter((l) => l.startsWith('html')).length).toBe(0);
    expect(run('new', { ...base, lock: true, after: ['a', 'b', 'c'] }).log.filter((l) => l.startsWith('html')).length).toBe(0);
  });
});
