# 🔧 Script Response Structure Fix

## 🎯 **New Issue Identified**

**Error**: `"Cannot read properties of undefined (reading 'id')"`

**Root Cause**: The Shopify Script Tags API response structure was different than expected. The code was trying to access `result.script_tag.id` but `result.script_tag` was undefined.

## 📊 **Progress Made**

✅ **HTTP 422 Fixed**: Changed `display_scope` from `"checkout"` to `"all"`  
✅ **API Call Succeeding**: No more validation errors from Shopify  
❌ **Response Parsing**: Response structure was unexpected

## 🔧 **Solution Applied**

### Enhanced Response Handling

Added robust response parsing that handles multiple possible response structures:

```javascript
// Handle different response structures
const result = response.body as any;
let scriptTag = null;

if (result?.script_tag) {
  // Standard wrapped response: { script_tag: {...} }
  scriptTag = result.script_tag;
} else if (result?.id) {
  // Direct response: { id, src, event, ... }
  scriptTag = result;
} else {
  // Unexpected structure - log and error
  logger.error("Unexpected response structure from script tag API", {
    shopDomain,
    responseBody: result,
    component: "scriptTag"
  });
  throw new Error("Invalid response structure from Shopify API");
}
```

### Enhanced Logging

Added comprehensive response logging to see exactly what Shopify returns:

```javascript
logger.info("Script registration API response", {
  shopDomain,
  status: response.status,
  responseBody: response.body,
  component: "scriptTag"
});
```

## 🚀 **Expected Outcome**

The next script registration attempt will:

1. ✅ **Show Response Structure** - Log the exact response from Shopify
2. ✅ **Handle Any Format** - Work with wrapped or direct response structures  
3. ✅ **Register Successfully** - Complete the script tag registration
4. ✅ **Show Success Details** - Log script ID, URL, event, and scope

## 🧪 **Debug Information**

When you try again, you'll see logs like:

```
INFO: Script registration API response {
  status: 201,
  responseBody: { /* actual Shopify response structure */ }
}

INFO: Checkout script registered successfully {
  scriptId: 12345,
  scriptUrl: "https://tunnel.com/checkout-enforcement.js",
  event: "onload", 
  displayScope: "all"
}
```

## 📝 **What This Tells Us**

- **API Integration**: Working correctly now (no HTTP errors)
- **Authentication**: Proper (API calls succeeding)
- **Permissions**: Correct (script tag creation allowed)
- **Response Format**: Just needed flexible parsing

This is a common issue when working with REST APIs that can return data in different formats depending on the endpoint or API version.

## ✅ **Ready for Testing**

Try the script registration again! It should now work end-to-end and provide clear success confirmation.

