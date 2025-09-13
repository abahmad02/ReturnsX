# 🚀 ReturnsX UI Extensions Implementation Guide

## 📋 Overview

This implementation provides a complete Shopify app + UI extension system for displaying unified customer risk scores on both Order Status pages and Post-Purchase checkout flow. The system includes:

- **Customer Account UI Extension** - Order status page risk display
- **Post-Purchase UI Extension** - Immediate post-checkout risk feedback  
- **Secure Backend APIs** - Session token validation and risk assessment
- **Checkout Correlation System** - Links post-purchase context with order webhooks
- **Privacy-Compliant Authentication** - Handles different authentication states

## 🏗️ Architecture Components

### 1. Customer Account UI Extension
- **Target**: `customer-account.order-status.block.render`
- **File**: `extensions/customer-account-risk-display/`
- **Features**:
  - Full risk profile for authenticated customers
  - Order history and statistics
  - Improvement tips and support contacts
  - Privacy-compliant data display

### 2. Post-Purchase UI Extension  
- **Target**: `purchase.checkout.block.render`
- **File**: `extensions/post-purchase-risk-display/`
- **Features**:
  - Immediate risk feedback after checkout
  - Checkout token correlation storage
  - New customer welcome messages
  - Quick improvement tips

### 3. Backend API Endpoints

#### Risk Profile API (`/api/risk-profile`)
```typescript
GET /api/risk-profile?phone={phone}&email={email}&customerId={id}
Headers: Authorization: Bearer {sessionToken}
```
- Session token validation
- Privacy-compliant data sanitization  
- Multi-factor customer identification
- Context-aware response filtering

#### Checkout Correlation API (`/api/checkout-correlation`)
```typescript
POST /api/checkout-correlation
Headers: Authorization: Bearer {sessionToken}
Body: { checkoutToken, customerPhone, customerEmail, ... }
```
- Stores checkout context for webhook correlation
- Links post-purchase extension data with orders
- Enables order tracking across systems

### 4. Enhanced Webhook Processing
- **File**: `app/routes/webhooks.orders.created.tsx`
- **Features**:
  - Checkout token correlation matching
  - Post-purchase context integration
  - Risk profile updates with correlation data

## 🔐 Authentication & Privacy

### Authentication States

| State | Description | Data Access | Risk Display |
|-------|-------------|-------------|--------------|
| **Authenticated** | Customer logged in with ID | Full private data | Complete risk profile |
| **Pre-Authenticated** | Login started, no ID | Limited email only | Basic risk message |
| **Unauthenticated** | No login | None | Login required message |
| **Anonymous** | Post-purchase context | Checkout data only | Basic risk feedback |

### Privacy Compliance
- Phone number hashing for cross-store tracking
- Session token validation for API security
- Data sanitization based on authentication level
- GDPR-compliant data handling

## 📊 Data Flow

### Customer Account Extension Flow
```
Customer logs in → Extension loads → Check auth state → 
Query customer data → Validate session token → 
Fetch risk profile → Display based on auth level
```

### Post-Purchase Extension Flow
```
Checkout completes → Extension loads → Extract checkout data → 
Store correlation → Fetch risk profile → Display feedback → 
Order webhook arrives → Match correlation → Update profile
```

## 🛠️ Installation & Setup

### 1. Install Dependencies
```bash
# Install extension dependencies
cd extensions/customer-account-risk-display
npm install

cd ../post-purchase-risk-display  
npm install

cd ../..
```

### 2. Database Migration
```bash
# Add checkout correlation table
npm run db:push

# Or run migration
npm run db:migrate
```

### 3. Build Extensions
```bash
# Build all extensions
shopify app build

# Or build individually
cd extensions/customer-account-risk-display
shopify extension build
```

### 4. Deploy Extensions
```bash
# Deploy entire app with extensions
shopify app deploy

# Or deploy extensions only
shopify extension deploy
```

### 5. Configure in Shopify Admin

#### Customer Account Extension
1. Go to **Online Store → Customer accounts**
2. Navigate to **Order status page** 
3. Add **"ReturnsX Customer Risk Display"** block
4. Configure settings:
   - API Endpoint: `https://your-app.vercel.app/api/risk-profile`
   - Show detailed statistics: `true`
   - Enable improvement tips: `true`

#### Post-Purchase Extension
1. Go to **Settings → Checkout**
2. Navigate to **Post-purchase page**
3. Add **"ReturnsX Post-Purchase Risk Display"** block
4. Configure settings:
   - API Endpoint: `https://your-app.vercel.app/api/risk-profile`
   - Correlation Endpoint: `https://your-app.vercel.app/api/checkout-correlation`

## 🔧 Configuration

### Extension Settings

Both extensions support these configurable settings:

