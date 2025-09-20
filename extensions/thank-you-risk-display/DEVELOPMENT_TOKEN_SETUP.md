# Development & Testing Setup - ReturnsX Extension

## 🚧 Development Scenario

You're right! Since you're building the ReturnsX platform, you don't have access to a production dashboard yet. Here's how to handle authentication during development and testing.

## 🔧 Development Options

### Option 1: Mock Token for Development (Recommended)
For development and testing, you can use a mock token that the extension will handle gracefully.

#### Create Mock Token
```bash
# Use this format for development
MOCK_TOKEN="rtx_dev_mock1234567890abcdefghijklmnop"
```

#### Configure Extension for Development
1. **In Shopify Theme Customizer:**
   - **Authentication Token:** `rtx_dev_mock1234567890abcdefghijklmnop`
   - **API Endpoint:** `http://localhost:3000/api` (your local ReturnsX API)
   - **Enable Debug Mode:** `Yes` (to see detailed logs)

#### Extension Behavior with Mock Token
The extension is designed to:
- ✅ Accept mock tokens starting with `rtx_dev_` or `rtx_test_`
- ✅ Show fallback content when API is unavailable
- ✅ Display debug information in development mode
- ✅ Gracefully handle connection failures

### Option 2: Local Development API
Set up a minimal local API endpoint for testing.

#### Quick Express.js Mock API
```javascript
// mock-api.js
const express = require('express');
const app = express();

app.use(express.json());

// Mock risk profile endpoint
app.post('/api/risk-profile', (req, res) => {
  const { phone, email } = req.body;
  
  // Mock response based on phone/email
  const mockResponse = {
    success: true,
    riskTier: phone?.includes('123') ? 'HIGH_RISK' : 'MEDIUM_RISK',
    riskScore: Math.floor(Math.random() * 100),
    totalOrders: Math.floor(Math.random() * 20),
    failedAttempts: Math.floor(Math.random() * 5),
    successfulDeliveries: Math.floor(Math.random() * 15),
    isNewCustomer: Math.random() > 0.5,
    message: 'Mock risk assessment for development',
    recommendations: [
      'This is a mock recommendation for testing',
      'Extension is working correctly in development mode'
    ]
  };
  
  res.json(mockResponse);
});

app.listen(3000, () => {
  console.log('Mock ReturnsX API running on http://localhost:3000');
});
```

#### Run Mock API
```bash
node mock-api.js
```

### Option 3: Environment-Based Configuration
Configure the extension to work in different environments.

#### Extension Configuration
```javascript
// In your extension code
const getApiConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = window.location.hostname === 'localhost';
  
  if (isDevelopment || isTest) {
    return {
      apiEndpoint: 'http://localhost:3000/api',
      enableMockMode: true,
      showDebugInfo: true
    };
  }
  
  return {
    apiEndpoint: 'https://api.returnsx.com',
    enableMockMode: false,
    showDebugInfo: false
  };
};
```

## 🧪 Testing Scenarios

### Test Different Risk Levels
Use these mock phone numbers to test different scenarios:

```javascript
// In your mock API or extension
const getMockRiskLevel = (phone) => {
  if (phone?.includes('111')) return 'ZERO_RISK';
  if (phone?.includes('222')) return 'MEDIUM_RISK';
  if (phone?.includes('333')) return 'HIGH_RISK';
  return 'MEDIUM_RISK'; // default
};
```

### Test Orders
- **Zero Risk:** Use phone `+92300111****`
- **Medium Risk:** Use phone `+92300222****`
- **High Risk:** Use phone `+92300333****`

## 🚀 Production Deployment Strategy

### Phase 1: Extension Development (Current)
- ✅ Use mock tokens and local API
- ✅ Test extension functionality
- ✅ Validate Shopify integration

### Phase 2: ReturnsX API Development
- 🔄 Build the actual ReturnsX API
- 🔄 Implement authentication system
- 🔄 Create token generation

### Phase 3: Integration Testing
- 🔄 Connect extension to real API
- 🔄 Test with real customer data
- 🔄 Validate risk assessment logic

### Phase 4: Production Launch
- 🔄 Deploy ReturnsX platform
- 🔄 Create merchant dashboard
- 🔄 Generate production tokens

## 📋 Current Development Checklist

### Extension Testing
- [ ] Extension loads without errors
- [ ] Mock token authentication works
- [ ] Fallback content displays properly
- [ ] Debug mode shows useful information
- [ ] Different risk levels display correctly
- [ ] WhatsApp integration works with mock data
- [ ] Mobile responsive design works
- [ ] Cross-browser compatibility verified

### API Integration Preparation
- [ ] API client handles different response formats
- [ ] Error handling works for network failures
- [ ] Retry logic functions correctly
- [ ] Circuit breaker prevents cascading failures
- [ ] Caching improves performance
- [ ] Security measures are in place

## 🛠️ Recommended Development Flow

1. **Start with Mock Data**
   ```bash
   # Use mock token in Shopify
   rtx_dev_mock1234567890abcdefghijklmnop
   ```

2. **Test Extension Functionality**
   - Place test orders
   - Verify thank you page display
   - Test different risk scenarios

3. **Build Local API (Optional)**
   - Create simple Express.js mock
   - Test real API integration
   - Validate request/response format

4. **Prepare for Production**
   - Document API requirements
   - Plan authentication system
   - Design token generation process

## 💡 Pro Tips

- **Use Debug Mode:** Always enable during development
- **Test Offline:** Ensure graceful fallback when API unavailable
- **Mock Different Scenarios:** Test zero, medium, and high risk customers
- **Document API Contract:** Define exact request/response format needed
- **Plan Token Security:** Design secure token generation for production

This approach lets you fully develop and test the extension before the ReturnsX platform is deployed!