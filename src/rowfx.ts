import { EASE, noMotion } from './ui';

// ---- Show / hide rows with a height-and-fade animation (used by the search filter and the lists) ----
const PROPS = ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'borderTopWidth', 'borderBottomWidth'];

function snap(el: HTMLElement): Keyframe {
  const cs = getComputedStyle(el) as unknown as Record<string, string>;
  const o: Keyframe = { height: el.getBoundingClientRect().height + 'px', opacity: cs.opacity };
  PROPS.forEach(function (p) { o[p] = cs[p]; });
  return o;
}
function zero(): Keyframe {
  const o: Keyframe = { height: '0px', opacity: 0 };
  PROPS.forEach(function (p) { o[p] = '0px'; });
  return o;
}

export function toggleEl(el: HTMLElement, show: boolean, animate?: boolean): void {
  const running = el.getAnimations().length > 0;
  if (!animate || noMotion() || !el.animate) {
    el.getAnimations().forEach(function (a) { a.cancel(); });
    el.hidden = !show; el.style.overflow = ''; return;
  }
  if (!running && el.hidden === !show) return;
  const wasHidden = el.hidden, cur = running ? snap(el) : null;
  el.getAnimations().forEach(function (a) { a.cancel(); });
  el.hidden = false; el.style.overflow = 'hidden';
  const nat = snap(el);
  const a = el.animate([cur || (wasHidden ? zero() : nat), show ? nat : zero()], { duration: 260, easing: EASE, fill: 'forwards' });
  a.onfinish = function () { if (!show) el.hidden = true; el.style.overflow = ''; a.cancel(); };
}

export function setLi(li: HTMLElement, show: boolean, animate?: boolean): void {
  const nw = show ? '1' : '0';
  if (animate && (li.dataset.show || '1') === nw) return;
  li.dataset.show = nw; toggleEl(li, show, animate);
}

export function markLast(ul: HTMLElement): void {
  let last: HTMLElement | null = null;
  ul.classList.add('f');
  ul.querySelectorAll<HTMLElement>('li').forEach(function (li) {
    li.classList.remove('last');
    if ((li.dataset.show || '1') === '1') last = li;
  });
  if (last) (last as HTMLElement).classList.add('last');
}

// ---- Search highlighting ----
export function clearMarks(root: HTMLElement): void {
  root.querySelectorAll('mark.hl').forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent || '')); });
  root.normalize();
}

// Search treats every character that is not a letter or digit as a space: "coconut cashew", "coconut/cashew"
// and "coconut - cashew" all find "Coconut/Cashew". With no letters or digits typed, the text is searched as typed.
// Marks every match, also when it runs across the line breaks of a tile title (several text pieces).
export function markText(el: HTMLElement, re: RegExp): void {
  const nodes: Text[] = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const pn = tw.currentNode.parentNode as Element;
    if (!(pn.closest && pn.closest('.qty'))) nodes.push(tw.currentNode as Text);
  }
  if (!nodes.length) return;
  const full = nodes.map(function (n) { return n.nodeValue; }).join(''), ranges: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(full))) {
    if (!m[0].length) { re.lastIndex++; continue; }
    ranges.push([m.index, m.index + m[0].length]);
  }
  if (!ranges.length) return;
  let off = 0;
  nodes.forEach(function (n) {
    const t = n.nodeValue as string, start = off, end = off + t.length, segs: Array<[number, number]> = [];
    off = end;
    ranges.forEach(function (r) {
      const a = Math.max(r[0], start), b = Math.min(r[1], end);
      if (a < b) segs.push([a - start, b - start]);
    });
    if (!segs.length) return;
    const frag = document.createDocumentFragment(); let pos = 0;
    segs.forEach(function (sg) {
      frag.appendChild(document.createTextNode(t.slice(pos, sg[0])));
      const mk = document.createElement('mark'); mk.className = 'hl'; mk.textContent = t.slice(sg[0], sg[1]);
      frag.appendChild(mk);
      pos = sg[1];
    });
    frag.appendChild(document.createTextNode(t.slice(pos)));
    n.replaceWith(frag);
  });
}

// ---- Reorder animation (FLIP): remember where each element is, re-render, then slide each one from its old place ----
const keyOf = new WeakMap<object, number>();
let keyCount = 0;
/** A stable number for an object, used as the data-key of its row so the row can be found again after a re-render. */
export function keyFor(o: object): number {
  if (!keyOf.has(o)) keyOf.set(o, ++keyCount);
  return keyOf.get(o) as number;
}

export function flipReorder(container: ParentNode, sel: string, key: string, renderFn: () => void): void {
  const first: Record<string, DOMRect> = {};
  container.querySelectorAll<HTMLElement>(sel).forEach(function (el) { first[el.dataset[key] as string] = el.getBoundingClientRect(); });
  renderFn();
  if (noMotion()) return;
  container.querySelectorAll<HTMLElement>(sel).forEach(function (el) {
    const f = first[el.dataset[key] as string];
    if (!f || !f.height || !el.animate) return;
    const l = el.getBoundingClientRect(), dy = f.top - l.top, dx = f.left - l.left;
    if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
    el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }], { duration: 450, easing: EASE });
  });
}
