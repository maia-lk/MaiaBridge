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
    const orderNumber = order.order_number || order.name?.replace('#', '') || 'unknown';
    
    // Extract customer details
    const customer = {
      name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Guest Customer',
      email: order.email || order.customer?.email || 'no-email',
      phone: order.customer?.phone || order.billing_address?.phone || 'no-phone'
    };

    // Extract shipping address
    const shippingAddress = order.shipping_address ? {
      name: order.shipping_address.name || '',
      address1: order.shipping_address.address1 || '',
      address2: order.shipping_address.address2 || '',
      city: order.shipping_address.city || '',
      country: order.shipping_address.country || '',
      phone: order.shipping_address.phone || ''
    } : null;

    // Extract line items (simplified)
    const orderItems = order.line_items.map(item => ({
      sku: item.sku || 'no-sku',
      title: item.title,
      quantity: item.quantity,
      price: item.price
    }));

    // Create simple order object
    const orderDetails = {
      number: orderNumber,
      customer,
      shipping_address: shippingAddress,
      items: orderItems
    };

    logWebhook(`📦 New order #${orderNumber} received from ${customer.name} (${customer.email})`);
    
    if (shippingAddress) {
      logWebhook(`Shipping to: ${shippingAddress.name}, ${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.country}`);
    }

    console.log('Order details:', JSON.stringify(orderDetails, null, 2));
    
    res.sendStatus(200);
  } catch (error) {
    logWebhook(`❌ Error processing order webhook: ${error.message}`);
    console.error('Full error:', error);
    res.sendStatus(200);
  }
};

