import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { registerWebhooksForAuthenticatedShop } from "../services/webhookRegistration.server";

/**
 * POST /api/webhooks/register
 * 
 * Register all ReturnsX webhooks for the authenticated shop
 * Used by merchant dashboard to set up or refresh webhook configuration
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Get the app URL from environment or use production URL as fallback
    const appUrl = process.env.SHOPIFY_APP_URL || "https://returnsx.pk";

    console.log("Registering webhooks with app URL:", appUrl);

    // Register webhooks for the authenticated shop
    const result = await registerWebhooksForAuthenticatedShop(request, appUrl);

    if (result.success) {
      return json({
        success: true,
        message: `Successfully registered ${result.registered.length} webhooks`,
        registered: result.registered,
      });
    } else {
      return json({
        success: false,
        message: "Some webhooks failed to register",
        registered: result.registered,
        errors: result.errors,
      }, { status: 400 });
    }

  } catch (error) {
    console.error("Error in webhook registration endpoint:", error);
    return json(
      { 
        success: false,
        error: "Failed to register webhooks",
        details: error?.toString() 
      },
      { status: 500 }
    );
  }
} 