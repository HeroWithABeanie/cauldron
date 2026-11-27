import { describe, it, expect, afterEach } from 'vitest';
import { createViewport } from '../src/viewport';
import { makeOldViewport } from './reference/oldViewport';
import { rng, clock, El } from './helpers/fakepage';

const g = globalThis as any;
const real = { setTimeout: g.setTimeout };
afterEach(() => { delete g.document; delete g.window; delete g.ResizeObserver; Object.assign(g, real); });

interface Sp { hasRO: boolean; hasVV: boolean; innerHeight: number; ops: Op[] }
type Op = { k: string; n: number; b: boolean };
const KB = [79, 80, 81, 300, -5, 0], OFF = [0, 12.4, 12.5, 12.6, 40], VH = [400.4, 400.5, 500, 520.6], TOP = [0, 3, 4, 5, 100], GAP = [3, 4, 5, 100];

function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const op = (k: string): Op => ({ k, n: Math.floor(rand() * 6), b: rand() < .5 });
  const flow = (): Op[] => {
    const f = pick(['fade', 'fade', 'ro', 'keyboard', 'keyboard', 'kbClose', 'lock', 'lock', 'touch', 'focus']);
    if (f === 'fade') return [op('setScroll'), op('scroll'), op('setScroll'), op('scroll')];
    if (f === 'ro') return [op('setScroll'), op('setScroll'), op('ro')];
    if (f === 'keyboard') return [op('vv'), op('vvResize'), op('vv'), op('vvScroll')];
    if (f === 'kbClose') return [{ k: 'vv', n: 0, b: true }, op('vvResize'), { k: 'vv', n: 3, b: false }, op('vvScroll'), { k: 'vv', n: 1, b: true }, op('vvResize')];
    if (f === 'lock') return [op('winScroll'), op('winScroll'), op('winScroll')];
    if (f === 'touch') return [op('touch'), op('touch')];
    return [op('focus'), { k: 'advance', n: 0, b: true }, { k: 'advance', n: 1, b: true }, op('advance'), op('winScroll'), { k: 'advance', n: 5, b: true }];
  };
  const single = () => op(pick(['setScroll', 'scroll', 'ro', 'vv', 'vvResize', 'vvScroll', 'winScroll', 'touch', 'focus', 'advance']));
  const ops: Op[] = [];
  for (let s = 0, n = 2 + Math.floor(rand() * 6); s < n; s++) { if (rand() < .75) ops.push(...flow()); else for (let k = 0, m = 1 + Math.floor(rand() * 4); k < m; k++) ops.push(single()); }
  return { hasRO: rand() < .85, hasVV: rand() < .85, innerHeight: pick([700, 800, 812.4]), ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function build(log: string[], sp: Sp) {
  const clk = clock();
  const mkSc = (id: string) => {
    const f: Record<string, (() => void)[]> = {};
    return { id, scrollTop: 0, clientHeight: 300, scrollHeight: 1000, f, style: { setProperty: (k: string, v: string) => { log.push(id + '.set ' + k + '=' + v); } },
      addEventListener: (t: string, fn: () => void, o: unknown) => { log.push(id + '.listen ' + t + ' ' + JSON.stringify(o)); (f[t] = f[t] || []).push(fn); } };
  };
  const scrollers = [mkSc('sc1'), mkSc('sc2')], list: any = { id: 'list' }, recipesEl: any = { id: 'recipesEl' };
  const root = new El(log, 'root'), main = new El(log, 'main'), search = new El(log, 'search');
  const body = { _t: 0, get scrollTop() { return this._t; }, set scrollTop(v: number) { this._t = v; log.push('body.scrollTop=' + v); } };
  const doc: any = { querySelectorAll: (sel: string) => (sel === '.scroller' ? scrollers : []), querySelector: (sel: string) => (sel === 'main' ? main : null), documentElement: root, body, activeElement: null };
  const vvL: Record<string, (() => void)[]> = {}, winL: Record<string, (() => void)[]> = {};
  const vv: any = { height: 500, offsetTop: 0, addEventListener: (t: string, f: () => void) => { log.push('vv.listen ' + t); (vvL[t] = vvL[t] || []).push(f); } };
  let roCb: (() => void) | null = null;
  class RO { constructor(cb: () => void) { roCb = cb; log.push('RO.new'); } observe(x: any) { log.push('RO.observe ' + x.id); } }
  const win: any = { innerHeight: sp.innerHeight, scrollY: 0, scrollTo: (x: number, y: number) => { log.push('scrollTo ' + x + ',' + y); },
    addEventListener: (t: string, f: () => void, o: unknown) => { log.push('win.listen ' + t + ' ' + JSON.stringify(o)); (winL[t] = winL[t] || []).push(f); } };
  delete g.ResizeObserver;
  if (sp.hasRO) { win.ResizeObserver = RO; g.ResizeObserver = RO; }
  const origListen = search.addEventListener.bind(search); search.addEventListener = (t: string, f: (e: any) => void, o?: unknown) => { log.push('search.options ' + t + ' ' + JSON.stringify(o)); origListen(t, f, o); };
  if (sp.hasVV) win.visualViewport = vv;
  g.document = doc; g.window = win; g.setTimeout = clk.setTimeout;
  return { scrollers, list, recipesEl, root, main, search, body, doc, vv, win, vvL, winL, clk, ro: () => roCb && roCb() };
}

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], p = build(log, sp);
  const env = { list: p.list, recipesEl: p.recipesEl, searchInput: p.search };
  if (impl === 'old') makeOldViewport(env); else createViewport(env as any);
  const snap = () => JSON.stringify([p.scrollers.map((s) => [s.scrollTop, s.clientHeight, s.scrollHeight]), p.vv.height, p.vv.offsetTop, p.win.innerHeight, p.win.scrollY, p.root.scrollTop, p.body.scrollTop, [...p.root.classes]]);
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.n + ' ' + o.b);
    try {
      switch (o.k) {
        case 'setScroll': { const s = p.scrollers[o.b ? 0 : 1]; s.scrollTop = TOP[o.n % 5]; s.scrollHeight = s.scrollTop + s.clientHeight + GAP[(o.n >> 1) % 4]; break; }
        case 'scroll': (p.scrollers[o.b ? 0 : 1].f.scroll || []).forEach((f) => f()); break;
        case 'ro': p.ro(); break;
        case 'vv': p.vv.height = VH[o.n % 4]; p.vv.offsetTop = OFF[(o.n + 1) % 5]; p.win.innerHeight = Math.round(p.vv.height + p.vv.offsetTop + KB[o.n % 6]) + (o.b ? 0.4 : 0); break;
        case 'vvResize': (p.vvL.resize || []).forEach((f) => f()); break;
        case 'vvScroll': (p.vvL.scroll || []).forEach((f) => f()); break;
        case 'winScroll': { const w = o.n % 4; p.win.scrollY = w === 1 ? 5 : 0; p.root.scrollTop = w === 2 ? 3 : 0; p.body.scrollTop = w === 3 ? 7 : 0; (p.winL.scroll || []).forEach((f) => f()); break; }
        case 'touch': p.doc.activeElement = o.b ? p.search : p.main; p.search.fire('touchstart'); break;
        case 'focus': p.search.fire('focus'); break;
        case 'advance': p.clk.advance([0, 59, 60, 160, 320, 600][o.n]); break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  p.clk.advance(1000);
  const txt = log.join('\n');
  if (count) {
    if (/set --ft=32px/.test(txt)) hit('top fade on'); if (/set --ft=0px/.test(txt)) hit('top fade off');
    if (/set --fb=32px/.test(txt)) hit('bottom fade on'); if (/set --fb=0px/.test(txt)) hit('bottom fade off');
    if (/-- scroll[^\n]*\n(?:(?!state)[^\n]*\n)*?sc\d\.set/.test(txt)) hit('fade after scroll');
    if (/-- ro[^\n]*\n(?:(?!state)[^\n]*\n)*?sc\d\.set/.test(txt)) hit('fade after resize');
    if (/RO.observe list/.test(txt)) hit('observer set up');
    if (!sp.hasRO && /state/.test(txt)) hit('no ResizeObserver');
    if (/root.toggle kb true/.test(txt)) hit('keyboard open'); if (/root.toggle kb false/.test(txt)) hit('keyboard closed');
    if (/main.style.transform=translateY/.test(txt)) hit('bar pinned'); if (/main.style.transform=\n/.test(txt) || /main.style.transform=$/m.test(txt)) hit('bar released');
    if (!sp.hasVV && /-- vvResize/.test(txt)) hit('no visualViewport');
    if (/scrollTo 0,0/.test(txt)) hit('page scroll undone');
    if (/-- winScroll[^\n]*\n(?:(?!state)[^\n]*\n)*?state/.test(txt) && !/-- winScroll[^\n]*\n(?:(?!state)[^\n]*\n)*?scrollTo/.test(txt)) hit('no scroll to undo');
    if (/search.preventDefault/.test(txt)) hit('touch refocused'); if (/-- touch \d true\nstate/.test(txt)) hit('touch when focused');
    if (/search.focus \{"preventScroll":true\}/.test(txt)) hit('focus without scrolling');
    if (/-- focus/.test(txt)) hit('focus handler');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log };
}

describe('the scroll fade, the keyboard handling and the scroll lock (new viewport.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 4000 random sessions (scrolls, resizes, keyboard sizes around 80 px, page scrolls, focus timers)', () => {
    const rand = rng(2468);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 4000; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['top fade on', 'top fade off', 'bottom fade on', 'bottom fade off', 'fade after scroll', 'fade after resize', 'observer set up', 'no ResizeObserver', 'keyboard open', 'keyboard closed', 'bar pinned', 'bar released', 'no visualViewport', 'page scroll undone', 'no scroll to undo', 'touch refocused', 'touch when focused', 'focus without scrolling', 'focus handler']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 120000);
});

