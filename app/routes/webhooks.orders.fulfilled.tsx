import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";

/**
 * Webhook handler for orders/fulfilled
 * Tracks successful order fulfillments and deliveries
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("Processing order fulfillment webhook for shop:", shop);

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

    if (topic !== "orders/fulfilled") {
      return json({ error: "Invalid webhook topic" }, { status: 400 });
    }

    // Parse the order payload
    const order = JSON.parse(rawBody);
    const {
      id: shopifyOrderId,
      customer,
      billing_address,
      shipping_address,
      total_price,
      currency,
      fulfillment_status,
      fulfillments,
    } = order;

    // Extract customer identifiers
    const phone = customer?.phone || billing_address?.phone || shipping_address?.phone;
    const email = customer?.email || billing_address?.email;
    const address = shipping_address ? 
      `${shipping_address.address1 || ''} ${shipping_address.city || ''} ${shipping_address.province || ''} ${shipping_address.country || ''}`.trim() :
      billing_address ? 
      `${billing_address.address1 || ''} ${billing_address.city || ''} ${billing_address.province || ''} ${billing_address.country || ''}`.trim() :
      null;

    if (!phone && !email) {
      console.log("No customer identifiers found in fulfilled order, skipping risk tracking");
      return json({ status: "ok" });
    }

    // Only track as successful delivery if fully fulfilled
    const isFullyFulfilled = fulfillment_status === "fulfilled";

    console.log("Processing fulfilled order for customer:", { 
      hasPhone: !!phone, 
      hasEmail: !!email, 
      hasAddress: !!address,
      orderId: shopifyOrderId,
      isFullyFulfilled,
      fulfillmentStatus: fulfillment_status
    });

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
      }, shop || "unknown");

      // Record the fulfillment event
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: isFullyFulfilled ? "ORDER_DELIVERED" : "ORDER_FULFILLED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          fulfillmentStatus: fulfillment_status,
          eventData: {
            fulfillments,
            customer_id: customer?.id,
            is_fully_fulfilled: isFullyFulfilled,
          },
        },
        shop || "unknown"
      );

      console.log(`✓ Order fulfillment tracked for customer profile: ${customerProfile.id} (status: ${fulfillment_status})`);
    } catch (dbError) {
      console.error("Database error processing fulfilled order:", dbError);
      // Don't fail the webhook for DB errors
    }

    return json({ status: "ok" });

  } catch (error) {
    console.error("Error processing order fulfillment webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
} 