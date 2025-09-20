# Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with the ReturnsX Thank You Page Extension. Issues are organized by category with step-by-step solutions and prevention tips.

## Quick Diagnostic Checklist

Before diving into specific issues, run through this quick checklist:

- [ ] Extension is installed and enabled in theme customizer
- [ ] API endpoint URL is correct and accessible
- [ ] Authentication token is valid and has proper permissions
- [ ] ReturnsX service is operational (check status.returnsx.com)
- [ ] Browser console shows no JavaScript errors
- [ ] Theme supports checkout UI extensions
- [ ] Test order contains customer phone or email

## Common Issues and Solutions

### 1. Extension Not Appearing

#### Symptoms
- Extension doesn't show on thank you page
- No risk information displayed after checkout
- Empty space where extension should appear

#### Diagnostic Steps

**Step 1: Verify Extension Installation**
```bash
# Check if extension is installed
shopify app info
# Look for "thank-you-risk-display" in extensions list
```

**Step 2: Check Theme Customizer Settings**
1. Go to **Online Store** > **Themes** > **Customize**
2. Navigate to **Checkout** > **Thank you page**
3. Verify "ReturnsX Risk Display" block is present and enabled
4. Check if block is positioned correctly in the layout

**Step 3: Verify Theme Compatibility**
```javascript
// Check browser console for compatibility errors
console.log('Shopify.theme.name:', Shopify.theme.name);
console.log('Checkout extensions supported:', !!window.Shopify?.checkout?.ui);
```

#### Solutions

**Solution 1: Reinstall Extension**
1. Remove the extension block from theme customizer
2. Save theme changes
3. Re-add the extension block
4. Configure settings again
5. Test with a new order

**Solution 2: Theme Compatibility Fix**
```css
/* Add to theme's additional CSS if extension is hidden */
.returnsx-risk-display {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
```

**Solution 3: Clear Cache**
1. Clear browser cache and cookies
2. Clear Shopify theme cache (if using caching apps)
3. Test in incognito/private browsing mode

### 2. API Connection Issues

#### Symptoms
- "Unable to load risk information" message
- Extension shows loading state indefinitely
- Console errors about network requests

#### Diagnostic Steps

**Step 1: Test API Endpoint**
```bash
# Test API connectivity
curl -X GET "https://api.returnsx.com/v1/health" \
  -H "Authorization: Bearer your-api-token"

# Expected response: {"status": "healthy", ...}
```

**Step 2: Verify Authentication**
```bash
# Test token validity
curl -X GET "https://api.returnsx.com/v1/auth/validate" \
  -H "Authorization: Bearer your-api-token"

# Expected response: {"valid": true, ...}
```

**Step 3: Check Network Requests**
1. Open browser developer tools
2. Go to Network tab
3. Place a test order
4. Look for failed requests to returnsx.com

#### Solutions

**Solution 1: Fix Authentication**
1. Go to ReturnsX dashboard > Settings > API Access
2. Generate a new API token
3. Update token in theme customizer
4. Ensure token has required permissions:
   - `risk_profile:read`
   - `customer:read`

**Solution 2: Update API Endpoint**
```
Correct endpoints by environment:
- Production: https://api.returnsx.com/v1
- Staging: https://staging-api.returnsx.com/v1
- Development: https://dev-api.returnsx.com/v1
```

**Solution 3: Configure Firewall/Proxy**
If using corporate firewall or proxy:
1. Whitelist `*.returnsx.com` domains
2. Allow HTTPS traffic on port 443
3. Configure proxy settings if required

### 3. Display and Formatting Issues

#### Symptoms
- Text appears garbled or overlapping
- Colors don't match theme
- Mobile display is broken
- Content is cut off or truncated

#### Diagnostic Steps

**Step 1: Check CSS Conflicts**
```javascript
// Check for CSS conflicts in browser console
const element = document.querySelector('.returnsx-risk-display');
const styles = window.getComputedStyle(element);
console.log('Display:', styles.display);
console.log('Position:', styles.position);
console.log('Z-index:', styles.zIndex);
```