// ---- the same, with the expected behaviour written out (no old code involved) ----
function mini(o: { hasRO?: boolean; hasVV?: boolean } = {}) {
  const log: string[] = [], p = build(log, { hasRO: o.hasRO ?? true, hasVV: o.hasVV ?? true, innerHeight: 800, ops: [] });
  createViewport({ list: p.list, recipesEl: p.recipesEl, searchInput: p.search as any });
  return { p, log };
}
const fade = (log: string[]) => log.filter((l) => /^sc\d\.set /.test(l));

describe('the scroll fade, the keyboard handling and the scroll lock, behaviour', () => {
  it('fades the top once you are more than 4 px down and the bottom while more than 4 px remain', () => {
    const { p, log } = mini();
    expect(fade(log)).toEqual(['sc1.set --ft=0px', 'sc1.set --fb=32px', 'sc2.set --ft=0px', 'sc2.set --fb=32px']);
    for (const [top, gap, ft, fb] of [[4, 4, '0px', '0px'], [5, 5, '32px', '32px'], [0, 3, '0px', '0px'], [100, 100, '32px', '32px']] as const) {
      const s = p.scrollers[0]; s.scrollTop = top; s.scrollHeight = top + s.clientHeight + gap; log.length = 0; s.f.scroll.forEach((f) => f());
      expect([top, gap, fade(log)]).toEqual([top, gap, ['sc1.set --ft=' + ft, 'sc1.set --fb=' + fb]]);
    }
  });
  it('listens for scrolling passively and watches the lists and both scrollers for a change of size', () => {
    const { log } = mini(); expect(log).toContain('sc1.listen scroll {"passive":true}');
    expect(log.filter((l) => /^RO\./.test(l))).toEqual(['RO.new', 'RO.observe sc1', 'RO.observe sc2', 'RO.observe list', 'RO.observe recipesEl']);
    const { p, log: l2 } = mini(); l2.length = 0; p.ro(); expect(fade(l2).length).toBe(4);
    const none = mini({ hasRO: false }); expect(none.log.filter((l) => /^RO\./.test(l))).toEqual([]);
  });
  it('shrinks the app to what the keyboard leaves free, from more than 80 px of keyboard, and pins it to the top of what is visible', () => {
    const { p, log } = mini(); const set = (kb: number, h = 500, off = 0) => { p.vv.height = h; p.vv.offsetTop = off; p.win.innerHeight = h + off + kb; log.length = 0; p.vvL.resize.forEach((f) => f()); };
    set(80); expect(log).toEqual(['root.toggle kb false', 'root.style.height=', 'main.style.transform=']);
    set(81, 500.4, 12.6); expect(log).toEqual(['root.toggle kb true', 'root.style.height=500px', 'main.style.transform=translateY(13px)']);
    set(300, 420, 0); expect(log).toEqual(['root.toggle kb true', 'root.style.height=420px', 'main.style.transform=translateY(0px)']);
    set(0); expect(log).toEqual(['root.toggle kb false', 'root.style.height=', 'main.style.transform=']);
    expect([p.vvL.resize.length, p.vvL.scroll.length]).toEqual([1, 1]);
    const no = mini({ hasVV: false }); expect(no.log.filter((l) => /^vv\./.test(l))).toEqual([]);
  });
  it('sends the page back to the top when it scrolls on its own, and leaves it alone when it is already there', () => {
    const { p, log } = mini(); const scroll = (y: number, r: number, b: number) => { p.win.scrollY = y; p.root.scrollTop = r; p.body.scrollTop = b; log.length = 0; p.winL.scroll.forEach((f) => f()); };
    scroll(0, 0, 0); expect(log).toEqual([]);
    for (const a of [[1, 0, 0], [0, 2, 0], [0, 0, 3]] as const) { scroll(...a); expect([a, log]).toEqual([a, ['scrollTo 0,0', 'root.scrollTop=0', 'body.scrollTop=0']]); }
    expect(log.length).toBe(3); expect(p.winL.scroll.length).toBe(1);
  });
  it('focuses the search field itself on a first tap (without scrolling) and lets a tap on an already focused field be', () => {
    const { p, log } = mini(); p.doc.activeElement = p.main; log.length = 0; p.search.fire('touchstart');
    expect(log).toEqual(['search.preventDefault', 'search.focus {"preventScroll":true}']);
    expect(log.filter((l) => /^search\.options/.test(l)).length).toBe(0);
    p.doc.activeElement = p.search; log.length = 0; p.search.fire('touchstart'); expect(log).toEqual([]);
    expect(log.length).toBe(0); expect(p.search.listeners.touchstart.length).toBe(1);
  });
  it('the field listens for touches non-passively (it has to be able to cancel them) and does nothing about the keyboard when the viewport information is gone', () => {
    const log: string[] = [], p = build(log, { hasRO: true, hasVV: true, innerHeight: 800, ops: [] }); createViewport({ list: p.list, recipesEl: p.recipesEl, searchInput: p.search as any });
    expect(log).toContain('search.options touchstart {"passive":false}');
    p.win.visualViewport = undefined; p.win.innerHeight = 2000; log.length = 0; p.vvL.resize.forEach((f) => f()); expect(log).toEqual([]);
  });
  it('after focusing the field it undoes page scrolls at 0, 60, 160, 320 and 600 ms', () => {
    const { p, log } = mini(); p.win.scrollY = 9; log.length = 0; p.search.fire('focus');
    const times = [0, 59, 60, 159, 160, 319, 320, 599, 600]; const at: number[] = [];
    let last = 0; for (const t of times) { p.clk.advance(t - last); last = t; at.push(log.filter((l) => l === 'scrollTo 0,0').length); }
    expect(at).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
});
