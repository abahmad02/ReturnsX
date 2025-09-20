# 🔧 API Hook Fix - Thank You Page Extension

## Issue Identified
```
ExtensionHasNoMethodError: Cannot call 'order()' on target 'purchase.thank-you.block.render'. 
The corresponding property was not found on the API.
```

## Root Cause
The extension was using `useOrder()` hook which is only available in **checkout** extensions, not **thank-you page** extensions.

## Fix Applied
✅ **Changed `useOrder()` to `usePurchase()`** in `useCustomerData.ts`

### Before:
```typescript
import { useOrder } from '@shopify/ui-extensions-react/checkout';

export function useCustomerData() {
  const order = useOrder(); // ❌ Not available in thank-you page
  // ...
}
```

### After:
```typescript
import { usePurchase } from '@shopify/ui-extensions-react/checkout';

export function useCustomerData() {
  const purchase = usePurchase(); // ✅ Correct for thank-you page
  // ...
}
```

## API Differences

### Thank You Page Extensions (`purchase.thank-you.block.render`)
- ✅ `usePurchase()` - Access to completed purchase data
- ✅ `useSettings()` - Extension configuration
- ❌ `useOrder()` - Not available (checkout only)
- ❌ `useCartLines()` - Not available (checkout only)

### Checkout Extensions (`purchase.checkout.block.render`)
- ✅ `useOrder()` - Access to order being processed
- ✅ `useCartLines()` - Access to cart items
- ❌ `usePurchase()` - Not available (thank-you only)

## Next Steps

### 1. Redeploy Extension
```bash
cd extensions/thank-you-risk-display
shopify app deploy
```

### 2. Test Again
1. Place a test order with phone/email
2. Go to thank you page
3. Check browser console for debug messages
4. Should now see:
   ```
   [ReturnsX Extension] Customer data: {phone: "+92...", email: "..."}
   [ReturnsX Extension] Making API request to: https://returnsx.pk/api/risk-profile
   ```

### 3. Verify API Calls
- Check your server logs at `https://returnsx.pk/api/risk-profile`
- Should now receive POST requests with customer data

## Expected Behavior After Fix
1. ✅ Extension loads without errors
2. ✅ Customer data extracted from purchase
3. ✅ API calls made to your endpoint
4. ✅ Risk assessment displayed

## Debug Checklist
- [ ] Extension redeployed successfully
- [ ] No JavaScript errors in console
- [ ] Customer data extracted properly
- [ ] API requests reaching your server
- [ ] Risk assessment card displayed

The fix should resolve the "Unable to load risk assessment information" issue and enable proper API communication with your ReturnsX backend.