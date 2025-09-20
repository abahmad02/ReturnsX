# API Endpoint Configuration Guide

## Overview

This guide provides detailed instructions for configuring the ReturnsX API endpoints for the Thank You Page Extension. Proper API configuration is essential for the extension to function correctly and securely.

## API Endpoint Structure

### Base URL Configuration

The extension connects to ReturnsX API endpoints using the following structure:

```
Base URL: https://api.returnsx.com/v1
Risk Profile Endpoint: /risk-profile
Authentication Endpoint: /auth/validate
Health Check Endpoint: /health
```

### Environment-Specific Endpoints

| Environment | Base URL | Purpose |
|-------------|----------|---------|
| Production | `https://api.returnsx.com/v1` | Live customer data |
| Staging | `https://staging-api.returnsx.com/v1` | Testing with staging data |
| Development | `https://dev-api.returnsx.com/v1` | Development and debugging |

## Authentication Configuration

### API Token Setup

1. **Obtain API Credentials**
   - Log into your ReturnsX merchant dashboard
   - Navigate to **Settings** > **API Access**
   - Generate a new API token for Shopify integration
   - Copy the token securely (it won't be shown again)

2. **Token Format**
   ```
   Format: Bearer [token]
   Example: Bearer rx_live_1234567890abcdef...
   Length: 64 characters (excluding prefix)
   ```

3. **Token Permissions**
   Required permissions for the extension:
   - `risk_profile:read` - Read customer risk assessments
   - `customer:read` - Access customer profile data
   - `analytics:read` - Access usage analytics (optional)

### Authentication Headers

The extension automatically includes these headers with each API request:

```http
Authorization: Bearer [your-api-token]
Content-Type: application/json
X-Shopify-Shop-Domain: [your-shop].myshopify.com
X-Extension-Version: 1.0.0
User-Agent: ReturnsX-Shopify-Extension/1.0.0
```

## API Endpoint Details

### 1. Risk Profile Endpoint

**Endpoint**: `POST /risk-profile`

**Purpose**: Retrieve customer risk assessment data

**Request Format**:
```json
{
  "phone": "hashed_phone_number",
  "email": "hashed_email_address",
  "orderId": "shopify_order_id",
  "checkoutToken": "shopify_checkout_token"
}
```

**Response Format**:
```json
{
  "success": true,
  "riskTier": "MEDIUM_RISK",
  "riskScore": 65,
  "totalOrders": 12,
  "failedAttempts": 3,
  "successfulDeliveries": 9,
  "isNewCustomer": false,
  "message": "Customer has moderate delivery risk",
  "recommendations": [
    "Confirm delivery address before shipping",
    "Consider requiring signature on delivery"
  ],
  "whatsappContact": {
    "enabled": true,
    "phoneNumber": "+923001234567",
    "messageTemplate": "Hi! I want to confirm my order details..."
  }
}
```

### 2. Authentication Validation Endpoint

**Endpoint**: `GET /auth/validate`

**Purpose**: Validate API token and check permissions

**Response Format**:
```json
{
  "valid": true,
  "permissions": [
    "risk_profile:read",
    "customer:read"
  ],
  "expiresAt": "2024-12-31T23:59:59Z",
  "rateLimits": {
    "requestsPerMinute": 100,
    "requestsPerHour": 1000
  }
}
```

### 3. Health Check Endpoint

**Endpoint**: `GET /health`

**Purpose**: Check API service availability

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.2.3",
  "responseTime": 45
}
```

## Configuration in Shopify

### Theme Customizer Settings

1. **Access Configuration**
   - Go to **Online Store** > **Themes** > **Customize**
   - Navigate to **Checkout** > **Thank you page**
   - Find "ReturnsX Risk Display" section

2. **API Configuration Fields**
   ```
   API Endpoint URL: [Base URL from table above]
   Authentication Token: [Your API token]
   Request Timeout: 5000 (milliseconds)
   Enable Retry Logic: Yes
   Max Retry Attempts: 3
   ```

### Advanced Configuration Options

```json
{
  "apiConfig": {
    "baseUrl": "https://api.returnsx.com/v1",
    "timeout": 5000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "circuitBreakerThreshold": 5,
    "circuitBreakerTimeout": 30000
  },
  "caching": {
    "enabled": true,
    "ttl": 300,
    "maxEntries": 100
  },
  "security": {
    "validateCertificates": true,
    "allowInsecureConnections": false,
    "hashCustomerData": true
  }
}
```

## Error Handling Configuration

### HTTP Status Code Handling

| Status Code | Meaning | Extension Behavior |
|-------------|---------|-------------------|
| 200 | Success | Display risk information |
| 401 | Unauthorized | Show fallback message, log error |
| 403 | Forbidden | Show fallback message, log error |
| 404 | Not Found | Treat as new customer |
| 429 | Rate Limited | Retry with exponential backoff |
| 500 | Server Error | Show fallback message, retry |
| 503 | Service Unavailable | Show fallback message, retry |

### Timeout Configuration

```javascript
const timeoutConfig = {
  connection: 2000,    // Connection timeout (2 seconds)
  request: 5000,       // Request timeout (5 seconds)
  retry: 1000,         // Delay between retries (1 second)
  circuitBreaker: 30000 // Circuit breaker timeout (30 seconds)
};
```

## Rate Limiting

### Default Limits

- **Requests per minute**: 100
- **Requests per hour**: 1,000
- **Concurrent requests**: 10
- **Burst allowance**: 20 requests

### Rate Limit Headers

The API returns rate limiting information in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 60
```

