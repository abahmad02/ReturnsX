# 🚨 Troubleshooting: No API Calls Being Made

## Issue Summary
- Extension shows: "Unable to load risk assessment information"
- No API calls reaching `https://returnsx.pk/api/risk-profile`
- Server logs show no incoming requests

## 🔍 **Step-by-Step Diagnosis**

### **Step 1: Check Extension Configuration**

**In Shopify Admin:**
1. Go to **Online Store** → **Themes** → **Customize**
2. Navigate to **Checkout** → **Thank you page**
3. Find **"ReturnsX Risk Display"** section
4. Verify these settings:

```
✅ ReturnsX API Endpoint: https://returnsx.pk
✅ Enable Debug Mode: Yes (temporarily)
✅ Enable Response Caching: Yes
✅ Analytics Enabled: Yes (optional)
```

**⚠️ CRITICAL:** Make sure the API endpoint is `https://returnsx.pk` (NOT `https://returnsx.pk/api/risk-profile`)

### **Step 2: Enable Debug Mode & Check Browser Console**

1. **Enable Debug Mode** in theme customizer
2. **Save** the configuration
3. Place a test order and go to thank you page
4. **Open browser console** (F12)
5. Look for these debug messages:

**Expected Debug Output:**
```javascript
[ReturnsX Extension] Initializing risk assessment
[ReturnsX Extension] Customer data: {phone: "+92...", email: "..."}
[ReturnsX Extension] Making API request to: https://returnsx.pk/api/risk-profile
[ReturnsX Extension] Request payload: {...}
```

**If you DON'T see these messages, the extension isn't loading properly.**

### **Step 3: Check Customer Data Extraction**

The extension needs either a phone number or email from the order. Check if:

**In browser console, look for:**
```javascript
[ReturnsX Extension] Customer data: {
  phone: "+923001234567",  // ✅ Should have this
  email: "customer@example.com",  // ✅ OR this
  orderId: "12345",
  checkoutToken: "abc123"
}
```

**If customer data is missing:**
- Make sure the test order has a phone number or email
- Check that the order was placed with proper customer information

### **Step 4: Verify Extension is Active**

**Check if extension is running:**
1. Go to thank you page after placing an order
2. **Right-click** → **Inspect Element**
3. Look for any elements with `returnsx` or `risk-assessment` in the HTML
4. If no extension elements exist, the extension isn't loading

### **Step 5: Test API Endpoint Directly**

**Test your API endpoint manually:**

```bash
# Test with curl
curl -X POST https://returnsx.pk/api/risk-profile \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+923001234567",
    "email": "test@example.com",
    "orderId": "test-order-123",
    "checkoutToken": "test-token"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "riskTier": "MEDIUM_RISK",
  "riskScore": 45,
  "totalOrders": 5,
  "failedAttempts": 1,
  "successfulDeliveries": 4,
  "isNewCustomer": false,
  "message": "Good delivery record",
  "recommendations": [...]
}
```

## 🛠️ **Common Issues & Solutions**

### **Issue 1: Extension Not Loading**

**Symptoms:**
- No debug messages in console
- No extension elements in HTML
- "Unable to load risk assessment information" immediately

**Solutions:**
```bash
# 1. Redeploy the extension
cd extensions/thank-you-risk-display
shopify app deploy

# 2. Check extension is active in Shopify Admin
# Go to Apps → Your App → Extensions → Check status

# 3. Clear browser cache and try again
```

### **Issue 2: Configuration Not Loading**

**Symptoms:**
- Debug shows: "Configuration loading..."
- Extension stuck on loading state

**Solutions:**
1. **Check theme customizer settings are saved**
2. **Try different browser/incognito mode**
3. **Verify extension settings schema matches the code**

### **Issue 3: Customer Data Missing**

**Symptoms:**
- Debug shows: "No customer phone or email found"
- Extension shows new customer fallback

**Solutions:**
1. **Ensure test orders have customer information**
2. **Check order contains shipping/billing address with phone**
3. **Verify customer email is captured during checkout**

### **Issue 4: API Client Not Initialized**

**Symptoms:**
- Debug shows configuration loaded
- No API request attempts
- Extension shows loading indefinitely

**Solutions:**
1. **Check API endpoint format** (should be base URL only)
2. **Verify network_access = true in shopify.extension.toml**
3. **Check for JavaScript errors in console**

