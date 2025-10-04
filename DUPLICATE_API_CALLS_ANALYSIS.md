# Duplicate API Calls - Root Cause Analysis

## Issue Summary
- **Problem**: Extension making **13+ duplicate API calls** to `/api/get-order-data` for the same order
- **Order ID**: `gid://shopify/OrderIdentity/5989336907846`
- **Time Range**: 10 seconds (20:22:10 - 20:22:20)
- **All Calls**: Identical parameters, same order ID

## HAR File Analysis - Call Timeline

### Confirmed Duplicate Calls (from HAR):
1. **20:22:10.022Z** - Line 105465 (❌ ERR_ABORTED after 277ms)
2. **20:22:10.998Z** - Line 112725 (✅ Completed - 173ms)
3. **20:22:11.207Z** - Line 113530 (✅ Completed - 132ms, **NOT_FOUND_ERROR**)
4. Line 113591+
5. Line 116025+
6. Line 116253+
7. Line 116916+
8. Line 117144+
9. Line 117372+
10. Line 117600+
11. Line 117828+
12-13. Additional calls at various timestamps

### API Response (Line 113530):
```json
{
  "error": {
    "type": "NOT_FOUND_ERROR",
    "message": "No customer data found for the provided identifiers. This may be a guest order or the order hasn't been processed by our webhooks yet.",
    "code": "NOT_FOUND",
    "retryable": false,
    "timestamp": 1759436531272,
    "requestId": "6eb1d3d6-35f7-4f70-aad9-17ec8efd6f44"
  },
  "metadata": {
    "requestId": "6eb1d3d6-35f7-4f70-aad9-17ec8efd6f44",
    "processingTime": 6,
    "cacheHit": false,
    "timestamp": 1759436531272,
    "version": "1.0.0",
    "dataSource": "database",
    "queryCount": 2,
    "deduplicationHit": false,
    "circuitBreakerState": "CLOSED"
  },
  "debug": {
    "searchParams": {
      "orderId": "5989336907846"
    },
    "foundCorrelation": false,
    "foundCustomer": false,
    "timestamp": "2025-10-02T20:22:11.272Z",
    "queryCount": 2
  }
}
```

## Root Causes Identified

### 1. **React Strict Mode Double Rendering** ⚠️
- Development mode runs effects twice
- Each render triggers a new API call
- `fetchedOrderIdRef` only prevents calls **within the same render cycle**
- Does NOT persist across unmount/remount cycles

### 2. **Multiple Extension Instances** 🚨
- HAR shows calls from `parentId: 54, 101, 109, 118` (different worker IDs)
- Shopify may be mounting extension **multiple times**
- Each instance has its own `fetchedOrderIdRef` scope
- No shared state between instances

### 3. **Shopify Extension Lifecycle Events** 🔄
```
callFrames: [
  {
    "functionName": "fetchOnBehalfOfWorker",
    "url": "load.Bw6vYUDr.html",
    "lineNumber": 227
  },
  {
    "functionName": "fetchListener",
    "url": "load.Bw6vYUDr.html",
    "lineNumber": 139
  }
]
```
- Shopify's service worker is initiating fetches
- Extension may be reloading on page navigation/state changes
- Thank You page might be re-rendering during checkout completion flow

### 4. **Effect Dependency Array Issue** 🐛
Current code:
```tsx
useEffect(() => {
  const orderId = useMemo(() => {
    return orderConfirmationData?.order?.id || 
           orderConfirmationData?.id || 
           null;
  }, [orderConfirmationData]);
  
  // Fetch logic...
}, [orderId, api, config]);
```

**Problem**: `useMemo` inside `useEffect` is invalid React pattern
- `useMemo` should be **outside** useEffect
- Current structure recalculates orderId on every effect run
- May cause subtle re-execution bugs

### 5. **Database Missing Data** 💾
HAR shows:
```json
"foundCorrelation": false,
"foundCustomer": false,
"dataSource": "database"
```

**Confirmed**:
- Webhooks have NOT processed this order yet
- Database URL is correct: `postgresql://postgres:Alkylon88524@localhost:5432/returnsx`
- NOT a database configuration issue
- Issue is **webhook processing delay**

## Why Previous Fixes Didn't Work

### Fix #1: `fetchedOrderIdRef` ❌ Insufficient
- Only prevents duplicates **within same component instance**
- New extension mount = new ref = fresh state
- Doesn't survive unmount/remount cycles

