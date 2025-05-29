// apiClient.js
const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'https://maiamypos.site/test';
const USERNAME = process.env.API_USERNAME || 'HLA0000';
const PASSWORD = process.env.API_PASSWORD || 'QKSDQJDSNP';

const getToken = async () => {
  const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  const response = await axios.post(
    `${API_BASE_URL}/?func=gettoken`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    }
  );

  if (response.data.Status === 1) {
    return response.data.Data;
  } else {
    throw new Error(`Token fetch failed: ${response.data.Message}`);
  }
};

// ✅ Generic function to make API calls with token
const callApi = async (funcName, payload = {}) => {
  try {
    const token = await getToken();

    const response = await axios.post(
      `${API_BASE_URL}/?func=${funcName}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Error calling API func=${funcName}:`, error.message);
    throw error;
  }
};

module.exports = {
  callApi,
};
