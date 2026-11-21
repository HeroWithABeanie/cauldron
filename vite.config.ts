import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Single source of truth for the app version: the major number in package.json ("76.0.0" -> "v76").
// To release: `npm version 77.0.0 --no-git-tag-version`, then add the 'v77' entry to NOTES in src/app.js.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = 'v' + String(pkg.version).split('.')[0];
const NOTES_FILE = new URL('./src/app.js', import.meta.url); // move this when the patch notes get their own module

// Fails the build if package.json was bumped but the patch-notes entry was forgotten.
const notesGuard = (): Plugin => ({
  name: 'cauldron-notes-guard',
  buildStart() {
    const src = readFileSync(NOTES_FILE, 'utf8');
    if (!src.includes(`'${APP_VERSION}':{date:`)) {
      this.error(`package.json says ${APP_VERSION} but NOTES in src/app.js has no '${APP_VERSION}' entry.`);
    }
  },
});

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    notesGuard(),
    VitePWA({
      base: './',
      scope: './',
      registerType: 'autoUpdate',
      injectRegister: null,              // main.ts registers via virtual:pwa-register
      includeManifestIcons: false,       // icons are precached by the glob below
      manifest: {
        name: 'Cauldron',
        short_name: 'Cauldron',
        description: 'Shopping lists and recipes in one place.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6ee',
        theme_color: '#2f7d4f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        // Workbox silently skips files above this limit, which would bring the blank-app bug back.
        // The default is 2 MiB; the JS bundle is ~966 kB today. check-pwa.mjs also verifies the result.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }, // 0 = opaque (the <link> has no crossorigin)
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
