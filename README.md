# Cauldron – PWA package

Files: index.html, manifest.webmanifest, sw.js, icons/

## Install as an app (PWA)
1. Upload this whole folder to any static HTTPS host (Netlify Drop, GitHub Pages, Cloudflare Pages, Vercel...).
   A service worker only works over HTTPS (or localhost).
2. Open the site on your phone.
   - Android / Chrome: menu > "Install app" (or "Add to Home screen").
   - iPhone / Safari: Share > "Add to Home Screen".

## Make an Android .apk
Once the site is live on HTTPS:
1. Go to https://www.pwabuilder.com, enter your site URL, and choose "Package for stores" > Android.
2. Download the generated package (it contains an .apk for testing and an .aab for the Play Store).
Alternative: Google's Bubblewrap CLI (`npx @bubblewrap/cli init --manifest https://your-site/manifest.webmanifest`).

## Updating
Change index.html, then bump CACHE_VERSION in sw.js (e.g. cauldron-v2) so installed copies refresh.

## Note
Lists and recipes are stored in the browser's localStorage for the site's own address,
so data from the claude.ai-hosted version does not carry over to a new address.
