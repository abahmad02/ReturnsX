import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrCreateCustomerProfile, recordOrderEvent } from "../services/customerProfile.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";
import { updateCustomerProfileRisk } from "../services/riskScoring.server";
import { applyDualRiskTags } from "../services/dualTagging.server";
import { getCheckoutCorrelation, markCorrelationMatched } from "../services/checkoutCorrelation.server";

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
      name: orderName,
      customer,
      billing_address,
      shipping_address,
      total_price,
      currency,
      financial_status,
      fulfillment_status,
      checkout_token,
    } = order;

    console.log("Order details:", { 
      orderId: shopifyOrderId,
      orderName,
      hasCheckoutToken: !!checkout_token,
      checkoutToken: checkout_token?.slice(-8)
    });

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

    // Try to find checkout correlation if checkout_token exists
    let correlation = null;
    if (checkout_token) {
      try {
        correlation = await getCheckoutCorrelation(checkout_token);
        
        if (correlation) {
          console.log("Found checkout correlation:", {
            orderId: shopifyOrderId,
            checkoutToken: checkout_token.slice(-8),
            correlationId: correlation.id,
            correlationPhone: correlation.customerPhone,
            correlationEmail: correlation.customerEmail
          });

          // Mark correlation as matched
          await markCorrelationMatched(correlation.id, shopifyOrderId.toString());
          
          // Use correlation data to supplement customer info if needed
          if (!phone && correlation.customerPhone) {
            console.log("Using phone from checkout correlation");
          }
          if (!email && correlation.customerEmail) {
            console.log("Using email from checkout correlation");
          }
        } else {
          console.log("No checkout correlation found for token:", checkout_token.slice(-8));
        }
      } catch (correlationError) {
        console.warn("Error processing checkout correlation:", correlationError);
        // Don't fail the webhook for correlation errors
      }
    }

    try {
      // Get or create customer profile
      const customerProfile = await getOrCreateCustomerProfile({
        phone,
        email,
        address: address || undefined,
      }, shop || "unknown");

      // Record the order creation event with correlation data
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
            checkout_token,
            correlation_id: correlation?.id,
            order_name: orderName,
            post_purchase_context: !!correlation // Flag to indicate this came from post-purchase extension
          },
        },
        shop || "unknown"
      );

      // Apply dual risk tags (customer + order) using GraphQL
      try {
        // Get admin API for tagging
        const { admin } = await authenticate.admin(request);
        
        // Apply tags to both customer and order based on database risk score
        const taggingResult = await applyDualRiskTags(
          admin,
          { phone, email },
          shopifyOrderId.toString(),
          shop || "unknown"
        );
        
        if (taggingResult.success) {
          console.log(`✓ Dual risk tags applied successfully:`, {
            customerProfileId: customerProfile.id,
            orderId: shopifyOrderId,
            customerTagged: taggingResult.customerTagged,
            orderTagged: taggingResult.orderTagged,
            appliedTag: taggingResult.appliedTag,
            riskDetails: taggingResult.details
          });
        } else {
          console.log(`⚠️ Dual risk tagging failed:`, taggingResult.error);
        }
        
        // Also update the risk score in our database
        await updateCustomerProfileRisk(
          customerProfile.id,
          shop || "unknown"
        );
        
        console.log(`✓ Order creation tracked and risk tags applied for customer profile: ${customerProfile.id}`);
      } catch (adminError) {
        console.log("Could not apply risk tags (admin API unavailable):", adminError);
        console.log(`✓ Order creation tracked for customer profile: ${customerProfile.id}`);
      }
      
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