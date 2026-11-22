// Differential regression suite: the same random operations are run against the OLD data logic
// (tests/reference/oldStore.ts, copied from app.js before step 3) and against src/store.ts.
// Lists, localStorage and the "pushed to sync" notifications must be identical after every step.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOldStore } from './reference/oldStore';
import { freshStore, seed, KEYS } from './storeHelper';

type Kind = 'items' | 'recipes' | 'history';
const KINDS: Kind[] = ['items', 'recipes', 'history'];

interface Impl {
  state(): Record<Kind, any[]>;
  save(kind: Kind): void;
  replaceAll(kind: Kind, list: any[] | null): void;
  applyChanges(kind: Kind, ups: any[], rem: string[]): void;
  pushed: Array<[string, string]>;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATS = ['Milk & Cheese', 'Dairy & egg products', 'Pantry', 'Beverages', '', undefined];
const IDS = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1', '10', '9'];
const TEXTS = ['Milk', 'milk', 'Bread', 'Eggs', 'EGGS', 'Rice', 'Tea'];

function makeGen(rnd: () => number) {
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const maybe = (p = 0.5) => rnd() < p;
  const item = (withId = true): any => {
    const o: any = { text: pick(TEXTS), qty: 1 + Math.floor(rnd() * 3), unit: 'pcs', done: maybe(0.3) };
    if (withId && maybe(0.9)) o.id = pick(IDS);
    const c = pick(CATS); if (c !== undefined) o.cat = c;
    if (maybe(0.2)) o.brand = 'Arla';
    return o;
  };
  const recipeItem = () => { const o: any = { text: pick(TEXTS), qty: 1, unit: 'g' }; const c = pick(CATS); if (c !== undefined) o.cat = c; return o; };
  const recipe = (): any => {
    const o: any = { id: maybe(0.5) ? pick(IDS) : Number(pick(['1', '2', '3', '10'])), name: 'R' + Math.floor(rnd() * 5) };
    if (maybe(0.7)) o.portions = 2 + Math.floor(rnd() * 4);
    if (maybe(0.8)) o.items = Array.from({ length: Math.floor(rnd() * 3) }, recipeItem);
    const c = pick(CATS); if (c !== undefined) o.cat = c;
    return o;
  };
  const hist = (): any => { const o: any = { text: pick(TEXTS), unit: 'pcs', last: Math.floor(rnd() * 1000) }; const c = pick(CATS); if (c !== undefined) o.cat = c; return o; };
  const many = (f: () => any, max: number) => Array.from({ length: Math.floor(rnd() * (max + 1)) }, f);
  const entry = (k: Kind) => (k === 'items' ? item() : k === 'recipes' ? recipe() : hist());
  const storedList = (k: Kind) => many(() => (k === 'items' ? item(maybe(0.7)) : entry(k)), 6);
  return { pick, maybe, entry, many, storedList };
}

/** Runs one random scenario against an implementation and returns what it did, step by step. */
function runScenario(seedNo: number, make: () => Promise<Impl> | Impl): Promise<string[]> {
  return (async () => {
    // Deterministic ids: uid() uses Date.now() and Math.random(); both give the same sequence on each run.
    let n = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000);
    vi.spyOn(Math, 'random').mockImplementation(() => { n++; return ((n * 7919) % 10007) / 10007; });

    const rnd = mulberry32(seedNo), g = makeGen(rnd);
    const initial: any = {};
    KINDS.forEach((k) => { if (g.maybe(0.8)) initial[k] = g.storedList(k); });
    seed(initial);
    n = 0;
    const impl = await make();
    const trace: string[] = [];
    const snap = (label: string) => trace.push(JSON.stringify({
      label,
      state: impl.state(),
      ls: KINDS.map((k) => localStorage.getItem(KEYS[k])),
      pushed: impl.pushed,
    }));
    snap('load');

    for (let step = 0; step < 25; step++) {
      const kind = g.pick(KINDS);
      const op = g.pick(['save', 'replaceAll', 'applyChanges', 'applyChanges', 'mutate']);
      const st = impl.state()[kind];
      if (op === 'save') {
        impl.save(kind);
      } else if (op === 'mutate') {
        st.push(g.entry(kind));               // what app.js does: change the live list ...
        impl.save(kind);                       // ... then save it
      } else if (op === 'replaceAll') {
        impl.replaceAll(kind, g.maybe(0.15) ? null : g.storedList(kind));
      } else {
        const ups = g.many(() => {
          // half of the updates hit an entry that already exists
          if (st.length && g.maybe(0.5)) { const e = JSON.parse(JSON.stringify(g.pick(st))); e.qty = 9; return e; }
          return g.entry(kind);
        }, 4);
        const rem = g.many(() => String(g.pick([...IDS, ...st.map((x: any) => x.id).filter(Boolean)])), 3);
        impl.applyChanges(kind, ups, kind === 'history' ? [] : rem);
      }
      snap(`${step}:${op}:${kind}`);
    }
    return trace;
  })();
}

const oldImpl = (): Impl => {
  const s = createOldStore();
  return {
    state: s.state, pushed: s.pushed,
    save: (k) => ({ items: s.save, recipes: s.saveR, history: s.saveHist }[k]()),
    replaceAll: s.replaceAll, applyChanges: s.applyChanges,
  };
};

const newImpl = async (): Promise<Impl> => {
  const store = await freshStore();
  const pushed: Array<[string, string]> = [];
  KINDS.forEach((k) => store.onLocalChange(k, (list: any[]) => { pushed.push([k, JSON.stringify(list)]); }));
  return {
    state: () => ({ items: store.items, recipes: store.recipes, history: store.history }),
    pushed,
    save: (k) => store.save(k),
    replaceAll: (k, l) => store.replaceAll(k, l),
    applyChanges: (k, u, r) => store.applyChanges(k, u, r),
  };
};

describe('store.ts vs the old app.js data logic', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const SCENARIOS = 400;      // 400 scenarios x 26 snapshots = 10,400 comparisons
  it(`gives identical results in ${SCENARIOS} random scenarios`, async () => {
    let compared = 0;
    for (let s = 1; s <= SCENARIOS; s++) {
      const a = await runScenario(s, oldImpl);
      vi.restoreAllMocks();
      const b = await runScenario(s, newImpl);
      vi.restoreAllMocks();
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) expect(JSON.parse(b[i]), `scenario ${s}, snapshot ${i}`).toEqual(JSON.parse(a[i]));
        compared++;
      }
    }
    expect(compared).toBe(SCENARIOS * 26);
  }, 120_000);
});
