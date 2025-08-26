# 🧪 ReturnsX Testing Guide - Dummy Store Setup

## 🎯 **Testing Overview**

Now that script registration is working, let's test the complete COD risk management functionality!

## 🏪 **Setting Up Your Test Store**

### 1. **Access Your Development Store**
```
Store URL: returnsx123.myshopify.com
Admin: https://returnsx123.myshopify.com/admin
```

### 2. **Enable Cash on Delivery (COD)**
1. Go to **Settings** → **Payments**
2. In **Manual payment methods**, click **Add manual payment method**
3. Add **Cash on Delivery** with these settings:
   - Name: "Cash on Delivery"
   - Payment instructions: "Pay when your order is delivered"
   - Additional details: "COD orders subject to verification"

## 📦 **Creating Test Products**

### Quick Product Setup
1. Go to **Products** → **Add product**
2. Create a few test products:

```
Product 1: "Test Electronics - Phone Case"
Price: $25.00
Weight: 0.1 kg

Product 2: "Test Clothing - T-Shirt" 
Price: $15.00
Weight: 0.2 kg

Product 3: "High Value Test Item"
Price: $500.00
Weight: 1.0 kg
```

## 👥 **Creating Test Customer Scenarios**

### Test Customer Profiles

#### 1. **Zero Risk Customer** (Should see green success message)
```
Email: good.customer@test.com
Phone: +923001234567
```

#### 2. **High Risk Customer** (Should see COD restriction modal)
```
Email: risky.customer@test.com  
Phone: +923009876543
```

#### 3. **New Customer** (Should have neutral experience)
```
Email: new.customer@test.com
Phone: +923005555555
```

## 🛒 **Testing Checkout Flow**

### Step 1: Create Customer Risk Data
First, let's create some risk profiles through the admin:

1. **Go to your ReturnsX app dashboard**
2. **Import some test data** or **manually create risk profiles**
3. **Or create orders first** (which will generate profiles automatically)

### Step 2: Test Checkout Scenarios

#### **Scenario A: Zero Risk Customer**
1. Go to your store front: `https://returnsx123.myshopify.com`
2. Add products to cart
3. Go to checkout
4. Enter zero risk customer details:
   - Email: `good.customer@test.com`
   - Phone: `+923001234567`
5. **Expected Result**: Green success banner "✨ Valued Customer"

#### **Scenario B: High Risk Customer**
1. Clear browser data or use incognito
2. Add products to cart
3. Go to checkout  
4. Enter high risk customer details:
   - Email: `risky.customer@test.com`
   - Phone: `+923009876543`
5. Try to select **Cash on Delivery**
6. **Expected Result**: 
   - Red warning banner "💳 Payment Required"
   - Modal popup when selecting COD
   - "50% advance payment required" message

#### **Scenario C: New Customer**
1. Use different browser/incognito
2. Enter new customer details
3. **Expected Result**: No special messages (neutral experience)

## 🔍 **Testing Script Functionality**

### Verify Script is Loading
1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Navigate to checkout page
4. Look for: `"ReturnsX: Checkout enforcement script loaded successfully"`
5. Look for: `"ReturnsX: Initializing checkout enforcement..."`

### Test Page Detection
1. Go to homepage - Console should show: `"ReturnsX: Not a checkout page, skipping initialization"`
2. Go to checkout - Console should show: `"ReturnsX: Initializing checkout enforcement..."`

## 📊 **Creating Orders for Testing**

### Method 1: Frontend Orders (Recommended)
1. **Complete actual checkout flows** with different customer profiles
2. **Use different payment methods** (COD vs. online)
3. **Try various order values** ($10, $100, $500+)

### Method 2: Admin Orders (Quick Testing)
1. Go to **Orders** → **Create order**
2. Add products and customer details
3. Select payment method
4. **Note**: Admin orders may not trigger all the same validations

### Method 3: API Testing
```bash
# Test the risk assessment API
curl "https://your-tunnel-url.trycloudflare.com/api/customer-profiles/PHONE_HASH" \
  -H "Accept: application/json"

# Test order risk assessment  
curl "https://your-tunnel-url.trycloudflare.com/api/orders/risk-assessment" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone": "+923001234567", "email": "test@example.com", "orderValue": 100}'
```

## 📈 **Monitoring and Analytics**

### Check App Dashboard
1. **Customer Statistics**: Should show growing customer profiles
2. **High Risk Customers**: Should list flagged customers  
3. **Risk Distribution**: Should show risk level breakdown

### Check Logs
Monitor your development console for:
```
INFO: Customer profile statistics generated
INFO: High-risk customers retrieved  
INFO: Risk assessment performed
INFO: Checkout script registered successfully
```

## 🔧 **Testing Advanced Features**

### 1. **WhatsApp Integration**
- Click "WhatsApp Support" button in COD restriction modal
- Should open WhatsApp with pre-filled message

### 2. **Script Tag Management**
- Try disabling/enabling checkout enforcement
- Verify script appears/disappears in store source

### 3. **Risk Configuration**
- Adjust risk thresholds in settings
- Test how it affects customer categorization

## 🚨 **Common Issues & Troubleshooting**

### Script Not Loading
```javascript
// Check in browser console:
document.querySelector('script[src*="checkout-enforcement"]')
// Should return the script element
```

### Risk Data Not Working
1. Check customer profiles are created: **App Dashboard** → **Customers**
2. Verify phone/email hashing is working
3. Check API responses in Network tab

### COD Restriction Not Working
1. Verify script detects checkout page
2. Check console for JavaScript errors
3. Confirm COD payment method is properly configured

## 📋 **Test Checklist**

### ✅ Basic Functionality
- [ ] Script loads on checkout pages only
- [ ] Customer risk assessment works
- [ ] COD restriction modal appears for high-risk customers
- [ ] Zero-risk customers see success message
- [ ] WhatsApp button works

### ✅ Edge Cases
- [ ] Script doesn't break on non-checkout pages
- [ ] Works with different phone number formats
- [ ] Handles empty email/phone gracefully
- [ ] Multiple payment method switches work

### ✅ Admin Features  
- [ ] Customer profiles are created/updated
- [ ] Risk statistics are accurate
- [ ] Script registration/removal works
- [ ] Settings changes affect behavior

## 🎯 **Success Metrics**

Your testing is successful when:
1. **High-risk customers** are prevented from using COD
2. **Zero-risk customers** get preferential treatment
3. **New customers** have smooth experience
4. **No JavaScript errors** in console
5. **Risk data** is being collected and analyzed

## 🚀 **Next Steps After Testing**

Once testing is complete:
1. **Document any issues** found
2. **Adjust risk thresholds** based on results  
3. **Prepare for production deployment**
4. **Set up monitoring and alerts**

Happy testing! Your COD risk management system should now be fully functional! 🎉

