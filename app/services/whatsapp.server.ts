import { logger } from "./logger.server";

// Twilio client will be imported when credentials are available
// import twilio from 'twilio';

export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
  template?: string;
  templateParams?: string[];
}

export interface WhatsAppConfig {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
  businessName: string;
  supportHours: string;
  paymentLinkBase: string;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface IncomingWhatsAppMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: Date;
  mediaUrl?: string;
  profileName?: string;
}

/**
 * Get WhatsApp configuration from environment variables
 */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  // Check if required credentials are available
  if (!accountSid || !authToken || !whatsappNumber) {
    logger.warn("WhatsApp configuration incomplete", {
      component: "whatsapp",
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasWhatsappNumber: !!whatsappNumber,
    });
    return null;
  }

  return {
    accountSid,
    authToken,
    whatsappNumber,
    businessName: process.env.WHATSAPP_BUSINESS_NAME || "ReturnsX Store",
    supportHours: process.env.WHATSAPP_SUPPORT_HOURS || "24/7",
    paymentLinkBase: process.env.WHATSAPP_PAYMENT_LINK_BASE || "https://example.com/pay",
  };
}

/**
 * Initialize Twilio client (when credentials are available)
 */
export function initializeTwilioClient() {
  const config = getWhatsAppConfig();
  if (!config) {
    return null;
  }

  try {
    // Uncomment when Twilio is set up:
    // const client = twilio(config.accountSid, config.authToken);
    // return client;
    
    logger.info("Twilio client would be initialized here", {
      component: "whatsapp",
      whatsappNumber: config.whatsappNumber
    });
    return null; // Return null for now until credentials are provided
  } catch (error) {
    logger.error("Failed to initialize Twilio client", {
      component: "whatsapp",
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage
): Promise<WhatsAppResponse> {
  const config = getWhatsAppConfig();
  
  if (!config) {
    logger.warn("WhatsApp not configured - message would be sent", {
      component: "whatsapp",
      to: message.to,
      messagePreview: message.body.substring(0, 50) + "..."
    });
    
    return {
      success: false,
      error: "WhatsApp API not configured. Please set up Twilio credentials."
    };
  }

  try {
    // When Twilio is set up, uncomment this:
    /*
    const client = initializeTwilioClient();
    if (!client) {
      throw new Error("Failed to initialize Twilio client");
    }

    const response = await client.messages.create({
      from: config.whatsappNumber,
      to: message.to,
      body: message.body,
      ...(message.mediaUrl && { mediaUrl: [message.mediaUrl] })
    });

    logger.info("WhatsApp message sent successfully", {
      component: "whatsapp",
      messageId: response.sid,
      to: message.to,
      status: response.status
    });

    return {
      success: true,
      messageId: response.sid,
      status: response.status
    };
    */

    // For now, just log what would be sent
    logger.info("WhatsApp message would be sent", {
      component: "whatsapp",
      to: message.to,
      body: message.body,
      mediaUrl: message.mediaUrl,
      config: {
        from: config.whatsappNumber,
        businessName: config.businessName
      }
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      status: "queued"
    };

  } catch (error) {
    logger.error("Failed to send WhatsApp message", {
      component: "whatsapp",
      to: message.to,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send message"
    };
  }
}

/**
 * Message Templates for different scenarios
 */
export const MessageTemplates = {
  // Zero Risk - Order Confirmation
  orderConfirmation: (orderNumber: string, orderTotal: string, currency: string) => `
🎉 *Order Confirmed!*

Thank you for your order #${orderNumber}!

💰 Total: ${currency} ${orderTotal}
📦 Status: Confirmed & Processing
🚚 Expected Delivery: 2-3 business days

As a valued customer, your order will be processed with priority. We'll keep you updated on the delivery progress.

Need help? Reply to this message anytime!

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // Medium Risk - Verification Request
  verificationRequest: (orderNumber: string, customerName?: string) => `
👋 Hi${customerName ? ` ${customerName}` : ''}!

We need to verify your order #${orderNumber} to ensure smooth delivery.

✅ Please reply *YES* to confirm this order
❌ Reply *CANCEL* if you want to cancel

This helps us prevent delivery delays and ensures your order reaches you safely.

⏰ Please respond within 24 hours to avoid processing delays.

Need assistance? Just reply with your question!

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // High Risk - Deposit Requirement
  depositRequest: (orderNumber: string, orderTotal: string, depositAmount: string, currency: string, paymentLink: string) => `
💳 *Advance Payment Required*

Order #${orderNumber}
Total: ${currency} ${orderTotal}
Required Deposit: ${currency} ${depositAmount} (50%)

To ensure secure delivery and reduce risks, we require advance payment for this order.

🔗 *Pay Now*: ${paymentLink}

✅ After payment, your order will be processed immediately
🚚 Remaining balance can be paid on delivery
💬 Need help? Reply to this message

Why do we require this?
This policy helps us maintain competitive prices and ensures reliable delivery for all customers.

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // Payment Confirmation
  paymentConfirmed: (orderNumber: string, paidAmount: string, remainingAmount: string, currency: string) => `
✅ *Payment Confirmed!*

Order #${orderNumber}
Paid: ${currency} ${paidAmount}
Remaining COD: ${currency} ${remainingAmount}

🎉 Your order is now confirmed and will be processed immediately!
📦 Processing time: 1-2 business days
🚚 Delivery: 2-3 business days

You'll receive tracking information once your order ships.

Thank you for your business!

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // General Support Response
  supportResponse: () => `
👋 Hello! I'm here to help with your order.

I can help you with:
💳 Payment and deposit questions
📦 Order status updates
🚚 Delivery information
❓ General support

For immediate assistance, you can:
• Ask me specific questions about your order
• Request to speak with a human agent
• Get payment links for deposits

What can I help you with today?

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // Human Agent Handoff
  humanAgentHandoff: () => `
🙋‍♀️ *Connecting you to our support team...*

A human agent will respond to you shortly during our business hours:
⏰ ${process.env.WHATSAPP_SUPPORT_HOURS || "Mon-Fri 9AM-6PM"}

In the meantime, feel free to describe your question or concern, and our team will address it as soon as possible.

Thank you for your patience!

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim(),

  // Order Status Update
  orderStatusUpdate: (orderNumber: string, status: string, trackingNumber?: string) => `
📦 *Order Update*

Order #${orderNumber}
Status: ${status}
${trackingNumber ? `Tracking: ${trackingNumber}` : ''}

${status === 'shipped' ? 
  '🚚 Your order is on the way! You can track it using the number above.' :
  '📋 We\'ll keep you updated as your order progresses.'
}

Questions? Just reply to this message!

_${process.env.WHATSAPP_BUSINESS_NAME || "Your Store"}_
  `.trim()
};

/**
 * Parse incoming WhatsApp message
 */
export function parseIncomingMessage(webhookData: any): IncomingWhatsAppMessage | null {
  try {
    // Parse Twilio webhook format
    return {
      from: webhookData.From || webhookData.from,
      body: (webhookData.Body || webhookData.body || '').trim().toLowerCase(),
      messageId: webhookData.MessageSid || webhookData.messageId || `msg_${Date.now()}`,
      timestamp: new Date(),
      mediaUrl: webhookData.MediaUrl0 || webhookData.mediaUrl,
      profileName: webhookData.ProfileName || webhookData.profileName
    };
  } catch (error) {
    logger.error("Failed to parse incoming WhatsApp message", {
      component: "whatsapp",
      error: error instanceof Error ? error.message : String(error),
      webhookData
    });
    return null;
  }
}

/**
 * Simple chatbot logic for handling basic queries
 */
export function processIncomingMessage(message: IncomingWhatsAppMessage): string {
  const body = message.body.toLowerCase();

  // Order confirmation responses
  if (body.includes('yes') || body.includes('confirm') || body.includes('ok')) {
    return "✅ Thank you for confirming! Your order will be processed and shipped as scheduled. You'll receive tracking information soon.";
  }

  if (body.includes('no') || body.includes('cancel') || body.includes('stop')) {
    return "❌ We understand. Your order has been noted for review. Our team will contact you shortly to discuss your options.";
  }

  // Payment related queries
  if (body.includes('payment') || body.includes('pay') || body.includes('deposit')) {
    return "💳 For payment assistance, I can provide you with secure payment links. What's your order number?";
  }

  // Delivery queries
  if (body.includes('delivery') || body.includes('shipping') || body.includes('track')) {
    return "🚚 I can help you track your order! Please provide your order number and I'll get you the latest status.";
  }

  // Support requests
  if (body.includes('help') || body.includes('support') || body.includes('agent') || body.includes('human')) {
    return MessageTemplates.humanAgentHandoff();
  }

  // Order number detection
  if (body.includes('#') || /\b\d{4,}\b/.test(body)) {
    return "📦 I can see you mentioned an order number. Let me help you with that! What would you like to know about your order?";
  }

  // Default response
  return MessageTemplates.supportResponse();
}

/**
 * Generate payment link for deposit
 */
export function generatePaymentLink(
  orderId: string, 
  amount: string, 
  currency: string, 
  customerPhone: string
): string {
  const config = getWhatsAppConfig();
  const baseUrl = config?.paymentLinkBase || process.env.WHATSAPP_PAYMENT_LINK_BASE || "https://example.com/pay";
  
  // Construct payment URL with order details
  const params = new URLSearchParams({
    order_id: orderId,
    amount: amount,
    currency: currency,
    customer_phone: customerPhone,
    return_url: `${process.env.APP_URL || 'https://your-app.com'}/payment/success`,
    cancel_url: `${process.env.APP_URL || 'https://your-app.com'}/payment/cancel`
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Validate WhatsApp phone number format
 */
export function validateWhatsAppNumber(phoneNumber: string): boolean {
  // WhatsApp numbers should be in format: whatsapp:+1234567890
  const whatsappPattern = /^whatsapp:\+\d{10,15}$/;
  const regularPattern = /^\+\d{10,15}$/;
  
  return whatsappPattern.test(phoneNumber) || regularPattern.test(phoneNumber);
}

/**
 * Format phone number for WhatsApp
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Add country code if missing (assume Pakistan +92 for this app)
  let formattedNumber = digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    // Pakistani number starting with 0
    formattedNumber = '92' + digits.substring(1);
  } else if (digits.length === 10) {
    // Pakistani number without country code
    formattedNumber = '92' + digits;
  } else if (!digits.startsWith('92') && digits.length < 12) {
    // Assume Pakistani number
    formattedNumber = '92' + digits;
  }
  
  return `whatsapp:+${formattedNumber}`;
}

/**
 * Check if WhatsApp is configured and available
 */
export function isWhatsAppAvailable(): boolean {
  const config = getWhatsAppConfig();
  return config !== null;
}

/**
 * Get WhatsApp service status for dashboard
 */
export function getWhatsAppStatus() {
  const config = getWhatsAppConfig();
  const isConfigured = config !== null;
  
  return {
    isConfigured,
    businessName: config?.businessName || "Not Set",
    whatsappNumber: config?.whatsappNumber || "Not Set",
    supportHours: config?.supportHours || "Not Set",
    hasPaymentLink: !!(config?.paymentLinkBase),
    status: isConfigured ? "ready" : "needs_configuration"
  };
} 