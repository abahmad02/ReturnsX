# 🔍 Extension Debugging - Version returnsx-19

## What I Fixed

### 1. **Fixed API Endpoint** ✅
- Changed default from `https://returnsx.vercel.app/api/risk-profile` 
- **To**: `https://returnsx.pk/api/risk-profile`

### 2. **Removed Silent Failures** ✅
- Extension was returning `null` when not configured
- **Now**: Always shows something, even if misconfigured

### 3. **Added Comprehensive Debugging** ✅
- Console logs at every step
- Shows configuration status
- Tracks rendering states

## Debugging Steps

### 1. **Place Test Order**
1. Place a COD order in your development store
2. Go to Thank You page
3. **Open browser console** (F12 → Console tab)

### 2. **Look for These Console Messages**

**Extension Loading:**
```
[OrderStatus] Extension rendering...
[OrderStatus] Component mounted {shop: "...", settings: {...}}
```

**Configuration Check:**
```
[OrderStatus] Render state: {
  hasApiEndpoint: true/false,
  apiEndpoint: "https://returnsx.pk/api/risk-profile",
  loading: true/false
}
```

**Order Data:**
```
[OrderStatus] useEffect triggered for order info
[OrderStatus] Order data: {...customer, billing, shipping...}
[OrderStatus] Phone extraction: {finalPhone: "+923..."}
```

**API Call:**
```
[OrderStatus] Making API call: {url: "...", phone: "...", hasToken: true}
[OrderStatus] API response data: {success: true, profile: {...}}
```

### 3. **Expected Behaviors**

**If Extension Doesn't Appear:**
- Console should show: `[OrderStatus] Extension rendering...`
- If missing → Extension target issue

**If Shows "Configuration" Warning:**
- Extension loaded but `api_endpoint` not set in theme customizer
- Fix: Set API endpoint in Shopify admin

**If Shows "Loading" Forever:**
- API call failing or timing out
- Check network tab for failed requests

**If Shows "Risk Score Unavailable":**
- Phone number extraction failing
- Check order data logs

## Quick Test

**Console Command Test:**
```javascript
// Run this in browser console on Thank You page
console.log('Extension check:', document.querySelector('[data-extension]'));
```

## Next Actions Based on Console Output

1. **No console logs**: Extension not loading → Check theme customizer
2. **"Configuration" message**: Set API endpoint in admin
3. **Loading forever**: API call issue → Check network tab  
4. **Phone extraction empty**: Order data issue → Check GraphQL response

The extension now has comprehensive debugging. Check console and report what you see! 🔍