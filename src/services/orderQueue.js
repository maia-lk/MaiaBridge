// MaiaBridge Project
// Failed order queue — persists orders that couldn't reach MyPOS.
// Stored as a JSON file on disk (no DB needed).

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, '..', '..', 'queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'failed-orders.json');
const SENT_FILE = path.join(QUEUE_DIR, 'sent-invoices.json');
const LOG_FILE = path.join(QUEUE_DIR, 'queue-log.txt');

function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function logQueue(message) {
  ensureQueueDir();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    logQueue(`Failed to read ${path.basename(file)}: ${err.message}`);
    return fallback;
  }
}

function writeJson(file, data) {
  ensureQueueDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadQueue() {
  return readJson(QUEUE_FILE, []);
}

function saveQueue(queue) {
  writeJson(QUEUE_FILE, queue);
}

function loadSent() {
  return readJson(SENT_FILE, []);
}

function markSent(orderId) {
  const sent = loadSent();
  if (!sent.includes(orderId)) {
    sent.push(orderId);
    // keep last 5000 to avoid unbounded growth
    const trimmed = sent.slice(-5000);
    writeJson(SENT_FILE, trimmed);
  }
}

function isAlreadySent(orderId) {
  return loadSent().includes(orderId);
}

function enqueueOrder(orderDetails, reason) {
  const queue = loadQueue();
  if (queue.some(item => item.orderDetails.id === orderDetails.id)) {
    logQueue(`Order #${orderDetails.number} already in queue, skipping enqueue`);
    return;
  }
  queue.push({
    queuedAt: new Date().toISOString(),
    attempts: 0,
    reason: reason || 'MyPOS unavailable',
    orderDetails
  });
  saveQueue(queue);
  logQueue(`Enqueued order #${orderDetails.number} (queue size: ${queue.length})`);
}

function removeFromQueue(orderId) {
  const queue = loadQueue();
  const filtered = queue.filter(item => item.orderDetails.id !== orderId);
  saveQueue(filtered);
}

function incrementAttempt(orderId) {
  const queue = loadQueue();
  const item = queue.find(i => i.orderDetails.id === orderId);
  if (item) {
    item.attempts = (item.attempts || 0) + 1;
    item.lastAttemptAt = new Date().toISOString();
    saveQueue(queue);
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
