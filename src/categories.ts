export const CATS = ['Fruits & Vegetables', 'Bread & Pastries', 'Dairy & egg products', 'Meat & Fish', 'Spices & Condiments', 'Conserved goods', 'Pantry', 'Grain products', 'Frozen & Convenience', 'Snacks & Sweets', 'Beverages', 'Household', 'Health & Care'];

const CAT_RENAME: Record<string, string> = { 'Milk & Cheese': 'Dairy & egg products' };

interface Catted { cat?: string; items?: Catted[] }

/** Renames old categories in place; returns true when something changed. */
export function fixCats(arr?: Catted[] | null): boolean {
  let changed = false;
  (arr || []).forEach((e) => {
    if (!e) return;
    if (e.cat && CAT_RENAME[e.cat]) { e.cat = CAT_RENAME[e.cat]; changed = true; }
    if (e.items && fixCats(e.items)) changed = true;
  });
  return changed;
}

export const CAT_HTML = '<option value="">None</option>' + CATS.map((c) => {
  const x = c.replace(/&/g, '&amp;');
  return `<option value="${x}">${x}</option>`;
}).join('');
