# ReturnsX Import Failure Solution

## Issue Identified
The historical order import fails on the demo store because **environment variables are missing**.

## Root Cause Analysis
1. **Missing .env file**: The application requires Shopify API credentials to function
2. **No API authentication**: Without proper environment variables, the app cannot authenticate with Shopify
3. **Import process fails**: The `importHistoricalOrdersForAuthenticatedShop` function cannot get a valid session

## Environment Variables Required

Based on the `shopify.app.toml` configuration, create a `.env` file with:

```env
# SHOPIFY APP CONFIGURATION
SHOPIFY_API_KEY="379db999296fcd515d9c4d2613882c5a"
SHOPIFY_API_SECRET="YOUR_APP_SECRET_HERE"
SHOPIFY_SCOPES="read_orders,write_orders,read_customers,write_customers,read_fulfillments,write_script_tags,read_script_tags"
SHOPIFY_APP_URL="https://seeks-palace-participants-greene.trycloudflare.com"

# SECURITY KEYS (Generate new ones for production)
RETURNSX_ENCRYPTION_KEY="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
RETURNSX_HASH_SALT="fedcba0987654321098765432109876543210fedcba09876543210fedcba0987"
SESSION_SECRET="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

# DATABASE
DATABASE_URL="file:./dev.db"

# ENVIRONMENT
NODE_ENV="development"
SESSION_SECURE="false"
LOG_LEVEL="debug"
```

## Step-by-Step Fix

### 1. Get Shopify API Secret
1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Find your "ReturnsX" app
3. Copy the "Client secret" value
4. Replace `YOUR_APP_SECRET_HERE` in the .env file

### 2. Create .env File
Create a `.env` file in the project root with the configuration above.

### 3. Install App on Demo Store
1. Make sure the ReturnsX app is installed on your demo store
2. Verify the app has the required permissions:
   - `read_orders` (most important for import)
   - `read_customers`
   - `read_fulfillments`

### 4. Ensure Demo Store Has Orders
The demo store needs actual orders to import. If it's empty:
1. Create some test orders manually in the Shopify admin
2. Or use the test data generation scripts in the project

### 5. Test the Import
1. Start the development server: `npm run dev`
2. Navigate to the app dashboard
3. Try the historical import feature
4. Check browser dev tools for any error messages

## Common Issues & Solutions

### Authentication Errors
- **Error**: "No access token available for historical import"
- **Solution**: Ensure app is installed and .env has correct SHOPIFY_API_SECRET

### Permission Errors
- **Error**: 403 Forbidden when fetching orders
- **Solution**: Verify app has `read_orders` permission in Shopify Partners

### No Orders Found
- **Error**: Import completes but processes 0 orders
- **Solution**: Add test orders to the demo store or adjust date range

### Rate Limiting
- **Error**: 429 Too Many Requests
- **Solution**: The code already has 500ms delays - check if you're making other API calls

## Testing the Fix

After implementing the solution, test with:

```bash
# Start the development server
npm run dev

# In browser dev tools, make a test request
fetch('/api/import/historical', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    limitPerPage: 5
  })
})
```

## Expected Success Indicators

✅ **Request succeeds** (status 200)
✅ **Progress object returned** with `totalOrders > 0`
✅ **Customer profiles created** in database
✅ **Order events recorded** for risk assessment

## Security Notes

- The demo values in this solution are for **testing only**
- Generate real secure keys for production using [random.org](https://www.random.org/strings/)
- Never commit the `.env` file to version control
- The `.env` file is already properly ignored in `.gitignore`

## Prevention

To prevent this issue in the future:
1. Include `.env.example` template in the repository
2. Add environment setup to the deployment guide
3. Include environment validation in the startup script

---

**Result**: After implementing this solution, the historical import feature should work correctly on the demo store.
