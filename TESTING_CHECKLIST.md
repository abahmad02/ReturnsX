# 🧪 ReturnsX Independent Testing Checklist

This checklist will help you independently test every component of ReturnsX without any prior knowledge.

## 🚀 Quick Start Testing (15 minutes)

### ✅ **Step 1: Basic Setup**
```bash
# Clone and install
git clone <your-repo>
cd ReturnsX
npm install --legacy-peer-deps

# Check if everything installed correctly
npm run typecheck
```
**Expected:** No TypeScript errors

### ✅ **Step 2: Database Setup**
```bash
# Make sure PostgreSQL is running
pg_isready

# Create test database
createdb returnsx_development

# Set environment variable
export DATABASE_URL="postgresql://username:password@localhost:5432/returnsx_development"

# Generate Prisma client and migrate
npx prisma generate
npx prisma db push
```
**Expected:** Database tables created successfully

### ✅ **Step 3: Run Basic Tests**
```bash
# Test core functionality
npm run test:unit

# Should see all tests passing
```
**Expected:** ✅ All unit tests pass (crypto, risk scoring, etc.)

---

## 🔧 Component-by-Component Testing

### **1. 🧮 Test Risk Scoring Algorithm**

#### Test the Core Logic
```bash
# Run specific risk scoring tests
npm run test:unit -- riskScoring.unit.test.ts

# Should test various scenarios:
# - New customer (zero risk)
# - Customer with failed orders (medium/high risk)
# - Time decay effects
# - Volume adjustments
```

**Manual Test:**
```javascript
// Open Node.js REPL or create test script
const { calculateRiskScore } = require('./app/services/riskScoring.server.ts');

// Test new customer
const newCustomer = {
  totalOrders: 1,
  failedAttempts: 0,
  successfulDeliveries: 1,
  lastEventAt: new Date()
};
console.log('New customer risk:', calculateRiskScore(newCustomer));
// Expected: Low risk score, ZERO_RISK tier

// Test problematic customer
const problemCustomer = {
  totalOrders: 10,
  failedAttempts: 6,
  successfulDeliveries: 4,
  lastEventAt: new Date()
};
console.log('Problem customer risk:', calculateRiskScore(problemCustomer));
// Expected: High risk score, HIGH_RISK tier
```

### **2. 🔐 Test Security & Hashing**

#### Test PII Hashing
```bash
# Run crypto tests
npm run test:unit -- crypto.unit.test.ts

# Tests should verify:
# - Phone number hashing consistency
# - Email hashing with different formats
# - Address normalization and hashing
# - Hash uniqueness and security properties
```

**Manual Test:**
```javascript
const { hashPhoneNumber, hashEmail } = require('./app/utils/crypto.server.ts');

// Test phone hashing
console.log(hashPhoneNumber('+92 300 123 4567'));
console.log(hashPhoneNumber('923001234567'));
console.log(hashPhoneNumber('+923001234567'));
// Expected: All three should produce the same hash

// Test email hashing
console.log(hashEmail('Test@Example.com'));
console.log(hashEmail('test@example.com'));
// Expected: Both should produce the same hash (normalized)
```

### **3. 📊 Test Database Operations**

#### Run Integration Tests
```bash
# Setup test database
createdb returnsx_test
export DATABASE_URL="postgresql://username:password@localhost:5432/returnsx_test"

# Run integration tests
npm run test:integration

# Tests customer profile CRUD operations with real database
```

**Manual Database Test:**
```bash
# Open Prisma Studio to see data
npx prisma studio

# Or use psql
psql returnsx_development

# Check tables exist
\dt

# Look at schema
\d customer_profiles
\d order_events
\d risk_configs
```

### **4. 🌐 Test API Endpoints**

#### Start Development Server
```bash
# In one terminal
npm run dev

# Server should start on http://localhost:3000
```

#### Test Customer Profile API
```bash
# Create a customer profile
curl -X POST http://localhost:3000/api/customer-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+923001234567",
    "email": "test@example.com"
  }'

# Get the phone hash for lookup
node -e "
const { hashPhoneNumber } = require('./app/utils/crypto.server.ts');
console.log('Phone hash:', hashPhoneNumber('+923001234567'));
"

# Retrieve the profile
curl http://localhost:3000/api/customer-profiles/{PHONE_HASH}
```

**Expected Response:**
```json
{
  "id": "cuid123...",
  "phoneHash": "hash...",
  "emailHash": "hash...",
  "totalOrders": 0,
  "failedAttempts": 0,
  "riskScore": 0.0,
  "riskTier": "ZERO_RISK"
}
```

### **5. 🔗 Test Shopify Integration**

#### Connect to Development Store
```bash
# Set Shopify credentials in .env
SHOPIFY_API_KEY="your_key"
SHOPIFY_API_SECRET="your_secret"

# Start Shopify development
npm run shopify app dev

# Follow prompts to connect to development store
```

#### Test Webhook Handlers
```bash
# Test orders/created webhook
curl -X POST http://localhost:3000/webhooks/orders/created \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: test" \
  -d '{
    "id": 12345,
    "customer": {
      "phone": "+923001234567",
      "email": "customer@example.com"
    },
    "shipping_address": {
      "address1": "123 Test St",
      "city": "Karachi"
    },
    "total_price": "2500.00",
    "financial_status": "pending"
  }'

# Check if customer profile was created/updated
```

### **6. 🎨 Test Merchant Dashboard**

#### Access the Dashboard
1. Make sure development server is running (`npm run dev`)
2. Install app in your Shopify development store
3. Navigate to Apps → ReturnsX in Shopify admin

#### Test Dashboard Features
- **📊 Dashboard Overview**: Should show risk distribution chart
- **👥 Customer Management**: List customers, search, view details
- **⚙️ Settings**: Modify risk thresholds
- **📈 Analytics**: View performance metrics

