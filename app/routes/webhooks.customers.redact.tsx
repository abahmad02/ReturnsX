import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logger } from "../services/logger.server";
import db from "../db.server";

/**
 * Webhook handler for customers/redact
 * 
 * This webhook is triggered when a customer requests data deletion.
 * Required for GDPR "right to be forgotten" compliance.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CUSTOMERS_REDACT") {
      return new Response("Webhook topic not supported", { status: 404 });
    }

    logger.info("Customer redaction request received", {
      shopDomain: shop,
      customerId: payload.customer?.id,
      ordersToRedact: payload.orders_to_redact?.length || 0,
      component: "privacyCompliance"
    });

    // Handle the redaction request
    await handleCustomerRedaction(payload, shop);

    return new Response("OK", { status: 200 });

  } catch (error) {
    logger.error("Failed to process customer redaction", {
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    
    return new Response("Internal Server Error", { status: 500 });
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

    const emailHash = customer.email ? await hashCustomerIdentifier(customer.email, 'email') : null;
    const phoneHash = customer.phone ? await hashCustomerIdentifier(customer.phone, 'phone') : null;

    // Delete customer profiles
    const deletedProfiles = await db.customerProfile.deleteMany({
      where: {
        OR: [
          ...(emailHash ? [{ emailHash }] : []),
          ...(phoneHash ? [{ phoneHash }] : []),
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
async function hashCustomerIdentifier(identifier: string, type: 'email' | 'phone'): Promise<string> {
  // Import the crypto utility
  const { hashEmail, hashPhoneNumber } = await import("../utils/crypto.server");
  
  if (type === 'email') {
    return hashEmail(identifier);
  } else {
    return hashPhoneNumber(identifier);
  }
}
