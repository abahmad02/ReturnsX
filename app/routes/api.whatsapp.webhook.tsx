import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { 
  parseIncomingMessage, 
  processIncomingMessage, 
  sendWhatsAppMessage,
  MessageTemplates,
  generatePaymentLink,
  formatWhatsAppNumber
} from "../services/whatsapp.server";
import { logger } from "../services/logger.server";
import { getCustomerProfileByPhoneHash } from "../services/customerProfile.server";
import { hashPhoneNumber } from "../utils/crypto.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Verify this is a POST request
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Parse the webhook data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData);

    logger.info("WhatsApp webhook received", {
      component: "whatsappWebhook",
      from: webhookData.From,
      body: webhookData.Body,
      messageId: webhookData.MessageSid
    });

    // Parse the incoming message
    const incomingMessage = parseIncomingMessage(webhookData);
    if (!incomingMessage) {
      logger.error("Failed to parse incoming WhatsApp message", {
        component: "whatsappWebhook",
        webhookData
      });
      return json({ error: "Invalid message format" }, { status: 400 });
    }

    // Extract phone number and normalize it
    const customerPhone = incomingMessage.from.replace('whatsapp:', '');
    const phoneHash = await hashPhoneNumber(customerPhone);
    
    // Get customer profile to understand context
    const customerProfile = await getCustomerProfileByPhoneHash(phoneHash);
    
    // Process the message and generate response
    let responseMessage = processIncomingMessage(incomingMessage);
    
    // Handle specific order-related responses
    if (incomingMessage.body.includes('yes') || incomingMessage.body.includes('confirm')) {
      // Customer confirmed their order
      logger.info("Customer confirmed order via WhatsApp", {
        component: "whatsappWebhook",
        customerPhone,
        customerId: customerProfile?.id
      });
      
      responseMessage = "✅ Thank you for confirming! Your order will be processed and shipped as scheduled. You'll receive tracking information soon.";
      
      // TODO: Update order status in Shopify or database
      // This would integrate with order management system
    }
    
    if (incomingMessage.body.includes('cancel') || incomingMessage.body.includes('no')) {
      // Customer wants to cancel
      logger.info("Customer requested cancellation via WhatsApp", {
        component: "whatsappWebhook",
        customerPhone,
        customerId: customerProfile?.id
      });
      
      responseMessage = "❌ We understand. Your order has been noted for review. Our team will contact you shortly to discuss your options.";
      
      // TODO: Flag order for cancellation review
    }
    
    if (incomingMessage.body.includes('payment') || incomingMessage.body.includes('deposit')) {
      // Customer asking about payment
      if (customerProfile?.riskTier === 'HIGH_RISK') {
        // Generate payment link for deposit
        const paymentLink = generatePaymentLink(
          "ORDER_" + Date.now(), // Replace with actual order ID
          "5000", // Replace with actual deposit amount
          "PKR",
          customerPhone
        );
        
        responseMessage = `💳 Here's your secure payment link for the deposit:\n\n${paymentLink}\n\nAfter payment, your order will be processed immediately. Need help? Just reply to this message!`;
      } else {
        responseMessage = "💳 I can help you with payment information. Could you please provide your order number?";
      }
    }
    
    // Send response back to customer
    const whatsappResponse = await sendWhatsAppMessage({
      to: formatWhatsAppNumber(customerPhone),
      body: responseMessage
    });
    
    if (!whatsappResponse.success) {
      logger.error("Failed to send WhatsApp response", {
        component: "whatsappWebhook",
        customerPhone,
        error: whatsappResponse.error
      });
    }

    // Log the interaction for merchant dashboard
    logger.info("WhatsApp interaction processed", {
      component: "whatsappWebhook",
      customerPhone,
      incomingMessage: incomingMessage.body,
      responseMessage: responseMessage.substring(0, 100) + "...",
      messageId: whatsappResponse.messageId
    });

    // Return success response to Twilio
    return json({
      success: true,
      messageId: whatsappResponse.messageId,
      response: "Message processed"
    });

  } catch (error) {
    logger.error("WhatsApp webhook processing failed", {
      component: "whatsappWebhook",
      error: error instanceof Error ? error.message : String(error)
    });

    return json({
      success: false,
      error: "Failed to process message"
    }, { status: 500 });
  }
}; 