import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshStore, seed, KEYS } from './storeHelper';

beforeEach(() => { localStorage.clear(); });

describe('loading', () => {
  it('starts empty when nothing is stored, and writes nothing', async () => {
    const s = await freshStore();
    expect(s.items).toEqual([]); expect(s.recipes).toEqual([]); expect(s.history).toEqual([]);
    expect(localStorage.length).toBe(0);               // app.js relies on this for its "fresh install" check
  });
  it('starts empty on unreadable JSON', async () => {
    seed({ items: '{broken', recipes: 'nope', history: '[' });
    const s = await freshStore();
    expect(s.items).toEqual([]); expect(s.recipes).toEqual([]); expect(s.history).toEqual([]);
  });
  it('starts empty when the stored value is not an array', async () => {
    seed({ items: '{"a":1}', recipes: '5', history: '"x"' });
    const s = await freshStore();
    expect(s.items).toEqual([]); expect(s.recipes).toEqual([]); expect(s.history).toEqual([]);
  });
  it('renames old categories, gives items ids and recipes portions', async () => {
    seed({
      items: [{ text: 'Milk', qty: 1, unit: 'pcs', done: false, cat: 'Milk & Cheese' }],
      recipes: [{ id: 1, name: 'R', items: [{ text: 'Cheese', qty: 1, unit: 'g', cat: 'Milk & Cheese' }] }],
      history: [{ text: 'Milk', unit: 'pcs', cat: 'Milk & Cheese', last: 1 }],
    });
    const s = await freshStore();
    expect(s.items[0].cat).toBe('Dairy & egg products');
    expect(typeof s.items[0].id).toBe('string');
    expect(s.items[0].id.length).toBeGreaterThan(0);
    expect(s.recipes[0].portions).toBe(4);
    expect(s.recipes[0].items[0].cat).toBe('Dairy & egg products');
    expect(s.history[0].cat).toBe('Dairy & egg products');
  });
  it('keeps the exact localStorage keys of the old app', () => {
    expect(KEYS).toEqual({ items: 'shopping-list-items', recipes: 'shopping-list-recipes', history: 'shopping-list-history' });
  });
});

describe('stable arrays', () => {
  it('get(kind) returns the exported array', async () => {
    const s = await freshStore();
    expect(s.get('items')).toBe(s.items);
    expect(s.get('recipes')).toBe(s.recipes);
    expect(s.get('history')).toBe(s.history);
  });
  it('setList replaces the contents but keeps the same array', async () => {
    const s = await freshStore();
    const ref = s.items;
    s.setList('items', [{ id: 'a', text: 'X', qty: 1, unit: 'pcs', done: false }]);
    expect(s.items).toBe(ref);
    expect(ref).toHaveLength(1);
  });
  it('setList works when given the live array itself (e.g. a filter result built from it)', async () => {
    const s = await freshStore();
    s.setList('items', [{ id: 'a', text: 'A', qty: 1, unit: 'pcs', done: false }, { id: 'b', text: 'B', qty: 1, unit: 'pcs', done: true }]);
    s.setList('items', s.items.filter((x) => !x.done));
    expect(s.items.map((x) => x.id)).toEqual(['a']);
    s.setList('items', s.items);
    expect(s.items.map((x) => x.id)).toEqual(['a']);
  });
  it('setList does not save or notify', async () => {
    const s = await freshStore();
    const cb = vi.fn(); s.onLocalChange('items', cb);
    s.setList('items', [{ id: 'a', text: 'A', qty: 1, unit: 'pcs', done: false }]);
    expect(cb).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEYS.items)).toBeNull();
  });
});

