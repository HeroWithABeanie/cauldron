import { describe, it, expect, afterEach, vi } from 'vitest';
import { createConfirms } from '../src/confirms';
import { makeOldConfirms } from './reference/oldConfirms';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.document; delete g.window; });

function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- a small fake page: elements with classes, attributes, text and listeners; dialogs that open and close ----
class El {
  classes = new Set<string>(); attrs: Record<string, string> = {}; listeners: Record<string, ((e: any) => void)[]> = {};
  textContent = ''; open = false; canAnimate = true;
  constructor(public log: string[], public id: string) {}
  get classList() { const s = this; return { add: (c: string) => { s.classes.add(c); }, remove: (c: string) => { s.classes.delete(c); }, contains: (c: string) => s.classes.has(c) }; }
  get animate(): any { return this.canAnimate ? (kf: unknown, o: unknown) => { this.log.push(this.id + '.animate ' + JSON.stringify([kf, o])); return { cancel: () => { this.log.push(this.id + '.cancel'); } }; } : undefined; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t: string, target: any = this) { (this.listeners[t] || []).slice().forEach((f) => f({ target, preventDefault() {} })); }
  showModal() { this.open = true; this.log.push(this.id + '.showModal'); }
  close() { if (!this.open) return; this.open = false; this.log.push(this.id + '.close'); this.fire('close'); }
  focus(o?: unknown) { this.log.push(this.id + '.focus ' + JSON.stringify(o)); }
}
const IDS: Record<string, string[]> = {
  dlgDelete: ['deleteYes', 'deleteFill', 'deleteLbl', 'deleteName', 'deletePortions', 'deleteMsg', 'deleteCancel', 'deleteClose'],
  dlgDiscard: ['discardYes', 'discardFill', 'discardLbl', 'discardCancel'],
  dlgAddList: ['addListNo', 'addListFill', 'addListLbl', 'addListName', 'addListPortions', 'addListYes'],
  dlgWipe: ['wipeYes', 'wipeFill', 'wipeLbl', 'wipeNo'],
  dlgRemove: ['removeYes', 'removeFill', 'removeLbl', 'removeNo'],
};
// per window: [dialog, the buttons a person can press]
const BUTTONS: Record<string, string[]> = {
  dlgDelete: ['deleteYes', 'deleteCancel', 'deleteClose'], dlgDiscard: ['discardYes', 'discardCancel'], dlgAddList: ['addListNo', 'addListYes'],
  dlgWipe: ['wipeYes', 'wipeNo'], dlgRemove: ['removeYes', 'removeNo'],
};

interface Spec { reduced: boolean; canAnimate: boolean; portions: number[]; listed: number; withItem: boolean; itemQty: number; actions: Act[] }
type Act = { kind: string; k: number; ms: number };
function randomSpec(rand: () => number): Spec {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const kinds = ['openDelete', 'openDiscard', 'openAddList', 'onAddListNo', 'openWipe', 'openRemoveChecked', 'press', 'press', 'press', 'press', 'addYes', 'addYes', 'full', 'full', 'full', 'backdrop', 'inside', 'closeDlg', 'toast', 'wait', 'wait'];
  return {
    reduced: rand() < .15, canAnimate: rand() < .85, portions: [pick([0, 1, 2, 4]), pick([1, 2, 4]), pick([0, 1, 2, 4])], listed: pick([0, 0, 3, 6]), withItem: rand() < .7, itemQty: pick([1.005, 0, 0.004, 2.5]),
    actions: Array.from({ length: 4 + Math.floor(rand() * 14) }, () => ({ kind: pick(kinds), k: Math.floor(rand() * 1000), ms: pick([0, 300, 1100, 2100, 3100, 5100]) })),
  };
}

