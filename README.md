# MaiaBridge

> **Legal Notice**
>
> MaiaBridge Project
> Copyright (c) 2025 Maia. All rights reserved.
> This project and its source code are the legal property of Maia.
> Unauthorized copying or distribution is prohibited.

MaiaBridge is a Node.js middleware service that synchronizes inventory and product data between a MyPOS system and Shopify. It provides RESTful APIs to fetch, update, and sync stock and product information, ensuring your Shopify store always reflects the latest inventory from your MyPOS system.

## Features

- **Sync MyPOS Stock to Shopify:**
  - Automatically updates Shopify inventory based on MyPOS stock data.
  - Creates new products in Shopify if they do not exist.
  - Updates stock levels for existing products.
  - Skips products where stock is already up-to-date.

- **Manual Stock Update:**
  - Update Shopify inventory for specific SKUs via API.

- **Product Management:**
  - Fetch products and inventory from Shopify.
  - Create new products via API.

- **Authentication:**
  - JWT-based authentication middleware for protected routes.

## API Endpoints

All endpoints are prefixed with `/shopify` unless otherwise noted.

| Method | Endpoint                | Description                                 |
|--------|-------------------------|---------------------------------------------|
| GET    | /products               | List Shopify products                       |
| GET    | /inventory              | List Shopify inventory                      |
| POST   | /create-product         | Create a new Shopify product                |
| POST   | /sync-stock             | Sync MyPOS stock to Shopify (protected)     |
| POST   | /update-stock           | Update stock for SKUs (protected)           |


## How It Works

1. **Sync Process:**
   - Fetches all products and stock from MyPOS.
   - Compares with existing Shopify SKUs.
   - Updates inventory for existing products if needed.
   - Creates new products in Shopify for items not found.
   - Logs all actions to `shopify-sync-log.txt`.

2. **Manual Updates:**
   - Use `/update-stock` to update inventory for specific SKUs.

3. **Authentication:**
   - Protected routes require a valid JWT token in the `Authorization` header.

## Getting Started

### Prerequisites
- Node.js v20+
- npm
- Shopify API credentials
- MyPOS API/data access

### Installation

```bash
npm install
```

### Configuration
- Copy your Shopify and MyPOS credentials into the appropriate files in `src/config/`.
- Set environment variables in a `.env` file if needed.

### Running the Server

```bash
node index.js
```

Server will run at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
index.js
src/
  config/           # Shopify/MyPOS config files
  controllers/      # Route controllers
  middleware/       # Auth middleware
  routes/           # Express route definitions
  services/         # Shopify/MyPOS service logic
```

## Logging
- All sync actions are logged to `src/controllers/shopify-sync-log.txt`.

## License
MIT
