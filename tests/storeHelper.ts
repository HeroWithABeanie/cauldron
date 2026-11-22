import { vi } from 'vitest';

export const KEYS = {
  items: 'shopping-list-items',
  recipes: 'shopping-list-recipes',
  history: 'shopping-list-history',
} as const;

/** Puts data into the fake localStorage (objects are JSON-encoded, strings are stored as given). */
export function seed(data: Partial<Record<keyof typeof KEYS, unknown>>): void {
  localStorage.clear();
  (Object.keys(data) as Array<keyof typeof KEYS>).forEach((k) => {
    const v = data[k];
    localStorage.setItem(KEYS[k], typeof v === 'string' ? v : JSON.stringify(v));
  });
}

/** Imports a fresh store.ts, so it loads whatever seed() put in localStorage. */
export async function freshStore() {
  vi.resetModules();
  return await import('../src/store');
}
