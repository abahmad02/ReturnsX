import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { logger } from "../services/logger.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";

/**
 * Webhook handler for customers/data_request
 * 
 * This webhook is triggered when a customer requests their data.
 * Required for GDPR and privacy law compliance.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    // MANDATORY: Verify webhook signature for compliance webhooks
    if (!signature) {
      logger.warn("Missing webhook signature", { component: "privacyCompliance" });
      return json({ error: "Missing signature" }, { status: 401 });
    }

    if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
      logger.error("Missing webhook secret", { component: "privacyCompliance" });
      return json({ error: "Server configuration error" }, { status: 500 });
    }

    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      process.env.SHOPIFY_WEBHOOK_SECRET
    );
    
    if (!isValid) {
      logger.warn("Invalid webhook signature for customer data request", { 
        shopDomain: shop,
        component: "privacyCompliance" 
      });
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    if (topic !== "customers/data_request") {
      return json({ error: "Webhook topic not supported" }, { status: 404 });
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    logger.info("Customer data request received", {
      shopDomain: shop,
      customerId: payload.customer?.id,
      dataRequestId: payload.data_request?.id,
      component: "privacyCompliance"
    });

    // Handle the data request
    await handleCustomerDataRequest(payload, shop || "unknown");

    return json({ status: "ok" }, { status: 200 });

  } catch (error) {
    // Check if this is an authentication/signature error
    if (error instanceof Error && 
        (error.message.includes("signature") || 
         error.message.includes("authentication") ||
         error.message.includes("unauthorized"))) {
      logger.warn("Authentication failed for customer data request webhook", {
        error: error.message,
        component: "privacyCompliance"
      });
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Failed to process customer data request", {
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};

/**
 * Handle customer data request
 */
async function handleCustomerDataRequest(payload: any, shopDomain: string) {
  const { customer, orders_requested, data_request } = payload;

  try {
    // For ReturnsX, we need to:
    // 1. Find customer profiles by phone/email (remember, we hash these)
    // 2. Collect all data we have for this customer
    // 3. Prepare data package for the merchant

    const customerData = {
      customerId: customer.id,
      email: customer.email,
      phone: customer.phone,
      ordersRequested: orders_requested,
      dataRequestId: data_request.id,
      
      // ReturnsX-specific data
      riskProfiles: [], // We'll populate this with customer risk data
      orderEvents: [],  // Order events we've tracked
      fraudScores: [],  // Historical fraud scores
    };

    // TODO: Implement actual data collection
    // Since we hash customer identifiers, we need to:
    // 1. Hash the provided email/phone with our salt
    // 2. Look up profiles by the hash
    // 3. Collect all associated data
    
    logger.info("Customer data request processed", {
      shopDomain,
      customerId: customer.id,
      dataRequestId: data_request.id,
      component: "privacyCompliance"
    });

    // Note: The actual data should be provided to the merchant
    // through their admin interface or via email, not returned here

  } catch (error) {
    logger.error("Error processing customer data request", {
      shopDomain,
      customerId: customer?.id,
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    throw error;
  }
}
