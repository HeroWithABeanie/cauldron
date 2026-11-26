(global as any).__realSetTimeout = setTimeout;
import { describe, it, expect, afterEach } from 'vitest';
import { createSearch } from '../src/search';
import { createSearchHint } from '../src/searchph';
import { lockUI, uiLocked } from '../src/ui';
import { makeOldSearch } from './reference/oldSearch';

const g = globalThis as any;
afterEach(() => { delete g.window; delete g.document; delete g.setTimeout_real; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A virtual clock: setTimeout / clearTimeout that only run when the test advances time. */
// (timer ids stay unique across runs: ui.ts keeps the id of its last lock timer, and a repeated id would cancel a timer of the next run)
let timerIds = 0;
function clock() {
  let now = 0; const q: { t: number; id: number; fn: () => void }[] = [];
  return {
    setTimeout: (fn: () => void, ms: number) => { const id = ++timerIds; q.push({ t: now + (ms || 0), id, fn }); return id; },
    clearTimeout: (i: number) => { const k = q.findIndex((x) => x.id === i); if (k > -1) q.splice(k, 1); },
    advance(ms: number) { const end = now + ms; for (;;) { q.sort((a, b) => a.t - b.t || a.id - b.id); if (!q.length || q[0].t > end) break; const x = q.shift()!; now = x.t; x.fn(); } now = end; },
  };
}

interface Setup { mgCanAnimate: boolean; canAnimate: boolean; canAnimateClose: boolean; hasMg: boolean; reduced: boolean; btn: { left: number; width: number; height: number }; bar: { left: number; width: number }; boxW: number; textW: number; hasFonts: boolean; }
function recording(name: string, log: string[], extra: Record<string, unknown> = {}) {
  const handlers: Record<string, ((e: any) => void)[]> = {};
  const cls = new Set<string>();
  const style = new Proxy({} as Record<string, string>, { set(o, k: string, v) { o[k] = v; log.push(name + '.style.' + k + '=' + v); return true; } });
  const el: any = new Proxy({
    name, style, handlers, value: '', _hidden: false, _text: '', anims: [] as any[],
    addEventListener(t: string, fn: (e: any) => void) { (handlers[t] = handlers[t] || []).push(fn); },
    classList: { add: (c: string) => { cls.add(c); log.push(name + '.add ' + c); }, remove: (...c: string[]) => { c.forEach((x) => cls.delete(x)); log.push(name + '.remove ' + c.join(',')); }, contains: (c: string) => cls.has(c) },
    setAttribute(k: string, v: unknown) { log.push(name + '.attr ' + k + '=' + String(v)); },
    focus(o: unknown) { log.push(name + '.focus ' + JSON.stringify(o)); }, blur() { log.push(name + '.blur'); },
    ...extra,
  } as any, {
    set(o: any, k: string, v: unknown) { if (k === 'hidden' || k === 'textContent' || k === 'title' || k === 'value') log.push(name + '.' + k + '=' + String(v)); o[k] = v; return true; },
  });
  return el;
}
function withAnimate(el: any, name: string, log: string[], can: boolean) {
  if (!can) { el.animate = undefined; return; }
  let n = 0;
  el.animate = (kf: unknown, o: unknown) => {
    const id = ++n, a: any = { id, onfinish: null, cancel() { log.push(name + '.cancel#' + id); }, pause() { log.push(name + '.pause#' + id); } };
    log.push(name + '.animate#' + id + ' ' + JSON.stringify([kf, o])); el.anims.push(a); return a;
  };
}

function page(s: Setup, log: string[], clk: ReturnType<typeof clock>) {
  const searchbar = recording('searchbar', log), searchInput = recording('input', log), fabbar = recording('fabbar', log, { getBoundingClientRect: () => ({ left: s.bar.left, width: s.bar.width, height: 50 }) }),
    searchPh = recording('ph', log, { clientWidth: s.boxW }), searchPhText = recording('phText', log, { scrollWidth: s.textW }),
    searchClose = recording('close', log), btn = recording('btn', log, { getBoundingClientRect: () => ({ left: s.btn.left, width: s.btn.width, height: s.btn.height }) }),
    label = recording('label', log), openItem = recording('openItem', log);
  const mg = s.hasMg ? recording('magnifier', log) : null;
  withAnimate(searchbar, 'searchbar', log, s.canAnimate); withAnimate(searchClose, 'close', log, s.canAnimateClose); withAnimate(searchPhText, 'phText', log, s.canAnimate);
  if (mg) withAnimate(mg, 'magnifier', log, s.mgCanAnimate);
  searchbar.querySelector = (sel: string) => (sel === '.sicon svg' ? mg : null);
  const byId: Record<string, any> = { searchbar, searchInput, fabbar, searchPh, searchPhText, searchClose, openItem, openItemLabel: label };
  const fontCbs: (() => void)[] = [];
  const resize: (() => void)[] = [];
  g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clearTimeout;
  g.document = {
    getElementById: (id: string) => byId[id] || null,
    querySelector: (sel: string) => (sel === '#fabRow .searchbtn' ? btn : null),
    querySelectorAll: (sel: string) => (sel === '.searchbtn' ? { forEach: (f: (e: any) => void) => [btn].forEach(f) } : { forEach() { } }),
    documentElement: { classList: { add() { }, remove() { } } },
    fonts: s.hasFonts ? { ready: { then: (cb: () => void) => { fontCbs.push(cb); } } } : undefined,
  };
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? s.reduced : false }), addEventListener: (t: string, fn: () => void) => { if (t === 'resize') resize.push(fn); } };
  return { searchbar, searchInput, fabbar, searchPh, searchPhText, searchClose, btn, mg, label, fontCbs, resize };
}

