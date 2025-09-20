# Theme Customizer Settings Guide

## Overview

The ReturnsX Thank You Page Extension provides comprehensive configuration options through Shopify's theme customizer. This guide explains each setting, its effects, and best practices for configuration.

## Accessing Extension Settings

1. **Navigate to Theme Customizer**
   - Go to **Online Store** > **Themes**
   - Click **Customize** on your active theme
   - Navigate to **Checkout** > **Thank you page**

2. **Locate Extension Settings**
   - Scroll to find "ReturnsX Risk Display" block
   - Click to expand configuration options
   - Settings are organized into logical groups

## Settings Categories

### 1. API Configuration Settings

#### API Endpoint URL
- **Setting Name**: `api_endpoint`
- **Type**: Text input
- **Default**: `https://api.returnsx.com/v1`
- **Description**: Base URL for ReturnsX API
- **Required**: Yes

**Valid Values**:
```
Production: https://api.returnsx.com/v1
Staging: https://staging-api.returnsx.com/v1
Development: https://dev-api.returnsx.com/v1
```

**Effects**:
- Determines which ReturnsX environment the extension connects to
- Must match your ReturnsX account environment
- Invalid URLs will cause API connection failures

#### Authentication Token
- **Setting Name**: `auth_token`
- **Type**: Password input (hidden)
- **Default**: Empty
- **Description**: Your ReturnsX API authentication token
- **Required**: Yes

**Format**: `rx_live_` or `rx_test_` followed by 64 characters

**Effects**:
- Authenticates all API requests to ReturnsX
- Invalid tokens result in 401 Unauthorized errors
- Test tokens only work with staging/development endpoints

#### Request Timeout
- **Setting Name**: `request_timeout`
- **Type**: Number input
- **Default**: `5000`
- **Range**: 1000-30000 (milliseconds)
- **Description**: Maximum time to wait for API responses

**Effects**:
- Lower values: Faster fallback to error states
- Higher values: More patience for slow connections
- Recommended: 5000ms for most use cases

#### Enable Debug Mode
- **Setting Name**: `debug_mode`
- **Type**: Checkbox
- **Default**: `false`
- **Description**: Show debug information in browser console

**Effects**:
- **Enabled**: Logs API requests, responses, and errors to console
- **Disabled**: Silent operation (recommended for production)
- **Security Note**: May expose sensitive information in logs

### 2. Display Configuration Settings

#### Show Risk Score
- **Setting Name**: `show_risk_score`
- **Type**: Checkbox
- **Default**: `true`
- **Description**: Display numerical risk percentage

**Effects**:
- **Enabled**: Shows "Success Rate: 85%" style indicators
- **Disabled**: Shows only risk tier (High/Medium/Zero risk)
- **Impact**: More specific information vs. simpler display

#### Use Color Coding
- **Setting Name**: `use_color_coding`
- **Type**: Checkbox
- **Default**: `true`
- **Description**: Apply color-coded visual indicators

**Color Scheme**:
```css
Zero Risk: Green (#28a745)
Medium Risk: Orange (#ffc107)
High Risk: Red (#dc3545)
New Customer: Blue (#007bff)
Error State: Gray (#6c757d)
```

**Effects**:
- **Enabled**: Visual color cues for quick risk assessment
- **Disabled**: Neutral styling for all risk levels
- **Accessibility**: Colors include text labels for colorblind users

#### Show Detailed Tips
- **Setting Name**: `show_detailed_tips`
- **Type**: Checkbox
- **Default**: `true`
- **Description**: Display improvement recommendations

**Effects**:
- **Enabled**: Shows actionable advice for customers
- **Disabled**: Shows only risk status without recommendations
- **Content**: Tips are dynamically generated based on risk tier

#### Compact Mode
- **Setting Name**: `compact_mode`
- **Type**: Checkbox
- **Default**: `false`
- **Description**: Use condensed display format

**Layout Differences**:
```
Standard Mode:
┌─────────────────────────────┐
│ Risk Assessment             │
│ ● Medium Risk Customer      │
│ Success Rate: 75%           │
│                             │
│ Recommendations:            │
│ • Confirm delivery address  │
│ • Be available for delivery │
└─────────────────────────────┘

Compact Mode:
┌─────────────────────────────┐
│ ● Medium Risk (75%) + Tips  │
└─────────────────────────────┘
```

**Effects**:
- **Enabled**: Minimal space usage, good for mobile
- **Disabled**: Full information display with better readability

### 3. Message Customization Settings

#### Zero Risk Customer Message
- **Setting Name**: `zero_risk_message`
- **Type**: Textarea
- **Default**: "Thank you for being a trusted customer! Your excellent delivery record helps us serve you better."
- **Character Limit**: 200
- **Description**: Message shown to customers with no failed deliveries

