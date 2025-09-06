import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { updateCustomerProfileRisk } from "../services/riskScoring.server";

/**
 * DEBUG webhook handler for orders/updated
 * This endpoint bypasses signature validation for debugging purposes
 * 
 * ⚠️ WARNING: This should only be used temporarily for debugging!
 * Remove this file once the signature issue is resolved.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get raw body and headers for debugging
    const rawBody = await request.text();
    const signature = request.headers.get("X-Shopify-Hmac-Sha256");
    const topic = request.headers.get("X-Shopify-Topic");
    const shop = request.headers.get("X-Shopify-Shop-Domain");

    console.log("🐛 DEBUG: Processing order update webhook", {
      shop,
      topic,
      hasSignature: !!signature,
      signaturePreview: signature ? signature.substring(0, 20) + "..." : null,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200) + "...",
      allHeaders: Object.fromEntries(request.headers.entries()),
    });

    // Skip signature validation for debugging
    console.log("🐛 DEBUG: Skipping signature validation for debugging purposes");

    if (topic !== "orders/updated") {
      console.log("❌ Invalid webhook topic:", topic);
      return json({ error: "Invalid webhook topic" }, { status: 400 });
    }

    // Parse the order payload
    let order;
    try {
      order = JSON.parse(rawBody);
      console.log("✅ Successfully parsed order JSON");
    } catch (parseError) {
      console.error("❌ Failed to parse order JSON:", parseError);
      return json({ error: "Invalid JSON payload" }, { status: 400 });
    }

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

    console.log("🐛 DEBUG: Extracted order data", {
      orderId: shopifyOrderId,
      hasCustomer: !!customer,
      financialStatus: financial_status,
      fulfillmentStatus: fulfillment_status,
      totalPrice: total_price,
      tags,
    });

    // Extract customer identifiers
    const phone = customer?.phone || billing_address?.phone || shipping_address?.phone;
    const email = customer?.email || billing_address?.email;
    const address = shipping_address ? 
      `${shipping_address.address1 || ''} ${shipping_address.city || ''} ${shipping_address.province || ''} ${shipping_address.country || ''}`.trim() :
      billing_address ? 
      `${billing_address.address1 || ''} ${billing_address.city || ''} ${billing_address.province || ''} ${billing_address.country || ''}`.trim() :
      null;

    console.log("🐛 DEBUG: Customer identifiers", {
      hasPhone: !!phone,
      hasEmail: !!email,
      hasAddress: !!address,
      phonePreview: phone ? phone.substring(0, 3) + "***" : null,
    });

    if (!phone && !email) {
      console.log("⚠️ No customer identifiers found in updated order, skipping risk tracking");
      return json({ status: "ok", message: "No customer identifiers" });
    }

    // Check for return-related updates
    const isReturnRelated = tags?.toLowerCase().includes('return') || 
                           tags?.toLowerCase().includes('refund') || 
                           note?.toLowerCase().includes('return') ||
                           note?.toLowerCase().includes('refund');

    console.log("🐛 DEBUG: Risk assessment context", {
      isReturnRelated,
      shouldUpdateRisk: isReturnRelated || financial_status === 'refunded' || fulfillment_status === 'fulfilled',
    });

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
      }, shop || "unknown");

      console.log("✅ Customer profile found/created:", customerProfile.id);

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

      console.log("✅ Order event recorded successfully");

      // Update risk score and apply tags for significant updates
      if (isReturnRelated || financial_status === 'refunded' || fulfillment_status === 'fulfilled') {
        try {
          console.log("🏷️ Attempting to update risk tags...");
          
          // Get admin API for tagging
          const { admin } = await authenticate.admin(request);
          
          // Recalculate risk and apply tags
          await updateCustomerProfileRisk(
            customerProfile.id,
            shop || "unknown",
            admin
          );
          
          console.log(`✅ Order update tracked and risk tags updated for customer profile: ${customerProfile.id} (type: ${eventType})`);
        } catch (adminError) {
          console.log("⚠️ Could not apply risk tags:", adminError);
          console.log(`✅ Order update tracked for customer profile: ${customerProfile.id} (type: ${eventType})`);
        }
      } else {
        console.log(`✅ Order update tracked for customer profile: ${customerProfile.id} (type: ${eventType}) - no tag update needed`);
      }
      
    } catch (dbError) {
      console.error("❌ Database error processing updated order:", dbError);
      return json({ 
        status: "error", 
        message: "Database error", 
        error: dbError instanceof Error ? dbError.message : String(dbError) 
      }, { status: 500 });
    }

    return json({ 
      status: "ok", 
      message: "DEBUG: Order update processed successfully",
      debug: {
        orderId: shopifyOrderId,
        eventType: isReturnRelated ? "ORDER_RETURN_INITIATED" : "ORDER_UPDATED",
        riskTagUpdateAttempted: isReturnRelated || financial_status === 'refunded' || fulfillment_status === 'fulfilled'
      }
    });

  } catch (error) {
    console.error("❌ Error processing DEBUG order update webhook:", error);
    return json({ 
      status: "error", 
      message: "Webhook processing failed", 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