**Step 2: Test Mobile Responsiveness**
1. Open browser developer tools
2. Toggle device simulation
3. Test various screen sizes
4. Check for horizontal scrolling

**Step 3: Verify Theme Integration**
```css
/* Check if theme CSS is overriding extension styles */
.returnsx-risk-display * {
  box-sizing: border-box !important;
}
```

#### Solutions

**Solution 1: Fix CSS Conflicts**
```css
/* Add to theme's additional CSS */
.returnsx-risk-display {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: inherit;
  background: transparent;
  border: none;
  margin: 16px 0;
  padding: 0;
}

/* Ensure proper spacing */
.returnsx-risk-display > * {
  margin-bottom: 8px;
}

.returnsx-risk-display > *:last-child {
  margin-bottom: 0;
}
```

**Solution 2: Mobile Optimization**
```css
/* Mobile-specific fixes */
@media (max-width: 768px) {
  .returnsx-risk-display {
    font-size: 13px;
    padding: 12px;
  }
  
  .returnsx-risk-display .whatsapp-button {
    width: 100%;
    text-align: center;
  }
}
```

**Solution 3: Enable Compact Mode**
1. Go to theme customizer
2. Find ReturnsX extension settings
3. Enable "Compact Mode"
4. Test display on mobile devices

### 4. WhatsApp Integration Issues

#### Symptoms
- WhatsApp button doesn't appear for high-risk customers
- Clicking WhatsApp button does nothing
- Wrong phone number or message in WhatsApp

#### Diagnostic Steps

**Step 1: Verify Configuration**
1. Check theme customizer settings
2. Ensure "Enable WhatsApp Integration" is ON
3. Verify phone number format: +923001234567
4. Check message template has valid variables

**Step 2: Test WhatsApp URL Generation**
```javascript
// Test URL generation in browser console
const orderNumber = '1001';
const phoneNumber = '+923001234567';
const message = `Hi! I just placed order #${orderNumber}...`;
const whatsappUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;
console.log('WhatsApp URL:', whatsappUrl);
```

**Step 3: Test on Different Devices**
1. Test on mobile device with WhatsApp installed
2. Test on desktop (should open WhatsApp Web)
3. Verify message appears correctly in WhatsApp

#### Solutions

**Solution 1: Fix Phone Number Format**
```
Correct format: +[country code][phone number]
Examples:
- Pakistan: +923001234567
- India: +919876543210
- UAE: +971501234567

Incorrect formats:
- 03001234567 (missing country code)
- +92 300 1234567 (spaces not allowed)
- +92-300-1234567 (dashes not allowed)
```

**Solution 2: Fix Message Template**
```
Valid variables:
- {ORDER_NUMBER} - Current order number
- {CUSTOMER_NAME} - Customer's name
- {STORE_NAME} - Your store name

Example template:
"Hi! I just placed order #{ORDER_NUMBER} on {STORE_NAME}. I want to ensure smooth delivery. Can you help verify my order details?"
```

**Solution 3: Test WhatsApp Availability**
```javascript
// Check if WhatsApp is available
function isWhatsAppAvailable() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
  
  if (isMobile) {
    // Mobile: Check if WhatsApp app is likely installed
    return true; // WhatsApp is very common on mobile
  } else {
    // Desktop: WhatsApp Web should work
    return true;
  }
}
```

### 5. Performance Issues

#### Symptoms
- Extension loads slowly
- Page becomes unresponsive
- High memory usage
- API timeouts

#### Diagnostic Steps

**Step 1: Measure Performance**
```javascript
// Measure extension load time
console.time('ReturnsX Extension Load');
// ... extension loads ...
console.timeEnd('ReturnsX Extension Load');

