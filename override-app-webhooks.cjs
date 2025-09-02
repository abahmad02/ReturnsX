const https = require('https');

console.log('🔧 OVERRIDING APP-CONFIGURATION WEBHOOKS');
console.log('========================================\n');

console.log('Your webhooks are registered via app configuration file (shopify.app.toml)');
console.log('They are pointing to: alan-casual-printing-career.trycloudflare.com');
console.log('We need to override them to point to: https://returnsx.pk\n');

async function overrideWebhooks() {
  console.log('Attempting to override webhooks via your app API...\n');
  
  try {
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
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}\n`);
    
    if (response.statusCode === 200) {
      console.log('✅ SUCCESS! Webhooks have been overridden with correct URLs');
      console.log('\n🧪 Test the fix:');
      console.log('1. Create a test order in your Shopify store');
      console.log('2. Fulfill it to trigger the webhook');
      console.log('3. Check webhook delivery logs in Shopify');
      console.log('4. Should now show 200 OK responses to https://returnsx.pk');
    } else {
      console.log('❌ API call failed. Try these alternatives:\n');
      showAlternatives();
    }
    
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
    showAlternatives();
  }
}

function showAlternatives() {
  console.log('📋 ALTERNATIVE SOLUTIONS:');
  console.log('=========================\n');
  
  console.log('1️⃣ Use the app dashboard:');
  console.log('   • Go to your ReturnsX app in Shopify');
  console.log('   • Click the "🔗 Setup Webhooks" button');
  console.log('   • This will programmatically override the webhooks\n');
  
  console.log('2️⃣ Redeploy your app:');
  console.log('   • Run: shopify app deploy');
  console.log('   • This will re-register webhooks with correct URLs\n');
  
  console.log('3️⃣ Force webhook refresh:');
  console.log('   • Run: shopify app dev');
  console.log('   • Then: shopify app deploy');
  console.log('   • This ensures webhooks use production URLs\n');
  
  console.log('💡 Why app-config webhooks are tricky:');
  console.log('   • They\'re managed by Shopify CLI, not admin interface');
  console.log('   • They get registered during development with tunnel URLs');
  console.log('   • Need to be overridden programmatically or via redeploy');
}

overrideWebhooks();
