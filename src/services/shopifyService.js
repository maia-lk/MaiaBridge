const shopify = require('../config/shopify');
const {
    SHOPIFY_LOCATION_ID
  } = require('../config/shopifyConfig');

  async function getExistingShopifySKUs() {
    const products = await shopify.product.list({
      limit: 250,
      autoPage: true,
      status: 'any' // 👈 important to get all products
    });
  
    const skuMap = new Map();
  
    for (const product of products) {
      for (const variant of product.variants || []) {
        const rawSku = variant.sku;
        const sku = String(rawSku || '').trim().toLowerCase();
  
        if (sku) {
          skuMap.set(sku, {
            inventory_item_id: variant.inventory_item_id,
            location_id: SHOPIFY_LOCATION_ID,
            inventory_quantity: variant.inventory_quantity || 0
          });
        }
      }
    }
  
    console.log(`✅ Total SKUs fetched from Shopify: ${skuMap.size}`);
    return skuMap;
  }
  
  

async function createShopifyProduct(product) {
    return shopify.product.create(product);
}

async function getExistingShopifySKUsWithInventoryId() {
    const products = await shopify.product.list({ limit: 250, autoPage: true });
    const skuMap = new Map();

    for (const product of products) {
        for (const variant of product.variants || []) {
            const sku = variant.sku?.toLowerCase();
            if (sku) {
                skuMap.set(sku, {
                    inventory_item_id: variant.inventory_item_id,
                    location_id: SHOPIFY_LOCATION_ID
                });
            }
        }
    }

    return skuMap;
}

async function updateShopifyInventoryLevel({ inventory_item_id, location_id, available }) {
    await shopify.inventoryLevel.set({
      inventory_item_id,
      location_id,
      available
    });
  }
  
  async function updateShopifyInventory(sku, newQuantity, skuMap) {
    const skuKey = sku.toLowerCase();
    const inventoryData = skuMap.get(skuKey);
    if (!inventoryData) throw new Error(`SKU ${sku} not found in Shopify inventory map`);
  
    await updateShopifyInventoryLevel({
      inventory_item_id: inventoryData.inventory_item_id,
      location_id: SHOPIFY_LOCATION_ID,
      available: newQuantity
    });
  }

module.exports = {
    getExistingShopifySKUs,
    createShopifyProduct,
    updateShopifyInventoryLevel,
    getExistingShopifySKUsWithInventoryId,
    updateShopifyInventory
};
