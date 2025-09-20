# Clearing Auth Token Field from Shopify

## 🔍 Issue: Auth Token Field Still Visible

If you're still seeing the "Authentication Token" field in Shopify's theme customizer after removing it from the code, this is likely due to caching.

## 🛠️ Solutions (Try in Order)

### 1. Redeploy the Extension
The most common cause is that the updated configuration hasn't been deployed yet.

```bash
# Redeploy with the updated configuration
shopify app deploy
```

**Wait 2-3 minutes** after deployment for Shopify to update the configuration.

### 2. Clear Browser Cache
Sometimes the browser caches the old configuration form.

**Chrome/Edge:**
- Press `Ctrl + Shift + R` (hard refresh)
- Or go to Settings → Privacy → Clear browsing data

**Firefox:**
- Press `Ctrl + F5` (hard refresh)
- Or clear cache in Settings

### 3. Force Shopify Configuration Refresh
Try these steps in Shopify admin:

1. **Go to theme customizer**
2. **Navigate away** from the thank you page section
3. **Close the customizer** completely
4. **Reopen the customizer**
5. **Navigate back** to the thank you page section

### 4. Check Extension Version
Verify you're looking at the latest version:

1. **Shopify Admin** → **Apps**
2. **Find your ReturnsX app**
3. **Check if there's an update available**
4. **Update if needed**

### 5. Temporary Workaround
If the field is still there but you want to proceed:

**Option A: Leave it empty**
- Just leave the auth token field blank
- The extension will work fine without it

**Option B: Put a placeholder**
- Enter: `not-required` or `disabled`
- The extension ignores this field now

## ✅ How to Verify It's Fixed

### Check the Configuration
After clearing cache, you should see:

**✅ Fields that should be present:**
- ReturnsX API Endpoint
- API Timeout (seconds)
- Enable Response Caching
- Enable Debug Mode
- Show Detailed Tips
- Show Risk Score
- Use Color Coding
- Compact Mode
- Custom messages (5 fields)
- WhatsApp settings (3 fields)
- Advanced options (3 fields)

**❌ Field that should NOT be present:**
- Authentication Token

### Test the Extension
1. **Configure API endpoint** (required)
2. **Save settings**
3. **Place test order**
4. **Check thank you page** - should work without auth token

## 🔧 Technical Details

### Why This Happens
- **Shopify caches** extension configurations for performance
- **Browser caches** form definitions
- **CDN caching** of extension metadata
- **Gradual rollout** of configuration changes

### Configuration File Status
The `shopify.extension.toml` file has been updated to remove:
```toml
# This field has been REMOVED
[[extensions.settings.fields]]
key = "auth_token"
type = "single_line_text_field"
name = "Authentication Token"
```

### Code Status
The extension code has been updated to:
- ✅ Remove auth token from API client
- ✅ Remove auth headers from requests  
- ✅ Remove auth token from configuration types
- ✅ Skip auth token processing in hooks

## 🚀 Next Steps

1. **Try the solutions above** in order
2. **If field persists** - it's just a visual artifact, leave it empty
3. **Extension will work fine** without authentication
4. **Focus on setting** the API endpoint correctly

The important thing is that the **extension code no longer uses authentication**, so even if the field appears, it won't affect functionality.

## 📞 Still Having Issues?

If the auth token field persists after trying all solutions:

1. **It's safe to ignore** - just leave it empty
2. **Extension works without it** - no authentication is performed
3. **Focus on API endpoint** - that's the only required field now
4. **Field will disappear** eventually as Shopify's cache expires

The removal was successful in the code - any remaining UI elements are just cached artifacts that don't affect functionality.