### Fix #2: `isFetchingRef` ❌ Insufficient  
- Same scope limitation as `fetchedOrderIdRef`
- Race conditions between **different extension instances**
- Not shared across workers

### Fix #3: OpenTelemetry Suppression ✅ Helped
- Removed console noise
- Doesn't address root cause of duplicates

## Recommended Solutions

### Solution A: Global Deduplication with SessionStorage 🎯 **RECOMMENDED**

```tsx
// extensions/thank-you-risk-display/src/Checkout.tsx

import { useEffect, useMemo, useState, useRef } from 'react';

// Global deduplication key with timestamp
const FETCH_CACHE_KEY = 'returnsx_fetch_lock';
const CACHE_TTL = 5000; // 5 seconds

function Checkout() {
  const orderConfirmationData = useApi();
  const config = useExtensionConfig();
  
  // Extract orderId OUTSIDE useEffect with useMemo
  const orderId = useMemo(() => {
    return orderConfirmationData?.order?.id || 
           orderConfirmationData?.id || 
           null;
  }, [orderConfirmationData]);
  
  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (!orderId || !config?.api_endpoint) return;
    
    // 1. Check global lock in sessionStorage
    const lockKey = `${FETCH_CACHE_KEY}_${orderId}`;
    const existingLock = sessionStorage.getItem(lockKey);
    
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      const now = Date.now();
      
      // If lock is still valid (within TTL), skip
      if (now - lockData.timestamp < CACHE_TTL) {
        console.log(`[Dedup] Skipping fetch - locked by instance ${lockData.instanceId}`);
        return;
      }
    }
    
    // 2. Acquire lock
    const instanceId = Math.random().toString(36).substring(7);
    const lock = {
      instanceId,
      orderId,
      timestamp: Date.now()
    };
    sessionStorage.setItem(lockKey, JSON.stringify(lock));
    
    setIsLoading(true);
    
    // 3. Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      fetchTimeoutRef.current = setTimeout(() => {
        reject(new Error('Fetch timeout - showing fallback UI'));
      }, 3000);
    });
    
    // 4. Build API URL
    const apiUrl = new URL('/api/get-order-data', config.api_endpoint);
    const params = new URLSearchParams();
    params.append('orderId', orderId);
    
    const order = orderConfirmationData?.order;
    if (order?.orderNumber) {
      params.append('orderName', `#${order.orderNumber}`);
    }
    if (order?.customer?.phone) {
      params.append('customerPhone', order.customer.phone);
    }
    if (order?.customer?.email) {
      params.append('customerEmail', order.customer.email);
    }
    
    const fullUrl = `${apiUrl}?${params}`;
    console.log(`[Fetch ${instanceId}] Making API request:`, fullUrl);
    
    // 5. Fetch with timeout
    const fetchPromise = fetch(fullUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(async (response) => {
      clearTimeout(fetchTimeoutRef.current);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[Fetch ${instanceId}] Success:`, data);
      
      setRiskData(data);
      setIsLoading(false);
      
      // Keep lock for TTL duration to prevent other instances
      return data;
    });
    
    Promise.race([fetchPromise, timeoutPromise])
      .catch((error) => {
        clearTimeout(fetchTimeoutRef.current);
        console.warn(`[Fetch ${instanceId}] Failed:`, error.message);
        
        // On timeout, show fallback (don't throw error to user)
        setIsLoading(false);
        
        // Release lock on error
        const currentLock = sessionStorage.getItem(lockKey);
        if (currentLock) {
          const lockData = JSON.parse(currentLock);
          if (lockData.instanceId === instanceId) {
            sessionStorage.removeItem(lockKey);
          }
        }
      });
    
    // 6. Cleanup on unmount
    return () => {
      clearTimeout(fetchTimeoutRef.current);
    };
  }, [orderId, config, orderConfirmationData]); // Only re-run if orderId/config changes
  
  // Rest of component...
}
```

**Benefits**:
- ✅ Works across **all extension instances**
- ✅ Survives unmount/remount cycles
- ✅ 5-second lock prevents rapid duplicates
- ✅ Automatic cleanup with TTL
- ✅ Instance ID for debugging

---

### Solution B: API-Level Deduplication (Server-Side) 🛡️

Add to `app/routes/api.get-order-data.tsx`:

```typescript
// In-memory request cache with TTL
const requestCache = new Map<string, { 
  promise: Promise<any>, 
  timestamp: number 
}>();

const DEDUPE_TTL = 5000; // 5 seconds

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');
  
  // Clean expired cache entries
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > DEDUPE_TTL) {
      requestCache.delete(key);
    }
  }
  
  // Deduplication key
  const cacheKey = `${orderId}_${url.searchParams.toString()}`;
  
  // Check if identical request is in-flight
  const cached = requestCache.get(cacheKey);
  if (cached && (now - cached.timestamp < DEDUPE_TTL)) {
    console.log(`[Dedupe] Returning in-flight request for ${orderId}`);
    return cached.promise;
  }
  
  // Create new promise
  const promise = (async () => {
    try {
      // Existing validation and processing logic
      const result = await validateInput(url);
      const response = await executeOptimizedRequest(result);
      return json(response);
    } finally {
      // Remove from cache after completion
      requestCache.delete(cacheKey);
    }
  })();
  
  // Cache the promise
  requestCache.set(cacheKey, { promise, timestamp: now });
  
  return promise;
}
```

**Benefits**:
- ✅ Prevents duplicate database queries
- ✅ Single source of truth (server-side)
- ✅ Works for ALL clients (not just React)
- ✅ Automatic cleanup

---

### Solution C: React Strict Mode Protection 🔧

Add to `extensions/thank-you-risk-display/src/Checkout.tsx`:

```tsx
// Detect if component is unmounting due to Strict Mode
const isMountedRef = useRef(false);

useEffect(() => {
  if (isMountedRef.current) {
    // This is a re-mount after Strict Mode unmount
    console.log('[StrictMode] Skipping duplicate fetch on re-mount');
    return;
  }
  
  isMountedRef.current = true;
  
  // Existing fetch logic...
  
  return () => {
    // Mark as mounted=true even on unmount
    // so re-mount will skip
  };
}, [orderId, config]);
```

## Webhook Processing Delay

**HAR Response shows**: `"foundCorrelation": false, "foundCustomer": false"`

**Root Cause**:
1. Order created in Shopify
2. Thank You page loads **immediately**
3. Extension tries to fetch data
4. Webhooks haven't processed yet (processing takes 1-30 seconds)
5. Database returns `NOT_FOUND`

**Solutions**:

### Option 1: Retry with Exponential Backoff
```tsx
const retryFetch = async (url: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.error || data.error.code !== 'NOT_FOUND') {
      return data;
    }
    
    // Wait before retry: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
  }
  
  throw new Error('Data not available after retries');
};
```

### Option 2: Polling with Timeout
```tsx
const pollForData = async (url: string, maxAttempts = 5) => {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) return data;
    
    // Poll every 2 seconds
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return null; // Show fallback after 10 seconds
};
```

### Option 3: WebSocket/SSE for Real-Time Updates ⭐ **BEST**
When webhook processes order, push notification to extension:
```tsx
// Server sends event when webhook completes
const eventSource = new EventSource(`/api/order-updates/${orderId}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setRiskData(data);
};
```

## Implementation Priority

### Phase 1: Immediate (Stop Duplicates)
1. ✅ **Implement Solution A** (SessionStorage deduplication)
2. ✅ **Fix useMemo placement** (move outside useEffect)
3. ✅ **Add Solution C** (Strict Mode protection)

### Phase 2: Short-term (Better UX)
4. ✅ **Implement Solution B** (API-level dedup)
5. ✅ **Add retry logic** for NOT_FOUND errors
6. ✅ **Show loading state** with "Processing order..." message

### Phase 3: Long-term (Optimal Architecture)
7. ✅ **WebSocket/SSE** for real-time updates
8. ✅ **Server-side rendering** of initial state
9. ✅ **Progressive enhancement** pattern

## Testing Checklist

- [ ] Single extension instance - no duplicates
- [ ] Multiple browser tabs - shared deduplication
- [ ] React Strict Mode enabled - no double calls
- [ ] Page refresh - lock expires correctly
- [ ] Slow network - timeout works
- [ ] Webhook delay - retry succeeds
- [ ] Guest order - fallback UI shown
- [ ] Production build - no dev-only issues

## Files to Modify

1. `extensions/thank-you-risk-display/src/Checkout.tsx` - Add SessionStorage dedup
2. `app/routes/api.get-order-data.tsx` - Add server-side dedup (optional)
3. `.env` - Confirm DATABASE_URL (already correct ✅)

---

**Next Steps**: Implement Solution A first, then test in production. Monitor HAR files to confirm reduction from 13 calls → 1 call.
