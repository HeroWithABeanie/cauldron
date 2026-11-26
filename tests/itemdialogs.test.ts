import { describe, it, expect, afterEach } from 'vitest';
import { createItemDialogs } from '../src/itemdialogs';
import { makeOldItemDialogs } from './reference/oldItemDialogs';

const g = globalThis as any;
afterEach(() => { delete g.document; delete g.window; delete g.setTimeout; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const realTimers = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, setInterval: g.setInterval, clearInterval: g.clearInterval };
afterEach(() => { Object.assign(g, realTimers); });

/** A virtual clock with timeouts and intervals; time only moves when a test advances it. */
function clock() {
  let now = 0, id = 0; const q: { t: number; id: number; fn: () => void; every?: number }[] = [];
  return {
    setTimeout: (fn: () => void, ms: number) => { q.push({ t: now + (ms || 0), id: ++id, fn }); return id; },
    setInterval: (fn: () => void, ms: number) => { q.push({ t: now + ms, id: ++id, fn, every: ms }); return id; },
    clear: (i: number) => { const k = q.findIndex((x) => x.id === i); if (k > -1) q.splice(k, 1); },
    advance(ms: number) { const end = now + ms; for (;;) { q.sort((a, b) => a.t - b.t || a.id - b.id); if (!q.length || q[0].t > end) break; const x = q.shift()!; now = x.t; if (x.every) q.push({ ...x, t: now + x.every }); x.fn(); } now = end; },
  };
}

/** A fake page element that writes everything done to it into one shared log. */
class El {
  children: El[] = []; classes = new Set<string>(); attrs: Record<string, string> = {}; listeners: Record<string, ((e: any) => void)[]> = {};
  open = false; canAnimate = false; _closing = false;
  selectionStart = 0; selectionEnd = 0; clientWidth = 300; offsetHeight = 60; offsetLeft = 0;
  private p: Record<string, unknown> = {};
  style: any;
  constructor(public log: string[], public id: string) {
    this.style = new Proxy({} as any, { set: (o, k: string, v) => { o[k] = v; this.log.push(this.id + '.style.' + k + '=' + v); return true; } });
  }
  private set(k: string, v: unknown) { this.p[k] = v; this.log.push(this.id + '.' + k + '=' + JSON.stringify(v)); }
  get className() { return (this.p.className as string) ?? ''; } set className(v: string) { this.set('className', v); }
  get textContent() { return (this.p.textContent as string) ?? ''; } set textContent(v: string) { this.set('textContent', v); this.children = []; }
  get hidden() { return !!this.p.hidden; } set hidden(v: boolean) { this.set('hidden', v); }
  get tabIndex() { return (this.p.tabIndex as number) ?? -1; } set tabIndex(v: number) { this.set('tabIndex', v); }
  get type() { return (this.p.type as string) ?? ''; } set type(v: string) { this.set('type', v); }
  get scrollTop() { return (this.p.scrollTop as number) ?? 0; } set scrollTop(v: number) { this.set('scrollTop', v); }
  get innerHTML() { return (this.p.innerHTML as string) ?? ''; } set innerHTML(v: string) { this.set('innerHTML', v); this.children = []; }
  get value() { return (this.p.value as string) ?? ''; } set value(v: unknown) { this.set('value', String(v)); }
  get firstChild() { return this.children[0] ?? null; }
  get classList() { const s = this; return {
    add: (c: string) => { s.classes.add(c); s.log.push(s.id + '.add ' + c); }, remove: (c: string) => { s.classes.delete(c); s.log.push(s.id + '.remove ' + c); },
    contains: (c: string) => s.classes.has(c), toggle: (c: string, on: boolean) => { if (on) s.classes.add(c); else s.classes.delete(c); s.log.push(s.id + '.toggle ' + c + ' ' + on); } }; }
  get animate(): any { return this.canAnimate ? (kf: unknown, o: unknown) => { this.log.push(this.id + '.animate ' + JSON.stringify([kf, o])); return { cancel: () => { this.log.push(this.id + '.cancel'); } }; } : undefined; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); this.log.push(this.id + '.attr ' + k + '=' + v); }
  removeAttribute(k: string) { delete this.attrs[k]; this.log.push(this.id + '.rm ' + k); }
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t: string, f: (e: any) => void, c?: unknown) { this.log.push(this.id + '.listen ' + t + (c ? ' capture' : '')); (this.listeners[t] = this.listeners[t] || []).push(f); }
  appendChild(c: El) { this.log.push(this.id + '.append ' + c.id); this.children.push(c); return c; }
  focus(o?: unknown) { this.log.push(this.id + '.focus ' + JSON.stringify(o)); }
  showModal() { this.open = true; this.log.push(this.id + '.showModal'); }
  close() { if (!this.open) return; this.open = false; this.log.push(this.id + '.close'); this.fire('close'); }
  fire(t: string, ev: any = {}) { ev.target = ev.target ?? this; ev.preventDefault = ev.preventDefault ?? (() => { this.log.push(this.id + '.preventDefault'); }); ev.stopPropagation = ev.stopPropagation ?? (() => { this.log.push(this.id + '.stopPropagation'); }); (this.listeners[t] || []).slice().forEach((f) => f(ev)); }
}

