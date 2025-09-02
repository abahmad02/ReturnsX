const https = require('https');

console.log('🔍 DEBUGGING WEBHOOK SECRET CONFIGURATION');
console.log('========================================\n');

console.log('The "Invalid webhook signature" error means:');
console.log('1. SHOPIFY_WEBHOOK_SECRET environment variable might be missing');
console.log('2. The secret used by Shopify doesn\'t match your environment variable');
console.log('3. There might be an issue with the HMAC calculation\n');

console.log('📋 DEBUGGING STEPS:');
console.log('==================\n');

console.log('1️⃣ CHECK VERCEL ENVIRONMENT VARIABLES');
console.log('-------------------------------------');
console.log('• Go to: https://vercel.com/your-project/settings/environment-variables');
console.log('• Look for: SHOPIFY_WEBHOOK_SECRET');
console.log('• If missing, add it with a random secure string\n');

console.log('2️⃣ GENERATE A NEW WEBHOOK SECRET');
console.log('--------------------------------');
console.log('Add this to your Vercel environment variables:');

// Generate a random webhook secret
const crypto = require('crypto');
const newSecret = crypto.randomBytes(32).toString('hex');
console.log(`SHOPIFY_WEBHOOK_SECRET=${newSecret}\n`);

console.log('3️⃣ TEMPORARILY DISABLE SIGNATURE VERIFICATION');
console.log('----------------------------------------------');
console.log('For testing purposes, you can temporarily disable verification');
console.log('by modifying the webhook handlers to skip the signature check.\n');

console.log('4️⃣ TEST WEBHOOK SECRET ON PRODUCTION');
console.log('------------------------------------');

async function testWebhookSecret() {
  try {
    console.log('Testing if webhook secret is accessible on production...\n');
    
    // Test a webhook endpoint to see if it gives us more info
    const response = await new Promise((resolve, reject) => {
      const req = https.request('https://returnsx.pk/webhooks/orders/fulfilled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': 'orders/fulfilled',
          'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
          'X-Shopify-Hmac-Sha256': 'invalid-signature-for-testing'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      
      req.on('error', reject);
      req.write(JSON.stringify({ test: true }));
      req.end();
    });
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}\n`);
    
    if (response.statusCode === 401 && response.body.includes('Invalid signature')) {
      console.log('✅ Webhook signature verification is working');
      console.log('❌ But the signature/secret mismatch is the issue\n');
      
      console.log('SOLUTION OPTIONS:');
      console.log('=================');
      console.log('Option A: Set the webhook secret in Vercel environment variables');
      console.log('Option B: Temporarily disable signature verification for testing');
      console.log('Option C: Re-register webhooks with a new secret\n');
      
    } else if (response.statusCode === 500) {
      console.log('❌ Server error - webhook secret might be missing from environment');
    }
    
  } catch (error) {
    console.log(`❌ Error testing: ${error.message}`);
  }
}

console.log('5️⃣ QUICK FIX: TEMPORARY DISABLE VERIFICATION');
console.log('--------------------------------------------');
console.log('To test if webhooks work without signature verification,');
console.log('you can temporarily comment out the signature check in your webhook handlers.\n');

console.log('In each webhook file (e.g., webhooks.orders.fulfilled.tsx), change:');
console.log('');
console.log('// BEFORE:');
console.log('if (signature && process.env.SHOPIFY_WEBHOOK_SECRET) {');
console.log('  const isValid = verifyWebhookSignature(rawBody, signature, process.env.SHOPIFY_WEBHOOK_SECRET);');
console.log('  if (!isValid) {');
console.log('    return json({ error: "Invalid signature" }, { status: 401 });');
console.log('  }');
console.log('}');
console.log('');
console.log('// AFTER (temporary):');
console.log('// Temporarily disable signature verification for testing');
console.log('// if (signature && process.env.SHOPIFY_WEBHOOK_SECRET) {');
console.log('//   const isValid = verifyWebhookSignature(rawBody, signature, process.env.SHOPIFY_WEBHOOK_SECRET);');
console.log('//   if (!isValid) {');
console.log('//     return json({ error: "Invalid signature" }, { status: 401 });');
console.log('//   }');
console.log('// }');
console.log('');
console.log('⚠️  IMPORTANT: Re-enable signature verification after testing!\n');

testWebhookSecret();
