import type { Unit } from './types';

const PLURALS: Record<string, string> = {
  pack: 'packs', bottle: 'bottles', can: 'cans', jar: 'jars', cup: 'cups', box: 'boxes', bag: 'bags',
  carton: 'cartons', tub: 'tubs', bunch: 'bunches', slice: 'slices', loaf: 'loaves', pinch: 'pinches',
  tube: 'tubes', container: 'containers',
};

export function unitLabel(qty: number, unit: Unit): string {
  if (unit === 'pcs' && qty === 1) return 'pc';
  return qty === 1 || !PLURALS[unit] ? unit : PLURALS[unit];
}

// [kind: mass | volume, factor to the base unit]
const UF: Record<string, ['m' | 'v', number]> = {
  g: ['m', 1], kg: ['m', 1000], ml: ['v', 1], cl: ['v', 10], dl: ['v', 100], l: ['v', 1000], tsp: ['v', 5], tbsp: ['v', 15],
};

export function convertQty(q: number, from: Unit, to: Unit): number | null {
  if (from === to) return q;
  const a = UF[from], b = UF[to];
  if (!a || !b || a[0] !== b[0]) return null;
  return (q * a[1]) / b[1];
}

export function scaleQty(q: number, f: number): number {
  return Math.max(0.01, Math.round(q * f * 100) / 100);
}