const IDS = ['dlgEdit', 'editName', 'editCat', 'editBrand', 'editQty', 'editUnit', 'dlgDesc', 'descText', 'descCount', 'descName', 'descSub', 'descCards', 'descEdit', 'descSave', 'dlgDescClose', 'dlgEditClose',
  'dlgUnlink', 'unlinkConfirm', 'unlinkFill', 'unlinkLbl', 'unlinkNo', 'unlinkCards', 'unlinkMsg', 'dlgRelink', 'relinkConfirm', 'relinkFill', 'relinkLbl', 'relinkNo', 'relinkCards', 'relinkMsg', 'editForm', 'suggestE'];

interface Src { id: number; name: string }
interface Sp { items: any[]; recipes: any[]; reduced: boolean; canAnimate: boolean; hasRO: boolean; ops: Op[] }
type Op = { k: string; i: number; v: string; b: boolean; ms: number };

const NAMES = ['milk', 'eggs', 'flour', 'tea'], UNITS = ['pcs', 'g', 'ml', 'tbsp'], CATS = ['', 'Dairy', 'Bakery'];
function randomSpec(rand: () => number): Sp {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const recipes = [1, 2, 3].map((id) => ({ id, name: 'R' + id, portions: pick([0, 1, 2, 4]), items: [] }));
  const items = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, n) => {
    const it: any = { id: 'i' + n, text: pick(NAMES), qty: pick([0, .5, 1, 2, 3]), unit: pick(UNITS), done: false };
    if (rand() < .4) it.brand = pick(['Alpro', 'Arla']);
    if (rand() < .6) it.cat = pick(CATS.slice(1));
    if (rand() < .5) it.desc = pick(['x', 'note', 'a'.repeat(100)]);
    const kind = n === 0 && rand() < .8 ? 'linked' : n === 1 && rand() < .6 ? 'unlinked' : pick(['plain', 'linked', 'linked', 'linked', 'multi', 'unlinked', 'unlinked', 'unlinkedNoOrig', 'manual']);
    if (n < 2 && rand() < .85) it.qty = pick([1, 2, 3]);
    const src = (id: number): Src => ({ id, name: 'R' + id });
    if (kind !== 'plain') it.from = kind === 'multi' ? [src(1), src(2), src(3)].slice(0, 2 + Math.floor(rand() * 2)) : [src(pick([1, 2, 3, 9]))];
    if (kind === 'unlinked' || kind === 'unlinkedNoOrig') { it.unlinked = true; if (kind === 'unlinked') it.orig = { qty: pick([1, 2]), unit: pick(UNITS), ...(rand() < .6 ? { text: pick(NAMES), brand: rand() < .5 ? 'Arla' : undefined } : {}) }; }
    if (kind === 'manual') it.manual = true;
    if (kind === 'unlinked' && rand() < .2) it.manual = true;
    return it;
  });
  const KINDS = ['openDesc', 'openDesc', 'openDesc', 'openRelink', 'descType', 'descBefore', 'descEditBtn', 'descEditBtn', 'descSaveBtn', 'descCloseBtn', 'descBackdrop', 'descBackdropInner', 'closeDesc',
    'requestCloseDesc', 'requestCloseEdit', 'closeEditBtn', 'editBackdrop', 'editField', 'editField', 'editField', 'submit', 'submit', 'submit', 'unlinkConfirm', 'unlinkConfirm', 'unlinkNo', 'unlinkBackdrop',
    'relinkConfirm', 'relinkConfirm', 'relinkNo', 'relinkBackdrop', 'confirmDiscard', 'undoToast', 'chain', 'advance', 'advance', 'advance', 'dataX', 'closing', 'replaceItem', 'removeItem', 'motion', 'closeEdit'];
  const op = (k: string, i = Math.floor(rand() * 8), ms = pick([0, 249, 250, 1000, 2999, 3000, 3100])): Op => ({ k, i, v: pick(['name', 'qty', 'unit', 'cat', 'brand']), b: rand() < .5, ms });
  const single = (): Op => op(pick(KINDS));
  const flow = (): Op[] => {
    const i = Math.floor(rand() * 2), f = pick(['edit', 'edit', 'edit', 'relink', 'relink', 'desc', 'chain']);
    if (f === 'edit') return [op('openDesc', i), op('descEditBtn'), op('fill', pick([0, 0, 0, 1, 2, 3, 4, 5, 6])), ...(rand() < .4 ? [op('fill', pick([0, 1, 5, 6]))] : []), op('submit'),
      ...pick([[], [op('advance', 0, 3100), op('unlinkConfirm')], [op('unlinkConfirm'), op('advance', 0, 3100), op('unlinkConfirm')], [op('unlinkNo')], [op('unlinkBackdrop')], [op('closeEdit')]]), ...(rand() < .4 ? [op('undoToast')] : []), ...(rand() < .3 ? [op('requestCloseEdit'), op('confirmDiscard')] : [])];
    if (f === 'relink') return [...(rand() < .5 ? [op('openDesc', i), op('chain'), op('advance', 0, 250)] : [op('openRelink', i)]), ...pick([[op('advance', 0, 3100), op('relinkConfirm')], [op('relinkConfirm'), op('advance', 0, 3100), op('relinkConfirm')], [op('relinkNo')], [op('relinkBackdrop')]]), ...(rand() < .4 ? [op('undoToast')] : []), ...(rand() < .2 ? [op('removeItem', i), op('relinkConfirm')] : [])];
    if (f === 'chain') return [op('openDesc', i), op('chain'), op('advance', 0, 250), op('advance', 0, 3100), op('relinkConfirm'), op('undoToast')];
    return [op('openDesc', i), op('descType'), ...(rand() < .5 ? [op('descSaveBtn')] : [op('requestCloseDesc'), op('confirmDiscard')]), ...(rand() < .5 ? [op('undoToast')] : [])];
  };
  const ops: Op[] = [];
  for (let seg = 0, segs = 2 + Math.floor(rand() * 5); seg < segs; seg++) { if (rand() < .6) ops.push(...flow()); else for (let k = 0, ks = 1 + Math.floor(rand() * 5); k < ks; k++) ops.push(single()); }
  return { items, recipes, reduced: rand() < .15, canAnimate: rand() < .7, hasRO: rand() < .5, ops };
}

