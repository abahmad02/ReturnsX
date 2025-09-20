# ReturnsX Thank You Page Extension - Merchant Setup Guide

## Overview

The ReturnsX Thank You Page Extension displays customer risk assessment information on your Shopify store's order confirmation page. This guide will walk you through the complete installation and configuration process.

## Prerequisites

Before installing the extension, ensure you have:

- A Shopify store with admin access
- An active ReturnsX account with API access
- Your ReturnsX API credentials (endpoint URL and authentication token)
- Basic familiarity with Shopify's theme customizer

## Installation Steps

### Step 1: Install the Extension

1. **Access Shopify Admin**
   - Log into your Shopify admin panel
   - Navigate to **Apps** > **App and sales channel settings**

2. **Install ReturnsX App**
   - Search for "ReturnsX" in the Shopify App Store
   - Click **Add app** and follow the installation prompts
   - Grant the required permissions when prompted

3. **Verify Installation**
   - The extension will be automatically installed with the ReturnsX app
   - You should see "Thank You Risk Display" in your checkout extensions list

### Step 2: Configure API Connection

1. **Access Extension Settings**
   - Go to **Online Store** > **Themes**
   - Click **Customize** on your active theme
   - Navigate to **Checkout** > **Thank you page**
   - Find the "ReturnsX Risk Display" block

2. **Configure API Settings**
   ```
   API Endpoint URL: https://api.returnsx.com/v1
   Authentication Token: [Your ReturnsX API token]
   Enable Debug Mode: No (for production)
   ```

3. **Test API Connection**
   - Enable debug mode temporarily
   - Place a test order to verify the connection
   - Check browser console for any error messages
   - Disable debug mode once confirmed working

### Step 3: Customize Display Settings

1. **Risk Display Options**
   - **Show Risk Score**: Display numerical risk percentage
   - **Use Color Coding**: Enable color-coded risk indicators
   - **Show Detailed Tips**: Display improvement recommendations
   - **Compact Mode**: Use condensed display format

2. **Message Customization**
   - **Zero Risk Message**: Custom message for trusted customers
   - **Medium Risk Message**: Message for customers with some failed deliveries
   - **High Risk Message**: Message for high-risk customers
   - **New Customer Message**: Welcome message for first-time customers

### Step 4: Configure WhatsApp Integration (Optional)

1. **Enable WhatsApp Support**
   - Toggle "Enable WhatsApp Integration" to ON
   - Enter your business WhatsApp number (with country code)
   - Example: +923001234567

2. **Customize WhatsApp Message Template**
   ```
   Default template:
   "Hi! I just placed order #{ORDER_NUMBER} on your store. I want to ensure smooth delivery. Can you help verify my order details?"
   
   Available variables:
   - {ORDER_NUMBER}: Current order number
   - {CUSTOMER_NAME}: Customer's name
   - {STORE_NAME}: Your store name
   ```

### Step 5: Test the Extension

1. **Place Test Orders**
   - Use different phone numbers to test various risk scenarios
   - Test with both new and existing customer data
   - Verify mobile responsiveness

2. **Check Display Elements**
   - Risk tier indicators appear correctly
   - Messages display as configured
   - WhatsApp button works (if enabled)
   - Error handling works when API is unavailable

## Configuration Options Reference

### Basic Settings

| Setting | Description | Default Value |
|---------|-------------|---------------|
| API Endpoint | ReturnsX API base URL | https://api.returnsx.com/v1 |
| Auth Token | Your ReturnsX authentication token | (Required) |
| Debug Mode | Show debug information in console | Disabled |

### Display Settings

| Setting | Description | Default Value |
|---------|-------------|---------------|
| Show Risk Score | Display numerical risk percentage | Enabled |
| Use Color Coding | Color-code risk indicators | Enabled |
| Show Detailed Tips | Display improvement recommendations | Enabled |
| Compact Mode | Use condensed display format | Disabled |

