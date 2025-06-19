// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const express = require('express');
const router = express.Router();
const { 
  handleOrderCreated,
  handleOrderCancelled
} = require('../controllers/shopifyWebhookController');

// Order webhooks
router.post('/order-created', handleOrderCreated);
router.post('/order-cancelled', handleOrderCancelled);

module.exports = router;