const seen: Record<string, number> = {};
const hit = (k: string) => { seen[k] = (seen[k] || 0) + 1; };

function run(impl: 'old' | 'new', sp: Sp, count: boolean) {
  const log: string[] = [], clk = clock();
  const items = JSON.parse(JSON.stringify(sp.items)), recipes = JSON.parse(JSON.stringify(sp.recipes));
  let created = 0, reduced = sp.reduced, lastUndo: (() => void) | null = null, pendingDiscard: (() => void) | null = null;
  const els: Record<string, El> = {};
  for (const id of IDS) { els[id] = new El(log, id); els[id].canAnimate = sp.canAnimate; }
  for (const id of ['dlgEdit', 'dlgDesc', 'dlgUnlink', 'dlgRelink']) els[id].open = false;
  const all: El[] = [];
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    createElement: (tag: string) => { const e = new El(log, tag + '#' + (++created)); e.canAnimate = false; all.push(e); log.push('create ' + e.id); return e; },
    createDocumentFragment: () => { const e = new El(log, 'frag#' + (++created)); log.push('create ' + e.id); return e; },
    createTextNode: (t: string) => { const e = new El(log, 'text#' + (++created)); log.push('text ' + e.id + ' ' + t); return e; },
  };
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? reduced : false }) };
  if (sp.hasRO) g.window.ResizeObserver = g.ResizeObserver = class { observe(x: any) { log.push('ro.observe ' + x.id); } disconnect() { log.push('ro.disconnect'); } }; else delete g.ResizeObserver;
  g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clear; g.setInterval = clk.setInterval; g.clearInterval = clk.clear;
  const env = {
    items, recipes, unitHTML: 'U', COOK_HTML: 'C',
    save: () => log.push('save'), render: () => log.push('render'), recordHistory: (e: unknown) => log.push('history ' + JSON.stringify(e)),
    openDiscard: (then: () => void) => { log.push('openDiscard'); pendingDiscard = then; },
    ensureOpt: (sel: El, v: unknown) => log.push('ensureOpt ' + sel.id + ' ' + v),
    recipeCardEl: (f: Src) => { const c = g.document.createElement('div'); c.className = 'shophead'; c.textContent = f.name; return c; },
    makeSuggest: (inp: El, box: El, u: unknown, q: unknown, c: El) => { log.push('makeSuggest ' + inp.id + ' ' + box.id + ' ' + c.id); return { hide: () => log.push('suggest.hide') }; },
    showToast: (msg: string, undo?: () => void) => { log.push('toast ' + msg); lastUndo = undo || null; },
  };
  const api: any = impl === 'old' ? makeOldItemDialogs(env) : createItemDialogs({ get items() { return items; }, get recipes() { return recipes; }, ...env } as any);
  const snap = () => JSON.stringify([items, ['dlgEdit', 'dlgDesc', 'dlgUnlink', 'dlgRelink'].map((i) => els[i].open), els.editName.value, els.editQty.value, els.descText.value, els.descCount.textContent]);
  const pickItem = (o: Op) => items[o.i % Math.max(1, items.length)];
  for (const o of sp.ops) {
    log.push('-- ' + o.k + ' ' + o.i);
    const it = pickItem(o);
    try {
      switch (o.k) {
        case 'openDesc': if (it) api.openDesc(it); break;
        case 'openRelink': if (it) api.openRelink(it, o.b); break;
        case 'descType': els.descText.value = o.b ? 'a'.repeat(o.i * 20) : 'note ' + o.i; els.descText.fire('input', { inputType: o.b ? 'insertFromPaste' : 'insertText' }); break;
        case 'descBefore': els.descText.value = o.b ? 'a'.repeat(100) : 'a'; els.descText.selectionStart = 0; els.descText.selectionEnd = o.i % 2 ? 0 : 3; els.descText.fire('beforeinput', { inputType: ['insertText', 'insertFromPaste', 'deleteContentBackward', undefined][o.i % 4] }); break;
        case 'descEditBtn': els.descEdit.fire('click'); break;
        case 'descSaveBtn': els.descSave.fire('click'); break;
        case 'descCloseBtn': els.dlgDescClose.fire('click'); break;
        case 'descBackdrop': els.dlgDesc.fire('click', { target: els.dlgDesc }); break;
        case 'descBackdropInner': els.dlgDesc.fire('click', { target: els.descText }); break;
        case 'closeDesc': els.dlgDesc.close(); break;
        case 'requestCloseDesc': api.requestCloseDesc(); break;
        case 'requestCloseEdit': api.requestCloseEdit(); break;
        case 'closeEditBtn': els.dlgEditClose.fire('click'); break;
        case 'editBackdrop': els.dlgEdit.fire('click', { target: o.b ? els.dlgEdit : els.editName }); break;
        case 'editField': { const f = o.v === 'name' ? els.editName : o.v === 'qty' ? els.editQty : o.v === 'unit' ? els.editUnit : o.v === 'cat' ? els.editCat : els.editBrand;
          f.value = o.v === 'qty' ? ['', '0', '-1', '2', '2.5', 'x', '1'][o.i % 7] : o.v === 'unit' ? ['', 'g', 'pcs', 'ml'][o.i % 4] : o.v === 'cat' ? ['', 'Dairy', 'Bakery'][o.i % 3] : ['', 'milk', ' eggs ', 'tea', 'Alpro'][o.i % 5]; break; }
        case 'fill': { const m = o.i % 7; if (m === 0) els.editQty.value = String((parseFloat(els.editQty.value) || 1) + 1); else if (m === 1) els.editCat.value = 'Bakery'; else if (m === 3) els.editQty.value = '0'; else if (m === 4) els.editBrand.value = 'Zed'; else if (m === 5) els.editName.value = '  new name '; else if (m === 6) els.editUnit.value = 'ml'; break; }
        case 'submit': els.editForm.fire('submit'); break;
        case 'unlinkConfirm': els.unlinkConfirm.fire('click'); break;
        case 'unlinkNo': els.unlinkNo.fire('click'); break;
        case 'unlinkBackdrop': els.dlgUnlink.fire('click', { target: o.b ? els.dlgUnlink : els.unlinkCards }); break;
        case 'relinkConfirm': els.relinkConfirm.fire('click'); break;
        case 'relinkNo': els.relinkNo.fire('click'); break;
        case 'relinkBackdrop': els.dlgRelink.fire('click', { target: o.b ? els.dlgRelink : els.relinkCards }); break;
        case 'confirmDiscard': { const f = pendingDiscard; pendingDiscard = null; if (f) f(); break; }
        case 'undoToast': { const f = lastUndo; lastUndo = null; if (f) f(); break; }
        case 'chain': { const b = [...all].reverse().find((e) => e.classes.has('act')); if (b) b.fire('click'); break; }
        case 'advance': clk.advance(o.ms); break;
        case 'dataX': if (o.b) els.dlgEdit.attrs['data-x'] = '1'; else delete els.dlgEdit.attrs['data-x']; break;
        case 'closing': els.dlgEdit._closing = o.b; els.dlgDesc._closing = !o.b; break;
        case 'replaceItem': if (it) items[o.i % items.length] = { ...it }; break;
        case 'removeItem': if (it && o.b) items.splice(o.i % items.length, 1); break;
        case 'motion': reduced = !reduced; break;
        case 'closeEdit': els.dlgEdit.close(); break;
      }
    } catch (e: any) { log.push('threw ' + String(e && e.message)); }
    log.push('state ' + snap());
  }
  clk.advance(10000);
  if (impl === 'old') {
    // The one deliberate difference: the old code also registered teardownEditSlider as a close listener of the Edit window, but nothing ever
    // created that window's card slider (setupEditSlider was never called), so the listener never did anything. The new module leaves it out.
    const at = log.indexOf('dlgEdit.listen close', log.indexOf('dlgEdit.listen close') + 1);
    if (at < 0 || log.filter((l) => l === 'dlgEdit.listen close').length !== 3) throw new Error('expected the old code to register three close listeners on the Edit window');
    log.splice(at, 1);
  }
  const txt = log.join('\n');
  if (count) {
    if (/dlgDesc\.showModal/.test(txt)) hit('desc opened');
    if (/toast Item updated\.\nsave|dlgDesc\.close\ntoast Item updated\./.test(txt)) hit('desc saved');
    if (/openDiscard/.test(txt)) hit('discard asked');
    if (/descCount\.animate|editQty\.animate/.test(txt)) hit('shake');
    if (/descCount\.toggle full true/.test(txt)) hit('counter full');
    if (/dlgEdit\.showModal/.test(txt)) hit('edit opened');
    if (/ensureOpt editUnit/.test(txt)) hit('unit ensured');
    if (/dlgUnlink\.showModal/.test(txt)) hit('unlink asked');
    if (/unlinkLbl.textContent="Unlink and save"/.test(txt)) hit('unlink unlocked');
    if (/history \[/.test(txt)) hit('edit applied');
    if (/toast Item updated\./.test(txt) && /-- undoToast[\s\S]*render/.test(txt)) hit('undo');
    if (/dlgRelink\.showModal/.test(txt)) hit('relink asked');
    if (/toast Item re-linked\./.test(txt)) hit('relinked');
    if (/descCards\.hidden=false/.test(txt)) hit('cards shown');
    if (/descCards\.hidden=true/.test(txt)) hit('cards hidden');
    if (/\.className="unlinked hovtip cardbrk"/.test(txt)) hit('chain drawn');
    if (/\.listen click\ncreate/.test(txt) || /className="unlinked hovtip cardbrk act"|add act/.test(txt)) hit('chain active');
    if (/ro\.disconnect/.test(txt)) hit('slider torn down');
    if (/suggest\.hide/.test(txt)) hit('suggest hidden');
    if (/dlgEdit\.close\n[\s\S]{0,200}descName/.test(txt)) hit('desc refreshed after edit close');
    if (/threw/.test(txt)) hit('threw');
  }
  return { log, items };
}

