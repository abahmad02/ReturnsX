#!/usr/bin/env node

/**
 * Debug Webhook Processing
 * 
 * This script simulates a webhook call to test our webhook processing
 */

import https from 'https';

const BASE_URL = 'https://collect-point-ryan-plate.trycloudflare.com';

console.log('🐛 Debug Webhook Processing\n');
console.log('=====================================\n');

// Sample order payload (similar to what Shopify sends)
const sampleOrderPayload = {
  "id": 999999999,
  "email": "test-webhook@example.com",
  "created_at": "2025-01-23T20:30:00-05:00",
  "updated_at": "2025-01-23T20:30:00-05:00",
  "number": 1001,
  "note": null,
  "token": "test-token-123",
  "gateway": "Cash on Delivery (COD)",
  "test": true,
  "total_price": "50.00",
  "subtotal_price": "50.00",
  "total_weight": 0,
  "total_tax": "0.00",
  "taxes_included": false,
  "currency": "USD",
  "financial_status": "pending",
  "confirmed": true,
  "total_discounts": "0.00",
  "total_line_items_price": "50.00",
  "cart_token": null,
  "buyer_accepts_marketing": false,
  "name": "#1001",
  "referring_site": null,
  "landing_site": "/",
  "cancelled_at": null,
  "cancel_reason": null,
  "total_price_usd": "50.00",
  "checkout_token": null,
  "reference": null,
  "user_id": null,
  "location_id": null,
  "source_identifier": null,
  "source_url": null,
  "processed_at": "2025-01-23T20:30:00-05:00",
  "device_id": null,
  "phone": "+1234567890",
  "customer_url": null,
  "order_number": 1001,
  "discount_applications": [],
  "discount_codes": [],
  "note_attributes": [],
  "payment_gateway_names": ["Cash on Delivery (COD)"],
  "processing_method": "manual",
  "checkout_id": null,
  "source_name": "web",
  "fulfillment_status": null,
  "tax_lines": [],
  "tags": "",
  "contact_email": "test-webhook@example.com",
  "order_status_url": null,
  "presentment_currency": "USD",
  "total_line_items_price_set": {
    "shop_money": {
      "amount": "50.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "50.00",
      "currency_code": "USD"
    }
  },
  "total_discounts_set": {
    "shop_money": {
      "amount": "0.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "0.00",
      "currency_code": "USD"
    }
  },
  "total_shipping_price_set": {
    "shop_money": {
      "amount": "0.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "0.00",
      "currency_code": "USD"
    }
  },
  "subtotal_price_set": {
    "shop_money": {
      "amount": "50.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "50.00",
      "currency_code": "USD"
    }
  },
  "total_price_set": {
    "shop_money": {
      "amount": "50.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "50.00",
      "currency_code": "USD"
    }
  },
  "total_tax_set": {
    "shop_money": {
      "amount": "0.00",
      "currency_code": "USD"
    },
    "presentment_money": {
      "amount": "0.00",
      "currency_code": "USD"
    }
  },
  "line_items": [
    {
      "id": 888888888,
      "variant_id": 777777777,
      "title": "Test Product",
      "quantity": 1,
      "sku": "TEST-SKU",
      "variant_title": null,
      "vendor": "Test Vendor",
      "fulfillment_service": "manual",
      "product_id": 666666666,
      "requires_shipping": true,
      "taxable": true,
      "gift_card": false,
      "name": "Test Product",
      "variant_inventory_management": "shopify",
      "properties": [],
      "product_exists": true,
      "fulfillable_quantity": 1,
      "grams": 0,
      "price": "50.00",
      "total_discount": "0.00",
      "fulfillment_status": null,
      "price_set": {
        "shop_money": {
          "amount": "50.00",
          "currency_code": "USD"
        },
        "presentment_money": {
          "amount": "50.00",
          "currency_code": "USD"
        }
      },
      "total_discount_set": {
        "shop_money": {
          "amount": "0.00",
          "currency_code": "USD"
        },
        "presentment_money": {
          "amount": "0.00",
          "currency_code": "USD"
        }
      },
      "discount_allocations": [],
      "duties": [],
      "admin_graphql_api_id": "gid://shopify/LineItem/888888888",
      "tax_lines": []
    }
  ],
  "fulfillments": [],
  "refunds": [],
  "total_tip_received": "0.0",
  "original_total_duties_set": null,
  "current_total_duties_set": null,
  "admin_graphql_api_id": "gid://shopify/Order/999999999",
  "shipping_lines": [],
  "billing_address": {
    "first_name": "Test",
    "address1": "123 Test Street",
    "phone": "+1234567890",
    "city": "Test City",
    "zip": "12345",
    "province": "Test State",
    "country": "United States",
    "last_name": "Customer",
    "address2": null,
    "company": null,
    "latitude": null,
    "longitude": null,
    "name": "Test Customer",
    "country_code": "US",
    "province_code": "TS"
  },
  "shipping_address": {
    "first_name": "Test",
    "address1": "123 Test Street",
    "phone": "+1234567890",
    "city": "Test City",
    "zip": "12345",
    "province": "Test State",
    "country": "United States",
    "last_name": "Customer",
    "address2": null,
    "company": null,
    "latitude": null,
    "longitude": null,
    "name": "Test Customer",
    "country_code": "US",
    "province_code": "TS"
  },
  "customer": {
    "id": 555555555,
    "email": "test-webhook@example.com",
    "accepts_marketing": false,
    "created_at": "2025-01-23T20:30:00-05:00",
    "updated_at": "2025-01-23T20:30:00-05:00",
    "first_name": "Test",
    "last_name": "Customer",
    "orders_count": 1,
    "state": "enabled",
    "total_spent": "50.00",
    "last_order_id": 999999999,
    "note": null,
    "verified_email": true,
    "multipass_identifier": null,
    "tax_exempt": false,
    "phone": "+1234567890",
    "tags": "",
    "last_order_name": "#1001",
    "currency": "USD",
    "accepts_marketing_updated_at": "2025-01-23T20:30:00-05:00",
    "marketing_opt_in_level": null,
    "tax_exemptions": [],
    "admin_graphql_api_id": "gid://shopify/Customer/555555555",
    "default_address": {
      "id": 444444444,
      "customer_id": 555555555,
      "first_name": "Test",
      "last_name": "Customer",
      "company": null,
      "address1": "123 Test Street",
      "address2": null,
      "city": "Test City",
      "province": "Test State",
      "country": "United States",
      "zip": "12345",
      "phone": "+1234567890",
      "name": "Test Customer",
      "province_code": "TS",
      "country_code": "US",
      "country_name": "United States",
      "default": true
    }
  }
};

