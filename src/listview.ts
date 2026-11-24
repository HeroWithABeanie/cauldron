// The Shopping list on screen: draws every row (list layout) or tile (grid layout), and animates ticking / unticking
// an item (the row fades out where it was and fades in at its new place while the rest glides into the new order).
import { keyFor } from './rowfx';
import { fullName } from './names';
import { unitLabel } from './units';
import { qtyText, setTileName, fitAll } from './tiles';
import { swipeRow, tileSwipe } from './swipe';
import { nameFrag, isDesk, noMotion, uiLocked, EASE } from './ui';
import { brokenLink, tipButton } from './tips';
import { WARN_SVG, SW_TRASH, chkSvg, chkIn } from './icons';
import { isMulti } from './sorting';
import type { Item, Recipe } from './types';

/**
 * What the list view needs from the app. The state comes through getters (so it is always current); the actions are
 * the app's own functions (late-bound wrappers in app.js, so they may call back into render() without a cycle).
 */
export interface ListViewCtx {
  readonly list: HTMLElement;
  readonly items: Item[];
  readonly recipes: Recipe[];
  readonly layoutMode: string;
  readonly sortMode: string;
  readonly sliding: boolean;
  readonly currentView: string;
  sortedItems(): Item[];
  topLine(it: Item): string | null;
  save(): void;
  syncClear(): void;
  applyListFilter(animate: boolean): void;
  checkedToast(it: Item): void;
  openDesc(it: Item): void;
  openRelink(it: Item): void;
  deleteItem(it: Item, anim?: boolean): void;
}

export interface ListView {
  render(): void;
  /** In ms: redraw with the tick / untick animation. its = the item(s) that moved. Calls in the same window are collected. */
  reorderSoon(ms: number, its: Item | Item[] | null | undefined): void;
}

interface Rel { t: number; l: number; w: number; h: number }
interface OldRow { a: Rel; rt: number; g: string | undefined; el: HTMLElement; chk: boolean }

