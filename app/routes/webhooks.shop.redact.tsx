import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { logger } from "../services/logger.server";
import { verifyWebhookSignature } from "../services/webhookRegistration.server";
import db from "../db.server";

/**
 * Webhook handler for shop/redact
 * 
 * This webhook is triggered 48 hours after a shop uninstalls the app.
 * Required for GDPR compliance - must delete all shop data.
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
      logger.warn("Invalid webhook signature for shop redaction", { 
        shopDomain: shop,
        component: "privacyCompliance" 
      });
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    if (topic !== "shop/redact") {
      return json({ error: "Webhook topic not supported" }, { status: 404 });
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    logger.info("Shop redaction request received", {
      shopDomain: shop,
      shopId: payload.shop_id,
      component: "privacyCompliance"
    });

    // Handle the shop data redaction
    await handleShopRedaction(payload);

    return json({ status: "ok" }, { status: 200 });

  } catch (error) {
    // Check if this is an authentication/signature error
    if (error instanceof Error && 
        (error.message.includes("signature") || 
         error.message.includes("authentication") ||
         error.message.includes("unauthorized"))) {
      logger.warn("Authentication failed for shop redaction webhook", {
        error: error.message,
        component: "privacyCompliance"
      });
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Failed to process shop redaction", {
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};

/**
 * Handle complete shop data deletion
 */
async function handleShopRedaction(payload: any) {
  const { shop_domain, shop_id } = payload;

  try {
    // Delete all data associated with this shop
    // Order is important due to foreign key constraints

    // 1. Delete manual overrides first (they reference customer profiles)
    const deletedOverrides = await db.manualOverride.deleteMany({
      where: {
        shopDomain: shop_domain,
      },
    });

    // 2. Delete order events (they reference customer profiles)
    const deletedOrderEvents = await db.orderEvent.deleteMany({
      where: {
        shopDomain: shop_domain,
      },
    });

    // 3. Delete customer profiles for this shop
    // Note: In our current schema, customer profiles are cross-store
    // We need to be careful about deleting profiles that might be used by other stores
    // For now, we'll keep customer profiles but this depends on business requirements
    
    // 4. Delete risk configuration
    const deletedRiskConfig = await db.riskConfig.deleteMany({
      where: {
        shopDomain: shop_domain,
      },
    });

    // 5. Delete sessions for this shop
    const deletedSessions = await db.session.deleteMany({
      where: {
        shop: shop_domain,
      },
    });

    logger.info("Shop data redacted successfully", {
      shopDomain: shop_domain,
      shopId: shop_id,
      deletedOverrides: deletedOverrides.count,
      deletedOrderEvents: deletedOrderEvents.count,
      deletedRiskConfigs: deletedRiskConfig.count,
      deletedSessions: deletedSessions.count,
      component: "privacyCompliance"
    });

    // Note: Customer profiles are intentionally preserved as they contain
    // cross-store fraud prevention data. If needed, implement a separate
    // cleanup job for orphaned customer profiles.

  } catch (error) {
    logger.error("Error processing shop redaction", {
      shopDomain: shop_domain,
      shopId: shop_id,
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    throw error;
  }
}
