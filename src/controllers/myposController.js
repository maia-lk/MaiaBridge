const { callApi } = require('../config/apiClient');

// Example: Get Products
exports.getProducts = async (req, res) => {
  try {
    const result = await callApi('getproducts', {  });

    if (result.Status === 1) {
      res.status(200).json({
        status: 1,
        message: 'Products retrieved successfully',
        data: result.Data,
      });
    } else {
      res.status(400).json({ status: 0, message: result.Message });
    }
  } catch (error) {
    res.status(500).json({ status: 0, message: 'API call failed', error: error.message });
  }
};

// Example: Get Total Stock
exports.getTotalStock = async (req, res) => {
  try {
    const result = await callApi('gettotalstockinhand', {});

    if (result.Status === 1) {
      res.status(200).json({
        status: 1,
        message: 'Total stock fetched',
        data: result.Data,
      });
    } else {
      res.status(400).json({ status: 0, message: result.Message });
    }
  } catch (error) {
    res.status(500).json({ status: 0, message: 'API call failed', error: error.message });
  }
};


    
exports.getUpdateStock = async (req, res) => {
    
    try {
      const result = await callApi('getupatedstockinhand', { Products: [],Location: [] });
      console.log(result);
  
      if (result.Status === 1) {
        res.status(200).json({
          status: 1,
          message: 'Total stock fetched',
          data: result.Data,
        });
      } else {
        res.status(400).json({ status: 0, message: result.Message });
      }
    } catch (error) {
      res.status(500).json({ status: 0, message: 'API call failed', error: error.message });
    }
  };