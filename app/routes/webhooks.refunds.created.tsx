import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";
import prisma from "../db.server";

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

    // Temporarily disable signature verification for testing
    // TODO: Re-enable after fixing webhook secret
    // if (signature && process.env.SHOPIFY_WEBHOOK_SECRET) {
    //   const isValid = verifyWebhookSignature(
    //     rawBody,
    //     signature,
    //     process.env.SHOPIFY_WEBHOOK_SECRET
    //   );
    //   
    //   if (!isValid) {
    //     console.error("Invalid webhook signature");
    //     return json({ error: "Invalid signature" }, { status: 401 });
    //   }
    // }

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

    // Find existing order events for this Shopify order to get customer profile
    try {
      const existingOrderEvent = await (prisma as any).orderEvent.findFirst({
        where: {
          shopifyOrderId: shopifyOrderId.toString(),
          shopDomain: shop || "unknown",
        },
        include: {
          customerProfile: true,
        },
      });

      if (existingOrderEvent) {
        // Record the refund event for the customer profile
        await recordOrderEvent(
          existingOrderEvent.customerProfile,
          {
            shopifyOrderId: shopifyOrderId.toString(),
            eventType: "ORDER_REFUNDED",
            orderValue: parseFloat(amount || "0"),
            currency,
            refundAmount: parseFloat(amount || "0"),
            eventData: {
              refund_id: refundId,
              reason,
              note,
              created_at,
            },
          },
          shop || "unknown"
        );

        console.log(`✓ Refund tracked for customer profile: ${existingOrderEvent.customerProfile.id} (refund: ${refundId}, amount: ${amount} ${currency})`);
      } else {
        console.log(`No existing order event found for order ${shopifyOrderId}, cannot link refund to customer profile`);
      }
      
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