// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const express = require('express');
const dotenv = require('dotenv');
const shopifRoutes = require('./src/routes/shopifRoutes');
const myposRoutes = require('./src/routes/myposRoutes');
const authRoutes = require('./src/routes/authRoutes');
const shopifyWebhookRoutes = require('./src/routes/shopifyWebhookRoutes');
const cron = require('node-cron');
const { syncMyPOSStockToShopify } = require('./src/controllers/shopifyController');

dotenv.config();
const app = express();
const port = 3000;

app.use(express.json());
app.use('/shopify', shopifRoutes);
app.use('/mypos', myposRoutes);
app.use('/auth', authRoutes);
app.use('/shopify-webhook', shopifyWebhookRoutes);

// Cron job: run syncMyPOSStockToShopify every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('Running stock sync...');
  syncMyPOSStockToShopify();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
