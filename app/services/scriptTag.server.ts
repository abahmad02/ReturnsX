import { authenticate } from "../shopify.server";
import { logger } from "./logger.server";

export interface ScriptTagData {
  id?: string;
  src: string;
  event: "onload";
  display_scope: "checkout" | "all" | "order_status";
  cache?: boolean;
}

export interface ScriptTagResponse {
  script_tag: {
    id: string;
    src: string;
    event: string;
    display_scope: string;
    cache: boolean;
    created_at: string;
    updated_at: string;
  };
}

/**
 * Register the ReturnsX checkout enforcement script tag
 */
export async function registerCheckoutScript(
  admin: any,
  shopDomain: string,
  scriptUrl: string
): Promise<ScriptTagResponse | null> {
  try {
    logger.info("Registering checkout script", {
      shopDomain,
      scriptUrl,
      component: "scriptTag"
    });

    // Check if script already exists
    const existingScripts = await getExistingScriptTags(admin, shopDomain);
    const existingScript = existingScripts.find((script: any) => 
      script.src.includes('checkout-enforcement') || script.src === scriptUrl
    );

    if (existingScript) {
      logger.info("Checkout script already exists", {
        shopDomain,
        scriptId: existingScript.id,
        component: "scriptTag"
      });
      return { script_tag: existingScript };
    }

    // Create new script tag
    const response = await admin.rest.post({
      path: "script_tags",
      data: {
        script_tag: {
          event: "onload",
          src: scriptUrl,
          display_scope: "checkout",
          cache: true
        }
      }
    });

    const result = response.body as ScriptTagResponse;
    
    logger.info("Checkout script registered successfully", {
      shopDomain,
      scriptId: result.script_tag.id,
      scriptUrl: result.script_tag.src,
      component: "scriptTag"
    });

    return result;

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 
                        error?.response?.status ? `HTTP ${error.response.status}: ${error.response.statusText || 'Unknown error'}` :
                        String(error);
    
    logger.error("Failed to register checkout script", {
      shopDomain,
      scriptUrl,
      error: errorMessage,
      component: "scriptTag"
    });
    throw error;
  }
}

/**
 * Get all existing script tags for the shop
 */
export async function getExistingScriptTags(
  admin: any,
  shopDomain: string
): Promise<any[]> {
  try {
    const response = await admin.rest.get({
      path: "script_tags"
    });

    return response.body.script_tags || [];

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 
                        error?.response?.status ? `HTTP ${error.response.status}: ${error.response.statusText || 'Unknown error'}` :
                        String(error);
    
    logger.error("Failed to fetch script tags", {
      shopDomain,
      error: errorMessage,
      component: "scriptTag"
    });
    return [];
  }
}

/**
 * Delete a specific script tag
 */
export async function deleteScriptTag(
  admin: any,
  shopDomain: string,
  scriptTagId: string
): Promise<boolean> {
  try {
    await admin.rest.delete({
      path: `script_tags/${scriptTagId}`
    });

    logger.info("Script tag deleted successfully", {
      shopDomain,
      scriptTagId,
      component: "scriptTag"
    });

    return true;

  } catch (error) {
    logger.error("Failed to delete script tag", {
      shopDomain,
      scriptTagId,
      error: error instanceof Error ? error.message : String(error),
      component: "scriptTag"
    });
    return false;
  }
}

/**
 * Update checkout script with new URL
 */
export async function updateCheckoutScript(
  admin: any,
  shopDomain: string,
  scriptTagId: string,
  newScriptUrl: string
): Promise<ScriptTagResponse | null> {
  try {
    const response = await admin.rest.put({
      path: `script_tags/${scriptTagId}`,
      data: {
        script_tag: {
          id: scriptTagId,
          src: newScriptUrl,
          event: "onload",
          display_scope: "checkout",
          cache: true
        }
      }
    });

    const result = response.body as ScriptTagResponse;
    
    logger.info("Checkout script updated successfully", {
      shopDomain,
      scriptTagId,
      newScriptUrl,
      component: "scriptTag"
    });

    return result;

  } catch (error) {
    logger.error("Failed to update checkout script", {
      shopDomain,
      scriptTagId,
      newScriptUrl,
      error: error instanceof Error ? error.message : String(error),
      component: "scriptTag"
    });
    return null;
  }
}

/**
 * Remove all ReturnsX script tags
 */
export async function removeAllReturnsXScripts(
  admin: any,
  shopDomain: string
): Promise<number> {
  try {
    const existingScripts = await getExistingScriptTags(admin, shopDomain);
    const returnsXScripts = existingScripts.filter((script: any) => 
      script.src.includes('returnsx') || 
      script.src.includes('checkout-enforcement') ||
      script.src.includes('cod-risk')
    );

    let deletedCount = 0;
    for (const script of returnsXScripts) {
      const deleted = await deleteScriptTag(admin, shopDomain, script.id);
      if (deleted) deletedCount++;
    }

    logger.info("ReturnsX script tags cleanup completed", {
      shopDomain,
      deletedCount,
      totalFound: returnsXScripts.length,
      component: "scriptTag"
    });

    return deletedCount;

  } catch (error) {
    logger.error("Failed to remove ReturnsX scripts", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
      component: "scriptTag"
    });
    return 0;
  }
}

/**
 * Helper function to register checkout script for authenticated shop
 */
export async function registerCheckoutScriptForShop(
  request: Request,
  scriptUrl?: string
): Promise<ScriptTagResponse | null> {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    const finalScriptUrl = scriptUrl || `${new URL(request.url).origin}/checkout-enforcement.js`;
    
    return await registerCheckoutScript(admin, session.shop, finalScriptUrl);

  } catch (error) {
    logger.error("Failed to register checkout script for shop", {
      error: error instanceof Error ? error.message : String(error),
      component: "scriptTag"
    });
    throw error;
  }
}

/**
 * Get script tag status for dashboard
 */
export async function getScriptTagStatus(
  admin: any,
  shopDomain: string
): Promise<{
  hasCheckoutScript: boolean;
  scriptCount: number;
  scripts: any[];
}> {
  try {
    const scripts = await getExistingScriptTags(admin, shopDomain);
    const returnsXScripts = scripts.filter((script: any) => 
      script.src.includes('returnsx') || 
      script.src.includes('checkout-enforcement') ||
      script.display_scope === 'checkout'
    );

    return {
      hasCheckoutScript: returnsXScripts.length > 0,
      scriptCount: returnsXScripts.length,
      scripts: returnsXScripts
    };

  } catch (error) {
    logger.error("Failed to get script tag status", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
      component: "scriptTag"
    });
    
    return {
      hasCheckoutScript: false,
      scriptCount: 0,
      scripts: []
    };
  }
} 