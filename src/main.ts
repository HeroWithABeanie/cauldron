import './style.css';
import './app.js';   // the old inline script, to be split up step by step
import './sync';
import { registerSW } from 'virtual:pwa-register';

// autoUpdate: a new service worker installs, takes over at once and the page reloads one time.
registerSW({
  onRegisterError: (e) => console.warn('Service worker registration failed', e),
});

// One-time cleanup of the cache the old hand-written sw.js created ("cauldron-v76" and earlier).
// Workbox only removes its own precache caches, so these would otherwise stay on the device forever.
if ('caches' in window) {
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cauldron-v')).map((k) => caches.delete(k))))
    .catch(() => {});
}
