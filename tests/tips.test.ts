import { describe, it, expect, afterEach, vi } from 'vitest';
import { closeTips, brokenLink, tipButton } from '../src/tips';
import { WARN_SVG, UNLINK_SVG } from '../src/icons';
import { oldTips } from './reference/oldTips';

const g = globalThis as any;
afterEach(() => { vi.useRealTimers(); delete g.document; });

// ---- a fake button, and a fake document that knows every button it created ----
class Btn {
  type = ''; className = ''; innerHTML = ''; style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners: Record<string, ((e: any) => void)[]> = {};
  stopped = 0;
  constructor(public doc: Doc) {}
  get cls() { return this.className.split(' ').filter(Boolean); }
  get classList() {
    const self = this;
    return {
      add(c: string) { if (!self.cls.includes(c)) self.className = self.cls.concat(c).join(' '); },
      remove(c: string) { self.className = self.cls.filter((x) => x !== c).join(' '); },
      contains(c: string) { return self.cls.includes(c); },
    };
  }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(type: string) { const ev = { type, stopPropagation: () => { this.stopped++; } }; (this.listeners[type] || []).forEach((f) => f(ev)); }
  snap() { return JSON.stringify([this.type, this.className.split(' ').sort().join(' '), this.innerHTML, this.attrs, this.style, Object.keys(this.listeners).sort(), this.stopped]); }
}
class Doc {
  buttons: Btn[] = [];
  createElement(tag: string) { if (tag !== 'button') throw new Error('unexpected ' + tag); const b = new Btn(this); this.buttons.push(b); return b; }
  querySelectorAll(sel: string) {
    if (sel !== '.unlinked.show') throw new Error('unexpected selector ' + sel);
    return this.buttons.filter((b) => b.cls.includes('unlinked') && b.cls.includes('show'));
  }
}
const setup = () => { vi.useFakeTimers(); const d = new Doc(); g.document = d; return d; };

describe('WARN_SVG', () => {
  it('is the same icon as before, and UNLINK_SVG is untouched', () => {
    expect(WARN_SVG).toBe(oldTips.WARN_SVG);
    expect(WARN_SVG.startsWith('<svg viewBox="0 0 24 24"')).toBe(true);
    expect(UNLINK_SVG.startsWith('<svg')).toBe(true);
  });
});

describe('closeTips', () => {
  it('hides every open tooltip and nothing else', () => {
    const d = setup();
    const a = tipButton('warn', '<i/>', 'x') as any, b = tipButton('warn', '<i/>', 'y') as any;
    a.fire('click'); b.classList.add('act');
    expect(d.querySelectorAll('.unlinked.show').length).toBe(1);
    closeTips();
    expect(a.cls.includes('show')).toBe(false);
    expect(b.cls.includes('act')).toBe(true);
  });
});

