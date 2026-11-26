// The windows that belong to one recipe: "Add ingredient", "Add to Shopping list" (with its portions picker and preview) and
// "Change name / portions", plus addToShopping, which puts ingredients on the list and gives back the undo. The code is what used
// to be in app.js. items is the one shared list array (it is only ever changed in place), so it comes in as it is.
import * as store from './store';
import { uid, fullName } from './names';
import { unitLabel, convertQty, scaleQty } from './units';
import { nameFrag } from './ui';
import { CAT_HTML } from './categories';
import type { Item, Recipe, RecipeItem } from './types';

type NewItem = { text: string; brand?: string; qty: number; unit: string; cat?: string };

export interface RecipeDialogsCtx {
  readonly items: Item[];
  save(): void;
  saveR(): void;
  render(): void;
  renderRecipes(): void;
  recordHistory(entries: { text: string; unit: string; cat?: string }[]): void;
  dismissSearch(): void;
  /** Asks "Discard changes?"; `then` runs when it is confirmed. */
  openDiscard(then: () => void): void;
  /** The "add to the Shopping list?" question after an ingredient was added to a recipe that is already on the list. */
  openAddList(r: Recipe, item: RecipeItem | null): void;
  ensureOpt(sel: HTMLSelectElement, v: unknown): void;
  linkedToRecipe(r: Recipe): boolean;
  listedPortions(r: Recipe): number;
  makeSuggest(inp: HTMLInputElement, box: HTMLElement, unitSel: unknown, qtySel: { value: unknown; focus?: () => void }, catSel: { value: string } | null): { hide: () => void };
  /** Comes in through here because toast.ts touches the page when it is imported. */
  showToast(msg: string, undo?: (() => void) | null, ms?: number, label?: string): void;
  /** The list of the Recipes view's ingredients window, which scrolls to the new ingredient. */
  readonly viewList: HTMLElement;
  /** The unit list of the Add item window, and the cooking units that follow it. */
  readonly unitHTML: string;
  readonly COOK_HTML: string;
}

export interface RecipeDialogs {
  openIngredient(r: Recipe): void;
  openShop(r: Recipe): void;
  openChange(r: Recipe): void;
  /** What Esc / a swipe down runs for the Change window: ask first when something was changed. */
  requestCloseChange(): void;
  /** Puts ingredients on the Shopping list (merging with what is there); returns the function that undoes it. */
  addToShopping(list: NewItem[], src: Recipe | null, sp: number, partial?: boolean): () => void;
}

type Dlg = HTMLDialogElement & { _closing?: boolean };
interface ShopRow { it: RecipeItem; cb: HTMLInputElement; q: HTMLElement }

