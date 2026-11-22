import { describe, it, expect, afterEach, vi } from 'vitest';
import { EASE, noMotion, lockUI } from '../src/ui';
import * as ui from '../src/ui';

const g = globalThis as any;
afterEach(() => { delete g.window; delete g.document; });

describe('EASE', () => {
  it('is the app-wide easing curve', () => expect(EASE).toBe('cubic-bezier(.2,.7,.2,1)'));
});

describe('noMotion', () => {
  it('is true when the device asks for reduced motion', () => {
    g.window = { matchMedia: (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) };
    expect(noMotion()).toBe(true);
  });
  it('is false otherwise', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    expect(noMotion()).toBe(false);
  });
  it('is false when matchMedia does not exist', () => {
    g.window = {};
    expect(noMotion()).toBe(false);
  });
});

describe('lockUI', () => {
  it('locks for the given time, sets the animlock class, and then unlocks', async () => {
    const classes = new Set<string>();
    g.document = { documentElement: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } } };
    expect(ui.uiLocked).toBe(false);
    lockUI(30);
    expect(ui.uiLocked).toBe(true);
    expect(classes.has('animlock')).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(ui.uiLocked).toBe(false);
    expect(classes.has('animlock')).toBe(false);
  });
  it('a second call restarts the timer instead of unlocking early', async () => {
    g.document = { documentElement: { classList: { add: () => {}, remove: () => {} } } };
    lockUI(40);
    await new Promise((r) => setTimeout(r, 25));
    lockUI(60);
    await new Promise((r) => setTimeout(r, 40));
    expect(ui.uiLocked).toBe(true);        // the first timer (40 ms) would be over by now
    await new Promise((r) => setTimeout(r, 60));
    expect(ui.uiLocked).toBe(false);
  });
});

describe('shake', () => {
  it('animates the element once', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    const el = { animate: vi.fn() };
    ui.shake(el as any);
    expect(el.animate).toHaveBeenCalledTimes(1);
  });
  it('does nothing with reduced motion', () => {
    g.window = { matchMedia: () => ({ matches: true }) };
    const el = { animate: vi.fn() };
    ui.shake(el as any);
    expect(el.animate).not.toHaveBeenCalled();
  });
  it('does nothing when the element cannot animate', () => {
    g.window = { matchMedia: () => ({ matches: false }) };
    expect(() => ui.shake({} as any)).not.toThrow();
  });
});
