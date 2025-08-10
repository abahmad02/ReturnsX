import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { 
  sendWhatsAppMessage, 
  MessageTemplates, 
  formatWhatsAppNumber, 
  generatePaymentLink,
  isWhatsAppAvailable 
} from "../services/whatsapp.server";
import { logger } from "../services/logger.server";
import { getCustomerProfileByPhoneHash } from "../services/customerProfile.server";
import { hashPhoneNumber } from "../utils/crypto.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    if (!isWhatsAppAvailable()) {
      return json({
        success: false,
        error: "WhatsApp is not configured. Please set up Twilio credentials in environment variables."
      }, { status: 503 });
    }

    const formData = await request.formData();
    const messageType = formData.get("type") as string;
    const customerPhone = formData.get("phone") as string;
    const orderNumber = formData.get("orderNumber") as string;

    if (!messageType || !customerPhone) {
      return json({
        success: false,
        error: "Missing required parameters: type and phone"
      }, { status: 400 });
    }

    let messageBody = "";
    let messageId = "";

    switch (messageType) {
      case "order_confirmation": {
        const orderTotal = formData.get("orderTotal") as string;
        const currency = formData.get("currency") as string || "PKR";
        
        messageBody = MessageTemplates.orderConfirmation(
          orderNumber || "N/A", 
          orderTotal || "0", 
          currency
        );
        break;
      }

      case "verification_request": {
        const customerName = formData.get("customerName") as string;
        
        messageBody = MessageTemplates.verificationRequest(
          orderNumber || "N/A",
          customerName
        );
        break;
      }

      case "deposit_request": {
        const orderTotal = formData.get("orderTotal") as string;
        const depositAmount = formData.get("depositAmount") as string;
        const currency = formData.get("currency") as string || "PKR";
        
        // Generate payment link
        const paymentLink = generatePaymentLink(
          orderNumber,
          depositAmount || "0",
          currency,
          customerPhone
        );
        
        messageBody = MessageTemplates.depositRequest(
          orderNumber || "N/A",
          orderTotal || "0",
          depositAmount || "0",
          currency,
          paymentLink
        );
        break;
      }

      case "payment_confirmed": {
        const paidAmount = formData.get("paidAmount") as string;
        const remainingAmount = formData.get("remainingAmount") as string;
        const currency = formData.get("currency") as string || "PKR";
        
        messageBody = MessageTemplates.paymentConfirmed(
          orderNumber || "N/A",
          paidAmount || "0",
          remainingAmount || "0",
          currency
        );
        break;
      }

      case "order_status": {
        const status = formData.get("status") as string;
        const trackingNumber = formData.get("trackingNumber") as string;
        
        messageBody = MessageTemplates.orderStatusUpdate(
          orderNumber || "N/A",
          status || "processing",
          trackingNumber
        );
        break;
      }

      case "custom": {
        messageBody = formData.get("message") as string;
        if (!messageBody) {
          return json({
            success: false,
            error: "Custom message body is required"
          }, { status: 400 });
        }
        break;
      }

      default:
        return json({
          success: false,
          error: "Invalid message type"
        }, { status: 400 });
    }

    // Send the WhatsApp message
    const response = await sendWhatsAppMessage({
      to: formatWhatsAppNumber(customerPhone),
      body: messageBody
    });

    if (response.success) {
      // Log the message for audit trail
      logger.info("WhatsApp message sent from dashboard", {
        component: "whatsappAPI",
        messageType,
        customerPhone,
        orderNumber,
        messageId: response.messageId,
        shopDomain: session.shop,
        adminUserId: session.id
      });

      // Get customer profile for additional context
      try {
        const phoneHash = await hashPhoneNumber(customerPhone);
        const customerProfile = await getCustomerProfileByPhoneHash(phoneHash);
        
        if (customerProfile) {
          logger.info("Message sent to tracked customer", {
            component: "whatsappAPI",
            customerId: customerProfile.id,
            riskTier: customerProfile.riskTier,
            totalOrders: customerProfile.totalOrders
          });
        }
      } catch (error) {
        // Non-critical error, don't fail the main operation
        logger.warn("Could not retrieve customer profile for message logging", {
          component: "whatsappAPI",
          customerPhone,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      return json({
        success: true,
        messageId: response.messageId,
        message: "WhatsApp message sent successfully",
        messageType,
        customerPhone
      });

    } else {
      logger.error("Failed to send WhatsApp message from dashboard", {
        component: "whatsappAPI",
        messageType,
        customerPhone,
        orderNumber,
        error: response.error,
        shopDomain: session.shop
      });

      return json({
        success: false,
        error: response.error || "Failed to send message"
      }, { status: 500 });
    }

  } catch (error) {
    logger.error("WhatsApp API error", {
      component: "whatsappAPI",
      error: error instanceof Error ? error.message : String(error)
    });

    return json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}; 