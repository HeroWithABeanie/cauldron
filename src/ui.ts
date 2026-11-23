// Small helpers that several parts of the app share.

export const EASE = 'cubic-bezier(.2,.7,.2,1)';

/** True when the device asks for reduced motion: animations are skipped then. */
export function noMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** True on computers (a mouse or trackpad that can hover); false on phones and tablets. */
export function isDesk(): boolean {
  return !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
}

/** Shakes an element sideways once (wrong input, alert windows). */
export function shake(el: HTMLElement): void {
  if (noMotion() || !el.animate) return;
  el.animate([
    { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
    { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' },
  ], { duration: 420, easing: 'ease-in-out' });
}

/**
 * Makes a required input shake (and take the focus) when the form is submitted with an invalid value, instead of
 * showing the browser's own "Please fill out this field" bubble. With reduced motion the browser's bubble stays,
 * so that the person still gets feedback.
 */
export function shakeOnInvalid(input: HTMLInputElement): void {
  input.addEventListener('invalid', (ev) => {
    if (noMotion()) return;
    ev.preventDefault();
    shake(input);
    input.focus();
  });
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
