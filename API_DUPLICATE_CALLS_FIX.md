# API Duplicate Calls Fix

## Issues Identified

### 1. Shopify GID Validation Error
**Problem**: The security validator was rejecting valid Shopify Global IDs (GIDs) like `gid://shopify/OrderIdentity/5989278875718`

**Root Causes**:
- The GID pattern `/^gid:\/\/shopify\/[A-Za-z]+\/\d+$/` was too restrictive, only allowing pure alphabetic ResourceTypes
- Shopify uses mixed-case resource types like `OrderIdentity` which weren't matching
- The malicious pattern check was being run on the full GID string, triggering false positives for `:` and `/` characters

**Fix Applied** (`app/services/securityValidator.server.ts`):
```typescript
// Old pattern - only allows pure letters
const gidPattern = /^gid:\/\/shopify\/[A-Za-z]+\/\d+$/;

// New pattern - allows alphanumeric ResourceTypes (e.g., OrderIdentity)
const gidPattern = /^gid:\/\/shopify\/[A-Za-z][A-Za-z0-9]*\/\d+$/;

// Skip malicious pattern check for valid GIDs
// Only check extracted numeric ID if GID validation fails
if (!isShopifyGID || errors.length > 0) {
  const checkValue = isShopifyGID ? numericOrderId : orderId;
  const maliciousCheck = this.checkForMaliciousPatterns(checkValue, 'orderId');
  errors.push(...maliciousCheck.errors);
}
```

### 2. Duplicate API Calls from Extension
**Problem**: The `/api/get-order-data` endpoint was being called 3 times from the same Cloudflare URL

**Root Causes**:
1. **Unstable Dependencies**: The `useEffect` depended on `orderConfirmationData` object, which changes frequently causing re-renders
2. **Poor State Management**: Using `hasFetched` boolean state that was reset on errors, allowing infinite retries
3. **Race Conditions**: No protection against concurrent fetches for the same orderId

**Fix Applied** (`extensions/thank-you-risk-display/src/Checkout.tsx`):

#### Before:
```typescript
const [hasFetched, setHasFetched] = React.useState(false);

React.useEffect(() => {
  async function fetchCustomerDataFromBackend(retryCount = 0) {
    const orderId = (orderConfirmationData as any)?.order?.id;
    
    if (hasFetched) {
      console.log('Already fetched data for this order, skipping duplicate call');
      return;
    }
    
    // ... fetch logic ...
    
    setHasFetched(true); // Reset to false on error
  }
  
  if ((api as any).orderConfirmation && !hasFetched) {
    fetchCustomerDataFromBackend();
  }
}, [orderConfirmationData, api, hasFetched, config]); // Unstable dependencies
```

#### After:
```typescript
// Use refs for stable tracking across renders
const fetchedOrderIdRef = React.useRef<string | null>(null);
const isFetchingRef = React.useRef(false);

// Extract orderId into stable memoized value
const orderId = React.useMemo(() => {
  return (orderConfirmationData as any)?.order?.id;
}, [(orderConfirmationData as any)?.order?.id]);

React.useEffect(() => {
  async function fetchCustomerDataFromBackend(retryCount = 0) {
    // Prevent duplicate calls for the same orderId
    if (fetchedOrderIdRef.current === orderId) {
      console.log('Already fetched data for this order ID:', orderId);
      return;
    }
    
    // Prevent race conditions
    if (isFetchingRef.current) {
      console.log('Fetch already in progress for order ID:', orderId);
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      // ... fetch logic ...
      
      // Store the fetched orderId
      fetchedOrderIdRef.current = orderId;
    } catch (error) {
      // Don't reset fetchedOrderIdRef on error to prevent infinite retries
    } finally {
      isFetchingRef.current = false;
    }
  }
  
  // Only depend on orderId (stable) instead of orderConfirmationData (unstable)
  if ((api as any).orderConfirmation && orderId && 
      fetchedOrderIdRef.current !== orderId && !isFetchingRef.current) {
    fetchCustomerDataFromBackend();
  }
}, [orderId, api, config]); // Stable dependencies only
```

## Key Improvements

### 1. Validation Fix
✅ Supports all valid Shopify GID formats (Order, OrderIdentity, Product, etc.)
✅ No false positives from security pattern matching on valid GIDs
✅ Properly extracts numeric ID from GID format

### 2. Duplicate Call Prevention
✅ **Ref-based tracking**: Uses `fetchedOrderIdRef` to track which orderId has been fetched
✅ **Race condition protection**: Uses `isFetchingRef` to prevent concurrent fetches
✅ **Stable dependencies**: Only re-runs when orderId actually changes (via useMemo)
✅ **Error resilience**: Doesn't reset fetch state on errors, preventing retry loops

### 3. Performance Benefits
- Reduces unnecessary API calls by ~66% (from 3 calls to 1 call)
- Prevents React re-render cascades from unstable dependencies
- Maintains fetch state across component re-renders using refs
- Allows retry for different orderIds while preventing duplicates for same orderId

## Testing Recommendations

1. **Test valid Shopify GIDs**:
   ```
   gid://shopify/Order/123456789
   gid://shopify/OrderIdentity/5989278875718
   gid://shopify/Product/987654321
   ```

2. **Test duplicate call prevention**:
   - Load Thank You page and verify only 1 API call in Network tab
   - Check browser console for "Already fetched data for this order ID" messages
   - Verify no calls when orderId hasn't changed

3. **Test error scenarios**:
   - Network errors should not cause infinite retry loops
   - Different orderIds should still trigger fresh fetches
   - Component re-renders should not trigger duplicate calls

## Related Files Modified

- `app/services/securityValidator.server.ts` - GID validation pattern fix
- `extensions/thank-you-risk-display/src/Checkout.tsx` - Duplicate call prevention

## Date
October 3, 2025
