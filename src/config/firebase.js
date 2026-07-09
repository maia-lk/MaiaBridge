// MaiaBridge Project
// Firebase Admin config — initializes Firestore for the order queue / dedup store.
//
// Firestore replaces the old file-backed queue (queue/*.json), which did not
// survive process restarts on ephemeral hosting (orders were being lost).
//
// Credentials are loaded in this order:
//   1. FIREBASE_SERVICE_ACCOUNT env var — the full service-account JSON as a
//      single line. Use this on Render (Environment tab).
//   2. src/config/serviceAccountKey.json — a local file (gitignored) for dev.
// Get the key from the Firebase console:
//   Project Settings → Service Accounts → Generate new private key.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

function loadServiceAccount() {
  // 1. Env var (preferred for deployment)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${err.message}`);
    }
  }

  // 2. Local file fallback (dev)
  try {
    return require('./serviceAccountKey.json');
  } catch (err) {
    throw new Error(
      'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT (full ' +
        'service-account JSON) in the environment, or place the key at ' +
        'src/config/serviceAccountKey.json for local dev.'
    );
  }
}

const app = initializeApp({
  credential: cert(loadServiceAccount())
});

const db = getFirestore(app);

module.exports = { db };
