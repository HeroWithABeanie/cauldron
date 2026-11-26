// Shared pieces for the tests that run old and new window code side by side on a fake page.
export function rng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A virtual clock with timeouts and intervals; time only moves when a test advances it. */
export function clock() {
  let now = 0, id = 0; const q: { t: number; id: number; fn: () => void; every?: number }[] = [];
  return {
    setTimeout: (fn: () => void, ms: number) => { q.push({ t: now + (ms || 0), id: ++id, fn }); return id; },
    setInterval: (fn: () => void, ms: number) => { q.push({ t: now + ms, id: ++id, fn, every: ms }); return id; },
    clear: (i: number) => { const k = q.findIndex((x) => x.id === i); if (k > -1) q.splice(k, 1); },
    advance(ms: number) { const end = now + ms; for (;;) { q.sort((a, b) => a.t - b.t || a.id - b.id); if (!q.length || q[0].t > end) break; const x = q.shift()!; now = x.t; if (x.every) q.push({ ...x, t: now + x.every }); x.fn(); } now = end; },
  };
}

/** A fake page element that writes everything done to it into one shared log. */
export class El {
  children: El[] = []; classes = new Set<string>(); attrs: Record<string, string> = {}; listeners: Record<string, ((e: any) => void)[]> = {};
  open = false; canAnimate = false; _closing = false;
  selectionStart = 0; selectionEnd = 0; clientWidth = 300; offsetHeight = 60; offsetLeft = 0;
  private p: Record<string, unknown> = {};
  style: any;
  constructor(public log: string[], public id: string) {
    this.style = new Proxy({} as any, { set: (o, k: string, v) => { o[k] = v; this.log.push(this.id + '.style.' + k + '=' + v); return true; } });
  }
  private set(k: string, v: unknown) { this.p[k] = v; this.log.push(this.id + '.' + k + '=' + JSON.stringify(v)); }
  get className() { return (this.p.className as string) ?? ''; } set className(v: string) { this.set('className', v); }
  get textContent() { return (this.p.textContent as string) ?? ''; } set textContent(v: string) { this.set('textContent', v); this.children = []; }
  get hidden() { return !!this.p.hidden; } set hidden(v: boolean) { this.set('hidden', v); }
  get disabled() { return !!this.p.disabled; } set disabled(v: boolean) { this.set('disabled', v); }
  get checked() { return !!this.p.checked; } set checked(v: boolean) { this.set('checked', v); }
  get tabIndex() { return (this.p.tabIndex as number) ?? -1; } set tabIndex(v: number) { this.set('tabIndex', v); }
  get type() { return (this.p.type as string) ?? ''; } set type(v: string) { this.set('type', v); }
  get scrollTop() { return (this.p.scrollTop as number) ?? 0; } set scrollTop(v: number) { this.set('scrollTop', v); }
  get scrollHeight() { return 500; }
  get innerHTML() { return (this.p.innerHTML as string) ?? ''; } set innerHTML(v: string) { this.set('innerHTML', v); this.children = []; }
  get value() { return (this.p.value as string) ?? ''; } set value(v: unknown) { this.set('value', String(v)); }
  get firstChild() { return this.children[0] ?? null; }
  get classList() { const s = this; return {
    add: (c: string) => { s.classes.add(c); s.log.push(s.id + '.add ' + c); }, remove: (c: string) => { s.classes.delete(c); s.log.push(s.id + '.remove ' + c); },
    contains: (c: string) => s.classes.has(c), toggle: (c: string, on: boolean) => { if (on) s.classes.add(c); else s.classes.delete(c); s.log.push(s.id + '.toggle ' + c + ' ' + on); } }; }
  get animate(): any { return this.canAnimate ? (kf: unknown, o: unknown) => { this.log.push(this.id + '.animate ' + JSON.stringify([kf, o])); return { cancel: () => { this.log.push(this.id + '.cancel'); } }; } : undefined; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); this.log.push(this.id + '.attr ' + k + '=' + v); }
  removeAttribute(k: string) { delete this.attrs[k]; this.log.push(this.id + '.rm ' + k); }
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t: string, f: (e: any) => void, c?: unknown) { this.log.push(this.id + '.listen ' + t + (c ? ' capture' : '')); (this.listeners[t] = this.listeners[t] || []).push(f); }
  appendChild(c: El) { this.log.push(this.id + '.append ' + c.id); this.children.push(c); return c; }
  removeChild(c: El) { this.log.push(this.id + '.removeChild ' + c.id); this.children = this.children.filter((x) => x !== c); return c; }
  focus(o?: unknown) { this.log.push(this.id + '.focus ' + JSON.stringify(o)); }
  showModal() { this.open = true; this.log.push(this.id + '.showModal'); }
  close() { if (!this.open) return; this.open = false; this.log.push(this.id + '.close'); this.fire('close'); }
  fire(t: string, ev: any = {}) { ev.target = ev.target ?? this; ev.preventDefault = ev.preventDefault ?? (() => { this.log.push(this.id + '.preventDefault'); }); ev.stopPropagation = ev.stopPropagation ?? (() => { this.log.push(this.id + '.stopPropagation'); }); (this.listeners[t] || []).slice().forEach((f) => f(ev)); }
}