async function testWebhookProcessing() {
  console.log('📡 Testing webhook endpoint with sample order...\n');
  
  const payload = JSON.stringify(sampleOrderPayload);
  
  return new Promise((resolve, reject) => {
    const url = new URL('/webhooks/orders/created', BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Shopify-Topic': 'orders/create',
        'X-Shopify-Shop-Domain': 'test-debug-shop.myshopify.com',
        'X-Shopify-Hmac-Sha256': 'test-signature',
        'User-Agent': 'ReturnsX-Debug-Tool'
      }
    };

    console.log('🎯 Sending request to:', `${BASE_URL}${url.pathname}`);
    console.log('📋 Headers:', options.headers);
    console.log('📦 Payload preview:', {
      orderId: sampleOrderPayload.id,
      customerEmail: sampleOrderPayload.customer?.email,
      customerPhone: sampleOrderPayload.customer?.phone,
      totalPrice: sampleOrderPayload.total_price
    });
    console.log();

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let responseData;
        try {
          responseData = JSON.parse(body);
        } catch (error) {
          responseData = body;
        }
        
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('🔍 Webhook Processing Debug Tool\n');
  
  console.log('📋 What this test does:');
  console.log('1. Sends a sample order webhook to your ReturnsX app');
  console.log('2. Bypasses Shopify signature verification (for testing)');
  console.log('3. Shows you the exact response and any errors');
  console.log('4. Helps identify what\'s causing the 100% failure rate\n');
  
  try {
    const response = await testWebhookProcessing();
    
    console.log('📊 Response Analysis:');
    console.log('='.repeat(50));
    console.log('Status:', response.status, response.statusText);
    console.log('Response Data:', response.data);
    console.log();
    
    if (response.status === 200) {
      console.log('✅ SUCCESS: Webhook processed without errors!');
      console.log('🎉 The database fix worked!');
      console.log();
      console.log('💡 Next steps:');
      console.log('- Check your ReturnsX dashboard for new customer');
      console.log('- Customer should appear with phone: +1234567890');
      console.log('- Email: test-webhook@example.com');
    } else {
      console.log('❌ ERROR: Webhook processing failed');
      console.log('🔍 This is why your real webhooks are failing');
      console.log();
      console.log('💡 Check your development console for detailed error logs');
    }
    
  } catch (error) {
    console.error('❌ Network error testing webhook:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🚀 After running this test:');
  console.log('1. Check your development console for webhook processing logs');
  console.log('2. Look for any error messages');
  console.log('3. Check ReturnsX dashboard to see if test customer appeared');
  console.log('4. If successful, your real orders should work too!');
}

main().catch(console.error);
