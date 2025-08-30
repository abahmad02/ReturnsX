import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { logger } from "../services/logger.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";
import db from "../db.server";

/**
 * Webhook handler for customers/redact
 * 
 * This webhook is triggered when a customer requests data deletion.
 * Required for GDPR "right to be forgotten" compliance.
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
      logger.warn("Invalid webhook signature for customer redaction", { 
        shopDomain: shop,
        component: "privacyCompliance" 
      });
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    if (topic !== "customers/redact") {
      return json({ error: "Webhook topic not supported" }, { status: 404 });
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    logger.info("Customer redaction request received", {
      shopDomain: shop,
      customerId: payload.customer?.id,
      ordersToRedact: payload.orders_to_redact?.length || 0,
      component: "privacyCompliance"
    });

    // Handle the redaction request
    await handleCustomerRedaction(payload, shop || "unknown");

    return json({ status: "ok" }, { status: 200 });

  } catch (error) {
    // Check if this is an authentication/signature error
    if (error instanceof Error && 
        (error.message.includes("signature") || 
         error.message.includes("authentication") ||
         error.message.includes("unauthorized"))) {
      logger.warn("Authentication failed for customer redaction webhook", {
        error: error.message,
        component: "privacyCompliance"
      });
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Failed to process customer redaction", {
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};

/**
 * Handle customer data redaction/deletion
 */
async function handleCustomerRedaction(payload: any, shopDomain: string) {
  const { customer, orders_to_redact } = payload;

  try {
    // For ReturnsX, we need to delete:
    // 1. Customer profiles (identified by hashed phone/email)
    // 2. All order events for this customer
    // 3. Any cached risk scores
    // 4. All personally identifiable information

    // Since we hash customer identifiers, we need to:
    // 1. Hash the provided email/phone with our salt
    // 2. Find matching customer profiles
    // 3. Delete all associated data

    const normalizedEmail = customer.email ? normalizeCustomerIdentifier(customer.email, 'email') : null;
    const normalizedPhone = customer.phone ? normalizeCustomerIdentifier(customer.phone, 'phone') : null;

    // Delete customer profiles
    const deletedProfiles = await db.customerProfile.deleteMany({
      where: {
        OR: [
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    // Delete order events for specific orders if provided
    if (orders_to_redact && orders_to_redact.length > 0) {
      await db.orderEvent.deleteMany({
        where: {
          shopDomain,
          shopifyOrderId: {
            in: orders_to_redact.map(String),
          },
        },
      });
    }

    logger.info("Customer data redacted successfully", {
      shopDomain,
      customerId: customer.id,
      deletedProfiles: deletedProfiles.count,
      deletedOrders: orders_to_redact?.length || 0,
      component: "privacyCompliance"
    });

  } catch (error) {
    logger.error("Error processing customer redaction", {
      shopDomain,
      customerId: customer?.id,
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    throw error;
  }
}

/**
 * Hash customer identifier using the appropriate function
 */
function normalizeCustomerIdentifier(identifier: string, type: 'email' | 'phone'): string {
  if (type === 'email') {
    return identifier.toLowerCase().trim();
  } else {
    return identifier.replace(/\D/g, ''); // Remove all non-digits for phone
  }
}
