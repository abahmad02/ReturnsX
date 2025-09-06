#!/usr/bin/env node

/**
 * ReturnsX Webhook Signature Debug Tool
 * 
 * Helps diagnose webhook signature validation issues
 * Run this to check webhook configuration and test signature validation
 */

const crypto = require('crypto');

// Test webhook signature validation
function testWebhookSignature() {
  console.log('🔍 ReturnsX Webhook Signature Debug Tool');
  console.log('=========================================\n');

  // Check environment variables
  console.log('1. Environment Check:');
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  console.log(`   SHOPIFY_WEBHOOK_SECRET: ${webhookSecret ? '✅ Set' : '❌ Missing'}`);
  
  if (webhookSecret) {
    console.log(`   Secret length: ${webhookSecret.length} characters`);
    console.log(`   Secret preview: ${webhookSecret.substring(0, 8)}...${webhookSecret.substring(webhookSecret.length - 4)}`);
  }
  console.log();

  if (!webhookSecret) {
    console.log('❌ SHOPIFY_WEBHOOK_SECRET is not set!');
    console.log('   This will cause all webhook signature validations to fail.');
    console.log('   Set this environment variable with your webhook secret from Shopify.');
    return;
  }

  // Test signature generation
  console.log('2. Signature Generation Test:');
  const testPayload = JSON.stringify({
    id: 12345,
    customer: { phone: "+923001234567" },
    total_price: "1500.00"
  });

  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(testPayload, 'utf8');
  const expectedSignature = hmac.digest('base64');
  
  console.log(`   Test payload: ${testPayload}`);
  console.log(`   Expected signature: ${expectedSignature}`);
  console.log();

  // Test signature verification function (same as in app)
  console.log('3. Signature Verification Test:');
  
  function verifyWebhookSignature(rawBody, signature, secret) {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody, 'utf8');
      const computedSignature = hmac.digest('base64');
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature), 
        Buffer.from(computedSignature)
      );
      
      console.log(`   Provided signature: ${signature}`);
      console.log(`   Computed signature: ${computedSignature}`);
      console.log(`   Signatures match: ${isValid ? '✅' : '❌'}`);
      
      return isValid;
    } catch (error) {
      console.log(`   ❌ Error during verification: ${error.message}`);
      return false;
    }
  }

  // Test with correct signature
  const isValidCorrect = verifyWebhookSignature(testPayload, expectedSignature, webhookSecret);
  console.log(`   Verification result: ${isValidCorrect ? '✅ Valid' : '❌ Invalid'}`);
  console.log();

  // Test with incorrect signature
  console.log('4. Invalid Signature Test:');
  const invalidSignature = "invalid_signature_123";
  const isValidIncorrect = verifyWebhookSignature(testPayload, invalidSignature, webhookSecret);
  console.log(`   Invalid signature test: ${isValidIncorrect ? '❌ Should be false' : '✅ Correctly rejected'}`);
  console.log();

  // Common issues and solutions
  console.log('5. Common Issues & Solutions:');
  console.log('   🔧 Webhook Secret Mismatch:');
  console.log('      - Ensure SHOPIFY_WEBHOOK_SECRET matches the secret used during webhook registration');
  console.log('      - Check if webhook was registered with a different secret');
  console.log();
  console.log('   🔧 Body Parsing Issues:');
  console.log('      - Webhook body must be raw/unparsed for signature verification');
  console.log('      - Use request.text() not request.json() for signature verification');
  console.log();
  console.log('   🔧 Encoding Issues:');
  console.log('      - Ensure body is treated as UTF-8 string');
  console.log('      - Check for any middleware that might modify the request body');
  console.log();

  console.log('6. Next Steps:');
  console.log('   1. Check server logs for detailed signature validation info');
  console.log('   2. Compare webhook secret in Shopify admin vs environment variable');
  console.log('   3. Re-register webhooks if secret mismatch is found');
  console.log('   4. Test with a simple webhook endpoint that logs everything');
  console.log();
}

// Run the test
testWebhookSignature();

// Export for use in other scripts
module.exports = { testWebhookSignature };
