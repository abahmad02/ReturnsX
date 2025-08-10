# WhatsApp Integration Setup Guide for ReturnsX

ReturnsX includes comprehensive WhatsApp integration for automated customer communication and verification. Follow this guide to set up WhatsApp messaging for your store.

## Prerequisites

1. **Twilio Account**: Sign up at [https://www.twilio.com/whatsapp](https://www.twilio.com/whatsapp)
2. **WhatsApp Business API Access**: Get approved through Twilio's WhatsApp Business API
3. **Verified Business Profile**: Complete Twilio's business verification process

## Step 1: Get Twilio Credentials

1. **Account SID**: Found in your Twilio Console Dashboard
2. **Auth Token**: Located in your Twilio Console (keep this secret!)
3. **WhatsApp Phone Number**: Your approved Twilio WhatsApp sender number

## Step 2: Install Twilio SDK

Add the Twilio SDK to your project:

```bash
npm install twilio
```

## Step 3: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID="your_twilio_account_sid_here"
TWILIO_AUTH_TOKEN="your_twilio_auth_token_here"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"

# WhatsApp Business Settings
WHATSAPP_BUSINESS_NAME="Your Store Name"
WHATSAPP_SUPPORT_HOURS="Mon-Fri 9AM-6PM PST"
WHATSAPP_PAYMENT_LINK_BASE="https://your-payment-gateway.com/pay"
```

## Step 4: Enable Twilio Client

In `app/services/whatsapp.server.ts`, uncomment the Twilio integration code:

```typescript
// Change this line:
// import twilio from 'twilio';
// To:
import twilio from 'twilio';

// And in initializeTwilioClient(), uncomment:
const client = twilio(config.accountSid, config.authToken);
return client;

// And in sendWhatsAppMessage(), uncomment the actual sending code
```

## Step 5: Configure Webhook URL

Set up your Twilio webhook URL to receive incoming messages:

1. Go to Twilio Console → WhatsApp → Senders
2. Configure webhook URL: `https://your-app-domain.com/api/whatsapp/webhook`
3. Set HTTP method to `POST`

## Step 6: Test Integration

1. **Dashboard Check**: Go to your ReturnsX dashboard and verify WhatsApp status shows "Ready"
2. **Test Message**: Send a verification message from the customer management page
3. **Webhook Test**: Send a message to your WhatsApp number and check logs

## WhatsApp Features in ReturnsX

### Automated Messages

#### Zero Risk Customers
- **Trigger**: New order created
- **Message**: Order confirmation with delivery timeline
- **Purpose**: Build customer confidence and reduce inquiries

#### Medium Risk Customers  
- **Trigger**: Manual from merchant dashboard
- **Message**: Order verification request
- **Purpose**: Confirm order intent and reduce failed deliveries

#### High Risk Customers
- **Trigger**: Checkout attempt or manual from dashboard  
- **Message**: Deposit requirement with payment link
- **Purpose**: Secure advance payment before processing

### Manual Communication

#### Dashboard Controls
- **Send Verification**: Request order confirmation from customer
- **Request Deposit**: Send payment link for advance payment
- **Custom Message**: Send personalized messages
- **Order Updates**: Notify customers about status changes

#### Automated Responses
The system handles common customer responses:
- **"YES"** → Order confirmed, processing continues
- **"NO/CANCEL"** → Order flagged for review
- **"PAYMENT"** → Payment assistance and links provided
- **"DELIVERY"** → Tracking information provided
- **"HELP"** → Human agent handoff

### Message Templates

All messages are professionally crafted and include:
- Clear call-to-action
- Business branding
- Support contact information
- Helpful explanations
- Non-punitive language

### Integration Points

#### Checkout Enforcement
- High-risk customers get WhatsApp link in checkout modal
- Direct connection to support chat
- Payment link generation

#### Order Management
- Automatic status updates
- Delivery confirmations
- Payment confirmations

#### Customer Support
- 24/7 automated responses
- Human agent handoff
- Order inquiry handling

## Monitoring & Analytics

### Dashboard Metrics
- WhatsApp message delivery status
- Customer response rates
- Verification success rates
- Support conversation volume

### Logging
All WhatsApp interactions are logged for:
- Audit compliance
- Performance analysis
- Customer service optimization
- Risk assessment improvement

## Troubleshooting

### Common Issues

#### Messages Not Sending
1. Check Twilio credentials in environment variables
2. Verify WhatsApp number format (must include `whatsapp:` prefix)
3. Confirm Twilio account has sufficient credit
4. Check phone number approval status

#### Webhooks Not Working
1. Verify webhook URL is accessible
2. Check HTTPS certificate validity
3. Confirm webhook URL in Twilio console
4. Review server logs for errors

#### Customer Can't Receive Messages
1. Verify customer's WhatsApp number is active
2. Check if customer has blocked your business number
3. Confirm message template compliance
4. Review Twilio delivery logs

### Debug Mode

Enable detailed logging by setting:
```env
LOG_LEVEL="debug"
```

### Support Contacts

- **Twilio Support**: [https://support.twilio.com](https://support.twilio.com)
- **WhatsApp Business API**: [https://developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp)
- **ReturnsX Documentation**: Check your app documentation

## Best Practices

### Message Timing
- Don't send messages outside business hours
- Respect customer time zones
- Allow reasonable response time

### Content Guidelines
- Keep messages professional and concise
- Include clear next steps
- Provide multiple contact options
- Use consistent branding

### Compliance
- Follow WhatsApp Business Policy
- Respect customer opt-out requests
- Maintain message logs for compliance
- Protect customer privacy

### Rate Limiting
- Don't exceed Twilio rate limits
- Implement message queuing for high volume
- Monitor delivery success rates
- Handle failures gracefully

## Security Considerations

### Credential Protection
- Never commit credentials to version control
- Use environment variables only
- Rotate credentials regularly
- Monitor for unauthorized access

### Message Security
- Hash customer identifiers
- Don't include sensitive payment details in messages
- Use secure payment links only
- Log security events

### Webhook Security
- Verify webhook signatures
- Use HTTPS endpoints only
- Implement request validation
- Monitor for suspicious activity

## Cost Optimization

### Message Efficiency
- Use automated responses to reduce support load
- Template messages for common scenarios
- Avoid unnecessary message volume
- Monitor Twilio usage and costs

### Success Metrics
- Track verification response rates
- Monitor payment completion rates
- Measure customer satisfaction
- Analyze cost per successful delivery

This integration provides powerful customer communication capabilities while maintaining security and compliance standards. 