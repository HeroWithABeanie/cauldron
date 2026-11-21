export interface Named { text: string; brand?: string }

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const fullName = (it: Named): string => (it.brand ? it.brand + ' ' : '') + it.text;
export const shortTitle = (t?: string): string => { t = t || ''; return t.length > 20 ? t.slice(0, 20) + '...' : t; };

const BRK_AFTER = '.,-_:/\\*+!?)';

/** Pieces a tile title may be broken into (never between two digits such as 1.5). */
export function nameParts(t: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const c = t.charAt(i), p = i ? t.charAt(i - 1) : '', n = t.charAt(i + 1);
    if (c === '(' && cur && p !== ' ') { out.push(cur); cur = ''; }
    cur += c;
    if (BRK_AFTER.indexOf(c) > -1 && n && n !== ' ' && BRK_AFTER.indexOf(n) < 0) {
      if ((c === '.' || c === ',') && /\d/.test(p) && /\d/.test(n)) continue;
      out.push(cur); cur = '';
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Every character that is not a letter or digit counts as a space. */
export function searchRe(q: string, flags: string): RegExp {
  const words = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const src = words.length ? words.map(esc).join('[^\\p{L}\\p{N}]+') : esc(q);
  return new RegExp(src, flags);
}
