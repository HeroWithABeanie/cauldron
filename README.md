# Cauldron - PWA with Firebase sync

Files: index.html, manifest.webmanifest, sw.js, icons/

Upload to your GitHub Pages repository (replace index.html, sw.js and the icons).
After uploading, open the app, close it fully and open it again once so the new version is picked up.

## Sync (v26)
Firebase Auth (email + password) and Firestore. Every item, recipe and history entry is its own document:

    household/items/entries/{id}
    household/recipes/entries/{id}
    household/history/entries/{id}
    household/meta            (marks that the old lists were converted)

A deleted entry stays as a small marker for 30 days so a phone with an old copy cannot bring it back.
The old whole-list documents (household/items, household/recipes, household/history) are no longer written to;
they are kept untouched as a backup.

## Firestore rules (must be updated once)
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /household/{document=**} {
          allow read, write: if request.auth != null
            && request.auth.token.email in ['EMAIL_1', 'EMAIL_2'];
        }
      }
    }

## Updating
1. Publish the new rules.
2. Upload the new files, then open the app on the first phone (it converts the old lists, one time).
3. Update the second phone. Both phones must run v26 (see the footer).
