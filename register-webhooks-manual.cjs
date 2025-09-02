const https = require('https');

console.log('🔗 MANUAL WEBHOOK REGISTRATION');
console.log('=============================\n');

// This script will register webhooks directly with your authenticated Shopify app
async function registerWebhooksManually() {
  const appUrl = 'https://returnsx.pk'; // Your production URL
  
  console.log('Attempting to register webhooks via your app...\n');
  
  try {
    // Try to register webhooks through your app's endpoint
    const response = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({});
      
      const options = {
        hostname: 'returnsx.pk',
        port: 443,
        path: '/api/webhooks/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}\n`);
    
    if (response.statusCode === 200) {
      console.log('✅ Webhooks registered successfully!');
      console.log('\n🧪 Now test by creating orders in your Shopify store:');
      console.log('1. Create a test order');
      console.log('2. Mark it as paid → should trigger orders/paid webhook');
      console.log('3. Fulfill the order → should trigger orders/fulfilled webhook');
      console.log('4. Create a refund → should trigger refunds/create webhook');
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log('❌ Authentication required.');
      console.log('\n📋 SOLUTION: Use the app dashboard instead:');
      console.log('1. Go to your Shopify admin: https://returnsx123.myshopify.com/admin');
      console.log('2. Navigate to Apps → ReturnsX');
      console.log('3. Look for the "🔗 Setup Webhooks" button (should be visible now)');
      console.log('4. Click it to register webhooks');
    } else {
      console.log('❌ Webhook registration failed.');
      console.log('\n📋 ALTERNATIVE SOLUTIONS:');
      console.log('\n1. Use the app dashboard:');
      console.log('   • Refresh your ReturnsX app in Shopify');
      console.log('   • Look for the "🔗 Setup Webhooks" button');
      console.log('   • Click it to register webhooks');
      console.log('\n2. Register webhooks manually using Shopify CLI:');
      console.log('   • Run: shopify app generate webhook');
      console.log('   • Select the webhook topics you need');
      console.log('\n3. Register via Shopify Admin API (if you have access token):');
      showManualApiCommands();
    }
    
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
    console.log('📋 FALLBACK SOLUTION:');
    console.log('Use the app dashboard in Shopify to register webhooks.');
  }
}

function showManualApiCommands() {
  console.log('\nManual API Registration Commands:');
  console.log('================================');
  
  const webhooks = [
    { topic: 'orders/paid', endpoint: '/webhooks/orders/paid' },
    { topic: 'orders/fulfilled', endpoint: '/webhooks/orders/fulfilled' },
    { topic: 'refunds/create', endpoint: '/webhooks/refunds/created' }
  ];
  
  webhooks.forEach((webhook, index) => {
    console.log(`\n${index + 1}. Register ${webhook.topic}:`);
    console.log(`curl -X POST "https://YOUR-SHOP.myshopify.com/admin/api/2025-01/webhooks.json" \\`);
    console.log(`  -H "X-Shopify-Access-Token: YOUR-ACCESS-TOKEN" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "webhook": {`);
    console.log(`      "topic": "${webhook.topic}",`);
    console.log(`      "address": "https://returnsx.pk${webhook.endpoint}",`);
    console.log(`      "format": "json"`);
    console.log(`    }`);
    console.log(`  }'`);
  });
}

// Run the registration
registerWebhooksManually();