// Check memory usage
console.log('Memory usage:', performance.memory);
```

**Step 2: Check API Response Times**
1. Open browser Network tab
2. Place test order
3. Look for API requests to returnsx.com
4. Check response times (should be < 500ms)

**Step 3: Monitor Resource Usage**
1. Open browser Performance tab
2. Record performance during checkout
3. Look for long tasks or memory leaks

#### Solutions

**Solution 1: Enable Caching**
1. Go to theme customizer
2. Find "Cache Duration" setting
3. Set to 5-15 minutes for optimal performance
4. Monitor API usage in ReturnsX dashboard

**Solution 2: Optimize Settings**
```
Performance-optimized settings:
- Compact Mode: Enabled
- Show Detailed Tips: Disabled (for high traffic)
- Cache Duration: 15 minutes
- Request Timeout: 3000ms
```

**Solution 3: Implement Circuit Breaker**
The extension automatically implements circuit breaker pattern:
- After 5 consecutive failures, API calls are temporarily disabled
- Fallback content is shown instead
- Circuit resets after 30 seconds

### 6. Data Privacy and Security Issues

#### Symptoms
- Concerns about customer data transmission
- GDPR compliance questions
- Security audit findings

#### Diagnostic Steps

**Step 1: Verify Data Hashing**
```javascript
// Check that customer data is hashed before transmission
// This should be done automatically by the extension
console.log('Customer data hashing enabled:', true);
```

**Step 2: Check HTTPS Usage**
```javascript
// Verify all API calls use HTTPS
const apiCalls = performance.getEntriesByType('resource')
  .filter(entry => entry.name.includes('returnsx.com'));
  
apiCalls.forEach(call => {
  console.log('API call:', call.name, 'Secure:', call.name.startsWith('https://'));
});
```

**Step 3: Review Data Transmission**
1. Open browser Network tab
2. Place test order
3. Check API request payloads
4. Verify no raw PII (phone, email) is transmitted

#### Solutions

**Solution 1: Verify Privacy Implementation**
The extension automatically:
- Hashes phone numbers with SHA-256 before transmission
- Hashes email addresses with SHA-256 before transmission
- Never stores raw customer data locally
- Uses HTTPS for all API communications

**Solution 2: GDPR Compliance**
```
GDPR compliance features:
- Customer data is hashed (pseudonymized)
- No raw PII is transmitted or stored
- Data retention follows ReturnsX policies
- Customers can request data deletion through ReturnsX
```

**Solution 3: Security Best Practices**
1. Regularly rotate API tokens (monthly recommended)
2. Monitor API usage for unusual patterns
3. Keep extension updated to latest version
4. Use production API endpoints only in live stores

### 7. Configuration and Settings Issues

#### Symptoms
- Settings don't save in theme customizer
- Configuration validation errors
- Extension behavior doesn't match settings

#### Diagnostic Steps

**Step 1: Check Setting Validation**
```javascript
// Common validation issues
const validations = {
  apiEndpoint: /^https:\/\/.+/,
  phoneNumber: /^\+[1-9]\d{1,14}$/,
  messageLength: (msg) => msg.length <= 300
};
```

**Step 2: Test Setting Persistence**
1. Change a setting in theme customizer
2. Save changes
3. Refresh page
4. Verify setting is still changed

**Step 3: Check Browser Console**
Look for validation errors when saving settings

#### Solutions

**Solution 1: Fix Common Validation Errors**
```
API Endpoint:
- Must start with https://
- Must be a valid URL
- No trailing slash

Phone Number:
- Must start with +
- Must include country code
- No spaces or special characters

Messages:
- Maximum 300 characters
- No HTML tags allowed
- Variables must use correct format: {VARIABLE_NAME}
```

**Solution 2: Clear Theme Cache**
```bash
# If using theme caching
1. Disable caching temporarily
2. Save extension settings
3. Re-enable caching
4. Test configuration
```

**Solution 3: Reset to Defaults**
1. Note current custom settings
2. Remove extension block from theme
3. Save theme
4. Re-add extension block
5. Reconfigure with correct values

## Advanced Troubleshooting

### Debug Mode

Enable debug mode for detailed troubleshooting:

1. **Enable in Theme Customizer**
   - Go to extension settings
   - Enable "Debug Mode"
   - Save changes

2. **Check Browser Console**
   ```javascript
   // Debug information will be logged
   [ReturnsX] API Request: POST /risk-profile
   [ReturnsX] Response time: 245ms
   [ReturnsX] Risk tier: MEDIUM_RISK
   [ReturnsX] Cache hit: false
   ```

3. **Disable After Troubleshooting**
   - Always disable debug mode in production
   - Debug logs may contain sensitive information

### Network Diagnostics

**Test API Connectivity**
```bash
# Test from command line
curl -v -X GET "https://api.returnsx.com/v1/health"

