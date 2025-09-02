const https = require('https');

console.log('🔧 FIXING WEBHOOK URLS');
console.log('=====================\n');

console.log('Issue detected:');
console.log('❌ Current webhook URL: https://alan-casual-printing-career.trycloudflare.com');
console.log('✅ Should be: https://returnsx.pk\n');

console.log('The webhooks are working, but pointing to the wrong URL!');
console.log('This happens when webhooks are registered during development.\n');

console.log('📋 SOLUTIONS (Try in order):');
console.log('============================\n');

console.log('1️⃣ EASIEST: Re-register webhooks via your app');
console.log('---------------------------------------------');
console.log('• Go to your ReturnsX app in Shopify');
console.log('• Click the "🔗 Setup Webhooks" button');
console.log('• This will update all webhook URLs to https://returnsx.pk\n');

console.log('2️⃣ MANUAL: Update webhooks via Shopify Admin');
console.log('--------------------------------------------');
console.log('• Go to: https://returnsx123.myshopify.com/admin/settings/notifications');
console.log('• Find the "Webhooks" section');
console.log('• Look for ReturnsX webhooks with the cloudflare URLs');
console.log('• Edit each one to use https://returnsx.pk instead\n');

console.log('3️⃣ API: Delete and recreate webhooks');
console.log('------------------------------------');
console.log('If you have access to your shop\'s access token:\n');

const correctWebhooks = [
  { topic: 'orders/fulfilled', endpoint: '/webhooks/orders/fulfilled' },
  { topic: 'orders/paid', endpoint: '/webhooks/orders/paid' },
  { topic: 'refunds/create', endpoint: '/webhooks/refunds/created' }
];

console.log('First, list existing webhooks:');
console.log('curl -H "X-Shopify-Access-Token: YOUR-TOKEN" \\');
console.log('     "https://returnsx123.myshopify.com/admin/api/2025-01/webhooks.json"\n');

console.log('Then delete the old ones and create new ones:');
correctWebhooks.forEach((webhook, index) => {
  console.log(`\n${index + 1}. Create ${webhook.topic}:`);
  console.log(`curl -X POST "https://returnsx123.myshopify.com/admin/api/2025-01/webhooks.json" \\`);
  console.log(`  -H "X-Shopify-Access-Token: YOUR-TOKEN" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "webhook": {`);
  console.log(`      "topic": "${webhook.topic}",`);
  console.log(`      "address": "https://returnsx.pk${webhook.endpoint}",`);
  console.log(`      "format": "json"`);
  console.log(`    }`);
  console.log(`  }'`);
});

console.log('\n🧪 VERIFY THE FIX:');
console.log('==================');
console.log('After updating the webhook URLs:');
console.log('1. Create a test order in your Shopify store');
console.log('2. Fulfill it to trigger the webhook');
console.log('3. Check if it reaches https://returnsx.pk successfully');
console.log('4. Verify data is saved in your database (npx prisma studio)\n');

console.log('💡 WHY THIS HAPPENED:');
console.log('=====================');
console.log('• Webhooks were registered during development using ngrok/cloudflare tunnel');
console.log('• The tunnel URL was temporary and is no longer active');
console.log('• Your production app is at https://returnsx.pk');
console.log('• Webhooks need to be updated to use the production URL\n');

console.log('🎯 EXPECTED RESULT:');
console.log('==================');
console.log('After fixing the URLs, you should see:');
console.log('✅ 200 OK responses instead of 503 errors');
console.log('✅ Webhook events processed successfully');
console.log('✅ Customer data saved to your database');
console.log('✅ Risk scores calculated and updated\n');

// Test if the correct endpoint is reachable
async function testProductionEndpoint() {
  console.log('🔍 TESTING PRODUCTION ENDPOINT:');
  console.log('===============================');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request('https://returnsx.pk/api/health', {
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      
      req.on('error', reject);
      req.end();
    });
    
    if (response.statusCode === 200) {
      console.log('✅ https://returnsx.pk is reachable and working');
      console.log('✅ Webhook endpoints should work once URLs are updated');
    } else {
      console.log(`❌ Production server returned: ${response.statusCode}`);
    }
    
  } catch (error) {
    console.log(`❌ Cannot reach production server: ${error.message}`);
  }
}

testProductionEndpoint();