### **Issue 5: CORS Issues**

**Symptoms:**
- API request starts but fails immediately
- Console shows CORS errors
- Network tab shows preflight OPTIONS request failing

**Solutions:**
```javascript
// Add to your API server
app.use(cors({
  origin: [
    /\\.myshopify\\.com$/,
    /\\.shopify\\.com$/,
    'https://checkout.shopify.com',
    /\\.shopifypreview\\.com$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('/api/risk-profile', (req, res) => {
  res.sendStatus(200);
});
```

### **Issue 6: SSL Certificate Problems**

**Symptoms:**
- API requests fail with SSL errors
- Console shows certificate warnings

**Solutions:**
1. **Verify SSL certificate is valid** for `returnsx.pk`
2. **Test with browser**: Visit `https://returnsx.pk/api/risk-profile`
3. **Check certificate chain is complete**

## 🧪 **Debugging Script**

Create this test file to debug the extension:

```javascript
// debug-extension.js - Run in browser console
(function debugReturnsXExtension() {
  console.log('🔍 ReturnsX Extension Debug Started');
  
  // Check if extension elements exist
  const extensionElements = document.querySelectorAll('[data-returnsx], [class*="returnsx"], [class*="risk"]');
  console.log('Extension elements found:', extensionElements.length);
  
  // Check for error messages
  const errorElements = document.querySelectorAll('[class*="error"], [aria-label*="error"]');
  console.log('Error elements:', errorElements.length);
  
  // Check local storage for cached data
  const cacheKeys = Object.keys(localStorage).filter(key => key.includes('returnsx') || key.includes('risk'));
  console.log('Cache keys found:', cacheKeys);
  
  // Check for network requests
  console.log('Check Network tab for requests to:', 'https://returnsx.pk/api/risk-profile');
  
  // Try to trigger extension manually (if possible)
  if (window.ReturnsXExtension) {
    console.log('Extension object found:', window.ReturnsXExtension);
  } else {
    console.log('❌ Extension object not found in window');
  }
})();
```

## 📋 **Diagnostic Checklist**

### Extension Setup
- [ ] Extension deployed successfully
- [ ] Extension active in Shopify Admin
- [ ] Theme customizer settings configured
- [ ] Debug mode enabled
- [ ] API endpoint set to `https://returnsx.pk`

### Browser Testing
- [ ] Browser console open during test
- [ ] Debug messages appearing
- [ ] Customer data extracted successfully
- [ ] No JavaScript errors in console
- [ ] Network tab shows API request attempts

### API Testing
- [ ] API endpoint accessible via curl/Postman
- [ ] CORS headers configured correctly
- [ ] SSL certificate valid
- [ ] API returns expected response format
- [ ] Server logs show incoming requests

### Order Testing
- [ ] Test order has customer phone or email
- [ ] Order completed successfully
- [ ] Thank you page loads properly
- [ ] Extension section visible on page

## 🎯 **Next Steps Based on Findings**

### If No Debug Messages:
1. **Extension not loading** - Check deployment and activation
2. **JavaScript errors** - Check browser console for errors
3. **Configuration issues** - Verify theme customizer settings

### If Debug Messages But No API Calls:
1. **Customer data missing** - Check order has phone/email
2. **API client initialization failed** - Check endpoint configuration
3. **Network access blocked** - Verify extension permissions

### If API Calls Fail:
1. **CORS issues** - Configure server CORS headers
2. **SSL problems** - Check certificate validity
3. **Server errors** - Check API server logs and responses

### If API Calls Succeed But No Display:
1. **Response format issues** - Verify API response matches expected format
2. **Rendering errors** - Check for React/component errors
3. **CSS/styling issues** - Check if content is hidden

## 🚀 **Quick Fix Commands**

```bash
# Redeploy extension
cd extensions/thank-you-risk-display
shopify app deploy

# Test API endpoint
curl -X POST https://returnsx.pk/api/risk-profile \
  -H "Content-Type: application/json" \
  -d '{"phone":"+923001234567","email":"test@example.com"}'

# Check extension status
shopify app info

# Clear extension cache
# (Run in browser console)
localStorage.clear();
sessionStorage.clear();
```

Run through this checklist systematically and let me know what you find at each step!