**Best Practices**:
- Keep positive and appreciative tone
- Acknowledge their good behavior
- Encourage continued reliability
- Avoid technical jargon

**Variables Available**:
- `{CUSTOMER_NAME}`: Customer's first name
- `{SUCCESS_RATE}`: Their success percentage
- `{TOTAL_ORDERS}`: Number of previous orders

#### Medium Risk Customer Message
- **Setting Name**: `medium_risk_message`
- **Type**: Textarea
- **Default**: "We appreciate your business! A few delivery improvements could help ensure smoother future orders."
- **Character Limit**: 200
- **Description**: Message for customers with 2-4 failed deliveries

**Best Practices**:
- Maintain encouraging tone
- Acknowledge their business value
- Gently suggest improvements
- Avoid blame or negative language

#### High Risk Customer Message
- **Setting Name**: `high_risk_message`
- **Type**: Textarea
- **Default**: "Let's work together to ensure successful delivery! Please confirm your details and be available to receive your order."
- **Character Limit**: 200
- **Description**: Message for customers with 5+ failed deliveries

**Best Practices**:
- Use collaborative language ("let's work together")
- Be direct but respectful
- Provide clear action items
- Offer support channels

#### New Customer Welcome Message
- **Setting Name**: `new_customer_message`
- **Type**: Textarea
- **Default**: "Welcome! We're excited to fulfill your first order. We'll keep you updated throughout the delivery process."
- **Character Limit**: 200
- **Description**: Message for first-time customers

**Best Practices**:
- Create welcoming atmosphere
- Set delivery expectations
- Build confidence in your service
- Encourage future purchases

### 4. WhatsApp Integration Settings

#### Enable WhatsApp Integration
- **Setting Name**: `whatsapp_enabled`
- **Type**: Checkbox
- **Default**: `false`
- **Description**: Show WhatsApp contact option for high-risk customers

**Effects**:
- **Enabled**: High-risk customers see WhatsApp contact button
- **Disabled**: No WhatsApp integration regardless of risk level
- **Requirement**: Must configure phone number when enabled

#### WhatsApp Phone Number
- **Setting Name**: `whatsapp_phone`
- **Type**: Text input
- **Default**: Empty
- **Format**: International format with country code
- **Description**: Business WhatsApp number for customer contact

**Format Examples**:
```
Pakistan: +923001234567
India: +919876543210
UAE: +971501234567
```

**Validation**:
- Must start with + and country code
- Must be 10-15 digits after country code
- No spaces or special characters allowed

#### WhatsApp Message Template
- **Setting Name**: `whatsapp_message_template`
- **Type**: Textarea
- **Default**: "Hi! I just placed order #{ORDER_NUMBER} on your store. I want to ensure smooth delivery. Can you help verify my order details?"
- **Character Limit**: 300
- **Description**: Pre-filled message for WhatsApp contact

**Available Variables**:
- `{ORDER_NUMBER}`: Current order number
- `{CUSTOMER_NAME}`: Customer's name
- `{STORE_NAME}`: Your store name
- `{ORDER_TOTAL}`: Order total amount
- `{DELIVERY_ADDRESS}`: Shipping address (first line only)

**Best Practices**:
- Keep professional but friendly tone
- Include order context for reference
- Ask specific questions about delivery
- Provide clear next steps

### 5. Advanced Settings

#### Cache Duration
- **Setting Name**: `cache_duration`
- **Type**: Select dropdown
- **Options**: 1 min, 5 min, 15 min, 30 min, 1 hour
- **Default**: `5 min`
- **Description**: How long to cache API responses

**Effects**:
- **Shorter Duration**: More up-to-date data, more API calls
- **Longer Duration**: Better performance, potentially stale data
- **Recommended**: 5-15 minutes for most stores

#### Error Fallback Behavior
- **Setting Name**: `error_fallback`
- **Type**: Select dropdown
- **Options**: Hide completely, Show generic message, Show new customer message
- **Default**: `Show new customer message`
- **Description**: What to display when API fails

**Behavior Options**:
```
Hide completely: Extension doesn't render anything
Generic message: "Thank you for your order!"
New customer: Shows welcome message for new customers
```

#### Rate Limit Handling
- **Setting Name**: `rate_limit_handling`
- **Type**: Select dropdown
- **Options**: Retry with backoff, Fail immediately, Use cached data
- **Default**: `Retry with backoff`
- **Description**: How to handle API rate limiting

**Strategies**:
- **Retry with backoff**: Wait and retry with increasing delays
- **Fail immediately**: Show error fallback without retrying
- **Use cached data**: Show last successful response if available

## Setting Combinations and Effects

### Recommended Configurations

