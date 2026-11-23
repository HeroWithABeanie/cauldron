// Little round buttons with a tooltip: "this item was unlinked from a recipe" and the portion-size warning.
// A tooltip opens on tap (or on hover with a mouse), closes by itself after 3.5 seconds, and tapping anywhere closes it.
import { UNLINK_SVG } from './icons';
import { isDesk } from './ui';

/** Closes every open tooltip. app.js also calls this on any click on the page. */
export function closeTips(): void {
  document.querySelectorAll('.unlinked.show').forEach(function (b) { b.classList.remove('show'); });
}

/**
 * The "unlinked" button of an item. With fn it is a button that opens the re-link window (after a short press
 * animation); without fn a tap shows the tooltip. note replaces the default tooltip text.
 */
export function brokenLink(cls: string, fn: (() => void) | null, note?: string): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'unlinked hovtip' + (cls ? ' ' + cls : '');
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const msg = note || 'This item was unlinked from a recipe.';
  b.setAttribute('aria-label', fn ? 'This item was unlinked from a recipe. Tap to re-link it.' : msg);
  b.innerHTML = UNLINK_SVG + '<span class="tip" role="tooltip">' + msg + '</span>';
  if (fn) {
    b.classList.add('act');
    // a quick tap still shows the full press animation before the window opens
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (b.classList.contains('pressed')) return;
      b.classList.add('pressed');
      setTimeout(function () { b.classList.remove('pressed'); fn(); }, 250);
    });
  } else {
    b.style.cursor = 'default';
    // not clickable: a tap (or hover with a mouse) shows the tooltip for a few seconds
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      closeTips(); clearTimeout(hideTimer);
      b.classList.add('show');
      hideTimer = setTimeout(function () { b.classList.remove('show'); }, 3500);
    });
  }
  return b;
}

/**
 * A button with an icon (svg) whose tooltip shows text; used for the portion-size warning on list rows.
 * With a mouse the tooltip shows only while the pointer is over the button (pure CSS, like the unlinked button, so it
 * can never linger). On touch screens there is no hover: a tap shows it for 3.5 seconds.
 */
export function tipButton(cls: string, svg: string, text: string): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'unlinked hovtip ' + cls;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  b.setAttribute('aria-label', text);
  b.innerHTML = svg + '<span class="tip" role="tooltip">' + text + '</span>';
  b.addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (isDesk()) return;
    closeTips(); clearTimeout(hideTimer);
    b.classList.add('show');
    hideTimer = setTimeout(function () { b.classList.remove('show'); }, 3500);
  });
  return b;
}
