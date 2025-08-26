import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";

/**
 * Webhook handler for orders/cancelled
 * Tracks order cancellations that may indicate customer refusal or delivery failures
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("Processing order cancellation webhook for shop:", shop);

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

    if (topic !== "orders/cancelled") {
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
      cancel_reason,
      cancelled_at,
      financial_status,
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
      console.log("No customer identifiers found in cancelled order, skipping risk tracking");
      return json({ status: "ok" });
    }

    console.log("Processing cancelled order for customer:", { 
      hasPhone: !!phone, 
      hasEmail: !!email, 
      hasAddress: !!address,
      orderId: shopifyOrderId,
      cancelReason: cancel_reason
    });

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
      }, shop || "unknown");

      // Record the order cancellation event
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: "ORDER_CANCELLED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          cancelReason: cancel_reason,
          eventData: {
            cancelled_at,
            financial_status,
            customer_id: customer?.id,
          },
        },
        shop || "unknown"
      );

      console.log(`✓ Order cancellation tracked for customer profile: ${customerProfile.id} (reason: ${cancel_reason})`);
    } catch (dbError) {
      console.error("Database error processing cancelled order:", dbError);
      // Don't fail the webhook for DB errors
    }

    return json({ status: "ok" });

  } catch (error) {
    console.error("Error processing order cancellation webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
} 