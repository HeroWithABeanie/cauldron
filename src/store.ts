// The app's data: the shopping list, the recipes and the item history.
//
// Each list is ONE array that lives for the whole session. It is only ever changed in place, so other
// modules can keep a reference to it (`store.items`). Nobody reassigns it; use setList() to replace
// the contents (this replaces the old `items = ...` assignments in app.js).
//
// localStorage keys are unchanged from the old app.js: shopping-list-items / -recipes / -history.
//
// Two kinds of change are announced:
//  - onLocalChange(kind, cb): this device saved the list (save()). sync.ts uses it to push to Firestore.
//  - onRemoteChange(cb):      sync.ts handed in data from the server (replaceAll / applyChanges). The stored
//                             list is already updated; app.js uses it to re-render.
import type { Item, Recipe, HistoryEntry, Kind } from './types';
import { fixCats } from './categories';
import { uid } from './names';

interface Lists { items: Item[]; recipes: Recipe[]; history: HistoryEntry[] }
export type RemoteHow = 'replace' | 'apply';

const KEYS: Record<Kind, string> = {
  items: 'shopping-list-items',
  recipes: 'shopping-list-recipes',
  history: 'shopping-list-history',
};

function load<T>(kind: Kind): T[] {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    if (raw) {
      const v = JSON.parse(raw) || [];
      if (Array.isArray(v)) return v;
    }
  } catch (e) { /* unreadable: start empty, like before */ }
  return [];
}

function ensureIds(arr: Item[] | null | undefined): boolean {
  let ch = false;
  (arr || []).forEach((e) => { if (e && !e.id) { e.id = uid(); ch = true; } });
  return ch;
}
function normRecipe(r: Recipe): void {
  if (!r.portions) r.portions = 4;
  if (!r.items) r.items = [];
}

const lists: Lists = {
  items: load<Item>('items'),
  recipes: load<Recipe>('recipes'),
  history: load<HistoryEntry>('history'),
};
// Same clean-up the old app.js did while loading. Nothing is written here, so the "fresh install"
// check in app.js (which looks for missing localStorage keys) still works.
fixCats(lists.items);
ensureIds(lists.items);
fixCats(lists.history);
lists.recipes.forEach((r) => { if (!r.portions) r.portions = 4; });
fixCats(lists.recipes);

export const items: Item[] = lists.items;
export const recipes: Recipe[] = lists.recipes;
export const history: HistoryEntry[] = lists.history;

export function get<K extends Kind>(kind: K): Lists[K] { return lists[kind]; }

// ---- change notifications -------------------------------------------------------------------------------
const localCbs: Record<Kind, Array<(list: any[]) => void>> = { items: [], recipes: [], history: [] };
const remoteCbs: Array<(kind: Kind, how: RemoteHow) => void> = [];

export function onLocalChange<K extends Kind>(kind: K, cb: (list: Lists[K]) => void): () => void {
  const a = localCbs[kind] as Array<(list: Lists[K]) => void>;
  a.push(cb);
  return () => { const i = a.indexOf(cb); if (i > -1) a.splice(i, 1); };
}
export function onRemoteChange(cb: (kind: Kind, how: RemoteHow) => void): () => void {
  remoteCbs.push(cb);
  return () => { const i = remoteCbs.indexOf(cb); if (i > -1) remoteCbs.splice(i, 1); };
}
const emitRemote = (kind: Kind, how: RemoteHow) => remoteCbs.slice().forEach((cb) => cb(kind, how));

// ---- saving ---------------------------------------------------------------------------------------------
/** Write one list to localStorage only (no notification). */
export function saveLocal(kind: Kind): void {
  try { localStorage.setItem(KEYS[kind], JSON.stringify(lists[kind])); } catch (e) { /* storage full or blocked */ }
}
/** Write one list to localStorage and tell the listeners (sync) that this device changed it. */
export function save(kind: Kind): void {
  saveLocal(kind);
  localCbs[kind].slice().forEach((cb) => cb(lists[kind]));
}

// ---- replacing contents in place ------------------------------------------------------------------------
/** Replaces the whole contents of a list, keeping the same array object. Does not save or notify. */
export function setList<K extends Kind>(kind: K, next: Lists[K]): void {
  const arr = lists[kind] as any[];
  const copy = (next as any[]).slice();      // copy first: `next` may be the live array itself
  arr.length = 0;
  for (let i = 0; i < copy.length; i++) arr.push(copy[i]);
}

// ---- data coming from the server (called by sync.ts) ----------------------------------------------------
/** Replaces a whole list with data from the server or from the one-time conversion. */
export function replaceAll(kind: Kind, list: any[] | null | undefined): void {
  setList(kind, (list || []) as any);
  if (kind === 'items') { fixCats(lists.items); ensureIds(lists.items); saveLocal('items'); }
  else if (kind === 'recipes') { lists.recipes.forEach(normRecipe); fixCats(lists.recipes); saveLocal('recipes'); }
  else { fixCats(lists.history); saveLocal('history'); }
  emitRemote(kind, 'replace');
}

// Every entry is stored on its own, so sync only ever hands over single entries that changed (ups)
// or were deleted (rem).
function putEntry<T>(arr: T[], u: T, idf: (x: T) => any, sorted: boolean): void {
  const id = idf(u);
  let i = -1, j: number;
  for (j = 0; j < arr.length; j++) { if (idf(arr[j]) === id) { i = j; break; } }
  if (i > -1) {
    const o: any = arr[i];
    Object.keys(o).forEach((k) => { delete o[k]; });
    Object.assign(o, u);
    return;
  }
  let p = arr.length;
  if (sorted) { for (j = 0; j < arr.length; j++) { if (String(idf(arr[j])) > id) { p = j; break; } } }
  arr.splice(p, 0, u);
}

/** Merges single changed entries (ups) and deleted ids (rem) from the server into a list. */
export function applyChanges(kind: Kind, ups: any[], rem: string[]): void {
  const fixed = fixCats(ups);
  if (kind === 'items') {
    if (rem.length) setList('items', lists.items.filter((x) => rem.indexOf(x.id) < 0));
    ups.forEach((u) => putEntry<Item>(lists.items, u, (x) => x.id, true));
    saveLocal('items');
    emitRemote('items', 'apply');
    if (fixed) save('items');
  } else if (kind === 'recipes') {
    if (rem.length) setList('recipes', lists.recipes.filter((x) => rem.indexOf(String(x.id)) < 0));
    ups.forEach((u) => { normRecipe(u); putEntry<Recipe>(lists.recipes, u, (x) => String(x.id), false); });
    saveLocal('recipes');
    emitRemote('recipes', 'apply');
    if (fixed) save('recipes');
  } else {
    ups.forEach((u) => putEntry<HistoryEntry>(lists.history, u, (x) => String(x.text).toLowerCase(), false));
    saveLocal('history');
    emitRemote('history', 'apply');
    if (fixed) save('history');
  }
}
