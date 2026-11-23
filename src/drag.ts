// Drag-to-reorder for the ingredients in the recipe window: grab the grip of a row and move it up or down.
// The recipe's `items` array is reordered in place when the finger / mouse is released, then onReorder() runs
// (the caller saves and redraws).

/**
 * grip: the handle that starts the drag. li: its row. ul: the list that holds all rows.
 * r: the recipe whose items follow the rows. searching(): reordering is off while a search filters the rows.
 */
export function enableDrag(grip: HTMLElement, li: HTMLElement, ul: HTMLElement, r: { items: unknown[] }, searching: () => boolean, onReorder: () => void): void {
  grip.addEventListener('pointerdown', function (ev: PointerEvent) {
    if (searching() || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const lis: HTMLElement[] = Array.prototype.slice.call(ul.querySelectorAll('li:not(.empty)'));
    if (lis.length < 2) return;
    ev.preventDefault();
    const from = lis.indexOf(li), startY = ev.clientY;
    let to = from;
    const rects = lis.map(function (x) { return x.getBoundingClientRect(); });
    const h = rects[from].height, last = lis.length - 1;
    grip.setPointerCapture(ev.pointerId);
    li.classList.add('dragging');
    lis.forEach(function (x) { if (x !== li) x.style.transition = 'transform .2s ease'; });
    document.body.style.userSelect = 'none';
    function move(e: PointerEvent): void {
      const dy = Math.max(rects[0].top - rects[from].top, Math.min(rects[last].top - rects[from].top, e.clientY - startY));
      li.style.transform = 'translateY(' + dy + 'px)';
      const center = rects[from].top + dy + h / 2;
      let n = 0;
      rects.forEach(function (rc, j) { if (j !== from && rc.top + rc.height / 2 < center) n++; });
      to = n;
      lis.forEach(function (x, j) {
        if (x === li) return;
        let s = 0;
        if (from < to && j > from && j <= to) s = -h;
        else if (from > to && j >= to && j < from) s = h;
        x.style.transform = s ? 'translateY(' + s + 'px)' : '';
      });
    }
    function up(): void {
      grip.removeEventListener('pointermove', move as EventListener);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      document.body.style.userSelect = '';
      const snap = to === from ? 0 : rects[to].top + (to > from ? rects[to].height - h : 0) - rects[from].top;
      li.style.transition = 'transform .15s ease';
      li.style.transform = 'translateY(' + snap + 'px)';
      setTimeout(function () {
        lis.forEach(function (x) { x.style.transform = ''; x.style.transition = ''; });
        li.classList.remove('dragging');
        if (to !== from) {
          const m = r.items.splice(from, 1)[0];
          r.items.splice(to, 0, m);
          onReorder();
        }
      }, 160);
    }
    grip.addEventListener('pointermove', move as EventListener);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
}