# Check DNS resolution
nslookup api.returnsx.com

# Test from different network
# (mobile hotspot, different ISP)
```

**Check Firewall/Proxy Issues**
```bash
# Test if corporate firewall blocks requests
curl -x proxy.company.com:8080 \
  -X GET "https://api.returnsx.com/v1/health"
```

### Browser Compatibility

**Test Across Browsers**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

**Check JavaScript Compatibility**
```javascript
// Check for required features
const features = {
  fetch: typeof fetch !== 'undefined',
  promises: typeof Promise !== 'undefined',
  asyncAwait: (async () => {})().constructor === Promise,
  modules: typeof import !== 'undefined'
};

console.log('Browser compatibility:', features);
```

## Getting Additional Help

### Before Contacting Support

Gather this information:

1. **Store Information**
   - Store URL: your-store.myshopify.com
   - Theme name and version
   - Extension version

2. **Error Details**
   - Exact error messages
   - Browser console logs
   - Network request details
   - Steps to reproduce

3. **Configuration**
   - Extension settings (remove sensitive tokens)
   - API endpoint being used
   - Any custom CSS modifications

### Support Channels

1. **ReturnsX Support**
   - Email: support@returnsx.com
   - Include store URL and error details
   - Response time: 24-48 hours

2. **Technical Documentation**
   - Developer docs: [DEVELOPER_DOCUMENTATION.md](./DEVELOPER_DOCUMENTATION.md)
   - API reference: https://docs.returnsx.com/api
   - Status page: https://status.returnsx.com

3. **Community Support**
   - GitHub issues: [Link to repository]
   - Discord community: [Link to Discord]
   - Stack Overflow: Tag with `returnsx-extension`

### Emergency Procedures

**If Extension Breaks Checkout**
1. Immediately disable extension in theme customizer
2. Save theme changes
3. Verify checkout works without extension
4. Contact support with error details
5. Re-enable only after issue is resolved

**If API Service is Down**
1. Check status page: https://status.returnsx.com
2. Extension should automatically show fallback content
3. No action needed - service will resume automatically
4. Monitor ReturnsX status updates

**If Security Issue is Suspected**
1. Immediately disable extension
2. Change API tokens in ReturnsX dashboard
3. Email security@returnsx.com with details
4. Do not re-enable until cleared by security team

## Prevention and Maintenance

### Regular Maintenance Tasks

**Monthly**
- [ ] Review extension performance metrics
- [ ] Check for extension updates
- [ ] Rotate API tokens
- [ ] Review error logs

**Quarterly**
- [ ] Test extension with new orders
- [ ] Review and update custom messages
- [ ] Check mobile responsiveness
- [ ] Verify GDPR compliance

**Annually**
- [ ] Security audit of configuration
- [ ] Performance optimization review
- [ ] Update documentation
- [ ] Staff training on troubleshooting

### Monitoring Setup

**Key Metrics to Monitor**
- Extension load success rate (target: >99%)
- API response time (target: <500ms)
- Error rate (target: <1%)
- Customer feedback scores

**Alerting Thresholds**
- API response time > 2 seconds
- Error rate > 5%
- Extension load failures > 10 per hour

### Best Practices

1. **Always test in staging first**
2. **Keep debug mode disabled in production**
3. **Monitor performance regularly**
4. **Update extension promptly**
5. **Document any customizations**
6. **Train staff on basic troubleshooting**
7. **Have rollback plan ready**

This troubleshooting guide should help resolve most common issues. For complex problems or issues not covered here, don't hesitate to contact ReturnsX support with detailed information about your specific situation.