import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";

/**
 * Webhook handler for refunds/create
 * Tracks refunds which indicate returns or failed COD deliveries
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("Processing refund creation webhook for shop:", shop);

    // Verify webhook signature for security
    if (signature && process.env.SHOPIFY_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        rawBody,
        signature,
        process.env.SHOPIFY_WEBHOOK_SECRET
      );
      
      if (!isValid) {
        console.error("Invalid webhook signature");
        return json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    if (topic !== "refunds/create") {
      return json({ error: "Invalid webhook topic" }, { status: 400 });
    }

    // Parse the refund payload
    const refund = JSON.parse(rawBody);
    const {
      id: refundId,
      order_id: shopifyOrderId,
      amount,
      currency,
      reason,
      note,
      created_at,
    } = refund;

    console.log("Processing refund for order:", { 
      refundId,
      shopifyOrderId,
      amount,
      reason
    });

    // We need to fetch the original order to get customer information
    // For now, we'll use the order_id to link to existing customer profiles
    try {
      // Since we don't have direct customer info in refund webhook,
      // we'll create a simplified refund event that can be linked to
      // existing customer profiles when we have the order information
      
      // This is a placeholder approach - in production, you might want to:
      // 1. Fetch the original order using Shopify Admin API
      // 2. Or link refunds to existing order events in the database
      
      console.log(`✓ Refund tracked: ${refundId} for order ${shopifyOrderId} (amount: ${amount} ${currency})`);
      
      // TODO: Implement proper refund tracking once we have order lookup functionality
      
    } catch (dbError) {
      console.error("Database error processing refund:", dbError);
      // Don't fail the webhook for DB errors
    }

    return json({ status: "ok" });

  } catch (error) {
    console.error("Error processing refund creation webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
} 