describe('the item windows (new itemdialogs.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 1500 random sessions (typing, saving, unlinking, re-linking, undo, timers)', () => {
    const rand = rng(8675309);
    for (const k of Object.keys(seen)) delete seen[k];
    for (let n = 0; n < 1500; n++) {
      const sp = randomSpec(rand), a = run('old', sp, true), b = run('new', sp, false);
      expect(b).toEqual(a);
    }
    for (const k of ['desc opened', 'desc saved', 'discard asked', 'shake', 'counter full', 'edit opened', 'unit ensured', 'unlink asked', 'unlink unlocked', 'edit applied', 'undo', 'relink asked', 'relinked', 'cards shown', 'cards hidden', 'chain drawn', 'slider torn down', 'suggest hidden']) expect([k, (seen[k] || 0) > 30]).toEqual([k, true]);
  }, 120000);
});

// ---- the same windows, with the expected behaviour written out (no old code involved) ----
function mini(items: any[], recipes: any[] = [{ id: 1, name: 'Pasta', portions: 4, items: [] }]) {
  const log: string[] = [], clk = clock();
  const els: Record<string, El> = {};
  for (const id of IDS) els[id] = new El(log, id);
  let created = 0, undo: (() => void) | null = null, discard: (() => void) | null = null;
  g.document = {
    getElementById: (id: string) => els[id] ?? null,
    createElement: (tag: string) => new El(log, tag + '#' + (++created)),
    createDocumentFragment: () => new El(log, 'frag#' + (++created)), createTextNode: (t: string) => new El(log, 'text#' + (++created)),
  };
  g.window = { matchMedia: () => ({ matches: true }) };
  delete g.ResizeObserver;
  g.setTimeout = clk.setTimeout; g.clearTimeout = clk.clear; g.setInterval = clk.setInterval; g.clearInterval = clk.clear;
  let saves = 0, renders = 0; const toasts: string[] = [];
  const api = createItemDialogs({
    get items() { return items; }, get recipes() { return recipes; }, unitHTML: 'U', COOK_HTML: 'C',
    save: () => { saves++; }, render: () => { renders++; }, recordHistory: () => { }, openDiscard: (then) => { discard = then; }, ensureOpt: () => { },
    recipeCardEl: (f) => { const c = g.document.createElement('div'); c.textContent = f.name; return c; },
    makeSuggest: () => ({ hide() { } }), showToast: (m, u) => { toasts.push(m); undo = u || null; },
  });
  return { els, api, clk, toasts, get saves() { return saves; }, get renders() { return renders; }, undo: () => { const f = undo; undo = null; f!(); }, discard: () => discard!, askedDiscard: () => discard !== null };
}
const linked = () => ({ id: 'a', text: 'pasta', qty: 2, unit: 'pcs', done: false, from: [{ id: 1, name: 'Pasta' }], cat: 'Dairy' });

