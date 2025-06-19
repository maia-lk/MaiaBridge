// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const express = require('express');
const router = express.Router();
const { 
  handleOrderCreated
} = require('../controllers/shopifyWebhookController');
const { 
  handleOrderCancelled 
} = require('../controllers/shopifyOrderCancelController');

// Order webhooks
router.post('/order-created', handleOrderCreated);
router.post('/cancelled', handleOrderCancelled);

module.exports = router;