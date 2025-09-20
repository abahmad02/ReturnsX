# ReturnsX API Client Service

This directory contains the API client service for integrating with the ReturnsX risk assessment backend.

## Overview

The API client provides secure communication with the ReturnsX backend API, including:

- **Customer Data Hashing**: All customer PII (phone numbers, emails) are hashed using SHA-256 before transmission
- **Authentication**: Bearer token authentication for secure API access
- **Retry Logic**: Exponential backoff retry mechanism for failed requests
- **Timeout Handling**: 5-second request timeout with proper error handling
- **Error Management**: Comprehensive error handling with fallback states

## Files

### `apiClient.ts`
Main API client implementation with the `ReturnsXApiClient` class.

**Key Features:**
- Secure customer data hashing using Web Crypto API
- Retry logic with exponential backoff (max 3 retries)
- Request timeout handling (5 seconds)
- Response validation and error handling
- Request cancellation support

**Usage:**
```typescript
import { createApiClient } from './services/apiClient';

const client = createApiClient({
  baseUrl: 'https://api.returnsx.com',
  authToken: 'your-auth-token',
  enableDebug: false,
});

const profile = await client.getRiskProfile({
  phone: '+923001234567',
  email: 'customer@example.com',
  orderId: 'order_123',
});
```

### `index.ts`
Service exports for easy importing.

## API Client Configuration

```typescript
interface ApiClientConfig {
  baseUrl: string;           // ReturnsX API base URL
  authToken?: string;        // Bearer authentication token
  timeout: number;           // Request timeout in milliseconds (default: 5000)
  maxRetries: number;        // Maximum retry attempts (default: 3)
  retryDelay: number;        // Initial retry delay in milliseconds (default: 1000)
  enableDebug: boolean;      // Enable debug logging (default: false)
}
```

## Customer Data Hashing

Customer data is hashed before transmission to protect privacy:

1. **Normalization**: Phone numbers and emails are normalized (lowercase, spaces removed)
2. **Salt Addition**: A consistent salt is added to the normalized data
3. **SHA-256 Hashing**: The combined data is hashed using SHA-256
4. **Hex Encoding**: The hash is converted to a hexadecimal string

**Example:**
```typescript
// Original: "+92 300 123 4567"
// Normalized: "+923001234567"
// Hashed: "a1b2c3d4e5f6..." (SHA-256 hex)
```

## Error Handling

The API client handles various error scenarios:

### Error Types
- `NETWORK_ERROR`: Network connectivity issues
- `AUTHENTICATION_ERROR`: Invalid or expired authentication
- `INVALID_RESPONSE`: Malformed API response
- `TIMEOUT_ERROR`: Request timeout
- `CONFIGURATION_ERROR`: Invalid client configuration

### Retry Logic
- **Retryable Errors**: Network errors, server errors (5xx)
- **Non-Retryable Errors**: Authentication errors (401, 403), client errors (4xx)
- **Exponential Backoff**: Delay increases with each retry (1s, 2s, 4s)

### Fallback Behavior
When API calls fail, the client returns a fallback response for new customers:

```typescript
{
  success: false,
  riskTier: 'ZERO_RISK',
  riskScore: 0,
  totalOrders: 0,
  failedAttempts: 0,
  successfulDeliveries: 0,
  isNewCustomer: true,
  message: 'Welcome! We\'re excited to serve you.',
  error: 'Error description'
}
```

## Response Validation

All API responses are validated to ensure data integrity:

- **Required Fields**: Validates presence of required fields
- **Data Types**: Ensures correct data types for all fields
- **Enum Values**: Validates risk tier enum values
- **Range Validation**: Ensures numeric values are within expected ranges

## Security Features

### Data Privacy
- Customer PII is never transmitted in plain text
- SHA-256 hashing with salt for one-way data protection
- Order IDs and checkout tokens are transmitted as-is (not PII)

### Authentication
- Bearer token authentication
- Secure token storage in extension configuration
- Automatic token inclusion in API requests

### Request Security
- HTTPS-only communication
- Request timeout to prevent hanging connections
- Proper error handling to prevent information leakage

## Testing

The API client includes comprehensive tests:

### Unit Tests (`__tests__/apiClient.test.ts`)
- Configuration validation
- Request/response handling
- Error scenarios
- Retry logic
- Data hashing

### Integration Tests (`__tests__/integration.test.ts`)
- End-to-end API communication
- Hook integration
- Error handling
- Race condition handling

**Running Tests:**
```bash
npm run test:run
```

## Performance Considerations

### Request Optimization
- Single API call per risk assessment
- Response caching within session (future enhancement)
- Efficient retry logic with exponential backoff

### Memory Management
- Automatic request cancellation on component unmount
- Proper cleanup of event listeners and timers
- Minimal memory footprint

### Network Efficiency
- Compressed request payloads
- Minimal data transmission (only required fields)
- Timeout handling to prevent resource waste

## Future Enhancements

### Planned Features
1. **Response Caching**: Cache responses within session to reduce API calls
2. **Circuit Breaker**: Temporarily disable API calls after repeated failures
3. **Metrics Collection**: Track API performance and error rates
4. **Batch Requests**: Support for multiple customer lookups in single request

### Configuration Enhancements
1. **Dynamic Timeouts**: Adjust timeouts based on network conditions
2. **Custom Retry Strategies**: Configurable retry logic per error type
3. **Rate Limiting**: Client-side rate limiting to prevent API abuse

## Troubleshooting

### Common Issues

**Configuration Errors:**
- Ensure `api_endpoint` is a valid URL
- Verify authentication token is provided
- Check network connectivity

**Timeout Issues:**
- Increase timeout value for slow networks
- Check API server response times
- Verify network stability

**Authentication Failures:**
- Verify token validity and expiration
- Check token format and encoding
- Ensure proper API permissions

**Response Validation Errors:**
- Check API response format
- Verify all required fields are present
- Ensure data types match expected format

### Debug Mode

Enable debug mode to get detailed logging:

```typescript
const client = createApiClient({
  baseUrl: 'https://api.returnsx.com',
  enableDebug: true, // Enable debug logging
});
```

Debug logs include:
- Request details (URL, headers, body)
- Response information
- Error details
- Retry attempts
- Performance metrics