// Verbatim copy of nameCandidates from app.js before it moved to src/suggest.ts (state passed in as arguments).
export function oldNameCandidates(q: string, limit: number | undefined, items: any[], recipes: any[], itemHistory: any[]) {
  var map: any = {};
  function add(name: string, src: string, unit: any, cat: any) {
    var k = name.toLowerCase();
    if (!map[k] || (src === 'list' && map[k].src !== 'list')) map[k] = { name: name, src: src, unit: unit, cat: cat };
  }
  items.forEach(function (it) { add(it.text, 'list', it.unit, it.cat); });
  recipes.forEach(function (r) { r.items.forEach(function (it: any) { add(it.text, 'recipe', it.unit, it.cat); }); });
  itemHistory.forEach(function (h) { add(h.text, 'history', h.unit, h.cat); });
  var out = Object.keys(map).map(function (k) { return map[k]; }).filter(function (c: any) { return c.name.toLowerCase().indexOf(q) > -1; });
  out.sort(function (a: any, b: any) {
    var as = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1, bs = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
    return as - bs || a.name.localeCompare(b.name);
  });
  return limit ? out.slice(0, limit) : out;
}
