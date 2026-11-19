# Cauldron - PWA with Firebase sync

Files: index.html, manifest.webmanifest, sw.js, icons/

Upload to your GitHub Pages repository (replace index.html and sw.js).
After uploading, open the app, close it fully and open it again once so the new version is picked up.

Sync: Firebase Auth (email + password) and Firestore. Firebase JS SDK 13.2.0, loaded from the gstatic CDN.
Data layout (sync v2):
- household/items/entries/{id}
- household/recipes/entries/{id}
- household/history/entries/{id}
- household/meta (marks that the old whole-list documents were converted)

Change the Firestore rules to allow only your two email addresses, and make sure they cover
household/{kind}/entries/{id} and household/meta (not just the old household/items and household/recipes documents).

When you change the Firebase SDK version, also bump CACHE_VERSION in sw.js, because the SDK files are cached.