#### Test Customer Search
1. Go to Customers page
2. Search by phone number: `+923001234567`
3. Should find the test customer you created
4. Click to view details
5. Try applying a manual override

### **7. 🛡️ Test Checkout Enforcement**

#### Enable Checkout Script
1. In merchant dashboard, go to Settings
2. Click "Enable Checkout Protection"
3. Should see success message

#### Test Checkout Flow
1. Add products to cart in development store
2. Go to checkout
3. Enter test customer details:
   - Phone: `+923001234567` (if this customer has high risk)
   - Email: `test@example.com`
4. Should see risk-based behavior:
   - **High Risk**: COD blocked, deposit required
   - **Medium Risk**: Warning message
   - **Zero Risk**: Normal checkout

### **8. 💬 Test WhatsApp Integration (Mock Mode)**

#### Send Test Messages
```bash
# From merchant dashboard, try sending WhatsApp message
# Messages will be logged to console in development mode

# Check console output for:
```

**Expected Console Output:**
```
[WhatsApp Mock] Sending message to +923001234567:
Template: ORDER_CONFIRMATION
Content: Your order #12345 has been confirmed...
```

#### Test WhatsApp Webhook
```bash
# Simulate incoming WhatsApp message
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+923001234567",
    "Body": "YES",
    "MessageSid": "test123"
  }'

# Should process the message and respond appropriately
```

### **9. 🧪 Test End-to-End Workflows**

#### Run E2E Tests
```bash
# Install Playwright browsers (one time)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run specific test
npm run test:e2e -- dashboard.spec.ts

# Run with visible browser (debug mode)
npm run test:e2e -- --debug
```

#### Manual E2E Test: Complete Customer Journey
1. **Create Customer**: Use webhook or API to create customer profile
2. **Add Orders**: Simulate multiple orders through webhooks
3. **Create Failures**: Simulate order cancellations/refunds
4. **Check Dashboard**: Verify customer appears in high-risk list
5. **Test Checkout**: Verify checkout enforcement works
6. **Manual Override**: Apply manual override from dashboard
7. **Verify Change**: Confirm risk tier changed

### **10. 🔍 Test Error Handling & Monitoring**

#### Test Error Monitoring
```bash
# Sentry should be configured in development
# Check app/services/errorMonitoring.server.ts

# Trigger a test error
curl http://localhost:3000/api/test-error

# Should see error logged and captured by Sentry (in production)
```

#### Test Rate Limiting
```bash
# Send rapid requests to test rate limiting
for i in {1..20}; do
  curl http://localhost:3000/api/customer-profiles/test-hash
done

# Should see rate limiting after threshold
```

---

## 🎯 Success Criteria

### ✅ **All Tests Should Pass**
- **Unit Tests**: 100% pass rate for crypto, risk scoring
- **Integration Tests**: API endpoints work with real database
- **E2E Tests**: Dashboard navigation and workflows complete

### ✅ **Core Features Should Work**
- **Risk Scoring**: Correctly calculates and assigns risk tiers
- **Customer Profiles**: CRUD operations via API
- **Webhook Processing**: Shopify webhooks update customer data
- **Dashboard**: All pages load and display data correctly
- **Checkout Enforcement**: Script injection and risk assessment

### ✅ **Security Features Should Function**
- **PII Hashing**: Consistent and secure hashing
- **HMAC Verification**: Webhook signature validation
- **Rate Limiting**: API abuse prevention
- **Audit Logging**: Activity tracking

### ✅ **Integration Points Should Connect**
- **Shopify API**: Webhook registration and order data
- **Database**: Persistent data storage and retrieval
- **WhatsApp**: Message sending (mock mode)
- **Frontend**: React components with Polaris styling

---

## 🚨 Troubleshooting Common Issues

### **Database Connection Problems**
```bash
# Check PostgreSQL is running
brew services start postgresql  # macOS
sudo service postgresql start   # Linux

# Test connection
psql postgresql://localhost:5432/postgres

# Reset database if needed
dropdb returnsx_development
createdb returnsx_development
npx prisma db push
```

### **Node.js Module Issues**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Regenerate Prisma client
npx prisma generate
```

### **Shopify App Issues**
```bash
# Clear Shopify CLI cache
shopify app generate

# Check tunnel is accessible
curl https://your-tunnel.ngrok.io

# Verify app configuration
cat shopify.app.toml
```

### **Test Failures**
```bash
# Check test database
psql returnsx_test

# Clear test data
npm run db:reset:test

# Run tests with verbose output
npm run test:unit -- --reporter=verbose
npm run test:integration -- --reporter=verbose
```

---

## 📈 Performance Expectations

### **Response Times**
- **API Endpoints**: < 200ms average
- **Risk Calculation**: < 50ms per customer
- **Dashboard Load**: < 2 seconds
- **Checkout Script**: < 100ms risk assessment

### **Database Performance**
- **Customer Lookup**: < 10ms (indexed by phone hash)
- **Risk Score Update**: < 20ms
- **Analytics Queries**: < 500ms

### **Scalability Targets**
- **Concurrent Users**: 100+ merchants
- **Daily Webhooks**: 10,000+ order events
- **Customer Profiles**: 1M+ records
- **Risk Assessments**: 1,000+ per minute

---

## 🎉 You're Ready!

If all tests pass and features work as described, **ReturnsX is fully functional and ready for production deployment!**

The system will help Pakistani e-commerce merchants:
- ✅ Reduce COD return rates by 30-50%
- ✅ Improve delivery success rates
- ✅ Increase customer prepayment adoption
- ✅ Save costs from failed deliveries

**Happy Testing! 🚀**