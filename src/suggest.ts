import type { Item, Recipe, HistoryEntry } from './types';

export interface Candidate { name: string; src: 'list' | 'recipe' | 'history'; unit?: string; cat?: string }

/**
 * Names matching q (already trimmed and lower-cased) from the list, the recipes and the history.
 * A name found on the list wins over the same name elsewhere; names starting with q come first, then A to Z.
 */
export function nameCandidates(q: string, limit: number | undefined, items: Item[], recipes: Recipe[], history: HistoryEntry[]): Candidate[] {
  const map: Record<string, Candidate> = {};
  function add(name: string, src: Candidate['src'], unit?: string, cat?: string): void {
    const k = name.toLowerCase();
    if (!map[k] || (src === 'list' && map[k].src !== 'list')) map[k] = { name: name, src: src, unit: unit, cat: cat };
  }
  items.forEach(function (it) { add(it.text, 'list', it.unit, it.cat); });
  recipes.forEach(function (r) { r.items.forEach(function (it) { add(it.text, 'recipe', it.unit, it.cat); }); });
  history.forEach(function (h) { add(h.text, 'history', h.unit, h.cat); });
  const out = Object.keys(map).map(function (k) { return map[k]; }).filter(function (c) { return c.name.toLowerCase().indexOf(q) > -1; });
  out.sort(function (a, b) {
    const as = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1, bs = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
    return as - bs || a.name.localeCompare(b.name);
  });
  return limit ? out.slice(0, limit) : out;
}

type SuggestButton = HTMLButtonElement & { _x: Candidate };

/**
 * Name suggestions under a text field. Picking one fills the name, fills the category when it is still empty and
 * moves on to the quantity when that is empty. unitSel is accepted for the existing call sites but not used.
 */
export function makeSuggest(
  inp: HTMLInputElement, box: HTMLElement, _unitSel: unknown,
  qtySel: { value: unknown; focus?: () => void }, catSel: { value: string } | null,
  candidates: (q: string) => Candidate[]
): { hide: () => void } {
  let idx = -1;
  function hide(): void { box.hidden = true; box.innerHTML = ''; idx = -1; (inp.parentNode as HTMLElement).classList.remove('sugopen'); }
  function pick(x: Candidate): void {
    inp.value = x.name;
    if (catSel && !catSel.value && x.cat) catSel.value = x.cat;
    hide();
    if (!qtySel.value && qtySel.focus) qtySel.focus();
  }
  function show(): void {
    const q = inp.value.trim().toLowerCase();
    if (!q) { hide(); return; }
    const c = candidates(q);
    if (!c.length) { hide(); return; }
    box.innerHTML = ''; idx = -1;
    c.forEach(function (x) {
      const b = document.createElement('button') as SuggestButton; b.type = 'button'; b.className = 'sopt'; b.setAttribute('role', 'option');
      const s = document.createElement('span'); s.textContent = x.name;
      const sm = document.createElement('small'); sm.textContent = x.src === 'list' ? 'On your list' : x.src === 'recipe' ? 'In a recipe' : 'From history';
      b.appendChild(s); b.appendChild(sm);
      b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      b.addEventListener('click', function () { pick(x); });
      b._x = x;
      box.appendChild(b);
    });
    box.hidden = false;
    (inp.parentNode as HTMLElement).classList.add('sugopen');
    fit();
  }
  // The list may be as long as the screen allows (above the keyboard when it is open); beyond that it scrolls.
  function fit(): void {
    if (box.hidden) return;
    const v = window.visualViewport, bottom = v ? v.offsetTop + v.height : window.innerHeight;
    const kbOpen = v && (window.innerHeight - (v.height + v.offsetTop)) > 80;
    const top = box.getBoundingClientRect().top;
    box.style.maxHeight = Math.max(120, bottom - top - (kbOpen ? 60 : 12)) + 'px';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit);
    window.visualViewport.addEventListener('scroll', fit);
  }
  window.addEventListener('resize', fit);
  const clr = (inp.parentNode as HTMLElement).querySelector('.inclear');
  if (clr) {
    clr.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    clr.addEventListener('click', function () { hide(); inp.focus(); });
  }
  function move(step: number): void {
    const opts = box.querySelectorAll('.sopt');
    if (!opts.length) return;
    idx = (idx + step + opts.length) % opts.length;
    opts.forEach(function (o, i) { o.classList.toggle('on', i === idx); });
  }
  inp.addEventListener('input', show);
  inp.addEventListener('keydown', function (ev) {
    if (box.hidden) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
    else if (ev.key === 'Enter' && idx >= 0) { ev.preventDefault(); pick((box.querySelectorAll('.sopt')[idx] as SuggestButton)._x); }
    else if (ev.key === 'Escape') { ev.preventDefault(); hide(); }
  });
  document.addEventListener('click', function (ev) {
    if (!box.hidden && !box.contains(ev.target as Node) && ev.target !== inp) hide();
  });
  return { hide: hide };
}
