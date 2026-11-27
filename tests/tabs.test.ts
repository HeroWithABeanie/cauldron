import { describe, it, expect, afterEach } from 'vitest';
import { createTabs } from '../src/tabs';
import { makeOldTabs } from './reference/oldTabs';
import { rng, El } from './helpers/fakepage';

const g = globalThis as any;
afterEach(() => { delete g.document; delete g.window; });

interface Sp { view: string; reduce: number; canList: boolean; canRec: boolean; ops: Op[] }
type Op = { k: string; n: number; b: boolean };

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const op = (k: string): Op => ({ k, n: Math.floor(rand() * 4), b: rand() < .5 });
  const flow = (): Op[] => {
    const f = pick(['slide', 'slide', 'slide', 'duringSlide', 'same', 'reduce', 'noAnim', 'cancel', 'direct', 'twice']);
    if (f === 'slide') return [{ k: 'tab', n: 1, b: true }, op('finish'), { k: 'tab', n: 0, b: true }, pick<Op[]>([[op('finish')], [op('cancel')], []])].flat();
    if (f === 'duringSlide') return [op('tab'), op('tab'), op('tab'), op('finish'), op('tab')];
    if (f === 'same') return [{ k: 'tab', n: 0, b: true }, { k: 'tab', n: 1, b: true }, { k: 'tab', n: 1, b: true }];
    if (f === 'reduce') return [{ k: 'setReduce', n: pick([0, 1, 2]), b: true }, op('tab'), op('tab')];
    if (f === 'noAnim') return [op('toggleAnim'), op('toggleAnim'), op('tab'), op('finish'), op('tab')];
    if (f === 'cancel') return [op('tab'), op('cancel'), op('finish'), op('tab'), op('cancel')];
    if (f === 'direct') return [op('direct'), op('finish'), op('direct'), op('finish')];
    return [op('tab'), op('finish'), op('tab'), op('finish'), op('tab'), op('finish')];
  };
  const single = () => op(pick(['tab', 'direct', 'finish', 'cancel', 'setReduce', 'toggleAnim']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 5); s < n; s++) { if (rand() < .75) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { view: pick(['list', 'list', 'recipes']), reduce: pick([0, 0, 1, 2]), canList: rand() < .9, canRec: rand() < .9, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

/** matchMedia: 0 = not reduced, 1 = reduced, 2 = the browser has no matchMedia */
function page(log: string[], reduceState: { v: number }, canAnim: { list: boolean; recipes: boolean }, anims: any[]) {
  const els: Record<string, El> = {};
  for (const id of ['view-list', 'view-recipes', 'tab-list', 'tab-recipes']) els[id] = new El(log, id);
  (els['tab-list'] as any).dataset = { view: 'list' }; (els['tab-recipes'] as any).dataset = { view: 'recipes' };
  for (const v of ['list', 'recipes'] as const) {
    const e = els['view-' + v];
    Object.defineProperty(e, 'animate', { get() { return (canAnim as any)[v] ? (kf: unknown, o: unknown) => { log.push(e.id + '.animate ' + JSON.stringify([kf, o])); const a: any = { onfinish: null, oncancel: null, cancel: () => { log.push(e.id + '.cancel'); } }; anims.push({ v, a }); return a; } : undefined; } });
  }
  g.document = { getElementById: (id: string) => els[id] ?? null, querySelectorAll: (sel: string) => (sel === '.tab' ? [els['tab-list'], els['tab-recipes']] : []) };
  g.window = { get matchMedia() { return reduceState.v === 2 ? undefined : (q: string) => { log.push('matchMedia ' + q); return { matches: reduceState.v === 1 }; }; } };
  return els;
}

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], anims: any[] = [];
  const reduceState = { v: sp.reduce }, canAnim = { list: sp.canList, recipes: sp.canRec };
  const els = page(log, reduceState, canAnim, anims);
  els['view-list'].hidden = sp.view !== 'list'; els['view-recipes'].hidden = sp.view !== 'recipes'; log.length = 0;
  const st = { currentView: sp.view, sliding: false };
  let api: any;
  const cur = () => (impl === 'old' ? api.get() : st);
  const env = {
    syncClear: () => log.push('syncClear ' + JSON.stringify(cur())), updateRow: (v: string) => log.push('updateRow ' + v), closeSearch: (c: boolean) => log.push('closeSearch ' + c),
    closeOpenSwipe: () => log.push('closeOpenSwipe'), setSwapAll: () => log.push('setSwapAll'), fitAll: () => log.push('fitAll'), fitRTiles: () => log.push('fitRTiles'), animateTabIcon: (v: string) => log.push('animateTabIcon ' + v),
  };
  if (impl === 'old') api = makeOldTabs({ ...env, ...st });
  else api = createTabs({ ...env, get currentView() { return st.currentView; }, set currentView(v) { st.currentView = v; }, get sliding() { return st.sliding; }, set sliding(v) { st.sliding = v; } });
  const snap = () => JSON.stringify([cur(), els['view-list'].hidden, els['view-recipes'].hidden, els['tab-list'].attrs, [...els['tab-list'].classes], els['tab-recipes'].attrs, [...els['tab-recipes'].classes]]);
  const done = new Set<any>();
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.n + ' ' + o.b);
    try {
      switch (o.k) {
        case 'tab': els[o.n % 2 ? 'tab-recipes' : 'tab-list'].fire('click'); break;
        case 'direct': api.switchView(o.b ? 'recipes' : 'list'); break;
        case 'finish': { const a = anims.filter((x) => x.v !== undefined)[o.n % Math.max(anims.length, 1)]; if (a && a.a.onfinish) a.a.onfinish(); break; }
        case 'cancel': { const a = anims[o.n % Math.max(anims.length, 1)]; if (a && a.a.oncancel) a.a.oncancel(); break; }
        case 'setReduce': reduceState.v = o.n % 3; break;
        case 'toggleAnim': (canAnim as any)[o.b ? 'list' : 'recipes'] = !(canAnim as any)[o.b ? 'list' : 'recipes']; break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  const txt = log.join('\n');
  if (count) {
    if (/\.animate /.test(txt)) hit('slide started');
    if (/-- tab[^\n]*\n(?:(?!state)[^\n]*\n)*?state[^\n]*"sliding":true/.test(txt) && /-- tab \d \w+\nstate/.test(txt)) hit('tab refused while sliding or same view');
    if (/view-(list|recipes)\.cancel/.test(txt)) hit('slide ended');
    if (/-- cancel/.test(txt) && /\.cancel/.test(txt)) hit('slide cancelled');
    if (/animateTabIcon recipes/.test(txt)) hit('to recipes');
    if (/animateTabIcon list/.test(txt)) hit('to list');
    if (/matchMedia/.test(txt)) hit('media query asked');
    if (reduceState.v === 1 && /-- tab/.test(txt)) hit('reduced motion');
    if (sp.reduce === 2 && /updateRow/.test(txt)) hit('no matchMedia');
    if (/updateRow/.test(txt) && !/\.animate /.test(txt)) hit('switched without animation');
    if (/closeSearch false/.test(txt)) hit('search closed by tab');
    if (/-- direct[^\n]*\ncloseOpenSwipe/.test(txt)) hit('direct switch');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log, state: cur() };
}

describe('the tabs (new tabs.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 4000 random sessions (tab clicks, slides, cancels, reduced motion, missing animation)', () => {
    const rand = rng(777);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 4000; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['slide started', 'tab refused while sliding or same view', 'slide ended', 'slide cancelled', 'to recipes', 'to list', 'media query asked', 'reduced motion', 'no matchMedia', 'switched without animation', 'search closed by tab', 'direct switch']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 120000);
});