type OpName = 'click' | 'closeBtn' | 'escape' | 'otherKey' | 'type' | 'clear' | 'resize' | 'fonts' | 'advance' | 'finish' | 'view' | 'updateRow' | 'dismiss' | 'dismissNoAnim' | 'lock' | 'motion' | 'width';
type Op = { op: OpName; ms: number; text: string; flag: boolean };
function randomSetup(rand: () => number): Setup {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  return { mgCanAnimate: rand() < .7, canAnimate: rand() < .85, canAnimateClose: rand() < .85, hasMg: rand() < .8, reduced: rand() < .2, btn: { left: pick([10, 250]), width: pick([44, 60]), height: pick([40, 48]) }, bar: { left: pick([0, 4]), width: pick([360, 420]) }, boxW: pick([200, 300]), textW: pick([150, 250, 300, 301]), hasFonts: rand() < .8 };
}
function randomOps(rand: () => number): Op[] {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  return Array.from({ length: 4 + Math.floor(rand() * 22) }, () => ({
    op: pick(['click', 'click', 'click', 'closeBtn', 'closeBtn', 'escape', 'otherKey', 'type', 'type', 'clear', 'resize', 'fonts', 'advance', 'advance', 'finish', 'finish', 'view', 'updateRow', 'dismiss', 'dismissNoAnim', 'lock', 'motion', 'width'] as OpName[]),
    ms: pick([1, 100, 167, 168, 169, 170, 280, 1000]), text: pick(['mi', 'milk', 'x', '  ']), flag: rand() < .5,
  }));
}
const seen: Record<string, number> = {};
const hit = (k: string, n = 1) => { seen[k] = (seen[k] || 0) + n; };

