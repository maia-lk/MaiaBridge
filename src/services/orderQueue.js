// MaiaBridge Project
// Failed order queue — persists orders that couldn't reach MyPOS.
// Backed by Firestore so the queue and dedup list survive process restarts
// (the previous file-based version lost orders when the host wiped its disk).
//
// Collections:
//   queue  — pending orders waiting for MyPOS. Doc id = Shopify order id.
//   sent   — dedup record of orders already delivered. Doc id = Shopify order id.

const { db } = require('../config/firebase');

const QUEUE_COL = 'queue';
const SENT_COL = 'sent';

function logQueue(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Firestore doc ids must be strings.
function docId(orderId) {
  return String(orderId);
}

async function loadQueue() {
  const snap = await db.collection(QUEUE_COL).get();
  return snap.docs.map(doc => doc.data());
}

async function markSent(orderId) {
  await db.collection(SENT_COL).doc(docId(orderId)).set({
    orderId,
    sentAt: new Date().toISOString()
  });
}

async function isAlreadySent(orderId) {
  const doc = await db.collection(SENT_COL).doc(docId(orderId)).get();
  return doc.exists;
}

async function enqueueOrder(orderDetails, reason) {
  const ref = db.collection(QUEUE_COL).doc(docId(orderDetails.id));
  const existing = await ref.get();
  if (existing.exists) {
    logQueue(`Order #${orderDetails.number} already in queue, skipping enqueue`);
    return;
  }
  await ref.set({
    queuedAt: new Date().toISOString(),
    attempts: 0,
    reason: reason || 'MyPOS unavailable',
    orderDetails
  });
  logQueue(`Enqueued order #${orderDetails.number}`);
}

async function removeFromQueue(orderId) {
  await db.collection(QUEUE_COL).doc(docId(orderId)).delete();
}

async function incrementAttempt(orderId) {
  const ref = db.collection(QUEUE_COL).doc(docId(orderId));
  const doc = await ref.get();
  if (doc.exists) {
    const data = doc.data();
    await ref.update({
      attempts: (data.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString()
    });
  }
}

module.exports = {
  enqueueOrder,
  removeFromQueue,
  incrementAttempt,
  loadQueue,
  markSent,
  isAlreadySent,
  logQueue
};