// ---- the same tabs, with the expected behaviour written out (no old code involved) ----
function mini(o: { view?: string; reduce?: number; canAnim?: boolean } = {}) {
  const log: string[] = [], anims: any[] = [], calls: string[] = [];
  const els = page(log, { v: o.reduce ?? 0 }, { list: o.canAnim ?? true, recipes: o.canAnim ?? true }, anims);
  const st = { currentView: o.view ?? 'list', sliding: false };
  const api = createTabs({ syncClear: () => calls.push('syncClear ' + st.currentView), updateRow: (v) => calls.push('updateRow ' + v), closeSearch: (c) => calls.push('closeSearch ' + c),
    closeOpenSwipe: () => calls.push('closeOpenSwipe'), setSwapAll: () => calls.push('setSwapAll'), fitAll: () => calls.push('fitAll'), fitRTiles: () => calls.push('fitRTiles'), animateTabIcon: (v) => calls.push('icon ' + v),
    get currentView() { return st.currentView; }, set currentView(v) { st.currentView = v; }, get sliding() { return st.sliding; }, set sliding(v) { st.sliding = v; } });
  return { els, st, api, calls, anims, log };
}

describe('the tabs, behaviour', () => {
  it('a tap on the other tab marks it, closes the search, slides in from the right to the Recipes and from the left back', () => {
    const m = mini();
    m.els['tab-recipes'].fire('click');
    expect(m.calls).toEqual(['closeSearch false', 'icon recipes', 'closeOpenSwipe', 'syncClear recipes', 'updateRow recipes', 'setSwapAll', 'fitAll', 'fitRTiles']);
    expect([m.els['tab-recipes'].attrs['aria-selected'], m.els['tab-recipes'].classes.has('on'), m.els['tab-list'].attrs['aria-selected'], m.els['tab-list'].classes.has('on')]).toEqual(['true', true, 'false', false]);
    expect([m.st.currentView, m.st.sliding, m.els['view-recipes'].hidden, m.els['view-list'].hidden]).toEqual(['recipes', true, false, false]);
    expect(m.log.filter((l) => /\.animate /.test(l)).map((l) => l.split('.animate')[0])).toEqual(['view-list', 'view-recipes']);
    expect(m.log.join('\n')).toContain('"translateX(-100%)"'); expect(m.log.join('\n')).toContain('"translateX(100%)"');
    expect(m.log.join('\n')).toContain('view-list.style.cssText=position:absolute;top:0;left:0;right:0;bottom:0');
    m.anims[1].a.onfinish();
    expect([m.st.sliding, m.els['view-list'].hidden, m.els['view-recipes'].hidden]).toEqual([false, true, false]); expect(m.log).toContain('view-list.style.cssText='); expect(m.log).toContain('view-list.cancel');
    m.log.length = 0; m.els['tab-list'].fire('click'); expect(m.log.join('\n')).toContain('"translateX(100%)"'); expect(m.log.join('\n')).toContain('"translateX(-100%)"'); expect(m.st.currentView).toBe('list');
  });
  it('a tap is ignored on the tab you are on and while a slide is running; a cancelled slide ends like a finished one', () => {
    const m = mini(); m.els['tab-list'].fire('click'); expect(m.calls).toEqual([]);
    m.els['tab-recipes'].fire('click'); m.calls.length = 0; m.els['tab-list'].fire('click'); m.els['tab-recipes'].fire('click'); expect(m.calls).toEqual([]);
    m.anims[1].a.oncancel(); expect([m.st.sliding, m.els['view-list'].hidden]).toEqual([false, true]);
    m.els['tab-list'].fire('click'); expect(m.st.currentView).toBe('list');
  });
  it('with reduced motion, or when the browser cannot animate, the view changes at once without sliding', () => {
    for (const o of [{ reduce: 1 }, { canAnim: false }]) {
      const m = mini(o); m.els['tab-recipes'].fire('click');
      expect([m.st.currentView, m.st.sliding, m.els['view-list'].hidden, m.els['view-recipes'].hidden, m.anims.length]).toEqual(['recipes', false, true, false, 0]);
    }
  });
  it('a browser without matchMedia slides as usual', () => {
    const m = mini({ reduce: 2 }); m.els['tab-recipes'].fire('click'); expect([m.st.sliding, m.anims.length]).toEqual([true, 2]);
  });
  it('the module asks the page for the views and the tab buttons once, when it is created', () => {
    const m = mini(); expect(m.log.filter((l) => /listen click/.test(l))).toEqual(['tab-list.listen click', 'tab-recipes.listen click']);
  });
});