function run(impl: 'old' | 'new', sp: Spec) {
  vi.useFakeTimers();
  const log: string[] = [];
  g.window = { matchMedia: (q: string) => ({ matches: q.includes('reduce') ? sp.reduced : false }) };
  const els: Record<string, El> = {};
  Object.entries(IDS).forEach(([d, ids]) => [d, ...ids].forEach((id) => { els[id] = new El(log, id); els[id].canAnimate = sp.canAnimate; }));
  g.document = { getElementById: (id: string) => els[id] || null };
  const toasts: (() => void)[] = [];
  const recipes = [{ id: 1, name: 'Stew', portions: sp.portions[0], items: [] }, { id: 2, name: 'Cake', portions: sp.portions[1], items: [] }, { id: 3, name: 'Soup', portions: sp.portions[2], items: [] }];
  const item = { text: 'Milk', qty: sp.itemQty, unit: 'l', cat: 'Dairy', brand: 'Arla' };
  const fn = {
    dismissSearch: () => { log.push('dismissSearch'); }, performDelete: (r: any) => { log.push('performDelete ' + r.id); }, doWipe: () => { log.push('doWipe'); }, removeChecked: () => { log.push('removeChecked'); },
    listedPortions: (r: any) => { log.push('listedPortions ' + r.id); return sp.listed; },
    addToShopping: (list: any, r: any, s: number, partial: boolean) => { log.push('addToShopping ' + JSON.stringify([list, r.id, s, partial])); return () => { log.push('shopUndo'); }; },
    showToast: (msg: string, undo?: (() => void) | null, ms?: number, label?: string) => { log.push('showToast ' + JSON.stringify([msg, !!undo, ms, label])); if (undo) toasts.push(undo); },
    openIngredient: (r: any) => { log.push('openIngredient ' + r.id); },
  };
  const c: any = impl === 'old' ? makeOldConfirms(fn) : createConfirms(fn as any);
  const thens = (k: number) => () => { log.push('discardThen ' + k); };

  const snaps: string[] = [];
  const snap = (label: string) => snaps.push(label + ': ' + Object.keys(IDS).map((d) => {
    const parts = [d + (els[d].open ? ' OPEN' : '') + JSON.stringify(els[d].attrs)];
    IDS[d].forEach((id) => { const e = els[id]; if (e.textContent || e.classes.size || Object.keys(e.attrs).length) parts.push(id + '[' + e.textContent + '|' + [...e.classes].join('.') + '|' + JSON.stringify(e.attrs) + ']'); });
    return parts.join(' ');
  }).join(' // ') + ' || log ' + log.length);

  sp.actions.forEach((a, i) => {
    const r = recipes[a.k % 3], dlgs = Object.keys(IDS), d = dlgs[a.k % dlgs.length];
    if (a.kind === 'openDelete') c.openDelete(r);
    else if (a.kind === 'openDiscard') c.openDiscard(thens(a.k % 5));
    else if (a.kind === 'openAddList') c.openAddList(r, sp.withItem ? item : null);
    else if (a.kind === 'onAddListNo') c.onAddListNo();
    else if (a.kind === 'openWipe') c.openWipe();
    else if (a.kind === 'openRemoveChecked') c.openRemoveChecked();
    else if (a.kind === 'press') { const b = BUTTONS[d][Math.floor(a.k / 7) % BUTTONS[d].length]; els[b].fire('click'); }
    else if (a.kind === 'addYes') els.addListYes.fire('click');
    else if (a.kind === 'full') {   // open a window, wait until its button unlocks, confirm
      const f = a.k % 5;
      if (f === 0) { c.openDelete(r); vi.advanceTimersByTime(5100); els.deleteYes.fire('click'); }
      else if (f === 1) { c.openDiscard(thens(a.k % 5)); vi.advanceTimersByTime(2100); els.discardYes.fire('click'); }
      else if (f === 2) { c.openAddList(r, sp.withItem ? item : null); vi.advanceTimersByTime(2100); els.addListNo.fire('click'); }
      else if (f === 3) { c.openWipe(); vi.advanceTimersByTime(5100); els.wipeYes.fire('click'); }
      else { c.openRemoveChecked(); vi.advanceTimersByTime(3100); els.removeYes.fire('click'); }
    }
    else if (a.kind === 'backdrop') els[d].fire('click', els[d]);
    else if (a.kind === 'inside') els[d].fire('click', els[IDS[d][0]]);
    else if (a.kind === 'closeDlg') els[d].close();
    else if (a.kind === 'toast') { const u = toasts.pop(); if (u) u(); }
    vi.advanceTimersByTime(a.ms);
    snap('action' + i);
  });
  vi.advanceTimersByTime(6000); snap('end');
  vi.useRealTimers();
  return { log, snaps };
}

