// REFERENCE ONLY. A faithful copy of the data logic that lived inside app.js before step 3
// (commit a9f9560): load/clean-up, save, replaceAll and applyChanges, with the arrays being
// REASSIGNED the way the old code did. The differential test runs the same operations against this and
// against src/store.ts and requires identical results. Do not "improve" this file.
import { fixCats } from '../../src/categories';
import { uid } from '../../src/names';

const KEY = 'shopping-list-items', RKEY = 'shopping-list-recipes', HKEY = 'shopping-list-history';

export function createOldStore() {
  let items: any[] = [], recipes: any[] = [], itemHistory: any[] = [];
  const pushed: Array<[string, string]> = [];   // what the old code handed to sync.push(kind, list)

  function ensureIds(arr: any[]) { let ch = false; (arr || []).forEach((e) => { if (e && !e.id) { e.id = uid(); ch = true; } }); return ch; }
  function normRecipe(r: any) { if (!r.portions) r.portions = 4; if (!r.items) r.items = []; }

  try { const raw = localStorage.getItem(KEY); if (raw) items = JSON.parse(raw) || []; } catch (e) { items = []; }
  fixCats(items);
  ensureIds(items);
  try { const hr = localStorage.getItem(HKEY); if (hr) itemHistory = JSON.parse(hr) || []; } catch (e) { itemHistory = []; }
  fixCats(itemHistory);
  try { const rr = localStorage.getItem(RKEY); if (rr) recipes = JSON.parse(rr) || []; } catch (e) { recipes = []; }
  recipes.forEach((r) => { if (!r.portions) r.portions = 4; });
  fixCats(recipes);

  const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* */ } };
  const save = () => { saveLocal(); pushed.push(['items', JSON.stringify(items)]); };
  const saveRLocal = () => { try { localStorage.setItem(RKEY, JSON.stringify(recipes)); } catch (e) { /* */ } };
  const saveR = () => { saveRLocal(); pushed.push(['recipes', JSON.stringify(recipes)]); };
  const saveHistLocal = () => { try { localStorage.setItem(HKEY, JSON.stringify(itemHistory)); } catch (e) { /* */ } };
  const saveHist = () => { saveHistLocal(); pushed.push(['history', JSON.stringify(itemHistory)]); };

  function putEntry(arr: any[], u: any, idf: (x: any) => any, sorted: boolean) {
    const id = idf(u); let i = -1, j: number;
    for (j = 0; j < arr.length; j++) { if (idf(arr[j]) === id) { i = j; break; } }
    if (i > -1) { const o = arr[i]; Object.keys(o).forEach((k) => { delete o[k]; }); Object.assign(o, u); return; }
    let p = arr.length;
    if (sorted) { for (j = 0; j < arr.length; j++) { if (String(idf(arr[j])) > id) { p = j; break; } } }
    arr.splice(p, 0, u);
  }

  return {
    pushed,
    state: () => ({ items, recipes, history: itemHistory }),
    save, saveR, saveHist,
    replaceAll(kind: string, list: any[] | null) {
      list = list || [];
      if (kind === 'items') { items = list; fixCats(items); ensureIds(items); saveLocal(); }
      else if (kind === 'recipes') { recipes = list; recipes.forEach(normRecipe); fixCats(recipes); saveRLocal(); }
      else { itemHistory = list; fixCats(itemHistory); saveHistLocal(); }
    },
    applyChanges(kind: string, ups: any[], rem: string[]) {
      const fixed = fixCats(ups);
      if (kind === 'items') {
        if (rem.length) items = items.filter((x) => rem.indexOf(x.id) < 0);
        ups.forEach((u) => putEntry(items, u, (x) => x.id, true));
        saveLocal(); if (fixed) save();
      } else if (kind === 'recipes') {
        if (rem.length) recipes = recipes.filter((x) => rem.indexOf(String(x.id)) < 0);
        ups.forEach((u) => { normRecipe(u); putEntry(recipes, u, (x) => String(x.id), false); });
        saveRLocal(); if (fixed) saveR();
      } else {
        ups.forEach((u) => putEntry(itemHistory, u, (x) => String(x.text).toLowerCase(), false));
        saveHistLocal(); if (fixed) saveHist();
      }
    },
  };
}