describe('saving and notifications', () => {
  it('save writes to localStorage and notifies only that kind', async () => {
    const s = await freshStore();
    const ci = vi.fn(), cr = vi.fn(); s.onLocalChange('items', ci); s.onLocalChange('recipes', cr);
    s.items.push({ id: 'a', text: 'A', qty: 1, unit: 'pcs', done: false });
    s.save('items');
    expect(JSON.parse(localStorage.getItem(KEYS.items)!)).toEqual(s.items);
    expect(ci).toHaveBeenCalledTimes(1);
    expect(ci.mock.calls[0][0]).toBe(s.items);
    expect(cr).not.toHaveBeenCalled();
  });
  it('saveLocal writes without notifying', async () => {
    const s = await freshStore();
    const cb = vi.fn(); s.onLocalChange('items', cb);
    s.items.push({ id: 'a', text: 'A', qty: 1, unit: 'pcs', done: false });
    s.saveLocal('items');
    expect(localStorage.getItem(KEYS.items)).not.toBeNull();
    expect(cb).not.toHaveBeenCalled();
  });
  it('the unsubscribe function stops notifications', async () => {
    const s = await freshStore();
    const cb = vi.fn(); const off = s.onLocalChange('history', cb);
    s.save('history'); off(); s.save('history');
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('save survives a failing localStorage (storage full) and still notifies', async () => {
    const s = await freshStore();
    const cb = vi.fn(); s.onLocalChange('items', cb);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => s.save('items')).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('replaceAll (server data)', () => {
  it('replaces in place, cleans up, saves locally, reports "replace", and does not notify sync', async () => {
    const s = await freshStore();
    const ref = s.items;
    const remote = vi.fn(), local = vi.fn();
    s.onRemoteChange(remote); s.onLocalChange('items', local);
    s.replaceAll('items', [{ text: 'Milk', qty: 1, unit: 'pcs', done: false, cat: 'Milk & Cheese' } as any]);
    expect(s.items).toBe(ref);
    expect(s.items[0].cat).toBe('Dairy & egg products');
    expect(s.items[0].id).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(KEYS.items)!)).toEqual(s.items);
    expect(remote).toHaveBeenCalledWith('items', 'replace');
    expect(local).not.toHaveBeenCalled();
  });
  it('treats null as an empty list', async () => {
    const s = await freshStore();
    s.items.push({ id: 'a', text: 'A', qty: 1, unit: 'pcs', done: false });
    s.replaceAll('items', null);
    expect(s.items).toEqual([]);
  });
  it('normalises recipes', async () => {
    const s = await freshStore();
    s.replaceAll('recipes', [{ id: 1, name: 'R' } as any]);
    expect(s.recipes[0].portions).toBe(4);
    expect(s.recipes[0].items).toEqual([]);
  });
});

describe('applyChanges (single entries from the server)', () => {
  const it1 = (id: string, text = 'X'): any => ({ id, text, qty: 1, unit: 'pcs', done: false });

  it('inserts new items in id order', async () => {
    const s = await freshStore();
    s.applyChanges('items', [it1('b'), it1('a'), it1('c')], []);
    expect(s.items.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('updates an existing item in place (same object)', async () => {
    const s = await freshStore();
    s.applyChanges('items', [it1('a')], []);
    const obj = s.items[0];
    s.applyChanges('items', [{ ...it1('a'), qty: 5 }], []);
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toBe(obj);
    expect(obj.qty).toBe(5);
  });
  it('removes items by id', async () => {
    const s = await freshStore();
    s.applyChanges('items', [it1('a'), it1('b')], []);
    s.applyChanges('items', [], ['a']);
    expect(s.items.map((x) => x.id)).toEqual(['b']);
  });
  it('recipes: append in arrival order, match by string id, default portions', async () => {
    const s = await freshStore();
    s.applyChanges('recipes', [{ id: 2, name: 'B' } as any, { id: 1, name: 'A' } as any], []);
    expect(s.recipes.map((r) => r.id)).toEqual([2, 1]);
    expect(s.recipes[0].portions).toBe(4);
    s.applyChanges('recipes', [{ id: '2', name: 'B2' } as any], []);       // string "2" matches number 2
    expect(s.recipes).toHaveLength(2);
    expect(s.recipes[0].name).toBe('B2');
    s.applyChanges('recipes', [], ['1']);
    expect(s.recipes.map((r) => String(r.id))).toEqual(['2']);   // the update replaced the entry, so its id is now the string "2"
  });
  it('history: matches by text, ignoring case', async () => {
    const s = await freshStore();
    s.applyChanges('history', [{ text: 'Milk', unit: 'pcs', cat: '', last: 1 }], []);
    s.applyChanges('history', [{ text: 'MILK', unit: 'pcs', cat: '', last: 2 }], []);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].last).toBe(2);
  });
  it('reports "apply" to the remote listener, once per call', async () => {
    const s = await freshStore();
    const remote = vi.fn(); s.onRemoteChange(remote);
    s.applyChanges('items', [it1('a')], []);
    expect(remote).toHaveBeenCalledTimes(1);
    expect(remote).toHaveBeenCalledWith('items', 'apply');
  });
  it('old category names from the server are fixed and pushed back (save -> notify)', async () => {
    const s = await freshStore();
    const local = vi.fn(); s.onLocalChange('items', local);
    s.applyChanges('items', [{ ...it1('a'), cat: 'Milk & Cheese' }], []);
    expect(s.items[0].cat).toBe('Dairy & egg products');
    expect(local).toHaveBeenCalledTimes(1);
  });
  it('clean data does not notify sync', async () => {
    const s = await freshStore();
    const local = vi.fn(); s.onLocalChange('items', local);
    s.applyChanges('items', [it1('a')], []);
    expect(local).not.toHaveBeenCalled();
  });
});

describe('listeners', () => {
  it('a listener may unsubscribe itself while being called', async () => {
    const s = await freshStore();
    const calls: string[] = [];
    const off1 = s.onRemoteChange(() => { calls.push('one'); off1(); });
    s.onRemoteChange(() => { calls.push('two'); });
    s.replaceAll('items', []);
    s.replaceAll('items', []);
    expect(calls).toEqual(['one', 'two', 'two']);
  });
});
