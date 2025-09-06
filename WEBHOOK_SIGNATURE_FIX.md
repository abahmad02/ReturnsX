# 🔧 Webhook Signature Validation Fix

## 🚨 Problem
Getting `401 Invalid webhook signature` error for `/webhooks/orders/updated` endpoint.

## 🔍 Diagnosis Steps

### 1. Run the Debug Script
```bash
node debug-webhook-signature.js
```

This will check:
- ✅ If `SHOPIFY_WEBHOOK_SECRET` environment variable is set
- ✅ Signature generation and verification logic
- ✅ Common issues and solutions

### 2. Check Environment Variables
```bash
# Check if webhook secret is set
echo $SHOPIFY_WEBHOOK_SECRET

# If using .env file
cat .env | grep SHOPIFY_WEBHOOK_SECRET
```

### 3. Use Debug Endpoint Temporarily
I've created a debug webhook endpoint that bypasses signature validation:
- **URL**: `/webhooks/debug/orders/updated`
- **Purpose**: Test webhook processing without signature validation
- **⚠️ Warning**: Remove this after debugging!

## 🛠️ Common Solutions

### Solution 1: Missing Webhook Secret
If `SHOPIFY_WEBHOOK_SECRET` is not set:

```bash
# Set the webhook secret (get this from Shopify Partner Dashboard)
export SHOPIFY_WEBHOOK_SECRET="your_webhook_secret_here"

# Or add to .env file
echo "SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here" >> .env
```

### Solution 2: Webhook Secret Mismatch
The webhook secret in your environment might not match what was used during registration:

```bash
# Re-register webhooks with current secret
# This can be done through the ReturnsX dashboard "Setup Webhooks" button
```

### Solution 3: Body Parsing Issue
The webhook body might be modified before signature verification:

**Check middleware in `remix.config.js` or `vite.config.ts`:**
```javascript
// Ensure no body parsing middleware interferes with webhooks
// Webhook routes should receive raw request body
```

### Solution 4: Encoding Issues
Ensure the request body is treated as UTF-8:

```typescript
// In webhook handler
const rawBody = await request.text(); // ✅ Correct
// NOT: const body = await request.json(); // ❌ Wrong for signature verification
```

## 🔧 Quick Fixes to Try

### Fix 1: Update Webhook Registration
1. Go to ReturnsX dashboard
2. Click "Setup Webhooks" button
3. This will re-register all webhooks with the current secret

### Fix 2: Temporarily Use Debug Endpoint
1. In Shopify Partner Dashboard, update the webhook URL:
   - **From**: `https://returnsx.pk/webhooks/orders/updated`
   - **To**: `https://returnsx.pk/webhooks/debug/orders/updated`
2. Test webhook delivery
3. Check server logs for detailed debug information
4. **Remember to change back** after debugging!

### Fix 3: Check Webhook Secret in Shopify
1. Go to Shopify Partner Dashboard
2. Navigate to your app
3. Check webhook configuration
4. Copy the webhook secret and update your environment variable

## 📊 Enhanced Logging
I've added detailed logging to the webhook handlers:

```typescript
console.log("Processing order update webhook for shop:", shop, {
  hasSignature: !!signature,
  hasSecret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
  topic,
  bodyLength: rawBody.length
});
```

Check your server logs for these debug messages.

## ✅ Verification Steps

After applying fixes:

1. **Test webhook signature validation**:
   ```bash
   node debug-webhook-signature.js
   ```

2. **Check webhook delivery in Shopify**:
   - Go to Shopify Partner Dashboard
   - Check webhook delivery logs
   - Look for successful 200 responses

3. **Test order update flow**:
   - Update an order in your test store
   - Check ReturnsX logs for successful processing
   - Verify risk tags are applied in Shopify admin

## 🔐 Security Note
The debug endpoint bypasses security validation and should be **removed immediately** after debugging:

```bash
# Remove the debug file after fixing the issue
rm app/routes/webhooks.debug.orders.updated.tsx
```

## 📞 Need Help?
If none of these solutions work:

1. Share the output of `node debug-webhook-signature.js`
2. Share relevant server logs from webhook processing
3. Check if webhook secret in Shopify matches environment variable
4. Verify no middleware is modifying request bodies

The enhanced logging will provide detailed information about where the signature validation is failing.
