const express = require('express');
const router = express.Router();
const {
  getProducts,
  getTotalStock,
  getUpdateStock
} = require('../controllers/myposController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/products', getProducts);
router.get('/total-stock', verifyToken,getTotalStock);
router.get('/update-stock', getUpdateStock);


module.exports = router;