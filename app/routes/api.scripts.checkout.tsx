import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import {
  registerCheckoutScript,
  getScriptTagStatus,
  removeAllReturnsXScripts,
  getExistingScriptTags
} from "../services/scriptTag.server";
import { logger } from "../services/logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    const status = await getScriptTagStatus(admin, session.shop);

    return json({
      success: true,
      shopDomain: session.shop,
      ...status
    });

  } catch (error) {
    logger.error("Failed to get checkout script status", {
      error: error instanceof Error ? error.message : String(error),
      component: "checkoutScriptAPI"
    });

    return json({
      success: false,
      error: "Failed to get script status",
      hasCheckoutScript: false,
      scriptCount: 0,
      scripts: []
    }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("action") as string;

    switch (actionType) {
      case "register": {
        const scriptUrl = `${new URL(request.url).origin}/checkout-enforcement.js`;
        
        const result = await registerCheckoutScript(admin, session.shop, scriptUrl);
        
        if (result) {
          return json({
            success: true,
            message: "Checkout script registered successfully",
            scriptTag: result.script_tag
          });
        } else {
          throw new Error("Failed to register script tag");
        }
      }

      case "remove": {
        const deletedCount = await removeAllReturnsXScripts(admin, session.shop);
        
        return json({
          success: true,
          message: `Removed ${deletedCount} checkout script(s)`,
          deletedCount
        });
      }

      case "status": {
        const status = await getScriptTagStatus(admin, session.shop);
        
        return json({
          success: true,
          ...status
        });
      }

      case "list": {
        const scripts = await getExistingScriptTags(admin, session.shop);
        
        return json({
          success: true,
          scripts: scripts.map(script => ({
            id: script.id,
            src: script.src,
            event: script.event,
            display_scope: script.display_scope,
            cache: script.cache,
            created_at: script.created_at,
            updated_at: script.updated_at
          }))
        });
      }

      default:
        return json({
          success: false,
          error: "Invalid action type"
        }, { status: 400 });
    }

  } catch (error: any) {
    let errorMessage = "Failed to perform action";
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.response) {
      // Handle Shopify REST API response errors
      const status = error.response.status || 'Unknown';
      const statusText = error.response.statusText || 'Unknown error';
      errorMessage = `HTTP ${status}: ${statusText}`;
      
      // Try to extract more details from the response body
      if (error.response.body) {
        try {
          const responseBody = typeof error.response.body === 'string' 
            ? JSON.parse(error.response.body) 
            : error.response.body;
          
          if (responseBody.errors) {
            errorMessage += ` - ${JSON.stringify(responseBody.errors)}`;
            errorDetails = { responseErrors: responseBody.errors };
          }
        } catch (parseError) {
          errorDetails = { rawResponseBody: String(error.response.body) };
        }
      }
    } else if (error instanceof Response) {
      // Handle Response objects directly (Shopify API sometimes returns these)
      const status = error.status || 'Unknown';
      const statusText = error.statusText || 'Unknown error';
      errorMessage = `HTTP ${status}: ${statusText}`;
      
      // Try to read the response body
      try {
        const responseText = await error.text();
        const responseBody = JSON.parse(responseText);
        
        if (responseBody.errors) {
          errorMessage += ` - ${JSON.stringify(responseBody.errors)}`;
          errorDetails = { responseErrors: responseBody.errors };
        } else {
          errorDetails = { responseBody };
        }
      } catch (parseError) {
        errorDetails = { rawResponse: error };
      }
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = error.toString();
      errorDetails = { errorObject: error };
    } else {
      errorMessage = String(error);
    }

    logger.error("Checkout script API action failed", {
      error: errorMessage,
      ...errorDetails,
      component: "checkoutScriptAPI"
    });

    return json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}; 