### Message Settings

| Setting | Description | Character Limit |
|---------|-------------|-----------------|
| Zero Risk Message | Message for trusted customers | 200 chars |
| Medium Risk Message | Message for medium-risk customers | 200 chars |
| High Risk Message | Message for high-risk customers | 200 chars |
| New Customer Message | Welcome message for new customers | 200 chars |

### WhatsApp Settings

| Setting | Description | Format |
|---------|-------------|--------|
| Enable WhatsApp | Toggle WhatsApp integration | On/Off |
| Phone Number | Business WhatsApp number | +92XXXXXXXXXX |
| Message Template | Pre-filled WhatsApp message | 300 chars max |

## Best Practices

### 1. Message Customization
- Keep messages positive and encouraging
- Avoid technical jargon that customers won't understand
- Include actionable advice for improvement
- Test messages with actual customers for clarity

### 2. WhatsApp Integration
- Use a dedicated business WhatsApp number
- Ensure someone monitors the WhatsApp account during business hours
- Keep message templates professional but friendly
- Include order context in messages

### 3. Performance Optimization
- Disable debug mode in production
- Monitor API response times
- Use compact mode for mobile-heavy traffic
- Regularly review error logs

### 4. Privacy Compliance
- Inform customers about risk assessment in your privacy policy
- Ensure compliance with local data protection laws
- The extension automatically hashes customer data for privacy

## Troubleshooting Common Issues

### Extension Not Appearing
1. Verify the ReturnsX app is properly installed
2. Check that the extension is enabled in theme customizer
3. Ensure the theme supports checkout extensions
4. Try refreshing the theme customizer

### API Connection Issues
1. Verify API endpoint URL is correct
2. Check authentication token validity
3. Ensure your ReturnsX account is active
4. Test API connection with debug mode enabled

### Display Issues
1. Check browser console for JavaScript errors
2. Verify theme compatibility
3. Test on different devices and browsers
4. Clear browser cache and cookies

### WhatsApp Not Working
1. Verify phone number format includes country code
2. Test WhatsApp link manually
3. Check if WhatsApp is installed on test device
4. Verify message template doesn't exceed character limits

## Support and Maintenance

### Getting Help
- **ReturnsX Support**: support@returnsx.com
- **Documentation**: https://docs.returnsx.com
- **Status Page**: https://status.returnsx.com

### Regular Maintenance
- Monitor extension performance monthly
- Update custom messages based on customer feedback
- Review API usage and costs
- Keep ReturnsX app updated to latest version

### Performance Monitoring
- Check API response times weekly
- Monitor error rates in ReturnsX dashboard
- Review customer feedback about risk messages
- Analyze impact on conversion rates

## Advanced Configuration

### Custom CSS Styling
If you need custom styling, add CSS to your theme's additional CSS section:

```css
/* Customize risk display colors */
.returnsx-risk-display .risk-zero {
  background-color: #d4edda;
  border-color: #c3e6cb;
}

.returnsx-risk-display .risk-medium {
  background-color: #fff3cd;
  border-color: #ffeaa7;
}

.returnsx-risk-display .risk-high {
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .returnsx-risk-display {
    font-size: 14px;
    padding: 12px;
  }
}
```

### Multi-language Support
The extension supports multiple languages through Shopify's translation system:

1. Go to **Online Store** > **Themes** > **Actions** > **Edit languages**
2. Search for "ReturnsX" translations
3. Update text for your store's language
4. Save changes and test with different language settings

## Next Steps

After successful installation:

1. **Monitor Performance**: Check the ReturnsX dashboard for extension usage analytics
2. **Gather Feedback**: Ask customers about their experience with risk information
3. **Optimize Settings**: Adjust messages and display options based on performance data
4. **Scale Usage**: Consider enabling for additional checkout points if available

For additional features or custom requirements, contact the ReturnsX team at support@returnsx.com.