import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logger } from "../services/logger.server";

/**
 * API endpoint to install the ReturnsX thank you page script
 * 
 * This creates a script tag that loads our thank you page widget
 * on order confirmation pages.
 */

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    if (!admin || !session) {
      return json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const shopDomain = session.shop;
    const appUrl = new URL(request.url).origin;
    
    // Create script tag for thank you page
    const scriptTag = await admin.rest.resources.ScriptTag.save({
      session,
      event: "onload",
      src: `${appUrl}/thank-you-script.js`,
      display_scope: "order_status", // Only load on order status/thank you pages
    });

    logger.info("Thank you script installed", {
      shopDomain,
      scriptTagId: scriptTag.id,
      src: scriptTag.src,
    });

    return json({
      success: true,
      message: "Thank you page script installed successfully",
      scriptTag: {
        id: scriptTag.id,
        src: scriptTag.src,
        display_scope: scriptTag.display_scope,
      },
    });

  } catch (error) {
    logger.error("Error installing thank you script", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return json({
      success: false,
      error: "Failed to install script",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    if (!admin || !session) {
      return json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    // Check if script is already installed
    const scriptTags = await admin.rest.resources.ScriptTag.all({
      session,
    });

    const appUrl = new URL(request.url).origin;
    const thankYouScriptUrl = `${appUrl}/thank-you-script.js`;
    
    const existingScript = scriptTags.data.find(script => 
      script.src === thankYouScriptUrl
    );

    return json({
      success: true,
      isInstalled: !!existingScript,
      scriptTag: existingScript || null,
      scriptUrl: thankYouScriptUrl,
    });

  } catch (error) {
    logger.error("Error checking thank you script status", {
      error: error instanceof Error ? error.message : String(error),
    });

    return json({
      success: false,
      error: "Failed to check script status",
    }, { status: 500 });
  }
}