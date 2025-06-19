const fs = require('fs');
const path = require('path');
const { callApi } = require('../config/apiClient');

const LOG_FILE = path.join(__dirname, 'mypos-service-log.txt');

function logService(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMsg);
  console.log(logMsg.trim());
}

/**
 * Converts Shopify order details to MyPOS invoice format
 * @param {Object} orderDetails - The processed order details from Shopify webhook
 * @returns {Object} Formatted MyPOS invoice object
 */
function convertOrderToInvoice(orderDetails) {
  const orderDate = new Date(orderDetails.created_at);
  const invoiceNumber = `INV${orderDetails.number.padStart(5, '0')}`;
  const grossAmount = parseFloat(orderDetails.total_price);
  const shippingCost = parseFloat(orderDetails.shipping_cost || '0.00');
  const netAmount = grossAmount;

  // Create line items for products
  const productItems = orderDetails.items.map((item, index) => ({
    DetailLineNo: index + 1,
    Salesman: "",
    ProductCode: item.sku || `ITEM${item.id.toString().padStart(6, '0')}`,
    StockCode: item.sku || `ITEM${item.id.toString().padStart(6, '0')}`,
    ProductReferenceCode: "",
    ProductDescription: item.name || item.title,
    ProductMeasurementUnit: "",
    CaseSize: 1,
    ProductCostPrice: 0.00, // Would need actual cost price from inventory system
    ProductSellingPrice: parseFloat(item.price),
    LineDiscontPercentage: 0.00,
    LineDiscountAmount: 0.00,
    CaseQuantity: 0,
    UnitQuantity: item.quantity,
    FreeQuantity: 0,
    Amount: parseFloat(item.price) * item.quantity,
    ServiceChargePercentage: 0.00,
    IsVoucher: 0,
    DetailLineVoid: 0
  }));

  // Add shipping as a separate line item only if shipping cost is greater than 0
  const invoiceDets = [...productItems];
  if (shippingCost > 0) {
    invoiceDets.push({
      DetailLineNo: productItems.length + 1, // Line numbering after products
      Salesman: "",
      ProductCode: "000001570", // Fixed shipping product code
      StockCode: "000001570", // Fixed shipping stock code
      ProductReferenceCode: "",
      ProductDescription: "DELIVERY CHARGES",
      ProductMeasurementUnit: "",
      CaseSize: 1,
      ProductCostPrice: 0.00,
      ProductSellingPrice: shippingCost,
      LineDiscontPercentage: 0.00,
      LineDiscountAmount: 0.00,
      CaseQuantity: 0,
      UnitQuantity: 1,
      FreeQuantity: 0,
      Amount: shippingCost,
      ServiceChargePercentage: 0.00,
      IsVoucher: 0,
      DetailLineVoid: 0
    });
  }

  const invoice = {
    InvoiceHed: {
      InvoiceNumber: invoiceNumber,
      SetupLocation: "001",
      InnerLocation: "001",
      StationId: "009",
      InvoiceDate: orderDate.toISOString(),
      InvoiceTime: orderDate.toISOString(),
      InvoiceEndDate: orderDate.toISOString(),
      InvoiceEndTime: orderDate.toISOString(),
      CashierId: "USER1",
      CashierSignOnDate: orderDate.toISOString(),
      CashierShift: 1,
      TemporaryCashierId: "",
      CustomerId: "",
      GrossAmount: grossAmount,
      DiscountPercentage: 0.00,
      DiscountAmount: 0.00,
      LineDiscountPercentageTotal: 0.00,
      LineDiscountAmountTotal: 0.00,
      NetAmount: netAmount,
      PaidAmount: netAmount,
      DueAmount: 0.00,
      ChangeAmount: 0.00,
      VATAmount: parseFloat(orderDetails.total_tax || '0.00'),
      NBTAmount: 0.00,
      InvoiceSlipPrint: 1,
      InvoiceCancel: 0,
      InvoiceProcessed: 1,
      ReferenceTransactionType: "",
      ReferenceTransactionDocNo: ""
    },
    InvoiceRemarks: [{
      Remark1: `CB${orderDetails.id.toString().padStart(8, '0')}`,
      Remark2: `Shopify Order #${orderDetails.number}`,
      Remark3: `Customer: ${orderDetails.customer.name}`,
      Remark4: `Date: ${orderDate.toLocaleDateString('en-US')}`,
      Remark5: "Online Payment"
    }],
    InvoiceDets: invoiceDets,
    InvoiceDetailRemarks: '',
    InvoicePayments: [{
      PaymentDetSequence: 1,
      PaymentHedCode: "CSH",
      PaymentDetCode: "VISA",
      PaymentReference: `SHOPIFY-${orderDetails.number}`,
      PayableAmount: netAmount,
      PaidAmount: netAmount,
      ForeignCurrencyAmount: 0.00,
      ForeignCurrencyvsLocalCurrencyRate: 0.00,
      ForeignCurrencyvsUSDollarRate: 0.00
    }],
    DeliveryAddress: {
      FirstName: orderDetails.shipping_address?.first_name || "",
      LastName: orderDetails.shipping_address?.last_name || "",
      Mobile: orderDetails.shipping_address?.phone || orderDetails.customer.phone,
      Email: orderDetails.customer.email,
      AddressLine1: orderDetails.shipping_address?.address1 || "",
      AddressLine2: orderDetails.shipping_address?.address2 || "",
      AddressLine3: orderDetails.shipping_address?.city || "",
      AddressLine4: orderDetails.shipping_address?.country || "",
      CreatedDate: orderDate.toISOString(),
      CreatedBy: "API_USER",
      ModifiedDate: orderDate.toISOString(),
      ModifiedBy: "API_USER"
    }
  };

  return invoice;
}

/**
 * Send invoice to MyPOS - production implementation
 * @param {Object} orderDetails - The order details from Shopify
 * @returns {Object} Result of the transaction
 */
async function sendTransactionToMyPOS(orderDetails) {
  try {
    // Build a proper invoice from the order details
    const singleInvoice = convertOrderToInvoice(orderDetails);
    
    // API expects an array of invoices
    const payload = [singleInvoice]; 
    logService(`Creating invoice for order #${orderDetails.number}`);
    logService(`Sending invoice to MyPOS API: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await callApi('saveInvoice', payload);
    
    // Validate API response
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid MyPOS API response');
    }

    const { Status, Message, Data, Exception } = response;

    // Log full response for debugging
    logService(`MyPOS API response for order #${orderDetails.number}: ${JSON.stringify(response, null, 2)}`);

    if (Status === 1) {
      logService(`Invoice ${Data?.[0] || 'unknown'} saved successfully for order #${orderDetails.number}`);
      return {
        success: true,
        status: Status,
        message: Message,
        invoiceNumber: Data?.[0] || null,
        response
      };
    } else {
      const errorMsg = Exception || Message || 'Unknown error occurred';
      logService(`Failed to save invoice for order #${orderDetails.number}: ${errorMsg}`);
      return {
        success: false,
        status: Status,
        message: errorMsg,
        invoiceNumber: null,
        response
      };
    }
  } catch (error) {
    logService(`Error saving invoice for order #${orderDetails.number}: ${error.message}`);
    console.error('Full error:', error);
    return {
      success: false,
      status: null,
      message: error.message,
      invoiceNumber: null,
      error: error.message
    };
  }
}

module.exports = {
  sendTransactionToMyPOS
};