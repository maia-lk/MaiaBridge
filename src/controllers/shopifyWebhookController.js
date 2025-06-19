// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, 'shopify-webhook-log.txt');

function logWebhook(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(logMsg.trim());
}

/**
 * Handle Shopify order creation webhook
 */
exports.handleOrderCreated = (req, res) => {
  const order = req.body;
  
  try {
    // Extract order details
    const orderId = order.id || order.order_id || 'unknown';
    const orderNumber = order.order_number || order.name || orderId;
    
    const skus = order.line_items.map(item => ({
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      title: item.title
    }));

    logWebhook(`📦 New order #${orderNumber} received with ${skus.length} items`);
    logWebhook(`Items: ${JSON.stringify(skus)}`);

    // Process the order (e.g., update inventory, notify systems)
    // Add your business logic here
    
    res.sendStatus(200);
  } catch (error) {
    logWebhook(`❌ Error processing order webhook: ${error.message}`);
    // Still return 200 to Shopify to prevent retries
    res.sendStatus(200);
  }
};