function run(impl: 'old' | 'new', s: Setup, ops: Op[], count: boolean) {
  const log: string[] = [], clk = clock(), p = page(s, log, clk);
  let reduced = s.reduced, view = 'list', ranLock = false;
  const calls = { closeMenu: 0 };
  const hooks = {
    closeMenu: () => { calls.closeMenu++; log.push('closeMenu'); },
    applyListFilter: (a: boolean) => log.push('applyListFilter ' + a),
    applyRecipeFilter: (a: boolean) => log.push('applyRecipeFilter ' + a),
  };
  let api: { open?: () => void; close: (a: boolean) => void; updateRow: (v: string) => void; state: () => string };
  if (impl === 'old') {
    const ref: { o: any } = { o: null };
    const hint = createSearchHint({ searchPhEl: p.searchPh, searchPhText: p.searchPhText, searchInput: p.searchInput, get searchOpen() { return ref.o.searchOpen; } });
    const o = makeOldSearch({ searchbar: p.searchbar, searchInput: p.searchInput, fabbar: p.fabbar, searchPhEl: p.searchPh, searchPhText: p.searchPhText, searchHint: hint, ...hooks });
    ref.o = o;
    api = { close: o.closeSearch, updateRow: o.updateRow, state: () => JSON.stringify([o.query, o.searchOpen]) };
    var setView = (v: string) => o.setView(v);
  } else {
    const ctx: any = { query: '', searchOpen: false, currentView: 'list', searchInput: p.searchInput, fabbar: p.fabbar, ...hooks };
    const sr = createSearch(ctx);
    api = { close: sr.close, updateRow: sr.updateRow, state: () => JSON.stringify([ctx.query, ctx.searchOpen]) };
    var setView = (v: string) => { ctx.currentView = v; };
  }
  const run1 = (fns: (() => void)[] | undefined) => (fns || []).slice().forEach((f) => f());
  for (const o of ops) {
    log.push('-- ' + o.op);
    if (count && o.op === 'click' && uiLocked && JSON.parse(api.state())[1] === false) hit('open refused while locked');
    if (o.op === 'click') run1(p.btn.handlers.click);
    else if (o.op === 'closeBtn') run1(p.searchClose.handlers.click);
    else if (o.op === 'escape') run1(p.searchInput.handlers.keydown?.map((f: any) => () => f({ key: 'Escape' })));
    else if (o.op === 'otherKey') run1(p.searchInput.handlers.keydown?.map((f: any) => () => f({ key: 'a' })));
    else if (o.op === 'type') { p.searchInput.value = o.text; run1(p.searchInput.handlers.input); }
    else if (o.op === 'clear') { p.searchInput.value = ''; run1(p.searchInput.handlers.input); }
    else if (o.op === 'resize') run1(p.resize);
    else if (o.op === 'fonts') run1(p.fontCbs);
    else if (o.op === 'advance') clk.advance(o.ms);
    else if (o.op === 'finish') [p.searchbar, p.mg, p.searchPhText].forEach((el: any) => el && el.anims.forEach((a: any) => a.onfinish && a.onfinish()));
    else if (o.op === 'view') { view = view === 'list' ? 'recipes' : 'list'; setView(view); }
    else if (o.op === 'updateRow') api.updateRow(o.flag ? 'recipes' : 'list');
    else if (o.op === 'dismiss') api.close(true);
    else if (o.op === 'dismissNoAnim') api.close(false);
    else if (o.op === 'lock') { lockUI(o.ms); ranLock = true; }
    else if (o.op === 'motion') { reduced = !reduced; g.window.matchMedia = (q: string) => ({ matches: q.includes('reduce') ? reduced : false }); }
    else if (o.op === 'width') p.searchPh.clientWidth = o.ms;
    log.push('state ' + api.state());
  }
  clk.advance(100000);   // lets a pending lock end, so the next run starts unlocked
  const txt = log.join('\n');
  if (count) {
    if (/btn\.style\.visibility=hidden/.test(txt)) hit('opened');
    if (/searchbar\.animate#\d+ .*"left":"18px","width"/.test(txt) && /"duration":280/.test(txt)) hit('open/close animated');
    if (/-- click\ncloseMenu\n[\s\S]*?searchbar\.animate/.test(txt)) hit('open animated');
    if (/fabbar\.add covered/.test(txt)) hit('covered');
    if (/close\.animate#/.test(txt)) hit('x pop');
    if (/applyRecipeFilter/.test(txt)) hit('recipe filter');
    if (/applyListFilter true/.test(txt)) hit('list filter animated');
    if (/applyListFilter false/.test(txt)) hit('list filter instant');
    if (/Search recipes or ingredients/.test(txt)) hit('recipe placeholder');
    if (/Search ingredients or items/.test(txt)) hit('list placeholder');
    if (/label\.textContent=Add recipe/.test(txt)) hit('updateRow recipes');
    if (/label\.textContent=Add item/.test(txt)) hit('updateRow list');
    if (/phText\.animate#/.test(txt)) hit('hint animation');
    if (/ph\.add hide/.test(txt)) hit('hint hidden while typing');
    if (/-- escape\n(?!state \["",false\])/.test(txt)) hit('escape');
    if (/input\.blur/.test(txt)) hit('closed');
    if (/state \["(mi|milk|x|  )",true\]/.test(txt)) hit('query kept while open');
  }
  return { log, closeMenu: calls.closeMenu };
}

describe('the search bar (new search.ts vs the old code from app.js)', () => {
  it('does exactly the same in 4000 random pages and sequences (animations, timers, locks, view changes)', () => {
    const rand = rng(777001);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let k = 0; k < 4000; k++) {
      const s = randomSetup(rand), ops = randomOps(rand), a = run('old', s, ops, true), b = run('new', s, ops, false);
      expect(b).toEqual(a);
    }
    for (const k of ['opened', 'open animated', 'covered', 'x pop', 'recipe filter', 'list filter animated', 'list filter instant', 'recipe placeholder', 'list placeholder', 'updateRow recipes', 'updateRow list', 'hint animation', 'hint hidden while typing', 'escape', 'closed', 'query kept while open', 'open refused while locked']) expect([k, (seen[k] || 0) > 100]).toEqual([k, true]);
  }, 120000);

  const basic = () => {
    const log: string[] = [], clk = clock(), s: Setup = { mgCanAnimate: true, canAnimate: true, canAnimateClose: true, hasMg: true, reduced: false, btn: { left: 250, width: 44, height: 40 }, bar: { left: 0, width: 360 }, boxW: 300, textW: 100, hasFonts: false };
    const p = page(s, log, clk);
    const ctx: any = { query: '', searchOpen: false, currentView: 'list', searchInput: p.searchInput, fabbar: p.fabbar, closeMenu() { log.push('closeMenu'); }, applyListFilter(a: boolean) { log.push('list ' + a); }, applyRecipeFilter(a: boolean) { log.push('recipes ' + a); } };
    const search = createSearch(ctx);
    return { log, clk, p, ctx, search };
  };
  it('opens: closes the menu, shows the bar, focuses the field and grows the bar out of the button', () => {
    const { p, ctx, log } = basic();
    p.btn.handlers.click.forEach((f: any) => f());
    expect(ctx.searchOpen).toBe(true);
    expect(log.includes('closeMenu')).toBe(true);
    expect(p.searchbar.hidden).toBe(false);
    expect(p.btn.style.visibility).toBe('hidden');
    expect(p.searchbar.style.height).toBe('40px');
    expect(log.some((l) => l.startsWith('searchbar.animate#1 ') && l.includes('"left":"250px","width":"44px"') && l.includes('"left":"18px","width":"324px"'))).toBe(true);
  });
  it('typing sets the query and filters; clearing brings the hint back; the x closes after its little pop', () => {
    const { p, ctx, log, clk } = basic();
    p.btn.handlers.click.forEach((f: any) => f());
    p.searchInput.value = 'mil'; p.searchInput.handlers.input.forEach((f: any) => f());
    expect(ctx.query).toBe('mil'); expect(log.includes('list true')).toBe(true);
    p.searchClose.handlers.click.forEach((f: any) => f());
    expect(ctx.searchOpen).toBe(true);        // still open during the pop
    clk.advance(170);
    expect(ctx.searchOpen).toBe(false); expect(ctx.query).toBe(''); expect(p.searchInput.value).toBe('');
  });
  it('the x pop waits 168 ms + 2: not yet at 169, closed at 170 (boundary)', () => {
    const { p, ctx, clk } = basic();
    p.btn.handlers.click.forEach((f: any) => f());
    p.searchClose.handlers.click.forEach((f: any) => f());
    clk.advance(169); expect(ctx.searchOpen).toBe(true);
    clk.advance(1); expect(ctx.searchOpen).toBe(false);
  });
  it('does not open while the page is locked for server animations', async () => {
    const { p, ctx } = basic();
    lockUI(5);
    p.btn.handlers.click.forEach((f: any) => f());
    expect(ctx.searchOpen).toBe(false);
    await new Promise((r) => setTimeout_real(r, 20));
  });
});
function setTimeout_real(fn: () => void, ms: number) { return (global as any).__realSetTimeout(fn, ms); }
