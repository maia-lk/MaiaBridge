// MaiaBridge Project
// Copyright (c) 2025 Maia. All rights reserved.
// This project and its source code are the legal property of Maia.
// Unauthorized copying or distribution is prohibited.

const { callApi } = require('../config/apiClient');
/**
 * Send invoice to MyPOS - production implementation
 * @param {Object} orderDetails - The order details from Shopify
 */
async function sendTransactionToMyPOS(orderDetails) {
  try {
    // Build a proper invoice from the order details
    const singleInvoice = convertOrderToInvoice(orderDetails);
    
    // API expects an array of invoices
    const payload = [singleInvoice]; 
    console.log(`Creating invoice for order #${orderDetails.number}`);
    
    console.log(`Sending invoice to MyPOS API...`);
    const response = await callApi('saveInvoice', payload);
    
    console.log('Invoice saved successfully:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error saving invoice:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Converts a Shopify order to MyPOS invoice format
 */
function convertOrderToInvoice(orderDetails) {
  // Generate invoice number based on order number
  const newInvoiceNumber = `INV${orderDetails.number}`;
  const nowDate = new Date().toISOString();
  
  // Calculate total price
  const totalPrice = orderDetails.items.reduce((total, item) => {
    return total + (parseFloat(item.price) * parseInt(item.quantity));
  }, 0);

  // Customer information
  const customer = orderDetails.customer || {};
  const shippingAddress = orderDetails.shipping_address || {};
  const customerPhone = customer.phone || shippingAddress.phone || '';
  
  // Build the invoice object structure
  const singleInvoice = {
    InvoiceHed: {
      InvoiceNumber: newInvoiceNumber,
      SetupLocation: '001',
      InnerLocation: '001',
      StationId: '009',
      InvoiceDate: nowDate,
      InvoiceTime: nowDate,
      InvoiceEndDate: nowDate,
      InvoiceEndTime: nowDate,
      CashierId: 'USER1',
      CashierSignOnDate: nowDate,
      CashierShift: 1,
      TemporaryCashierId: '',
      CustomerId: customerPhone,
      // The following amounts refer to the entire order totals:
      GrossAmount: totalPrice,
      DiscountPercentage: 0.0,
      DiscountAmount: 0.0,
      LineDiscountPercentageTotal: 0.0,
      LineDiscountAmountTotal: 0.0,
      NetAmount: totalPrice,
      PaidAmount: totalPrice,
      DueAmount: 0.0,
      ChangeAmount: 0.0,
      VATAmount: 0.0,
      NBTAmount: 0.0,
      InvoiceSlipPrint: 1,
      InvoiceCancel: 0,
      InvoiceProcessed: 1,
      ReferenceTransactionType: 'SHOPIFY',
      ReferenceTransactionDocNo: orderDetails.number.toString()
    },
    InvoiceRemarks: [
      {
        Remark1: 'CB81201292',
        Remark2: `Shopify Order #${orderDetails.number}`,
        Remark3: `Customer: ${customer.name || 'N/A'}`,
        Remark4: `Date: ${new Date().toLocaleDateString()}`,
        Remark5: 'Online Payment'
      }
    ],
    InvoiceDets: orderDetails.items.map((item, index) => {
      const lineQuantity = parseInt(item.quantity);
      const lineSellingPrice = parseFloat(item.price);
      
      return {
        DetailLineNo: index + 1,
        Salesman: '',
        ProductCode: item.sku,
        StockCode: item.sku,
        ProductReferenceCode: '',
        ProductDescription: item.title || `Product ${item.sku}`,
        ProductMeasurementUnit: '',
        CaseSize: 1,
        ProductCostPrice: lineSellingPrice * 0.6, // Estimate cost as 60% of selling price if not provided
        ProductSellingPrice: lineSellingPrice,
        LineDiscontPercentage: 0.0,
        LineDiscountAmount: 0.0,
        CaseQuantity: 0,
        UnitQuantity: lineQuantity,
        FreeQuantity: 0,
        Amount: lineSellingPrice * lineQuantity,
        ServiceChargePercentage: 0.0,
        IsVoucher: 0,
        DetailLineVoid: 0
      };
    }),
    InvoiceDetailRemarks: orderDetails.items.map((item, index) => ({
      DetailLineNo: (index + 1).toString(),
      Remark: `Shopify Item: ${item.title || item.sku}`
    })),
    InvoicePayments: [
      {
        PaymentDetSequence: 1,
        PaymentHedCode: 'CRC', // Credit Card instead of Cash
        PaymentDetCode: 'VISA', // Using VISA as default
        PaymentReference: `SHOPIFY-${orderDetails.number}`,
        PayableAmount: totalPrice,
        PaidAmount: totalPrice,
        ForeignCurrencyAmount: 0.0,
        ForeignCurrencyvsLocalCurrencyRate: 0.0,
        ForeignCurrencyvsUSDollarRate: 0.0
      }
    ],
    DeliveryAddress: {
      FirstName: (shippingAddress.name || customer.name || '').split(' ')[0] || '',
      LastName: (shippingAddress.name || customer.name || '').split(' ').slice(1).join(' ') || '',
      Mobile: customerPhone.startsWith('94') ? customerPhone : `94${customerPhone.replace(/^0+/, '')}`,
      Email: customer.email || '',
      AddressLine1: shippingAddress.address1 || '',
      AddressLine2: shippingAddress.address2 || '',
      AddressLine3: shippingAddress.city || '',
      AddressLine4: shippingAddress.country || '',
      CreatedDate: nowDate,
      CreatedBy: 'API_USER',
      ModifiedDate: nowDate,
      ModifiedBy: 'API_USER'
    }
  };

  return singleInvoice;
}

module.exports = {
  sendTransactionToMyPOS
};