export function createRecipeDialogs(ctx: RecipeDialogsCtx): RecipeDialogs {
  const el = function (id: string): HTMLElement { return document.getElementById(id) as HTMLElement; };
  const items = ctx.items;

  // ---- Put ingredients on the Shopping list ----
  function addToShopping(list: NewItem[], src: Recipe | null, sp: number, partial?: boolean): () => void {
    const undo: (() => void)[] = [];
    list.forEach(function (it) {
      const nm = fullName(it).toLowerCase();
      // 1) a linked item with the same unit; 2) an item that was unlinked (by editing or by a manual top-up) but still lists its
      // recipes (units must be convertible).
      const m = items.find(function (x) { return !x.done && !x.unlinked && x.unit === it.unit && fullName(x).toLowerCase() === nm; }) ||
        items.find(function (x) { return !x.done && !!x.unlinked && !!x.from && x.from.length > 0 && fullName(x).toLowerCase() === nm && convertQty(it.qty, it.unit, x.unit) !== null; });
      if (m) {
        const prevFrom = m.from ? m.from.map(function (f) { return Object.assign({}, f); }) : null, prevUnl = m.unlinked, prevMan = m.manual;
        const add = m.unit === it.unit ? it.qty : Math.round((convertQty(it.qty, it.unit, m.unit) as number) * 100) / 100;
        m.qty = Math.round(((m.qty || 0) + add) * 100) / 100;
        if (!m.cat && it.cat) m.cat = it.cat;
        if (src) {
          m.from = m.from || [];
          const ex = m.from.find(function (f) { return f.id === src.id; });
          if (!ex) m.from.push({ id: src.id, name: src.name, rp: src.portions, sp: sp });
          // the same recipe added again: its portions add up, so the label matches the quantity (not when only a single new ingredient is topped up)
          else if (!partial && ex.sp && sp) ex.sp += sp;
          // an item that was added manually first: the recipe is merged in, the link is broken, and it counts as several sources
          if (!prevFrom) { m.unlinked = true; m.manual = true; }
        }
        undo.push(function () {
          m.qty = Math.round(((m.qty || 0) - add) * 100) / 100;
          if (prevFrom) m.from = prevFrom; else delete m.from;
          if (prevUnl) m.unlinked = prevUnl; else delete m.unlinked;
          if (prevMan) m.manual = prevMan; else delete m.manual;
        });
      } else {
        const n: Item = { id: uid(), text: it.text, qty: it.qty, unit: it.unit, done: false };
        if (it.brand) n.brand = it.brand;
        if (it.cat) n.cat = it.cat;
        if (src) n.from = [{ id: src.id, name: src.name, rp: src.portions, sp: sp }];
        items.push(n);
        undo.push(function () { store.setList('items', items.filter(function (x) { return x !== n; })); });
      }
    });
    ctx.recordHistory(list);
    ctx.save(); ctx.render();
    return function () {
      undo.reverse().forEach(function (fn) { fn(); });
      ctx.save(); ctx.render();
    };
  }

  // ---- Add ingredient ----
  const dlg = el('dlg') as Dlg,
    ingRecipeName = el('ingRecipeName');
  let ingTarget: Recipe | null = null;
  const ingQty = el('ingQty') as HTMLInputElement,
    ingUnit = el('ingUnit') as HTMLSelectElement,
    ingName = el('ingName') as HTMLInputElement,
    ingCat = el('ingCat') as HTMLSelectElement,
    ingBrand = el('ingBrand') as HTMLInputElement;
  ingCat.innerHTML = CAT_HTML;
  const COOK: Record<string, number> = { tsp: 1, tbsp: 1, pinch: 1 };
  ingUnit.innerHTML = ctx.unitHTML + ctx.COOK_HTML;
  ingUnit.value = 'pcs';
  function openIngredient(r: Recipe): void {
    ingTarget = r;
    ingRecipeName.textContent = r.name;
    el('ingPortionsInfo').textContent = 'up to ' + r.portions + (r.portions === 1 ? ' portion' : ' portions');
    dlg.showModal();
    dlg.setAttribute('tabindex', '-1');
    dlg.focus({ preventScroll: true });
  }
  el('dlgClose').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
  el('ingForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const r = ingTarget;
    const t = ingName.value.trim(), qty = parseFloat(ingQty.value);
    if (!r || !t || !(qty > 0) || !ingUnit.value) return;
    ctx.dismissSearch();
    const added: RecipeItem = { text: t, qty: qty, unit: ingUnit.value };
    if (ingBrand.value.trim()) added.brand = ingBrand.value.trim();
    if (ingCat.value) added.cat = ingCat.value;
    r.items.push(added);
    ctx.recordHistory([added]);
    ctx.saveR(); ctx.renderRecipes();
    ctx.viewList.scrollTop = ctx.viewList.scrollHeight;
    ingQty.value = ''; ingUnit.value = 'pcs'; ingName.value = ''; ingCat.value = ''; ingBrand.value = '';
    recipeSuggest.hide();
    dlg.close();
    if (ctx.linkedToRecipe(r)) ctx.openAddList(r, added);
    else ctx.showToast('Item added. Add another?', function () { openIngredient(r); }, 7000, 'Yes');
  });

  // ---- Add recipe to the Shopping list ----
  const dlgShop = el('dlgShop') as HTMLDialogElement, shopPortions = el('shopPortions') as HTMLSelectElement;
  let shopTarget: { r: Recipe } | null = null;
  let shopRows: ShopRow[] = [];
  function renderPreviewQty(): void {
    const r = shopTarget && shopTarget.r; if (!r) return;
    const f = (parseInt(shopPortions.value, 10) || r.portions) / r.portions;
    shopRows.forEach(function (x) {
      const n = scaleQty(x.it.qty, f);
      x.q.textContent = n + '\u00a0' + unitLabel(n, x.it.unit) + ' ';
    });
  }
  function updateShopBtn(): void {
    (el('shopSubmit') as HTMLButtonElement).disabled = !shopRows.some(function (x) { return x.cb.checked; });
  }
  function openShop(r: Recipe): void {
    shopTarget = { r: r };
    el('shopRecipe').textContent = r.name;
    el('shopPortionsInfo').textContent = 'up to ' + r.portions + (r.portions === 1 ? ' portion' : ' portions');
    ctx.ensureOpt(shopPortions, r.portions);
    shopPortions.value = String(r.portions);
    const pv = el('shopPreview');
    pv.innerHTML = '';
    // recipe already on the list: warn, and mark ingredients that are not on the list yet (skipped last time) and tick them
    const onList = ctx.linkedToRecipe(r), lp = ctx.listedPortions(r), have: Record<string, number> = {};
    if (onList) items.forEach(function (x) { if ((x.from || []).some(function (f) { return f.id === r.id; })) have[fullName(x).toLowerCase()] = 1; });
    el('shopWarn').hidden = !onList;
    if (onList) el('shopWarnText').textContent = 'This recipe is already on your list' + (lp ? ' for ' + lp + (lp === 1 ? ' portion' : ' portions') : '') + '.';
    shopRows = r.items.map(function (it) {
      const li = document.createElement('li');
      const lab = document.createElement('label'); lab.className = 'pvrow';
      const skipped = onList && !have[fullName(it).toLowerCase()];
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = skipped ? true : !COOK[it.unit];
      cb.addEventListener('change', updateShopBtn);
      const span = document.createElement('span'); span.className = 'name';
      const q = document.createElement('strong'); q.className = 'qty';
      span.appendChild(q); span.appendChild(nameFrag(it));
      lab.appendChild(cb);
      if (skipped) {
        const wrap = document.createElement('span'); wrap.className = 'txt'; wrap.appendChild(span);
        const hint = document.createElement('span'); hint.className = 'pvhint';
        hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>Not added last time';
        wrap.appendChild(hint); lab.appendChild(wrap);
      } else lab.appendChild(span);
      li.appendChild(lab); pv.appendChild(li);
      return { it: it, cb: cb, q: q };
    });
    renderPreviewQty(); updateShopBtn();
    dlgShop.showModal();
    dlgShop.setAttribute('tabindex', '-1');
    dlgShop.focus({ preventScroll: true });
    pv.style.maxHeight = ''; pv.style.overflowY = '';
    const rows = pv.children;
    if (rows.length >= 4) {
      // from 4 ingredients on the list scrolls and is capped at 3 and a half single-line rows (measured with a probe row,
      // so wrapped names or hints never change the window size)
      const probe = document.createElement('li'), pl = document.createElement('label'), pc = document.createElement('input'), ps = document.createElement('span'), pq = document.createElement('strong');
      pl.className = 'pvrow'; pc.type = 'checkbox'; ps.className = 'name'; pq.className = 'qty'; pq.textContent = '1\u00a0g ';
      ps.appendChild(pq); ps.appendChild(document.createTextNode('Ag')); pl.appendChild(pc); pl.appendChild(ps); probe.appendChild(pl);
      pv.appendChild(probe);
      const rowH = probe.offsetHeight + (parseFloat(getComputedStyle(rows[0]).borderBottomWidth) || 0);
      pv.removeChild(probe);
      pv.style.maxHeight = Math.round(rowH * 3.5 + 3) + 'px';
      pv.style.overflowY = 'auto';
    }
    pv.scrollTop = 0;
  }
  el('dlgShopClose').addEventListener('click', function () { dlgShop.close(); });
  dlgShop.addEventListener('click', function (ev) { if (ev.target === dlgShop) dlgShop.close(); });
  el('shopForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const r = (shopTarget as { r: Recipe }).r, want = parseInt(shopPortions.value, 10);
    if (!(want > 0)) return;
    const f = want / r.portions;
    const picked = shopRows.filter(function (x) { return x.cb.checked; }).map(function (x) { return x.it; });
    if (!picked.length) return;
    ctx.dismissSearch();
    const undo = addToShopping(picked.map(function (it) {
      return { text: it.text, brand: it.brand, qty: scaleQty(it.qty, f), unit: it.unit, cat: it.cat };
    }), r, want);
    dlgShop.close();
    ctx.showToast('Ingredients for ' + r.name + ' added to list', undo);
  });

  // ---- Change recipe name / portions ----
  const dlgChange = el('dlgChange') as Dlg,
    changeName = el('changeName') as HTMLInputElement,
    changePortions = el('changePortions') as HTMLSelectElement;
  let changeTarget: Recipe | null = null;
  function openChange(r: Recipe): void {
    changeTarget = r;
    changeName.value = r.name;
    ctx.ensureOpt(changePortions, r.portions || 4);
    changePortions.value = String(r.portions || 4);
    dlgChange.showModal();
    dlgChange.setAttribute('tabindex', '-1');
    dlgChange.focus({ preventScroll: true });
  }
  // Closing the window without saving asks first when the name or the portions were changed (same as the Edit item window).
  function changeDirty(): boolean {
    const r = changeTarget;
    return !!r && (changeName.value.trim() !== r.name || parseInt(changePortions.value, 10) !== (r.portions || 4));
  }
  function requestCloseChange(): void {
    if (dlgChange._closing) return;
    if (changeDirty()) { ctx.openDiscard(function () { dlgChange.close(); }); }
    else dlgChange.close();
  }
  el('dlgChangeClose').addEventListener('click', requestCloseChange);
  dlgChange.addEventListener('click', function (ev) { if (ev.target === dlgChange) requestCloseChange(); });
  el('changeForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const r = changeTarget, t = changeName.value.trim(), p = parseInt(changePortions.value, 10);
    if (!r || !t || !(p > 0)) return;
    if (t === r.name && p === r.portions) { dlgChange.close(); return; }
    ctx.dismissSearch();
    const prev = { name: r.name, portions: r.portions };
    const rec: Recipe = r;   // (a copy that is known not to be null inside the function below)
    function rename(n: string): void { items.forEach(function (it) { (it.from || []).forEach(function (f) { if (f.id === rec.id) f.name = n; }); }); }
    r.name = t; r.portions = p; rename(t);
    ctx.saveR(); ctx.save(); ctx.renderRecipes(); ctx.render();
    dlgChange.close();
    ctx.showToast('Recipe updated.', function () {
      r.name = prev.name; r.portions = prev.portions; rename(prev.name);
      ctx.saveR(); ctx.save(); ctx.renderRecipes(); ctx.render();
    });
  });

  // ---- Registered last, in the order the old code did: the name suggestions of the Add ingredient window, what closing it throws away,
  // and the portions picker of the shop window ----
  const recipeSuggest = ctx.makeSuggest(ingName, el('suggestR'), ingUnit, ingQty, ingCat);
  // Closing (or dismissing) an Add item window throws away whatever was typed.
  dlg.addEventListener('close', function () {
    ingQty.value = ''; ingUnit.value = 'pcs'; ingName.value = ''; ingCat.value = ''; ingBrand.value = '';
    recipeSuggest.hide();
  });
  shopPortions.addEventListener('change', renderPreviewQty);

  return { openIngredient: openIngredient, openShop: openShop, openChange: openChange, requestCloseChange: requestCloseChange, addToShopping: addToShopping };
}
