// Adding items: the Add item form (it merges with an item of the same name and a convertible unit, or adds a new one), the window for
// "the name is already on the list, but its unit cannot be converted", and the item history that suggestions and categories come from.
// The code is the code that used to be in app.js (step 1c-7b); only the typing is new.
import { uid } from './names';
import { unitLabel, convertQty } from './units';
import { nameFrag } from './ui';
import type { Item, HistoryEntry, Unit } from './types';

/** What the Add item form needs from the app. */
export interface AddingCtx {
  /** The Shopping list and the history are only ever changed in place (see store.setList), so they can be passed directly. */
  readonly items: Item[];
  readonly itemHistory: HistoryEntry[];
  readonly input: HTMLInputElement;
  /** These two are made later in app.js than this module, so they are read when needed. */
  readonly dlgItem: HTMLDialogElement;
  readonly addSuggest: { hide: () => void };
  save(): void;
  saveHist(): void;
  render(): void;
  withAnim(kind: string, fn: () => void, lock?: boolean): void;
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void;
  openItemDialog(): void;
  openDesc(it: Item): void;
}

export interface Adding {
  /** Remembers what was added or used, newest first, at most 500 names. */
  recordHistory(entries: { text?: string; unit?: Unit; cat?: string }[]): void;
}

export function createAdding(ctx: AddingCtx): Adding {
  const items = ctx.items, itemHistory = ctx.itemHistory, input = ctx.input, save = ctx.save, saveHist = ctx.saveHist, render = ctx.render, withAnim = ctx.withAnim, showToast = ctx.showToast;
  const byId = function (id: string): HTMLInputElement { return document.getElementById(id) as HTMLInputElement; };

  function recordHistory(entries: { text?: string; unit?: Unit; cat?: string }[]): void {
    const now = Date.now();
    entries.forEach(function (e) {
      if (!e || !e.text) return;
      const name = e.text.trim(), k = name.toLowerCase();
      const h = itemHistory.find(function (x) { return x.text.toLowerCase() === k; });
      if (h) { h.text = name; if (e.unit) h.unit = e.unit; if (e.cat) h.cat = e.cat; h.last = now; }
      else itemHistory.push({ text: name, unit: e.unit || '', cat: e.cat || '', last: now });
    });
    if (itemHistory.length > 500) { itemHistory.sort(function (a, b) { return b.last - a.last; }); itemHistory.length = 500; }
    saveHist();
  }

  function commitAdd(t: string, qty: number, unit: Unit, cat: string, m: Item | null, brand: string): void {
    const qtyEl = byId('qty'), unitEl = byId('unit'), catEl = byId('addCat');
    if (m) {
      if (m.from && m.from.length && !m.unlinked) m.orig = { qty: m.qty, unit: m.unit };
      m.qty = Math.round(((m.qty || 0) + (convertQty(qty, unit, m.unit) as number)) * 100) / 100;
      if (m.from && m.from.length) { m.unlinked = true; m.manual = true; }
      if (cat && !m.cat) m.cat = cat;
    } else {
      const n: Item = { id: uid(), text: t, qty: qty, unit: unit, done: false };
      if (brand) n.brand = brand;
      if (cat) n.cat = cat;
      items.push(n);
    }
    recordHistory([{ text: t, unit: unit, cat: cat }]);
    qtyEl.value = ''; unitEl.value = 'pcs'; input.value = ''; catEl.value = ''; byId('brand').value = '';
    ctx.addSuggest.hide();
    save();
    ctx.dlgItem.close();
    setTimeout(function () { withAnim('list', render); }, 340);
    showToast('Item added. Add another?', ctx.openItemDialog, 7000, 'Yes');
  }
  byId('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const qtyEl = byId('qty'), unitEl = byId('unit');
    const t = input.value.trim(), qty = parseFloat(qtyEl.value), catEl = byId('addCat'), cat = catEl.value;
    if (!t || !(qty > 0) || !unitEl.value) return;
    const brand = byId('brand').value.trim(), unit = unitEl.value, m = items.find(function (x) { return !x.done && x.text.toLowerCase() === t.toLowerCase() && (x.brand || '').toLowerCase() === brand.toLowerCase() && convertQty(qty, unit, x.unit) !== null; }) || null;
    if (!m) {
      const c = items.find(function (x) { return !x.done && x.text.toLowerCase() === t.toLowerCase() && (x.brand || '').toLowerCase() === brand.toLowerCase(); });
      if (c) { openConflict(c, { t: t, qty: qty, unit: unit, cat: cat, brand: brand }); return; }
    }
    commitAdd(t, qty, unit, cat, m, brand);
  });
  // ---- Conflicting units: the name is already on the list, but its unit cannot be converted ----
  interface Pending { t: string; qty: number; unit: Unit; cat: string; brand: string }
  const dlgConflict = byId('dlgConflict') as unknown as HTMLDialogElement;
  let cfPending: Pending | null = null, cfExisting: Item | null = null;
  function cfRow(id: string, it: { text: string; brand?: string; qty: number; unit: Unit }): void {
    const ul = byId(id); ul.innerHTML = '';
    const li = document.createElement('li'), span = document.createElement('span'); span.className = 'name';
    const q = document.createElement('strong'); q.className = 'qty';
    q.textContent = it.qty + '\u00a0' + unitLabel(it.qty, it.unit) + ' ';
    span.appendChild(q); span.appendChild(nameFrag(it));
    li.appendChild(span); ul.appendChild(li);
  }
  function openConflict(ex: Item, p: Pending): void {
    cfExisting = ex; cfPending = p;
    cfRow('cfExisting', ex);
    cfRow('cfNew', { text: p.t, brand: p.brand, qty: p.qty, unit: p.unit });
    dlgConflict.showModal();
    dlgConflict.setAttribute('tabindex', '-1');
    dlgConflict.focus({ preventScroll: true });
  }
  byId('cfSeparate').addEventListener('click', function () {
    const p = cfPending; cfPending = null; if (!p) return;
    dlgConflict.close();
    commitAdd(p.t, p.qty, p.unit, p.cat, null, p.brand);
  });
  byId('cfMerge').addEventListener('click', function () {
    const ex = cfExisting; cfPending = null;
    dlgConflict.close(); ctx.dlgItem.close();
    byId('qty').value = ''; byId('unit').value = 'pcs';
    input.value = ''; byId('addCat').value = ''; byId('brand').value = ''; ctx.addSuggest.hide();
    if (ex) ctx.openDesc(ex);
  });
  byId('cfCancel').addEventListener('click', function () { cfPending = null; dlgConflict.close(); });
  dlgConflict.addEventListener('click', function (ev) { if (ev.target === dlgConflict) { cfPending = null; dlgConflict.close(); } });

  return { recordHistory };
}
