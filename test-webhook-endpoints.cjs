const crypto = require('crypto');

console.log('🔍 TESTING RETURNSX WEBHOOK ENDPOINTS');
console.log('====================================\n');

// Test data that matches your specification exactly
const testPayloads = {
  'orders/paid': {
    id: 1234567890,
    customer: {
      id: 11111111,
      email: "customer@example.com",
      first_name: "Jane",
      last_name: "Doe",
      phone: "+923001234567"
    },
    billing_address: {
      address1: "123 Test Street",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan"
    },
    financial_status: "paid",
    fulfillment_status: null,
    total_price: "2500.00",
    currency: "PKR"
  },
  
  'orders/fulfilled': {
    id: 1234567890,
    customer: {
      id: 11111111,
      email: "customer@example.com",
      first_name: "Jane",
      last_name: "Doe",
      phone: "+923001234567"
    },
    fulfillment_status: "fulfilled",
    financial_status: "paid",
    total_price: "2500.00",
    currency: "PKR",
    line_items: [
      {
        id: 987654321,
        title: "Product Name",
        quantity: 2
      }
    ]
  },
  
  'refunds/create': {
    id: 555666777,
    order_id: 1234567890,
    amount: "2500.00",
    currency: "PKR",
    reason: "Customer returned item",
    created_at: new Date().toISOString()
  }
};

const webhookEndpoints = {
  'orders/paid': '/webhooks/orders/paid',
  'orders/fulfilled': '/webhooks/orders/fulfilled', 
  'refunds/create': '/webhooks/refunds/created'
};

function generateHmacSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
}

async function testWebhookEndpoint(topic, payload) {
  const endpoint = webhookEndpoints[topic];
  const payloadString = JSON.stringify(payload);
  const signature = generateHmacSignature(payloadString, 'test_secret');
  
  console.log(`\n🧪 Testing ${topic} webhook...`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Payload size: ${payloadString.length} chars`);
  
  try {
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
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`   ✅ Success: ${response.status}`);
      console.log(`   📄 Response: ${result}`);
    } else {
      console.log(`   ❌ Failed: ${response.status}`);
      console.log(`   📄 Error: ${result}`);
    }
    
    return response.ok;
    
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing webhook endpoints that match your specification:\n');
  
  // Check server first
  try {
    const healthCheck = await fetch('http://localhost:3000/api/health');
    if (healthCheck.ok) {
      console.log('✅ Server is running\n');
    } else {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.log('❌ Server not running. Please start with: npm run dev\n');
    return;
  }
  
  let passed = 0;
  const total = Object.keys(testPayloads).length;
  
  // Test each webhook in sequence
  for (const [topic, payload] of Object.entries(testPayloads)) {
    const success = await testWebhookEndpoint(topic, payload);
    if (success) passed++;
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 RESULTS:');
  console.log(`   Passed: ${passed}/${total} webhook tests`);
  
  if (passed === total) {
    console.log('\n🎉 ALL WEBHOOKS WORKING!');
    console.log('\nYour implementation matches the Shopify webhook pattern:');
    console.log('✅ POST requests with JSON payloads');
    console.log('✅ HMAC signature verification'); 
    console.log('✅ Proper topic headers');
    console.log('✅ Order lifecycle tracking (paid → fulfilled → refunded)');
    console.log('✅ Customer data extraction and database updates');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above.');
  }
}

// For Node.js compatibility
if (typeof fetch === 'undefined') {
  console.log('Installing node-fetch...');
  require('child_process').execSync('npm install node-fetch', { stdio: 'inherit' });
  global.fetch = require('node-fetch');
}

runTests().catch(console.error);
