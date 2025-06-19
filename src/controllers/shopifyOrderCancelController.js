// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, 'shopify-cancel-log.txt');

function logCancellation(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(logMsg.trim());
}

/**
 * Handle Shopify order cancellation webhook
 */
exports.handleOrderCancelled = async (req, res) => {
  const order = req.body;
  
  try {
    // Validate that we received a proper order payload
    if (!order) {
      logCancellation('❌ Error: No order data in cancellation webhook payload');
      return res.sendStatus(200);
    }
    
    // Extract essential cancellation data only
    const orderNumber = order.order_number || order.name?.replace('#', '') || 'unknown';
    const cancelledAt = order.cancelled_at;
    const cancelReason = order.cancel_reason;
    
    // Simple cancellation log
    logCancellation(`🚫 Order #${orderNumber} cancelled at ${cancelledAt} - Reason: ${cancelReason || 'Not specified'}`);
    
    // Always return 200 to Shopify
    res.sendStatus(200);
  } catch (error) {
    logCancellation(`❌ Error processing order cancellation: ${error.message}`);
    res.sendStatus(200);
  }
};
