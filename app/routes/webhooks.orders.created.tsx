import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";

/**
 * Webhook handler for orders/create
 * Tracks new orders and updates customer risk profiles
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("Processing order creation webhook for shop:", shop);

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

    if (topic !== "orders/create") {
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
      financial_status,
      fulfillment_status,
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
      console.log("No customer identifiers found in order, skipping risk tracking");
      return json({ status: "ok" });
    }

    console.log("Processing order for customer identifiers:", { 
      hasPhone: !!phone, 
      hasEmail: !!email, 
      hasAddress: !!address,
      orderId: shopifyOrderId,
      orderValue: total_price
    });

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
        shopDomain: shop || "unknown",
      });

      // Record the order creation event
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: "ORDER_CREATED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          eventData: {
            financial_status,
            fulfillment_status,
            customer_id: customer?.id,
          },
        },
        shop || "unknown"
      );

      console.log(`✓ Order creation tracked for customer profile: ${customerProfile.id}`);
    } catch (dbError) {
      console.error("Database error processing order:", dbError);
      // Don't fail the webhook for DB errors - Shopify won't retry
      // Log for monitoring but return success
    }

    return json({ status: "ok" });

  } catch (error) {
    console.error("Error processing order creation webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
} 