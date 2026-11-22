// Small helpers that several parts of the app share.

export const EASE = 'cubic-bezier(.2,.7,.2,1)';

/** True when the device asks for reduced motion: animations are skipped then. */
export function noMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** A list name as DOM: the brand in bold in front of the item name. */
export function nameFrag(it: { brand?: string; text: string }): DocumentFragment {var f=document.createDocumentFragment();if(it.brand){var b=document.createElement('b');b.className='brand';b.textContent=it.brand;f.appendChild(b);f.appendChild(document.createTextNode(' '));}f.appendChild(document.createTextNode(it.text));return f;}

// Sorting, layout switching and search pause while items from the server animate in.
// (A live binding: other modules read `uiLocked` and always see the current value.)
export let uiLocked = false;
let uiLockTimer: ReturnType<typeof setTimeout> | undefined;
export function lockUI(ms: number): void {
  uiLocked = true;
  document.documentElement.classList.add('animlock');
  clearTimeout(uiLockTimer);
  uiLockTimer = setTimeout(() => {
    uiLocked = false;
    document.documentElement.classList.remove('animlock');
  }, ms);
}