#### High-Traffic Store (Performance Focused)
```
Compact Mode: Enabled
Cache Duration: 15 minutes
Show Detailed Tips: Disabled
Rate Limit Handling: Use cached data
```

#### Customer Experience Focused
```
Show Risk Score: Enabled
Use Color Coding: Enabled
Show Detailed Tips: Enabled
WhatsApp Integration: Enabled
```

#### Privacy-Conscious Setup
```
Debug Mode: Disabled
Show Risk Score: Disabled
Cache Duration: 1 minute
Error Fallback: Hide completely
```

#### Mobile-Optimized Configuration
```
Compact Mode: Enabled
Use Color Coding: Enabled
Show Detailed Tips: Disabled
WhatsApp Integration: Enabled
```

### Setting Interactions

#### Dependent Settings
- **WhatsApp Phone Number**: Only visible when WhatsApp Integration is enabled
- **WhatsApp Message Template**: Only visible when WhatsApp Integration is enabled
- **Cache Duration**: Affects all API-dependent features

#### Conflicting Settings
- **Compact Mode + Show Detailed Tips**: Tips are truncated in compact mode
- **Debug Mode + Production**: Should not be enabled together
- **Hide Error Fallback + Required API**: May result in blank display

## Validation and Error Handling

### Setting Validation

The theme customizer validates settings in real-time:

```javascript
// API Endpoint validation
if (!isValidUrl(apiEndpoint)) {
  showError("Please enter a valid API endpoint URL");
}

// Phone number validation
if (whatsappEnabled && !isValidPhoneNumber(whatsappPhone)) {
  showError("Please enter a valid WhatsApp phone number with country code");
}

// Message length validation
if (customMessage.length > 200) {
  showError("Message must be 200 characters or less");
}
```

### Common Validation Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid API endpoint" | Malformed URL | Use format: https://domain.com/path |
| "Authentication failed" | Wrong token | Verify token from ReturnsX dashboard |
| "Phone number invalid" | Wrong format | Use international format: +923001234567 |
| "Message too long" | Exceeds character limit | Shorten message to under limit |

## Testing Your Configuration

### 1. Configuration Test Checklist

- [ ] API endpoint responds to health check
- [ ] Authentication token is valid
- [ ] All custom messages display correctly
- [ ] WhatsApp integration works on mobile
- [ ] Error fallbacks work when API is down
- [ ] Settings persist after saving

### 2. Test Scenarios

#### API Connection Test
1. Enable debug mode
2. Place a test order
3. Check browser console for API logs
4. Verify successful response

#### Message Display Test
1. Configure custom messages
2. Test with different risk scenarios
3. Verify message variables are replaced
4. Check character limits are respected

#### WhatsApp Integration Test
1. Enable WhatsApp integration
2. Configure phone number and message
3. Place order as high-risk customer
4. Click WhatsApp button and verify message

#### Mobile Responsiveness Test
1. Enable compact mode
2. Test on various mobile devices
3. Verify all elements are readable
4. Check touch targets are appropriate

### 3. Performance Testing

Monitor these metrics after configuration changes:

- **Page Load Time**: Should not increase significantly
- **API Response Time**: Monitor in ReturnsX dashboard
- **Error Rate**: Should remain low after configuration
- **Customer Feedback**: Monitor for usability issues

## Troubleshooting Settings Issues

### Common Problems

#### Settings Not Saving
1. Check for validation errors
2. Verify theme customizer permissions
3. Try refreshing the page
4. Contact Shopify support if persistent

#### Extension Not Appearing
1. Verify extension is enabled
2. Check theme compatibility
3. Ensure proper block placement
4. Review browser console for errors

#### API Connection Issues
1. Verify endpoint URL format
2. Check authentication token
3. Test with debug mode enabled
4. Confirm network connectivity

#### Display Issues
1. Clear browser cache
2. Test on different devices
3. Check for theme CSS conflicts
4. Verify setting combinations

### Debug Information

When contacting support, include:

```
Store URL: your-store.myshopify.com
Theme: [Theme name and version]
Extension Version: 1.0.0
Settings Configuration: [Export from theme customizer]
Error Messages: [Any console errors]
Browser: [Browser name and version]
```

## Best Practices Summary

### Performance
- Use appropriate cache duration for your traffic
- Enable compact mode for mobile-heavy stores
- Monitor API usage and optimize settings

### User Experience
- Customize messages to match your brand voice
- Test all configurations with real customer data
- Provide clear, actionable recommendations

### Security
- Never enable debug mode in production
- Regularly rotate API tokens
- Monitor for unusual API usage patterns

### Maintenance
- Review settings monthly
- Update custom messages based on feedback
- Keep extension updated to latest version
- Monitor performance metrics regularly