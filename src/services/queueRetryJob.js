// MaiaBridge Project
// Background retry job — periodically tries to flush the failed-order queue.
// Only runs during MyPOS working hours.

const { sendTransactionToMyPOS } = require('./myposService');
const { isWithinWorkingHours, describeHours } = require('./workingHours');
const {
  loadQueue,
  removeFromQueue,
  incrementAttempt,
  markSent,
  isAlreadySent,
  logQueue
} = require('./orderQueue');

const RETRY_INTERVAL_MS = parseInt(process.env.QUEUE_RETRY_INTERVAL_MS || '300000', 10); // default 5 min

let isRunning = false;

async function flushQueue() {
  if (isRunning) return;
  isRunning = true;
  try {
    if (!isWithinWorkingHours()) {
      return;
    }

    const queue = loadQueue();
    if (queue.length === 0) return;

    logQueue(`Working hours active — attempting to flush ${queue.length} queued order(s)`);

    for (const item of queue) {
      const { orderDetails } = item;
      const orderNumber = orderDetails.number || orderDetails.id;

      if (isAlreadySent(orderDetails.id)) {
        logQueue(`Order #${orderNumber} already marked sent, removing from queue`);
        removeFromQueue(orderDetails.id);
        continue;
      }

      incrementAttempt(orderDetails.id);
      const result = await sendTransactionToMyPOS(orderDetails);

      if (result.success) {
        markSent(orderDetails.id);
        removeFromQueue(orderDetails.id);
        logQueue(`✅ Flushed order #${orderNumber} to MyPOS`);
      } else {
        logQueue(`⏳ Order #${orderNumber} still failing (${result.message || result.error}) — keeping in queue`);
      }
    }
  } catch (err) {
    logQueue(`Retry job error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

function startRetryJob() {
  logQueue(`Queue retry job started — interval ${RETRY_INTERVAL_MS}ms, hours: ${describeHours()}`);
  // Run once on startup (in case server just turned on at opening time)
  setTimeout(flushQueue, 5000);
  // Then on interval
  setInterval(flushQueue, RETRY_INTERVAL_MS);
}

module.exports = { startRetryJob, flushQueue };