describe('the five confirmation windows (new confirms.ts vs the old code from app.js)', () => {
  it('behave exactly like the old code in 900 random sequences', () => {
    const rand = rng(777001);
    const seen = { delete: 0, deleteDone: 0, discard: 0, discardDone: 0, addNo: 0, addYes: 0, wipeDone: 0, removeDone: 0, locked: 0, shake: 0, noItem: 0 };
    for (let k = 0; k < 900; k++) {
      const sp = randomSpec(rand), a = run('old', sp), b = run('new', sp);
      expect(b).toEqual(a);
      const s = a.log.join('\n'), all = a.snaps.join('\n');
      if (/dlgDelete\.showModal/.test(s)) seen.delete++;
      if (/performDelete/.test(s)) seen.deleteDone++;
      if (/dlgDiscard\.showModal/.test(s)) seen.discard++;
      if (/discardThen/.test(s)) seen.discardDone++;
      if (/Item added\. Add another/.test(s)) seen.addNo++;
      if (/addToShopping/.test(s)) seen.addYes++;
      if (/doWipe/.test(s)) seen.wipeDone++;
      if (/removeChecked/.test(s)) seen.removeDone++;
      if (/\|locked\|/.test(all)) seen.locked++;
      if (/Label\.animate|Lbl\.animate/.test(s)) seen.shake++;
      if (/addToShopping \[\[\]/.test(s)) seen.noItem++;
    }
    for (const [k, v] of Object.entries(seen)) expect([k, v > 25]).toEqual([k, true]);
  }, 60000);

  // ---- readable examples (all with the new code) ----
  const setup = (reduced = true) => {
    const log: string[] = [], els: Record<string, El> = {};
    g.window = { matchMedia: () => ({ matches: reduced }) };
    Object.entries(IDS).forEach(([d, ids]) => [d, ...ids].forEach((id) => { els[id] = new El(log, id); }));
    g.document = { getElementById: (id: string) => els[id] };
    const toasts: any[] = [];
    const calls: string[] = [];
    const c = createConfirms({
      dismissSearch: () => { calls.push('dismissSearch'); }, performDelete: (r) => { calls.push('performDelete ' + r.id); }, doWipe: () => { calls.push('doWipe'); }, removeChecked: () => { calls.push('removeChecked'); },
      listedPortions: () => 0, addToShopping: (list, r, sp) => { calls.push('addToShopping ' + JSON.stringify(list) + ' ' + sp); return () => {}; },
      showToast: (msg, undo, ms, label) => { calls.push('toast ' + msg + ' ' + ms + ' ' + label); toasts.push(undo); }, openIngredient: (r) => { calls.push('openIngredient ' + r.id); },
    });
    return { els, c, calls, log, toasts };
  };
  const stew = { id: 7, name: 'Stew', portions: 1, items: [] };

  it('delete: the Yes button stays locked for 5 seconds, then deletes the recipe and clears the search', () => {
    vi.useFakeTimers();
    const { els, c, calls } = setup();
    c.openDelete(stew);
    expect(els.dlgDelete.open).toBe(true);
    expect(els.deleteName.textContent).toBe('Stew');
    expect(els.deletePortions.textContent).toBe('up to 1 portion');
    expect(els.deleteMsg.textContent).toBe('Delete this recipe and all of its ingredients?');
    els.deleteYes.fire('click'); expect(calls).toEqual([]); expect(els.dlgDelete.open).toBe(true);
    vi.advanceTimersByTime(5000);
    els.deleteYes.fire('click');
    expect(calls).toEqual(['dismissSearch', 'performDelete 7']);
    expect(els.dlgDelete.open).toBe(false);
    els.deleteYes.fire('click'); expect(calls.length).toBe(2);   // a second press does nothing
  });
  it('delete: Cancel, the close button and a click on the backdrop close it without deleting', () => {
    for (const how of ['deleteCancel', 'deleteClose', 'backdrop']) {
      vi.useFakeTimers();
      const { els, c, calls } = setup(); c.openDelete({ ...stew, portions: 4 });
      expect(els.deletePortions.textContent).toBe('up to 4 portions');
      if (how === 'backdrop') els.dlgDelete.fire('click', els.dlgDelete); else els[how].fire('click');
      expect(els.dlgDelete.open).toBe(false); expect(calls).toEqual([]);
      vi.useRealTimers();
    }
  });
  it('a click inside the window does not close it', () => {
    vi.useFakeTimers();
    const { els, c } = setup(); c.openDelete(stew);
    els.dlgDelete.fire('click', els.deleteMsg);
    expect(els.dlgDelete.open).toBe(true);
  });
  it('discard: runs what the caller asked for after 2 seconds, again on every later confirmation', () => {
    vi.useFakeTimers();
    const { els, c } = setup(); const ran: string[] = [];
    c.openDiscard(() => ran.push('first'));
    els.discardYes.fire('click'); expect(ran).toEqual([]);
    vi.advanceTimersByTime(2000); els.discardYes.fire('click');
    expect(ran).toEqual(['first']); expect(els.dlgDiscard.open).toBe(false);
    c.openDiscard(() => ran.push('second')); vi.advanceTimersByTime(2000); els.discardYes.fire('click');
    expect(ran).toEqual(['first', 'second']);
  });
  it('add to list, Yes: adds the missing ingredient scaled to the listed portions and offers an undo', () => {
    vi.useFakeTimers();
    const { els, c, calls } = setup();
    c.openAddList({ id: 1, name: 'Cake', portions: 4, items: [] }, { text: 'Milk', qty: 1.5, unit: 'l' });
    expect(els.addListName.textContent).toBe('Cake');
    els.addListYes.fire('click');
    expect(calls[0]).toBe('addToShopping [{"text":"Milk","qty":1.5,"unit":"l"}] 4');
    expect(calls[1]).toBe('toast Item added to Shopping list. 7000 undefined');
    expect(els.dlgAddList.open).toBe(false);
  });
  it('add to list, Yes: the quantity never drops below 0.01, and a recipe without portions does not divide by zero', () => {
    vi.useFakeTimers();
    const a = setup();
    a.c.openAddList({ id: 1, name: 'Cake', portions: 4, items: [] }, { text: 'Salt', qty: 0.004, unit: 'g' });
    a.els.addListYes.fire('click');
    expect(a.calls[0]).toBe('addToShopping [{"text":"Salt","qty":0.01,"unit":"g"}] 4');
    const b = setup();
    b.c.openAddList({ id: 2, name: 'Plain', portions: 0, items: [] }, { text: 'Rice', qty: 3, unit: 'g' });
    b.els.addListYes.fire('click');
    expect(b.calls[0]).toBe('addToShopping [{"text":"Rice","qty":0.01,"unit":"g"}] 0');   // 0 portions: the factor is 0 / 1 = 0 (not 0 / 0 = NaN), so the quantity is the 0.01 minimum
  });
  it('add to list, No (after 2 seconds, or the backdrop): offers to add another ingredient', () => {
    vi.useFakeTimers();
    const { els, c, calls, toasts } = setup();
    c.openAddList(stew, null);
    els.addListNo.fire('click'); expect(calls).toEqual([]);   // still locked
    vi.advanceTimersByTime(2000); els.addListNo.fire('click');
    expect(calls).toEqual(['toast Item added. Add another? 7000 Yes']);
    toasts[0](); expect(calls[1]).toBe('openIngredient 7');
  });
  it('clear list and remove checked: locked for 5 and 3 seconds, No closes at once', () => {
    vi.useFakeTimers();
    const { els, c, calls } = setup();
    c.openWipe(); els.wipeYes.fire('click'); expect(calls).toEqual([]); vi.advanceTimersByTime(5000); els.wipeYes.fire('click');
    c.openRemoveChecked(); vi.advanceTimersByTime(2999); els.removeYes.fire('click'); expect(calls).toEqual(['doWipe']);
    vi.advanceTimersByTime(1); els.removeYes.fire('click'); expect(calls).toEqual(['doWipe', 'removeChecked']);
    c.openRemoveChecked(); els.removeNo.fire('click'); expect(els.dlgRemove.open).toBe(false);
  });
});