describe('the item windows, behaviour', () => {
  it('saving a description keeps it, says so, and undo puts the old text back', () => {
    const it: any = { ...linked(), desc: 'old' }, m = mini([it]);
    m.api.openDesc(it); m.els.descText.value = '  new note '; m.els.descSave.fire('click');
    expect(it.desc).toBe('new note'); expect(m.toasts).toEqual(['Item updated.']); expect(m.els.dlgDesc.open).toBe(false);
    m.undo(); expect(it.desc).toBe('old');
  });
  it('closing the description asks first only when the text was changed', () => {
    const it: any = { ...linked(), desc: 'old' }, m = mini([it]);
    m.api.openDesc(it); m.api.requestCloseDesc(); expect(m.els.dlgDesc.open).toBe(false); expect(m.askedDiscard()).toBe(false);
    m.api.openDesc(it); m.els.descText.value = 'changed'; m.api.requestCloseDesc();
    expect(m.els.dlgDesc.open).toBe(true); expect(m.askedDiscard()).toBe(true);
    m.discard()(); expect(m.els.dlgDesc.open).toBe(false);
  });
  it('the counter reads n/100 and turns "full" at exactly 100', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openDesc(it);
    m.els.descText.value = 'a'.repeat(99); m.els.descText.fire('input', {}); expect(m.els.descCount.textContent).toBe('99/100'); expect(m.els.descCount.classes.has('full')).toBe(false);
    m.els.descText.value = 'a'.repeat(100); m.els.descText.fire('input', {}); expect(m.els.descCount.textContent).toBe('100/100'); expect(m.els.descCount.classes.has('full')).toBe(true);
  });
  it('changing the amount of a recipe-linked item asks before unlinking, and nothing changes until the 3 seconds are over', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openEdit(it); m.els.editQty.value = '3'; m.els.editForm.fire('submit');
    expect(m.els.dlgUnlink.open).toBe(true); expect(it.qty).toBe(2);
    m.els.unlinkConfirm.fire('click'); expect(m.els.dlgUnlink.open).toBe(true);   // still locked
    m.clk.advance(3000); m.els.unlinkConfirm.fire('click');
    expect(it.qty).toBe(3); expect(it.unlinked).toBe(true); expect(it.orig).toEqual({ qty: 2, unit: 'pcs', text: 'pasta', brand: undefined });
    expect(m.els.dlgEdit.open).toBe(false); expect(m.toasts).toEqual(['Item updated.']);
    m.undo(); expect(it.qty).toBe(2); expect(it.unlinked).toBeFalsy(); expect(it.orig).toBe(undefined);
  });
  it('2 seconds are not enough for the unlink confirmation (boundary)', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openEdit(it); m.els.editQty.value = '3'; m.els.editForm.fire('submit');
    m.clk.advance(2999); m.els.unlinkConfirm.fire('click'); expect(it.qty).toBe(2);
    m.clk.advance(1); m.els.unlinkConfirm.fire('click'); expect(it.qty).toBe(3);
  });
  it('cancelling the unlink question leaves the item alone and the Edit window open', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openEdit(it); m.els.editQty.value = '3'; m.els.editForm.fire('submit'); m.els.unlinkNo.fire('click');
    expect(m.els.dlgUnlink.open).toBe(false); expect(m.els.dlgEdit.open).toBe(true); expect(it.qty).toBe(2); expect(m.saves).toBe(0);
  });
  it('changing only the category (or the brand) of a linked item saves straight away and keeps the link', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openEdit(it); m.els.editCat.value = 'Bakery'; m.els.editBrand.value = ' Barilla '; m.els.editForm.fire('submit');
    expect(m.els.dlgUnlink.open).toBe(false); expect(it.cat).toBe('Bakery'); expect(it.brand).toBe('Barilla'); expect(it.unlinked).toBeFalsy(); expect(m.saves).toBe(1);
  });
  it('saving without a change just closes; an empty name or an invalid amount does not save', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openEdit(it); m.els.editForm.fire('submit'); expect(m.els.dlgEdit.open).toBe(false); expect(m.saves).toBe(0);
    m.api.openEdit(it); m.els.editQty.value = '0'; m.els.editForm.fire('submit'); expect(m.els.dlgEdit.open).toBe(true);
    m.els.editQty.value = '2'; m.els.editName.value = '   '; m.els.editForm.fire('submit'); expect(m.els.dlgEdit.open).toBe(true); expect(m.saves).toBe(0);
  });
  it('an item that is already unlinked is edited without asking, and keeps its first original values', () => {
    const it: any = { ...linked(), unlinked: true, orig: { qty: 5, unit: 'g', text: 'pasta' } }, m = mini([it]);
    m.api.openEdit(it); m.els.editQty.value = '9'; m.els.editForm.fire('submit');
    expect(m.els.dlgUnlink.open).toBe(false); expect(it.qty).toBe(9); expect(it.orig).toEqual({ qty: 5, unit: 'g', text: 'pasta' });
  });
  it('re-linking puts back the original amount and name, and undo unlinks again', () => {
    const it: any = { ...linked(), qty: 9, unlinked: true, orig: { qty: 2, unit: 'g', text: 'penne', brand: 'Barilla' } }, m = mini([it]);
    m.api.openRelink(it); expect(m.els.dlgRelink.open).toBe(true);
    m.els.relinkConfirm.fire('click'); expect(it.qty).toBe(9);          // locked
    m.clk.advance(3000); m.els.relinkConfirm.fire('click');
    expect([it.qty, it.unit, it.text, it.brand, it.unlinked, it.orig]).toEqual([2, 'g', 'penne', 'Barilla', undefined, undefined]);
    expect(m.toasts).toEqual(['Item re-linked.']);
    m.undo(); expect([it.qty, it.unit, it.text, it.unlinked]).toEqual([9, 'pcs', 'pasta', true]); expect(it.orig.text).toBe('penne');
  });
  it('re-linking from the Edit window closes that window; re-linking is refused for items from several recipes or without originals', () => {
    const it: any = { ...linked(), unlinked: true, orig: { qty: 2, unit: 'g' } }, m = mini([it]);
    m.api.openEdit(it); m.api.openRelink(it, true); m.clk.advance(3000); m.els.relinkConfirm.fire('click');
    expect(m.els.dlgEdit.open).toBe(false); expect(it.unlinked).toBeFalsy();
    const multi: any = { ...linked(), from: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], unlinked: true, orig: { qty: 1, unit: 'g' } }, noOrig: any = { ...linked(), unlinked: true };
    const m2 = mini([multi, noOrig]); m2.api.openRelink(multi); m2.api.openRelink(noOrig); expect(m2.els.dlgRelink.open).toBe(false);
  });
  it('the description window shows one card per source recipe, and no cards for an item that is not linked', () => {
    const a: any = { ...linked(), from: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Soup' }] }, b: any = { id: 'b', text: 'tea', qty: 1, unit: 'pcs', done: false }, m = mini([a, b]);
    m.api.openDesc(a); expect(m.els.descCards.hidden).toBe(false); expect(m.els.descCards.children.length).toBe(3);   // label, slider, dots
    m.els.dlgDesc.close(); m.api.openDesc(b); expect(m.els.descCards.hidden).toBe(true);
  });
  it('spaces around the description do not count as a change', () => {
    const it: any = { ...linked(), desc: 'old' }, m = mini([it]);
    m.api.openDesc(it); m.els.descText.value = '  old '; m.api.requestCloseDesc();
    expect(m.els.dlgDesc.open).toBe(false); expect(m.askedDiscard()).toBe(false);
  });
  it('undoing the first description removes the field again instead of leaving it empty', () => {
    const it: any = linked(), m = mini([it]);
    m.api.openDesc(it); m.els.descText.value = 'first'; m.els.descSave.fire('click');
    expect(it.desc).toBe('first'); m.undo(); expect('desc' in it).toBe(false);
  });
  it('an item without a quantity can be opened and closed in the Edit window without a "discard?" question', () => {
    const it: any = { id: 'z', text: 'salt', qty: 0, unit: 'pcs', done: false }, m = mini([it]);
    m.api.openEdit(it); m.api.requestCloseEdit();
    expect(m.askedDiscard()).toBe(false); expect(m.els.dlgEdit.open).toBe(false);
  });
  it('re-linking still works when the item got a manual top-up while the window was open, and undo brings the top-up back', () => {
    const it: any = { ...linked(), qty: 9, unlinked: true, orig: { qty: 2, unit: 'g' } }, m = mini([it]);
    m.api.openRelink(it); it.manual = true; m.clk.advance(3000); m.els.relinkConfirm.fire('click');
    expect(it.manual).toBe(undefined); expect(it.unlinked).toBe(undefined);
    m.undo(); expect(it.manual).toBe(true); expect(it.unlinked).toBe(true);
  });
});
