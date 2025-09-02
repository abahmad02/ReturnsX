#!/usr/bin/env node

/**
 * Test script to verify ReturnsX webhook functionality
 * Tests webhook handlers and database operations
 */

const crypto = require('crypto');

// Mock webhook payloads for testing
const mockWebhookData = {
  orderCreated: {
    id: 1234567890,
    customer: {
      id: 123456,
      phone: "+923001234567",
      email: "test@example.com"
    },
    billing_address: {
      address1: "123 Test Street",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan"
    },
    shipping_address: {
      address1: "123 Test Street", 
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan"
    },
    total_price: "2500.00",
    currency: "PKR",
    financial_status: "pending",
    fulfillment_status: null
  },
  
  orderPaid: {
    id: 1234567890,
    customer: {
      id: 123456,
      phone: "+923001234567",
      email: "test@example.com"
    },
    total_price: "2500.00",
    currency: "PKR",
    financial_status: "paid",
    fulfillment_status: null,
    payment_gateway_names: ["cod"],
    processed_at: new Date().toISOString()
  },
  
  orderFulfilled: {
    id: 1234567890,
    customer: {
      id: 123456,
      phone: "+923001234567",
      email: "test@example.com"
    },
    total_price: "2500.00",
    currency: "PKR",
    fulfillment_status: "fulfilled",
    fulfillments: [
      {
        id: 98765,
        status: "success",
        tracking_number: "TRK123456"
      }
    ]
  },
  
  refundCreated: {
    id: 555666777,
    order_id: 1234567890,
    amount: "2500.00",
    currency: "PKR",
    reason: "Customer returned item",
    note: "Item was damaged",
    created_at: new Date().toISOString()
  }
};

// Function to generate HMAC signature for webhook verification
function generateHmacSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
}

// Test webhook endpoints
async function testWebhookEndpoint(endpoint, payload, topic) {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || 'test_secret';
  const payloadString = JSON.stringify(payload);
  const signature = generateHmacSignature(payloadString, webhookSecret);
  
  try {
    console.log(`\n🧪 Testing ${topic} webhook...`);
    
    const response = await fetch(`http://localhost:3000${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': signature,
        'X-Shopify-Topic': topic,
        'X-Shopify-Shop-Domain': 'test-shop.myshopify.com'
      },
      body: payloadString
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${topic} webhook successful:`, result);
    } else {
      console.log(`❌ ${topic} webhook failed:`, result);
    }
    
    return response.ok;
    
  } catch (error) {
    console.error(`❌ Error testing ${topic} webhook:`, error.message);
    return false;
  }
}

// Test database operations directly
async function testDatabaseOperations() {
  console.log('\n📊 Testing database operations...');
  
  try {
    // Test customer profile creation
    const profileResponse = await fetch('http://localhost:3000/api/customer-profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '+923001234567',
        email: 'test@example.com',
        address: '123 Test Street, Karachi'
      })
    });
    
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Customer profile created/retrieved:', {
        id: profile.id,
        riskTier: profile.riskTier,
        riskScore: profile.riskScore
      });
      return true;
    } else {
      console.log('❌ Failed to create customer profile');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    return false;
  }
}

// Main test function
async function runWebhookTests() {
  console.log('🚀 ReturnsX Webhook Functionality Test');
  console.log('=====================================');
  
  // Check if server is running
  try {
    const healthCheck = await fetch('http://localhost:3000/api/health');
    if (!healthCheck.ok) {
      throw new Error('Server not responding');
    }
    console.log('✅ Server is running on localhost:3000');
  } catch (error) {
    console.error('❌ Server is not running. Please start the development server with: npm run dev');
    process.exit(1);
  }
  
  // Test database operations first
  const dbTest = await testDatabaseOperations();
  if (!dbTest) {
    console.error('❌ Database operations failed. Check your database connection.');
    process.exit(1);
  }
  
  // Test webhook endpoints in order (simulating customer journey)
  const tests = [
    {
      endpoint: '/webhooks/orders/created',
      payload: mockWebhookData.orderCreated,
      topic: 'orders/create'
    },
    {
      endpoint: '/webhooks/orders/paid', 
      payload: mockWebhookData.orderPaid,
      topic: 'orders/paid'
    },
    {
      endpoint: '/webhooks/orders/fulfilled',
      payload: mockWebhookData.orderFulfilled,
      topic: 'orders/fulfilled'
    },
    {
      endpoint: '/webhooks/refunds/created',
      payload: mockWebhookData.refundCreated,
      topic: 'refunds/create'
    }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    const success = await testWebhookEndpoint(test.endpoint, test.payload, test.topic);
    if (success) passedTests++;
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${tests.length} webhook tests`);
  
  if (passedTests === tests.length) {
    console.log('🎉 All webhook tests passed! Your webhook system is working correctly.');
  } else {
    console.log('⚠️  Some webhook tests failed. Check the logs above for details.');
  }
  
  // Final verification - check if data was saved
  console.log('\n🔍 Verifying data was saved to database...');
  
  try {
    const customerCheck = await fetch('http://localhost:3000/api/customer-profiles/+923001234567');
    if (customerCheck.ok) {
      const customer = await customerCheck.json();
      console.log('✅ Customer data found in database:', {
        totalOrders: customer.totalOrders,
        successfulDeliveries: customer.successfulDeliveries,
        failedAttempts: customer.failedAttempts,
        riskTier: customer.riskTier
      });
    } else {
      console.log('❌ Customer data not found in database');
    }
  } catch (error) {
    console.error('❌ Error checking saved data:', error.message);
  }
}

// Run the tests
if (require.main === module) {
  runWebhookTests().catch(console.error);
}

module.exports = { runWebhookTests, testWebhookEndpoint };
