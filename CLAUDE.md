# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MaiaBridge is a Node.js/Express middleware that synchronizes data between a **MyPOS** point-of-sale system and a **Shopify** store. It runs two independent integrations:

1. **Stock sync (MyPOS → Shopify):** pull products/stock from MyPOS and create or update them in Shopify.
2. **Order forwarding (Shopify → MyPOS):** receive Shopify order webhooks and post them to MyPOS as invoices.

## Commands

- **Run (dev, auto-reload):** `npm start` (runs `nodemon index.js`)
- **Run (plain):** `node index.js`
- Server listens on **port 3000** (hardcoded in `index.js`).
- **No test suite, linter, or build step exists.** `test.json` is a static mock of the MyPOS stock response, not a test.

## Configuration

All secrets and behavior come from a `.env` file (gitignored; see `.env.example`). Required vars: Shopify credentials (`SHOPIFY_SHOP_NAME`, `SHOPIFY_API_KEY`, `SHOPIFY_ACCESS_TOKEN`), `JWT_SECRET`, MyPOS API (`API_BASE_URL`, `API_USERNAME`, `API_PASSWORD`), and MyPOS working-hours vars (see Offline order recovery below).

Non-secret constants live in code, not env:
- `src/config/shopifyConfig.js` — Shopify `SHOPIFY_LOCATION_ID`, vendor name, product status (`draft`), etc.
- `src/services/myposService.js` — MyPOS invoice constants like `SetupLocation`/`InnerLocation` (`"003"`), `StationId`, and the fixed shipping product code (`"000001570"`). These are business-specific magic values; changing them affects how invoices land in MyPOS.

## Architecture

Standard Express layering: `routes/ → controllers/ → services/`, with `config/` holding external-client setup.

### Route groups (mounted in `index.js`)
- `/shopify` (`shopifRoutes.js`) — product/inventory reads, product creation, and the **stock sync** endpoints.
- `/mypos` (`myposRoutes.js`) — read MyPOS products/stock.
- `/auth` (`authRoutes.js`) — JWT login.
- `/shopify-webhook` (`shopifyWebhookRoutes.js`) — inbound Shopify order webhooks (`/order-created`, `/cancelled`).

### External clients
- **Shopify:** `config/shopify.js` wraps the `shopify-api-node` client. All Shopify calls funnel through `services/shopifyService.js`.
- **MyPOS:** `config/apiClient.js` exposes `callApi(funcName, payload)`. MyPOS uses a two-step auth: `callApi` fetches a fresh Bearer token via Basic auth on **every** call, then POSTs to `{API_BASE_URL}/?func={funcName}`. Key funcs: `gettotalstockinhand`, `saveInvoice`. MyPOS responses use `{ Status, Message, Data, Exception }` where `Status === 1` means success.

### Order forwarding flow (Shopify → MyPOS)
`shopifyWebhookController.handleOrderCreated` is the core path:
1. Skips cancelled orders and de-dupes via `orderQueue.isAlreadySent` (order id).
2. Flattens the raw Shopify order into an internal `orderDetails` shape.
3. If **outside MyPOS working hours**, enqueues immediately (see below).
4. Otherwise calls `myposService.sendTransactionToMyPOS`, which maps `orderDetails` → a MyPOS invoice (`convertOrderToInvoice`) and posts via `saveInvoice`. On success, marks sent; on failure, enqueues for retry.
5. **Always returns HTTP 200 to Shopify** (even on error) to prevent Shopify webhook retries — failures are handled internally via the queue, not by letting Shopify re-deliver.

### Offline order recovery (working-hours queue)
The MyPOS machine is only online during business hours, so orders that arrive while it's off must be held and delivered later. This is a **file-backed queue, no database**:
- `services/workingHours.js` — `isWithinWorkingHours()` checks the current time in `MYPOS_TIMEZONE` (default `Asia/Colombo`) against separate weekday/weekend windows from env. Correctly handles overnight windows (start > end).
- `services/orderQueue.js` — persists to JSON files under `queue/` (gitignored): `failed-orders.json`, `sent-invoices.json` (dedup list, capped at 5000), and `queue-log.txt`.
- `services/queueRetryJob.js` — `startRetryJob()` is launched from `index.js` on boot. It runs `flushQueue` on an interval (`QUEUE_RETRY_INTERVAL_MS`, default 5 min), but only *does* anything during working hours. Uses an `isRunning` guard to avoid overlapping runs.

### Stock sync flow (MyPOS → Shopify)
`shopifyController.syncMyPOSStockToShopify` (POST `/shopify/sync-stock`) fetches MyPOS stock (`getMyPOSStockData`) and existing Shopify SKUs in parallel, then: updates inventory for matching SKUs (skips if unchanged), and creates new Shopify products for unmatched ones. Product grouping derives a base title + size variant by splitting `ProductDescription` on the last space. Shopify writes are throttled with `p-limit` (`CONCURRENCY_LIMIT = 2`). `syncStockToShopify` is an older create-only variant of the same logic.

### Auth
JWT via `authMiddleware.verifyToken` (expects `Authorization: Bearer <token>`). Login (`authController.login`) checks against a **hardcoded in-memory user list** in `src/config/users/users.js`. Protection is applied inconsistently per-route — check the specific route file before assuming an endpoint is protected. Webhook routes are unauthenticated.

## Logging

There is no logging library. Each controller/service appends timestamped lines to its own `*-log.txt` file next to the source (e.g. `src/controllers/shopify-webhook-log.txt`, `src/services/mypos-service-log.txt`) via `fs.appendFileSync`, and also `console.log`s. The queue logs go to `queue/queue-log.txt`. Some of these `.txt` logs are committed to git.
