import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";
import { updateCustomerProfileRisk } from "../services/riskScoring.server";
import { applyDualRiskTags } from "../services/dualTagging.server";

/**
 * Webhook handler for orders/updated
 * Tracks order updates which may include status changes, returns, or modifications
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("Processing order update webhook for shop:", shop, {
      hasSignature: !!signature,
      hasSecret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
      topic,
      bodyLength: rawBody.length
    });

    // Verify webhook signature for security
    if (signature && process.env.SHOPIFY_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        rawBody,
        signature,
        process.env.SHOPIFY_WEBHOOK_SECRET
      );
      
      if (!isValid) {
        console.error("Invalid webhook signature for orders/updated", {
          shop,
          signatureLength: signature.length,
          bodyPreview: rawBody.substring(0, 100) + "...",
          secretExists: !!process.env.SHOPIFY_WEBHOOK_SECRET
        });
        return json({ error: "Invalid signature" }, { status: 401 });
      } else {
        console.log("Webhook signature verified successfully");
      }
    } else {
      console.warn("Webhook signature verification skipped", {
        hasSignature: !!signature,
        hasSecret: !!process.env.SHOPIFY_WEBHOOK_SECRET
      });
    }

    if (topic !== "orders/updated") {
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
      tags,
      note,
      updated_at,
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
      console.log("No customer identifiers found in updated order, skipping risk tracking");
      return json({ status: "ok" });
    }

    // Check for return-related updates
    const isReturnRelated = tags?.toLowerCase().includes('return') || 
                           tags?.toLowerCase().includes('refund') || 
                           note?.toLowerCase().includes('return') ||
                           note?.toLowerCase().includes('refund');

    console.log("Processing updated order for customer:", { 
      hasPhone: !!phone, 
      hasEmail: !!email, 
      hasAddress: !!address,
      orderId: shopifyOrderId,
      orderValue: total_price,
      financialStatus: financial_status,
      fulfillmentStatus: fulfillment_status,
      isReturnRelated,
      tags
    });

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
      }, shop || "unknown");

      // Determine event type based on the update
      let eventType = "ORDER_UPDATED";
      if (isReturnRelated) {
        eventType = "ORDER_RETURN_INITIATED";
      }

      // Record the order update event
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType,
          orderValue: parseFloat(total_price || "0"),
          currency,
          eventData: {
            financial_status,
            fulfillment_status,
            customer_id: customer?.id,
            tags,
            note,
            updated_at,
            is_return_related: isReturnRelated,
          },
        },
        shop || "unknown"
      );

      // Update risk score and apply dual tags for significant updates
      if (isReturnRelated || financial_status === 'refunded' || fulfillment_status === 'fulfilled') {
        try {
          // Get admin API for tagging
          const { admin } = await authenticate.admin(request);
          
          // First update the risk score in database (significant updates affect risk)
          await updateCustomerProfileRisk(
            customerProfile.id,
            shop || "unknown"
          );
          
          // Apply updated risk tags to both customer and order
          const taggingResult = await applyDualRiskTags(
            admin,
            { phone, email },
            shopifyOrderId.toString(),
            shop || "unknown"
          );
          
          if (taggingResult.success) {
            console.log(`✓ Dual risk tags applied after order update:`, {
              customerProfileId: customerProfile.id,
              orderId: shopifyOrderId,
              eventType,
              customerTagged: taggingResult.customerTagged,
              orderTagged: taggingResult.orderTagged,
              appliedTag: taggingResult.appliedTag,
              riskDetails: taggingResult.details
            });
          } else {
            console.log(`⚠️ Dual risk tagging failed after order update:`, taggingResult.error);
          }
          
          console.log(`✓ Order update tracked and risk tags updated for customer profile: ${customerProfile.id} (type: ${eventType})`);
        } catch (adminError) {
          console.log("Could not apply risk tags (admin API unavailable):", adminError);
          console.log(`✓ Order update tracked for customer profile: ${customerProfile.id} (type: ${eventType})`);
        }
      } else {
        console.log(`✓ Order update tracked for customer profile: ${customerProfile.id} (type: ${eventType}) - no significant changes for tagging`);
      }
      
    } catch (dbError) {
      console.error("Database error processing updated order:", dbError);
      // Don't fail the webhook for DB errors
    }

    return json({ status: "ok" });

  } catch (error) {
    console.error("Error processing order update webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