describe('tipButton', () => {
  it('builds the button with its tooltip', () => {
    setup();
    const b = tipButton('warn', '<svg/>', 'Portion size was changed.') as any;
    expect(b.type).toBe('button');
    expect(b.className).toBe('unlinked warn');
    expect(b.attrs['aria-label']).toBe('Portion size was changed.');
    expect(b.innerHTML).toBe('<svg/><span class="tip" role="tooltip">Portion size was changed.</span>');
  });
  it('shows on tap and on hover, closes the others, and hides itself after 3.5 seconds', () => {
    vi.useFakeTimers(); const d = setup();
    const a = tipButton('warn', '', 'a') as any, b = tipButton('warn', '', 'b') as any;
    a.fire('mouseenter');
    expect(a.cls.includes('show')).toBe(true);
    expect(a.stopped).toBe(0);                 // hover does not stop the click from bubbling
    b.fire('click');
    expect(a.cls.includes('show')).toBe(false);
    expect(b.cls.includes('show')).toBe(true);
    expect(b.stopped).toBe(1);                 // a tap does (so the page-wide "close tips" click does not undo it)
    vi.advanceTimersByTime(3499); expect(b.cls.includes('show')).toBe(true);
    vi.advanceTimersByTime(2); expect(b.cls.includes('show')).toBe(false);
    expect(d.querySelectorAll('.unlinked.show').length).toBe(0);
  });
  it('a second tap restarts the 3.5 seconds', () => {
    setup();
    const a = tipButton('warn', '', 'a') as any;
    a.fire('click'); vi.advanceTimersByTime(3000); a.fire('click'); vi.advanceTimersByTime(3000);
    expect(a.cls.includes('show')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(a.cls.includes('show')).toBe(false);
  });
});

describe('brokenLink', () => {
  it('without an action: a plain button whose tap shows the tooltip', () => {
    setup();
    const b = brokenLink('tbrk', null) as any;
    expect(b.className).toBe('unlinked hovtip tbrk');
    expect(b.attrs['aria-label']).toBe('This item was unlinked from a recipe.');
    expect(b.style.cursor).toBe('default');
    b.fire('click');
    expect(b.cls.includes('show')).toBe(true);
  });
  it('with an action: a tap plays the press animation, then runs the action once', () => {
    setup();
    let ran = 0;
    const b = brokenLink('', () => { ran++; }) as any;
    expect(b.cls.includes('act')).toBe(true);
    expect(b.attrs['aria-label']).toBe('This item was unlinked from a recipe. Tap to re-link it.');
    b.fire('click'); b.fire('click');           // the second tap during the animation does nothing
    expect(b.cls.includes('pressed')).toBe(true);
    expect(ran).toBe(0);
    vi.advanceTimersByTime(250);
    expect(ran).toBe(1);
    expect(b.cls.includes('pressed')).toBe(false);
  });
  it('uses a custom note as tooltip text', () => {
    setup();
    const b = brokenLink('cardbrk', null, 'Custom note') as any;
    expect(b.innerHTML.endsWith('<span class="tip" role="tooltip">Custom note</span>')).toBe(true);
    expect(b.attrs['aria-label']).toBe('Custom note');
  });
});

// ---- the new code against the old code, with the same random sequences of taps, hovers and waiting ----
function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function drive(impl: { closeTips: () => void; brokenLink: any; tipButton: any }, seed: number) {
  const rand = rng(seed);
  const d = setup();
  const out: string[] = [];
  const calls: number[] = [];
  const btns: Btn[] = [];
  const n = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const r = rand();
    if (r < .4) btns.push(impl.brokenLink(rand() < .5 ? 'tbrk' : '', null, rand() < .3 ? 'note ' + i : undefined));
    else if (r < .7) btns.push(impl.brokenLink('cardbrk', () => { calls.push(i); }));
    else btns.push(impl.tipButton('warn', '<svg/>', 'tip ' + i));
  }
  for (let step = 0; step < 25; step++) {
    const a = rand();
    const b = btns[Math.floor(rand() * btns.length)];
    if (a < .4) b.fire('click');
    else if (a < .55) b.fire('mouseenter');
    else if (a < .65) impl.closeTips();
    else vi.advanceTimersByTime(Math.floor(rand() * 2500));
    out.push(step + ': ' + btns.map((x) => x.snap()).join(' | ') + ' calls=' + calls.join(','));
  }
  vi.advanceTimersByTime(10000);
  out.push('end: ' + btns.map((x) => x.snap()).join(' | ') + ' calls=' + calls.join(','));
  vi.useRealTimers();
  return out;
}

describe('tips (new vs the old code from app.js)', () => {
  it('behave exactly like the old code in 300 random sequences', () => {
    for (let k = 0; k < 300; k++) {
      const a = drive(oldTips, 5000 + k), b = drive({ closeTips, brokenLink, tipButton }, 5000 + k);
      expect(b).toEqual(a);
    }
  });
});
