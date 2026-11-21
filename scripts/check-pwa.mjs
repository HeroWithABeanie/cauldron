// Post-build sanity check for the PWA output. Fails the build (and the GitHub Action) if the offline setup is broken.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const problems = [];
const read = (f) => readFileSync(join(dist, f), 'utf8');
const need = (cond, msg) => { if (!cond) problems.push(msg); };

need(existsSync(join(dist, 'sw.js')), 'dist/sw.js is missing');
need(existsSync(join(dist, 'manifest.webmanifest')), 'dist/manifest.webmanifest is missing');

if (existsSync(join(dist, 'sw.js'))) {
  const sw = read('sw.js');
  need(sw.includes('index.html'), 'sw.js does not precache index.html');
  const built = readdirSync(join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f));
  need(built.length > 0, 'dist/assets has no js/css');
  for (const f of built) need(sw.includes('assets/' + f), `sw.js does not precache assets/${f} (file too large for the precache limit?)`);
}

if (existsSync(join(dist, 'index.html'))) {
  const html = read('index.html');
  const m = html.match(/<link[^>]*rel="manifest"[^>]*>/);
  need(!!m, 'index.html has no <link rel="manifest">');
  if (m) {
    const href = (m[0].match(/href="([^"]*)"/) || [])[1] || '';
    need(!/^(\/|https?:)/.test(href), `manifest href "${href}" is not relative; it would break on a GitHub Pages sub-path`);
  }
  need((html.match(/rel="manifest"/g) || []).length === 1, 'index.html has more than one manifest link');
  need(!/serviceWorker\s*\.\s*register/.test(html), 'index.html still registers a service worker inline');
}

if (existsSync(join(dist, 'manifest.webmanifest'))) {
  const mf = JSON.parse(read('manifest.webmanifest'));
  need(mf.start_url === './' && mf.scope === './', `manifest start_url/scope should be "./" (got ${mf.start_url} / ${mf.scope})`);
  for (const i of mf.icons || []) need(existsSync(join(dist, i.src)), `manifest icon ${i.src} is not in dist`);
}

if (problems.length) {
  console.error('\nPWA check failed:\n - ' + problems.join('\n - ') + '\n');
  process.exit(1);
}
console.log('PWA check OK');