export function createListView(ctx: ListViewCtx): ListView {
  // ---- Tick / untick: the row fades out where it was and fades in at its new place while the rest of the list glides
  // into the new arrangement. The "Checked off" section grows in (and shrinks away) the same way. ----
  let moveTimer: ReturnType<typeof setTimeout> | null = null, moveKeys: Record<string, number> = {}, moveDone: (() => void) | null = null;
  const MOVE_MS = 480;

  function reorderSoon(ms: number, its: Item | Item[] | null | undefined): void {
    (Array.isArray(its) ? its : [its]).forEach(function (it) { if (it) moveKeys[keyFor(it)] = 1; });
    if (moveTimer) return;
    moveTimer = setTimeout(function () {
      moveTimer = null;
      const keys = moveKeys; moveKeys = {};
      moveAnim(keys);
    }, ms);
  }

  function moveAnim(keys: Record<string, number>): void {
    if (moveDone) moveDone();
    const list = ctx.list;
    const grid = ctx.layoutMode === 'grid' && ctx.items.length > 0;
    if (noMotion() || !list.animate || ctx.sliding || uiLocked || ctx.currentView !== 'list' || Object.keys(keys).length > 8) { render(); return; }
    const lr = list.getBoundingClientRect(), oh = lr.height;
    function rel(r: DOMRect, b: DOMRect): Rel { return { t: r.top - b.top, l: r.left - b.left, w: r.width, h: r.height }; }
    const old: Record<string, OldRow> = {}, olduls: Record<string, { el: HTMLElement; r: Rel }> = {};
    list.querySelectorAll<HTMLElement>('li[data-key]').forEach(function (li) {
      const r = li.getBoundingClientRect();
      if (!r.height) return;
      const ul = li.parentNode as HTMLElement, ur = ul.getBoundingClientRect(), cb = li.querySelector<HTMLInputElement>('input[type=checkbox]');
      old[li.dataset.key as string] = { a: rel(r, lr), rt: r.top - ur.top, g: ul.dataset.g, el: li, chk: !!(cb && cb.checked) };
    });
    if (!grid) list.querySelectorAll<HTMLElement>(':scope > ul').forEach(function (ul) {
      const r = ul.getBoundingClientRect();
      if (r.height) olduls[ul.dataset.g as string] = { el: ul, r: rel(r, lr) };
    });
    render();
    const lr2 = list.getBoundingClientRect(), nh = lr2.height, opt = { duration: 420, easing: EASE };
    const undo: (() => void)[] = [], extra: HTMLElement[] = [], pos = list.style.position;
    list.style.position = 'relative';
    undo.push(function () { list.style.position = pos; });
    // the row as it was stays behind for a moment and fades out; the real row fades in at its new place
    function fadeOutOld(o: OldRow): void {
      const gu = document.createElement('ul'), gl = o.el.cloneNode(true) as HTMLElement, cb = gl.querySelector<HTMLInputElement>('input[type=checkbox]');
      if (cb) cb.checked = o.chk;
      gl.removeAttribute('data-key');
      gu.className = 'ghostrow' + (grid ? ' grid' : ''); gu.setAttribute('aria-hidden', 'true');
      gu.style.cssText = 'left:' + o.a.l + 'px;top:' + o.a.t + 'px;width:' + o.a.w + 'px' + (grid ? ';grid-template-columns:1fr' : '');
      gu.appendChild(gl); extra.push(gu);
      gu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    }
    function fadeInNew(li: HTMLElement): void {
      li.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 460, easing: 'ease-out' });
    }
    const uls: HTMLElement[] = grid ? [] : Array.prototype.slice.call(list.querySelectorAll(':scope > ul')), newGs: Record<string, number> = {};
    uls.forEach(function (ul) {
      const g = ul.dataset.g as string, o = olduls[g], n = rel(ul.getBoundingClientRect(), lr2);
      newGs[g] = 1;
      if (!o) { ul.animate([{ height: '0px', opacity: 0 }, { height: n.h + 'px', opacity: 1 }], opt); return; }
      const dy = o.r.t - n.t;
      if (Math.abs(dy) > .5 || Math.abs(o.r.h - n.h) > .5) ul.animate([{ transform: 'translateY(' + dy + 'px)', height: o.r.h + 'px' }, { transform: 'translateY(0)', height: n.h + 'px' }], opt);
    });
    list.querySelectorAll<HTMLElement>('li[data-key]').forEach(function (li) {
      const k = li.dataset.key as string, o = old[k]; if (!o) return;
      const r = li.getBoundingClientRect(); if (!r.height) return;
      const n = rel(r, lr2), ul = li.parentNode as HTMLElement;
      if (grid) {
        // tiles simply glide to their new place; the moved tile travels above the others
        const dx = o.a.l - n.l, dy = o.a.t - n.t;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        if (keys[k]) { li.style.zIndex = '4'; undo.push(function () { li.style.zIndex = ''; }); }
        li.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], opt);
      } else if (keys[k]) {
        if (Math.abs(o.a.t - n.t) < 1 && Math.abs(o.a.l - n.l) < 1) return;
        fadeOutOld(o); fadeInNew(li);
      } else if (ul.dataset.g === o.g) {
        const ur = ul.getBoundingClientRect(), ry = o.rt - (r.top - ur.top);
        if (Math.abs(ry) > .5) li.animate([{ transform: 'translateY(' + ry + 'px)' }, { transform: 'none' }], opt);
      }
    });
    // a section that is gone fades out where it was
    Object.keys(olduls).forEach(function (g) {
      if (newGs[g]) return;
      const o = olduls[g], cl = o.el.cloneNode(true) as HTMLElement;
      cl.querySelectorAll<HTMLElement>('li').forEach(function (l) { if (keys[l.dataset.key as string]) l.style.visibility = 'hidden'; });
      cl.setAttribute('aria-hidden', 'true');
      cl.style.cssText = 'position:absolute;margin:0;left:' + o.r.l + 'px;top:' + o.r.t + 'px;width:' + o.r.w + 'px;z-index:1;pointer-events:none';
      extra.push(cl);
      cl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' });
    });
    // everything under the list (footer) follows the change in height
    const dh = nh - oh;
    if (Math.abs(dh) > 1) {
      let sib = list.nextElementSibling as HTMLElement | null;
      while (sib) { if (sib.animate) sib.animate([{ transform: 'translateY(' + (-dh) + 'px)' }, { transform: 'none' }], opt); sib = sib.nextElementSibling as HTMLElement | null; }
    }
    extra.forEach(function (e) { list.appendChild(e); });
    let tm: ReturnType<typeof setTimeout> | null = null;
    function finish(): void {
      clearTimeout(tm as ReturnType<typeof setTimeout>);
      extra.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      undo.forEach(function (fn) { fn(); });
      if (moveDone === finish) moveDone = null;
    }
    moveDone = finish;
    tm = setTimeout(finish, MOVE_MS + 50);
  }

  function renderGrid(): void {
    const list = ctx.list;
    const ul = document.createElement('ul'); ul.className = 'grid'; list.appendChild(ul);
    ctx.sortedItems().forEach(function (it) {
      const li = document.createElement('li');
      li.dataset.key = String(keyFor(it)); li.dataset.name = fullName(it).toLowerCase();
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile' + (it.done ? ' done' : '');
      b.setAttribute('aria-label', fullName(it) + (it.qty ? ', ' + qtyText(it) : '') + (it.unlinked ? ' Unlinked from recipe.' : '') + (it.done ? ' Checked off.' : '') + (isDesk() ? ' Click to ' + (it.done ? 'uncheck' : 'check off') + ', right click to open details.' : ' Tap to open details, swipe right to ' + (it.done ? 'uncheck' : 'check off') + ', swipe left to delete.'));
      const tin = document.createElement('span'); tin.className = 'tin';
      const tl = ctx.topLine(it);
      if (tl !== null) { const c = document.createElement('span'); c.className = 'tcat'; c.textContent = tl; tin.appendChild(c); }
      const nw = document.createElement('span'); nw.className = 'tnw';
      const nm = document.createElement('span'); nm.className = 'tname'; setTileName(nm, it.text, it.brand);
      nw.appendChild(nm); tin.appendChild(nw);
      const q = document.createElement('span'); q.className = 'tqty'; q.textContent = qtyText(it); tin.appendChild(q);
      b.appendChild(tin);
      const act = document.createElement('button'); act.type = 'button'; act.className = 'tact'; act.tabIndex = -1;
      act.setAttribute('aria-label', 'Delete ' + it.text); act.innerHTML = SW_TRASH;
      // swipe right: green button on the left edge that checks the item off (or unchecks it)
      const lact = document.createElement('button'); lact.type = 'button'; lact.className = 'tact chk'; lact.tabIndex = -1;
      lact.innerHTML = chkSvg();
      function syncChk(): void {
        lact.setAttribute('aria-label', (it.done ? 'Uncheck ' : 'Check off ') + it.text);
        (lact.firstChild as HTMLElement).innerHTML = chkIn(it.done);
      }
      syncChk();
      function toggleDone(): void {
        it.done = !it.done; ctx.save();
        b.classList.toggle('done', it.done);
        ctx.syncClear(); reorderSoon(500, it);
        setTimeout(syncChk, 330);
        if (it.done) ctx.checkedToast(it);
      }
      const sw = tileSwipe(li, act, tin, function () { ctx.deleteItem(it, true); }, function () {}, { leftAct: lact, onLeft: toggleDone, lock: .3, commit: .75 });
      // phones: tap opens the Edit item window. Computers: left click checks off, right click edits (keyboard activation still edits).
      function tap(mouse: boolean): void {
        if (sw.open) { sw.close(); return; }
        if (mouse && isDesk()) toggleDone(); else ctx.openDesc(it);
      }
      b.addEventListener('click', function (e) { tap(e.detail > 0); });
      li.addEventListener('contextmenu', function (e) { e.preventDefault(); if (isDesk()) ctx.openDesc(it); });
      // mouse and trackpad: the Delete button shows when the pointer is in the top-right corner; a click elsewhere in the corner still checks off the tile
      const zone = document.createElement('div'); zone.className = 'tzone';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'tdel';
      del.setAttribute('aria-label', 'Delete ' + it.text); del.innerHTML = SW_TRASH;
      del.addEventListener('click', function (e) { e.stopPropagation(); ctx.deleteItem(it, true); });
      zone.addEventListener('click', function (e) { if (e.target === zone) tap(true); });
      zone.appendChild(del);
      li.appendChild(b); li.appendChild(act); li.appendChild(lact); li.appendChild(zone);
      if (it.unlinked) li.appendChild(brokenLink('tbrk', (it.orig && it.from && it.from.length === 1 && !isMulti(it)) ? function () { ctx.openRelink(it); } : null, isMulti(it) ? 'Re-linking not possible' : null));
      ul.appendChild(li);
    });
    fitAll();
  }

  function render(): void {
    const list = ctx.list, items = ctx.items, sortMode = ctx.sortMode;
    list.innerHTML = '';
    if (ctx.layoutMode === 'grid' && items.length) { renderGrid(); ctx.syncClear(); ctx.applyListFilter(false); return; }
    const groups: Record<string, HTMLUListElement> = {};
    function groupUl(it: Item): HTMLUListElement {
      const key = it.done ? 'done' : sortMode === 'cat' ? (it.cat ? 'cat' : 'nocat') : sortMode !== 'recipe' ? 'all' : (isMulti(it) ? 'multi' : (it.from && it.from.length === 1 ? 'recipe' : 'manual'));
      if (!groups[key]) { groups[key] = document.createElement('ul'); if (key === 'done') groups[key].className = 'donegrp'; groups[key].dataset.g = key; list.appendChild(groups[key]); }
      return groups[key];
    }
    if (!items.length) {
      const e = document.createElement('li');
      e.className = 'empty';
      e.textContent = 'Your list is empty. Tap \u201cAdd item\u201d to get started.';
      const eu = document.createElement('ul'); eu.appendChild(e); list.appendChild(eu);
    }
    ctx.sortedItems().forEach(function (it) {
      const li = document.createElement('li');
      li.dataset.key = String(keyFor(it));
      li.dataset.name = fullName(it).toLowerCase();
      if (it.done) li.className = 'done';
      const fg = swipeRow(li, function () { ctx.deleteItem(it); }, it.text);
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = it.done; cb.setAttribute('aria-label', 'Mark ' + it.text + ' as bought');
      cb.addEventListener('change', function () {
        it.done = cb.checked; ctx.save();
        li.classList.toggle('done', cb.checked);
        ctx.syncClear(); reorderSoon(500, it);
        if (it.done) ctx.checkedToast(it);
      });
      const span = document.createElement('span');
      span.className = 'name';
      if (it.qty) { const q = document.createElement('strong'); q.className = 'qty'; q.textContent = it.qty + '\u00a0' + unitLabel(it.qty, it.unit) + ' '; span.appendChild(q); }
      span.appendChild(nameFrag(it));
      label.appendChild(cb);
      const txt = document.createElement('span'); txt.className = 'txt';
      if (sortMode === 'recipe' && it.from && it.from.length) {
        const tag = document.createElement('span'); tag.className = 'from';
        const f0 = it.from[0];
        tag.textContent = isMulti(it) ? 'Multiple recipes' : f0.name + (f0.sp ? ', ' + f0.sp + (f0.sp === 1 ? ' portion' : ' portions') : '');
        txt.appendChild(tag);
      } else if (sortMode === 'cat' && it.cat) {
        const ctag = document.createElement('span'); ctag.className = 'from'; ctag.textContent = it.cat;
        txt.appendChild(ctag);
      }
      txt.appendChild(span);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'itembtn';
      edit.setAttribute('aria-label', 'Open ' + it.text);
      edit.addEventListener('click', function (e) { if (e.detail > 0 && isDesk()) return; ctx.openDesc(it); });
      li.addEventListener('contextmenu', function (e) { if (isDesk()) { e.preventDefault(); ctx.openDesc(it); } });
      edit.appendChild(txt);
      fg.appendChild(label); fg.appendChild(edit);
      if (it.unlinked) fg.appendChild(brokenLink('', (it.orig && it.from && it.from.length === 1 && !isMulti(it)) ? function () { ctx.openRelink(it); } : null, isMulti(it) ? 'Re-linking not possible' : null));
      const changed = (it.from || []).some(function (f) {
        const rc = ctx.recipes.find(function (x) { return x.id === f.id; });
        return rc && f.rp !== undefined && rc.portions !== f.rp;
      });
      if (changed) fg.appendChild(tipButton('warn', WARN_SVG, 'Portion size of the original recipe was changed.'));
      fg.finish();
      groupUl(it).appendChild(li);
    });
    ctx.syncClear();
    ctx.applyListFilter(false);
  }

  return { render, reorderSoon };
}
