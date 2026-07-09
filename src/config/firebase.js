// MaiaBridge Project
// Firebase Admin config — initializes Firestore for the order queue / dedup store.
//
// Firestore replaces the old file-backed queue (queue/*.json), which did not
// survive process restarts on ephemeral hosting (orders were being lost).
//
// Credentials: place the Firebase Admin SDK service-account key at
//   src/config/serviceAccountKey.json
// Get it from the Firebase console:
//   Project Settings → Service Accounts → Generate new private key.
// This file is a SECRET and must never be committed (see .gitignore).

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (err) {
  throw new Error(
    'Missing src/config/serviceAccountKey.json — download it from the Firebase console ' +
      '(Project Settings → Service Accounts → Generate new private key) and save it there.'
  );
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

module.exports = { db };