```toml
[extensions.settings]
[[extensions.settings.fields]]
key = "api_endpoint"
type = "single_line_text_field"
name = "API Endpoint"
default = "https://returnsx.vercel.app/api/risk-profile"

[[extensions.settings.fields]]
key = "show_detailed_stats"
type = "boolean"
name = "Show Detailed Statistics"
default = true
```

### Environment Variables
```bash
# Required for session token validation
RETURNSX_HASH_SALT=your-secure-random-salt

# Database for correlation storage
DATABASE_URL=your-postgresql-connection-string

# Shopify webhook secret for verification
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
```

## 🧪 Testing

### Run Test Suite
```bash
# Test all extension functionality
node test-extensions.js

# Test specific components
npm run test:extensions
```

### Manual Testing

#### Customer Account Extension
1. Create test customer account
2. Place and complete an order
3. Log in as customer
4. Navigate to order status page
5. Verify risk display appears with correct data

#### Post-Purchase Extension  
1. Complete a checkout as guest or logged-in customer
2. Verify risk feedback appears on post-purchase page
3. Check correlation is stored in database
4. Verify webhook matches correlation with order

### Testing Different Authentication States
```javascript
// Test unauthenticated state
// Log out and visit order status page

// Test pre-authenticated state  
// Start login but don't complete

// Test authenticated state
// Complete login and access order details
```

## 🚀 Deployment

### Production Checklist
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Extensions built and deployed
- [ ] Webhooks registered and verified
- [ ] Session token validation implemented
- [ ] Privacy compliance reviewed
- [ ] API endpoints secured
- [ ] Error handling implemented
- [ ] Logging configured

### Monitoring
- Extension load times and errors
- API response times and success rates
- Session token validation failures
- Checkout correlation match rates
- Privacy compliance metrics

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Appearing
- Check extension is deployed: `shopify extension list`
- Verify extension is enabled in Shopify admin
- Check browser console for JavaScript errors

#### Authentication Failures
- Verify session token validation logic
- Check customer authentication state
- Review API endpoint authentication headers

#### Correlation Mismatches
- Verify webhook is receiving `checkout_token`
- Check correlation table for stored data
- Review webhook processing timing

#### Privacy Violations
- Ensure data sanitization for unauthenticated users
- Verify phone number hashing implementation
- Check session token validation

### Debug Mode
Enable debug logging:
```javascript
// In extension code
console.log('Extension Debug:', { 
  authState, 
  customerData, 
  riskData 
});

// In API endpoints
logger.debug("API Debug", { 
  component: "riskProfileAPI",
  authLevel: tokenValidation.authenticated 
});
```

## 📈 Performance Optimization

### Extension Performance
- Minimize API calls per extension load
- Cache risk data when appropriate
- Use loading states for better UX
- Implement error boundaries

### API Performance
- Database query optimization
- Response caching for repeated requests
- Efficient session token validation
- Minimize data payload sizes

## 🔒 Security Considerations

### Session Token Security
- Always validate session tokens
- Check token expiration
- Verify token authenticity with Shopify
- Use HTTPS for all API communications

### Data Privacy
- Hash customer identifiers
- Sanitize responses based on auth level
- Implement proper GDPR compliance
- Audit data access patterns

### API Security
- Rate limiting on API endpoints
- Input validation and sanitization
- SQL injection prevention
- CORS configuration

## 📋 API Reference

### Risk Profile Response Format
```json
{
  "success": true,
  "riskTier": "ZERO_RISK|MEDIUM_RISK|HIGH_RISK",
  "riskScore": 25.5,
  "totalOrders": 15,
  "failedAttempts": 2,
  "successfulDeliveries": 13,
  "isNewCustomer": false,
  "message": "Customer risk message",
  "riskFactors": ["13% delivery failure rate"],
  "improvementTips": ["Accept deliveries promptly"],
  "timestamp": "2025-09-14T10:00:00Z"
}
```

### Checkout Correlation Request Format
```json
{
  "checkoutToken": "checkout_token_12345",
  "customerPhone": "+923001234567",
  "customerEmail": "customer@example.com", 
  "customerId": "customer_456",
  "totalPrice": {
    "amount": "2500.00",
    "currencyCode": "PKR"
  },
  "timestamp": "2025-09-14T10:00:00Z"
}
```

## 🎯 Expected Deliverables Summary

✅ **Extension Configuration**: `shopify.extension.toml` files with correct targets, api_access, and network_access flags

✅ **Extension Code**: React components for both Customer Account and Post-Purchase UI extensions with authentication handling

✅ **Backend API**: Secure `/api/risk-profile` endpoint with session token validation and privacy controls

✅ **Correlation System**: Checkout token correlation system linking post-purchase context with order webhooks

✅ **Authentication Handling**: Comprehensive authentication state management for different user contexts

✅ **Privacy Compliance**: Data sanitization and access controls based on authentication level

This implementation provides a complete, production-ready solution for displaying unified customer risk scores across Shopify's checkout and customer account interfaces while maintaining strict privacy and security standards.