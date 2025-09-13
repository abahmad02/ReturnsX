# 🧪 Testing Guide for ReturnsX Risk Score Extensions

## 🎯 Overview

This guide covers testing both Post-Purchase and Order Status extensions that display customer risk scores after checkout.

---

## 🏗️ Setup Instructions

### 1. Backend API Setup
```bash
# Start the backend API stub
cd ReturnsX
node backend-api-stub.js

# API will run on http://localhost:3000
# Test endpoint: GET http://localhost:3000/api/risk-profile?phone=+923001234567
```

### 2. Extension Configuration
Configure these settings in your Shopify app admin:

**Post-Purchase Extension:**
- API Endpoint: `http://localhost:3000/api/risk-profile`
- Enable Debug Mode: `true` (for development)

**Order Status Extension:**
- API Endpoint: `http://localhost:3000/api/risk-profile`
- Enable Debug Mode: `true`
- Show Detailed Tips: `true`

### 3. Deploy Extensions
```bash
shopify app deploy
```

---

## 🧪 Testing Post-Purchase Extension

### Prerequisites
- ✅ Extension must be deployed and active
- ✅ Customer must provide phone number during checkout
- ✅ Order must be **PAID** (not pending/failed)
- ✅ Payment method must be processed (not COD/manual)

### Test Scenarios

#### ✅ Scenario 1: Shopify Payments (Success)
1. **Setup Bogus Gateway:**
   ```
   Shopify Admin → Settings → Payments → Manage → Bogus Gateway
   Enable for testing
   ```

2. **Test Checkout:**
   - Add product to cart
   - Go to checkout
   - Fill customer info with phone: `+923001234560` (for HIGH_RISK)
   - Use test card: `1` (success)
   - Complete payment

3. **Expected Result:**
   - Post-purchase screen appears after payment
   - Shows "🔴 High Risk" with score 25.5/100
   - Displays improvement tips
   - Has "Continue to Order Confirmation" button

#### ✅ Scenario 2: Different Risk Levels
Use these phone numbers to test different risk tiers:

| Phone Number | Risk Level | Expected Score | Expected Color |
|-------------|------------|---------------|---------------|
| `+923001234560` | HIGH_RISK | 25.5/100 | 🔴 Red |
| `+923001234564` | MEDIUM_RISK | 65.8/100 | 🟡 Yellow |
| `+923001234568` | ZERO_RISK | 92.3/100 | 🟢 Green |

#### ❌ Scenario 3: Extension Won't Show
Extension will NOT appear if:
- Payment method is COD (Cash on Delivery)
- Payment method is manual/bank transfer  
- No phone number provided
- Order status is not 'paid'
- API endpoint not configured

**Test COD (No Show):**
- Enable COD payment method
- Complete checkout with COD
- Result: No post-purchase screen, goes directly to Thank You page

---

## 🧪 Testing Order Status Extension

### Prerequisites
- ✅ Extension must be deployed and active
- ✅ Customer must provide phone number (checkout/billing/shipping)
- ✅ Works with **ALL payment methods** including COD

### Test Scenarios

#### ✅ Scenario 1: COD Order (Shows)
1. **Setup COD:**
   ```
   Shopify Admin → Settings → Payments → Manual Payment Methods
   Add "Cash on Delivery"
   ```

2. **Test Checkout:**
   - Add product to cart
   - Go to checkout  
   - Fill customer info with phone: `+923001234564` (MEDIUM_RISK)
   - Select "Cash on Delivery" payment
   - Complete checkout

3. **Expected Result:**
   - Thank You page shows order confirmation
   - Risk score section appears below order details
   - Shows "🟡 Medium Risk" with score 65.8/100
   - Shows delivery statistics and tips

#### ✅ Scenario 2: Paid Order (Also Shows)
- Use Shopify Payments with test card `1`
- Phone: `+923001234567` (ZERO_RISK)
- Expected: "🟢 Low Risk" with score 92.3/100

#### ✅ Scenario 3: Revisiting Order Status
- Customer can return to Thank You page anytime
- URL format: `store.myshopify.com/orders/STATUS_TOKEN`
- Risk score will reload each time

---

## 🚨 Edge Cases Testing

### 1. Missing Phone Number
**Test Setup:**
- Complete checkout without providing phone number
- Don't fill billing/shipping phone fields

**Expected Results:**
- **Post-Purchase:** Extension doesn't show at all
- **Order Status:** Shows "Risk score unavailable - phone number not provided"

### 2. API Failure
**Test Setup:**
- Stop the backend API server (`Ctrl+C`)
- Complete a normal checkout

**Expected Results:**
- **Post-Purchase:** Shows "Unable to load risk profile. Your order is confirmed..."
- **Order Status:** Shows "Risk score temporarily unavailable. Your order will be processed normally."

### 3. Invalid API Response
**Test Setup:**
- Modify API to return invalid JSON or 500 error
- Complete checkout

**Expected Results:**
- Both extensions show appropriate error messages
- Checkout flow is NOT interrupted
- Customer can still complete their order

### 4. New Customer (No Risk Data)
**Test Setup:**
- Use phone number not in database: `+923009999999`

**Expected Results:**
- Shows "🆕 Welcome to ReturnsX!" message
- Explains zero risk status for new customers

---

## 🛠️ Debug Tools

### 1. Browser Console
Enable debug mode and check console for:
```javascript
[PostPurchase] Order query result: {...}
[OrderStatus] Risk API error: Network request failed
```

### 2. Network Tab
Monitor API calls to:
- `http://localhost:3000/api/risk-profile?phone=...`
- Check request/response headers
- Verify session token is being sent

### 3. API Logs
Backend will log:
```
[Risk API] Request from shop.myshopify.com for phone: 4567
```

---

## ✅ Success Criteria

### Post-Purchase Extension
- ✅ Shows immediately after successful payment
- ✅ Displays correct risk level and score
- ✅ Shows relevant improvement tips  
- ✅ Handles errors gracefully
- ✅ Doesn't show for COD/manual payments
- ✅ "Continue" button works

### Order Status Extension  
- ✅ Shows on Thank You page for ALL payment methods
- ✅ Displays correct risk information
- ✅ Handles missing phone numbers gracefully
- ✅ Shows appropriate error messages
- ✅ Works when revisiting order status page
- ✅ Doesn't break checkout flow

---

## 🐛 Common Issues

### Extension Not Showing
1. Check if extension is deployed: `shopify app info`
2. Verify API endpoint is configured correctly
3. Check browser console for errors
4. Ensure phone number is provided

### API Errors
1. Verify backend server is running on correct port
2. Check session token is being sent
3. Verify shop domain header is present
4. Check API endpoint URL configuration

### Wrong Risk Score
1. Verify phone number format in API call
2. Check backend logic for risk tier calculation
3. Ensure API is returning expected JSON structure

---

## 📱 Mobile Testing

Both extensions are responsive and should be tested on:
- Mobile browsers (Chrome, Safari)
- Shopify Mobile app checkout
- Different screen sizes

The extensions use Shopify's UI components which automatically adapt to mobile layouts.