### Handling Rate Limits

When rate limits are exceeded:

1. **Automatic Retry**: Extension waits for the time specified in `Retry-After` header
2. **Exponential Backoff**: Increases delay between retry attempts
3. **Circuit Breaker**: Temporarily stops API calls after repeated failures
4. **Fallback Content**: Shows generic content when API is unavailable

## Security Configuration

### HTTPS Requirements

- **Production**: HTTPS is mandatory for all API calls
- **Development**: HTTP allowed only for localhost testing
- **Certificate Validation**: Always enabled in production

### Data Privacy

The extension automatically implements privacy protection:

```javascript
// Customer data is hashed before transmission
const hashedPhone = sha256(customerPhone);
const hashedEmail = sha256(customerEmail);

// API request includes only hashed identifiers
const requestData = {
  phone: hashedPhone,
  email: hashedEmail,
  // No raw PII is transmitted
};
```

### Request Signing (Optional)

For enhanced security, enable request signing:

```javascript
const signature = hmacSha256(requestBody, secretKey);
headers['X-Request-Signature'] = signature;
```

## Testing API Configuration

### 1. Connection Test

Use the health check endpoint to verify basic connectivity:

```bash
curl -X GET "https://api.returnsx.com/v1/health" \
  -H "Authorization: Bearer your-api-token"
```

### 2. Authentication Test

Validate your API token:

```bash
curl -X GET "https://api.returnsx.com/v1/auth/validate" \
  -H "Authorization: Bearer your-api-token"
```

### 3. Risk Profile Test

Test risk profile retrieval:

```bash
curl -X POST "https://api.returnsx.com/v1/risk-profile" \
  -H "Authorization: Bearer your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "hashed_phone_number",
    "orderId": "test_order_123"
  }'
```

## Monitoring and Logging

### API Usage Monitoring

Monitor these metrics in your ReturnsX dashboard:

- **Request Volume**: Total API calls per day/hour
- **Response Times**: Average and 95th percentile response times
- **Error Rates**: Percentage of failed requests by error type
- **Rate Limit Usage**: Percentage of rate limit consumed

### Debug Logging

Enable debug mode in theme customizer to log:

```javascript
// Debug information logged to browser console
console.log('ReturnsX API Request:', {
  endpoint: '/risk-profile',
  timestamp: new Date().toISOString(),
  requestId: 'req_123456789'
});

console.log('ReturnsX API Response:', {
  status: 200,
  responseTime: 245,
  riskTier: 'MEDIUM_RISK'
});
```

## Troubleshooting API Issues

### Common Problems and Solutions

1. **401 Unauthorized**
   - Verify API token is correct and not expired
   - Check token permissions include required scopes
   - Ensure token is properly formatted with "Bearer " prefix

2. **Connection Timeouts**
   - Check network connectivity
   - Verify API endpoint URL is correct
   - Consider increasing timeout values for slow connections

3. **Rate Limit Exceeded**
   - Implement proper retry logic with exponential backoff
   - Consider caching responses to reduce API calls
   - Contact ReturnsX support to increase rate limits if needed

4. **Invalid Response Format**
   - Verify API version compatibility
   - Check for API updates or breaking changes
   - Validate request format matches API specification

### Debug Mode Configuration

Enable debug mode for troubleshooting:

```json
{
  "debugMode": {
    "enabled": true,
    "logLevel": "verbose",
    "logRequests": true,
    "logResponses": true,
    "logErrors": true,
    "consoleOutput": true
  }
}
```

## Production Deployment Checklist

Before deploying to production:

- [ ] API token is production-ready (not test/staging token)
- [ ] Base URL points to production API endpoint
- [ ] Debug mode is disabled
- [ ] HTTPS is enforced for all API calls
- [ ] Rate limiting is properly configured
- [ ] Error handling covers all expected scenarios
- [ ] Monitoring and alerting are set up
- [ ] API usage limits are appropriate for expected traffic

## Support and Updates

### Getting Help

- **API Documentation**: https://docs.returnsx.com/api
- **Support Email**: api-support@returnsx.com
- **Status Page**: https://status.returnsx.com

### API Version Updates

The extension automatically handles minor API updates. For major version changes:

1. Review changelog at https://docs.returnsx.com/changelog
2. Test changes in staging environment
3. Update extension configuration if needed
4. Deploy to production after validation

### Webhook Notifications (Optional)

Configure webhooks to receive API status updates:

```json
{
  "webhookUrl": "https://your-store.myshopify.com/webhooks/returnsx",
  "events": [
    "api.maintenance.scheduled",
    "api.version.updated",
    "rate_limit.exceeded"
  ]
}
```