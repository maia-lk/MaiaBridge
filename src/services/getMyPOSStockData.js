const fs = require('fs/promises');
const { callApi } = require('../config/apiClient');


async function getMyPOSStockData() {

      //   This is a mockup of the API response
      const data = await fs.readFile('./test.json', 'utf-8');
      const response = JSON.parse(data);


    // const response = await callApi('gettotalstockinhand', {});
    return response?.Data?.Products || [];
  }

module.exports = {
    getMyPOSStockData
};
