const shopify = require('../config/shopify');
const { getExistingShopifySKUs, createShopifyProduct,getExistingShopifySKUsWithInventoryId,updateShopifyInventoryLevel,updateShopifyInventory } = require('../services/shopifyService');
const { getMyPOSStockData } = require('../services/getMyPOSStockData');
const {
  VENDOR_NAME,
  PRODUCT_TYPE,
  PRODUCT_OPTION_NAME,
  buildProductDescription,
  PRODUCT_STATUS,
} = require('../config/shopifyConfig');
const pLimit = require('p-limit');


const CONCURRENCY_LIMIT = 2;

exports.getProducts = async (req, res) => {
  try {
    const products = await shopify.product.list({ limit: 100 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { limit = 10, order = 'created_at DESC' } = req.query;
    const inventory = await shopify.product.list({
      limit: parseInt(limit),
      order
    });
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

exports.createProduct = async (req, res) => {
  const { title, price, quantity } = req.body;

  if (!title || !price || quantity === undefined) {
    return res.status(400).json({ error: 'Title, price, and quantity are required' });
  }

  try {
    const newProduct = await shopify.product.create({
      title,
      body_html: "<strong>Auto-created via API</strong>",
      vendor: "My Vendor",
      product_type: "Custom Product",
      variants: [
        {
          option1: "Default",
          price,
          sku: `SKU-${Date.now()}`,
          inventory_management: "shopify",
          inventory_quantity: quantity
        }
      ]
    });

    res.status(201).json({ message: 'Product created', product: newProduct });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};



exports.syncStockToShopify = async (req, res) => {
  try {
    console.log('Syncing stock to Shopify...');

    // STEP 1: Get existing SKUs and MyPOS stock data
    const [existingSKUs, products] = await Promise.all([
      getExistingShopifySKUs(),
      getMyPOSStockData()
    ]);

    const productMap = new Map();

    // STEP 2: Group and prepare products
    for (const product of products) {
      const fullDesc = product.ProductDescription?.trim();
      if (!fullDesc) continue;

      const parts = fullDesc.split(' ');
      const size = parts.pop();
      const baseTitle = parts.join(' ').trim();
      const sku = product.StockCode?.trim().toLowerCase();

      if (existingSKUs.has(sku)) continue;

      if (!productMap.has(baseTitle)) {
        productMap.set(baseTitle, {
          title: baseTitle,
          webDescription: product.WebProductDescription || baseTitle,
          webImagePath: product.WebImagePath || '',
          variants: []
        });
      }

      const productEntry = productMap.get(baseTitle);

      productEntry.variants.push({
        option1: size || "Default",
        price: product.SellingPrice > 0 ? product.SellingPrice.toString() : "0.01",
        sku: product.StockCode,
        inventory_management: "shopify",
        inventory_quantity: Math.max(product.Stock, 0),
        cost: product.CostPrice > 0 ? product.CostPrice.toString() : undefined
      });
    }

    // STEP 3: Create products
    const groupedProducts = Array.from(productMap.values());
    const createdProducts = [];

    for (const product of groupedProducts) {
      try {
        const newProduct = await createShopifyProduct({
          title: product.title,
          body_html: buildProductDescription(product.webDescription),
          vendor: VENDOR_NAME,
          product_type: PRODUCT_TYPE,
          options: [{ name: PRODUCT_OPTION_NAME }],
          variants: product.variants,
          status: PRODUCT_STATUS,
          images: product.webImagePath ? [{ src: product.webImagePath }] : undefined
        });

        createdProducts.push(newProduct);
      } catch (err) {
        console.error(`Error creating product "${product.title}":`, err.message);
        continue;
      }
    }

    return res.status(201).json({
      status: 1,
      message: `Successfully created ${createdProducts.length} products in Shopify.`,
      products: createdProducts
    });

  } catch (error) {
    console.error('Error syncing stock to Shopify:', error);
    return res.status(500).json({
      status: 0,
      message: 'Failed to sync stock to Shopify.',
      error: error.message
    });
  }
};

exports.updateStockBySKU = async (req, res) => {
  try {
    const updates = req.body; // Expecting an array of { sku, stock }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid request body. Must be a non-empty array of { sku, stock }'
      });
    }

    // STEP 1: Get existing Shopify SKUs with inventory item info
    const existingInventoryMap = await getExistingShopifySKUsWithInventoryId(); // Map { sku: { inventory_item_id, location_id } }

    const updated = [];
    const notFound = [];

    // STEP 2: Loop through given SKUs and update if found
    for (const { sku, stock } of updates) {
      const cleanSku = sku?.trim().toLowerCase();
      const stockQty = Math.max(stock ?? 0, 0);

      if (!cleanSku || !existingInventoryMap.has(cleanSku)) {
        notFound.push(cleanSku);
        continue;
      }

      const { inventory_item_id, location_id } = existingInventoryMap.get(cleanSku);

      try {
        await updateShopifyInventoryLevel({
          inventory_item_id,
          location_id,
          available: stockQty
        });

        updated.push({ sku: cleanSku, updatedStock: stockQty });
      } catch (err) {
        console.error(`Error updating stock for SKU: ${cleanSku}`, err.message);
      }
    }

    return res.status(200).json({
      status: 1,
      message: `Stock updated for ${updated.length} SKUs.`,
      updated,
      notFound
    });

  } catch (error) {
    console.error('Error updating stock by SKU:', error);
    return res.status(500).json({
      status: 0,
      message: 'Internal server error.',
      error: error.message
    });
  }
};

const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(__dirname, 'shopify-sync-log.txt');

function logAction(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(logMsg.trim());
}

// exports.syncMyPOSStockToShopify = async (req, res) => {
//   try {
//     logAction('🔄 Starting stock sync with Shopify...');

//     // STEP 1: Get existing Shopify SKUs and stock data
//     const [existingShopifyProducts, myPOSProducts] = await Promise.all([
//       getExistingShopifySKUs(), // Must return array of { sku, inventory_quantity }
//       getMyPOSStockData()
//     ]);

//     console.log(`Found ${existingShopifyProducts.size} existing Shopify SKUs.`);
//     console.log(`Found ${myPOSProducts} MyPOS products to process.`);

//     const shopifyStockMap = new Map();
    
//     for (const [sku, details] of existingShopifyProducts.entries()) {
//       shopifyStockMap.set(sku, details.inventory_quantity);
//     }

//     const productMap = new Map();
//     const createdProducts = [];
//     const updatedProducts = [];
//     const skippedProducts = [];

//     for (const product of myPOSProducts) {
//       const fullDesc = product.ProductDescription?.trim();
//       if (!fullDesc) continue;

//       const parts = fullDesc.split(' ');
//       const size = parts.pop();
//       const baseTitle = parts.join(' ').trim();
//       const sku = product.StockCode?.trim().toLowerCase();
//       const myPOSStock = Math.max(product.Stock, 0);

//       if (!sku) continue;

//       const existingStock = shopifyStockMap.get(sku);

//       // If SKU exists
//       if (shopifyStockMap.has(sku)) {
//         if (existingStock !== myPOSStock) {
//           // Update stock on Shopify
//           try {
//             await updateShopifyInventory(sku, myPOSStock, existingShopifyProducts);
//             updatedProducts.push({ sku, from: existingStock, to: myPOSStock });
//             logAction(`✅ Updated stock for SKU ${sku} from ${existingStock} to ${myPOSStock}`);
//           } catch (err) {
//             logAction(`❌ Error updating SKU ${sku}: ${err.message}`);
//           }
//         } else {
//           skippedProducts.push({ sku, stock: myPOSStock });
//           logAction(`⏩ SKU ${sku} stock (${myPOSStock}) already correct, skipped.`);
//         }
//         continue;
//       }

//       // If SKU doesn't exist, prepare to create
//       if (!productMap.has(baseTitle)) {
//         productMap.set(baseTitle, {
//           title: baseTitle,
//           webDescription: product.WebProductDescription || baseTitle,
//           webImagePath: product.WebImagePath || '',
//           variants: []
//         });
//       }

//       productMap.get(baseTitle).variants.push({
//         option1: size || "Default",
//         price: product.SellingPrice > 0 ? product.SellingPrice.toString() : "0.01",
//         sku: product.StockCode,
//         inventory_management: "shopify",
//         inventory_quantity: myPOSStock,
//         cost: product.CostPrice > 0 ? product.CostPrice.toString() : undefined
//       });
//     }

//     // STEP 3: Create new products
//     for (const product of Array.from(productMap.values())) {
//       try {
//         const newProduct = await createShopifyProduct({
//           title: product.title,
//           body_html: buildProductDescription(product.webDescription),
//           vendor: VENDOR_NAME,
//           product_type: PRODUCT_TYPE,
//           options: [{ name: PRODUCT_OPTION_NAME }],
//           variants: product.variants,
//           status: PRODUCT_STATUS,
//           images: product.webImagePath ? [{ src: product.webImagePath }] : undefined
//         });

//         createdProducts.push(newProduct);
//         logAction(`🆕 Created new product "${product.title}" with ${product.variants.length} variant(s).`);
//       } catch (err) {
//         logAction(`❌ Error creating product "${product.title}": ${err.message}`);
//       }
//     }

//     // Final response
//     return res.status(201).json({
//       status: 1,
//       message: `Sync complete. Created: ${createdProducts.length}, Updated: ${updatedProducts.length}, Skipped: ${skippedProducts.length}`,
//       created: createdProducts,
//       updated: updatedProducts,
//       skipped: skippedProducts
//     });

//   } catch (error) {
//     logAction(`🚨 Error during sync: ${error.message}`);
//     return res.status(500).json({
//       status: 0,
//       message: 'Failed to sync stock to Shopify.',
//       error: error.message
//     });
//   }
// };

exports.syncMyPOSStockToShopify = async (req, res) => {
  const startTime = Date.now(); 
  try {
    logAction('🔄 Starting stock sync with Shopify...');

    const [existingShopifyProducts, myPOSProducts] = await Promise.all([
      getExistingShopifySKUs(), 
      getMyPOSStockData()
    ]);

    logAction(`🛒 Shopify SKUs: ${existingShopifyProducts.size}`);
    logAction(`🏪 MyPOS Products: ${myPOSProducts.length}`);

    const {
      productMap,
      updatedProducts,
      skippedProducts
    } = await syncExistingProducts(myPOSProducts, existingShopifyProducts);

    const createdProducts = await createNewShopifyProducts(productMap);
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    logAction(`⏱️ Sync process completed in ${durationMs} ms`);
    return res.status(201).json(
      {
      status: 1,
      message: `✅ Sync complete. Created: ${createdProducts.length}, Updated: ${updatedProducts.length}, Skipped: ${skippedProducts.length}`,
      created: createdProducts,
      updated: updatedProducts,
      skipped: skippedProducts,
      durationMs
    });
    

  } catch (error) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    logAction(`🚨 Sync error: ${error.message}`);
    return res.status(500).json({
      status: 0,
      message: 'Failed to sync stock to Shopify.',
      error: error.message,
      durationMs
    });
  }
};

// Handle existing SKUs (update stock if needed)
async function syncExistingProducts(myPOSProducts, shopifyStockMap) {
  const productMap = new Map();
  const updatedProducts = [];
  const skippedProducts = [];

  const limit = pLimit(CONCURRENCY_LIMIT);
  const updateTasks = [];

  for (const product of myPOSProducts) {
    const fullDesc = product.ProductDescription?.trim();
    if (!fullDesc) continue;

    const parts = fullDesc.split(' ');
    const size = parts.pop();
    const baseTitle = parts.join(' ').trim();
    const sku = product.StockCode?.trim().toLowerCase();
    const myPOSStock = Math.max(product.Stock, 0);

    if (!sku) continue;

    if (shopifyStockMap.has(sku)) {
      const existingStock = shopifyStockMap.get(sku).inventory_quantity;

      if (existingStock !== myPOSStock) {
        updateTasks.push(limit(async () => {
          try {
            await updateShopifyInventory(sku, myPOSStock, shopifyStockMap);
            updatedProducts.push({ sku, from: existingStock, to: myPOSStock });
            logAction(`✅ Updated SKU ${sku}: ${existingStock} ➝ ${myPOSStock}`);
          } catch (err) {
            logAction(`❌ Error updating SKU ${sku}: ${err.message}`);
          }
        }));
      } else {
        skippedProducts.push({ sku, stock: myPOSStock });
      }

      continue;
    }

    // SKU doesn't exist - prepare for creation
    if (!productMap.has(baseTitle)) {
      productMap.set(baseTitle, {
        title: baseTitle,
        webDescription: product.WebProductDescription || baseTitle,
        webImagePath: product.WebImagePath || '',
        variants: []
      });
    }

    productMap.get(baseTitle).variants.push({
      option1: size || 'Default',
      price: product.SellingPrice > 0 ? product.SellingPrice.toString() : '0.01',
      sku: product.StockCode,
      inventory_management: 'shopify',
      inventory_quantity: myPOSStock,
      cost: product.CostPrice > 0 ? product.CostPrice.toString() : undefined
    });
  }

  await Promise.allSettled(updateTasks);

  return { productMap, updatedProducts, skippedProducts };
}

// Create new products on Shopify
async function createNewShopifyProducts(productMap) {
  const createdProducts = [];

  for (const product of Array.from(productMap.values())) {
    try {
      const newProduct = await createShopifyProduct({
        title: product.title,
        body_html: buildProductDescription(product.webDescription),
        vendor: VENDOR_NAME,
        product_type: PRODUCT_TYPE,
        options: [{ name: PRODUCT_OPTION_NAME }],
        variants: product.variants,
        status: PRODUCT_STATUS,
        images: product.webImagePath ? [{ src: product.webImagePath }] : undefined
      });

      createdProducts.push(newProduct);
      logAction(`🆕 Created "${product.title}" with ${product.variants.length} variants`);
    } catch (err) {
      logAction(`❌ Failed to create "${product.title}": ${err.message}`);
    }
  }

  return createdProducts;
}