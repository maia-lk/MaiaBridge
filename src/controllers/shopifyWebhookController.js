// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, 'shopify-webhook-log.txt');
const { sendTransactionToMyPOS } = require('../services/myposService');

function logWebhook(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(logMsg.trim());
}

/**
 * Handle Shopify order creation webhook
 */
exports.handleOrderCreated = async (req, res) => {
  const order = req.body;
  
  try {
    // Extract complete order details
    const orderNumber = order.order_number || order.name?.replace('#', '') || 'unknown';
    
    // Extract customer details with all available fields
    const customer = {
      id: order.customer?.id,
      name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Guest Customer',
      first_name: order.customer?.first_name || '',
      last_name: order.customer?.last_name || '',
      email: order.email || order.customer?.email || 'no-email',
      phone: order.customer?.phone || order.billing_address?.phone || 'no-phone'
    };

    // Extract billing address
    const billingAddress = order.billing_address ? {
      first_name: order.billing_address.first_name || '',
      last_name: order.billing_address.last_name || '',
      name: order.billing_address.name || '',
      company: order.billing_address.company || '',
      address1: order.billing_address.address1 || '',
      address2: order.billing_address.address2 || '',
      city: order.billing_address.city || '',
      province: order.billing_address.province || '',
      province_code: order.billing_address.province_code || '',
      country: order.billing_address.country || '',
      country_code: order.billing_address.country_code || '',
      zip: order.billing_address.zip || '',
      phone: order.billing_address.phone || ''
    } : null;

    // Extract shipping address with all available fields
    const shippingAddress = order.shipping_address ? {
      first_name: order.shipping_address.first_name || '',
      last_name: order.shipping_address.last_name || '',
      name: order.shipping_address.name || '',
      company: order.shipping_address.company || '',
      address1: order.shipping_address.address1 || '',
      address2: order.shipping_address.address2 || '',
      city: order.shipping_address.city || '',
      province: order.shipping_address.province || '',
      province_code: order.shipping_address.province_code || '',
      country: order.shipping_address.country || '',
      country_code: order.shipping_address.country_code || '',
      zip: order.shipping_address.zip || '',
      phone: order.shipping_address.phone || ''
    } : null;

    // Extract line items with all available details
    const orderItems = order.line_items.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku || 'no-sku',
      title: item.title,
      variant_title: item.variant_title,
      vendor: item.vendor,
      quantity: item.quantity,
      price: item.price
    }));

    // Extract shipping lines
    const shippingLines = order.shipping_lines ? order.shipping_lines.map(shipping => ({
      code: shipping.code,
      price: shipping.price,
      title: shipping.title
    })) : [];

    // Calculate shipping cost total
    const shippingCost = shippingLines.reduce((total, line) => 
      total + parseFloat(line.price || 0), 0).toFixed(2);

    // Create comprehensive order object with all details from sample
    const orderDetails = {
      id: order.id,
      number: orderNumber,
      name: order.name,
      email: order.email,
      created_at: order.created_at,
      processed_at: order.processed_at,
      currency: order.currency,
      financial_status: order.financial_status,
      total_price: order.total_price,
      subtotal_price: order.subtotal_price,
      total_tax: order.total_tax,
      customer,
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      items: orderItems,
      shipping_lines: shippingLines,
      shipping_cost: shippingCost
    };

    logWebhook(`📦 New order #${orderNumber} received from ${customer.name} (${customer.email})`);
    
    if (shippingAddress) {
      logWebhook(`Shipping to: ${shippingAddress.name}, ${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.country}`);
    }


    
    // Send order to MyPOS
    logWebhook(`Forwarding order #${orderNumber} to MyPOS...`);
    
    // const myposResult = await sendTransactionToMyPOS(orderDetails);
    
    if (myposResult.success) {
      logWebhook(`✅ Successfully sent order #${orderNumber} to MyPOS`);
    } else {
      logWebhook(`❌ Failed to send order #${orderNumber} to MyPOS: ${myposResult.error}`);
    }
    
    // Always return 200 to Shopify
    res.sendStatus(200);
  } catch (error) {
    logWebhook(`❌ Error processing order webhook: ${error.message}`);
    console.error('Full error:', error);
    // Still return 200 to Shopify to prevent retries
    res.sendStatus(200);
  }
};
