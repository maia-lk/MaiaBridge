const express = require('express');
const router = express.Router();
const {
  getProducts,
  getInventory,
  createProduct,
  syncStockToShopify,
  updateStockBySKU,
  syncMyPOSStockToShopify
} = require('../controllers/shopifyController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/products', getProducts);
router.get('/inventory', verifyToken,getInventory);
router.post('/create-product', createProduct);

router.post('/sync-stock', verifyToken, syncMyPOSStockToShopify);
router.post('/update-stock', verifyToken, updateStockBySKU);


module.exports = router;
