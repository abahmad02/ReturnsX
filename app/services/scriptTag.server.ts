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
    
    logger.info("Existing script tags check", {
      shopDomain,
      totalScripts: existingScripts.length,
      scripts: existingScripts.map(s => ({ id: s.id, src: s.src, event: s.event, display_scope: s.display_scope })),
      component: "scriptTag"
    });
    
    const existingScript = existingScripts.find((script: any) => 
      script.src.includes('checkout-enforcement') || 
      script.src === scriptUrl ||
      script.src.includes('returnsx') ||
      script.src.includes('cod-risk')
    );

    if (existingScript) {
      logger.info("Checkout script already exists", {
        shopDomain,
        scriptId: existingScript.id,
        existingUrl: existingScript.src,
        component: "scriptTag"
      });
      return { script_tag: existingScript };
    }

    // Check script tag limits (Shopify allows max 20 script tags per shop)
    if (existingScripts.length >= 20) {
      const errorMsg = `Cannot register script: shop has reached maximum limit of 20 script tags (current: ${existingScripts.length})`;
      logger.error(errorMsg, {
        shopDomain,
        currentScriptCount: existingScripts.length,
        component: "scriptTag"
      });
      throw new Error(errorMsg);
    }

    // Create new script tag
    const scriptTagData = {
      script_tag: {
        event: "onload",
        src: scriptUrl,
        display_scope: "all",
        cache: true
      }
    };

    logger.info("Creating script tag with data", {
      shopDomain,
      scriptTagData,
      component: "scriptTag"
    });

    const response = await admin.rest.post({
      path: "script_tags",
      data: scriptTagData
    });

    logger.info("Script registration API response", {
      shopDomain,
      status: response.status,
      responseKeys: Object.keys(response),
      bodyType: typeof response.body,
      bodyConstructor: response.body?.constructor?.name,
      component: "scriptTag"
    });

    // Read the ReadableStream to get the actual JSON data
    let result: any;
    
    if (response.body && response.body.constructor?.name === 'ReadableStream') {
      try {
        // Read the stream
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        // Convert chunks to text
        const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, offset);
          offset += chunk.length;
        }
        
        const text = new TextDecoder().decode(allChunks);
        result = JSON.parse(text);
        
        logger.info("Successfully parsed ReadableStream response", {
          shopDomain,
          parsedResult: result,
          component: "scriptTag"
        });
        
      } catch (streamError) {
        logger.error("Failed to read ReadableStream", {
          shopDomain,
          error: streamError instanceof Error ? streamError.message : String(streamError),
          component: "scriptTag"
        });
        throw new Error(`Failed to read API response: ${streamError}`);
      }
    } else {
      // Fallback for other response types
      result = response.body || response.data || response;
    }

    // Handle different response structures
    let scriptTag = null;

    if (result?.script_tag) {
      scriptTag = result.script_tag;
    } else if (result?.id) {
      // Sometimes Shopify returns the script tag object directly
      scriptTag = result;
    } else {
      logger.error("Unexpected response structure from script tag API", {
        shopDomain,
        responseBody: result,
        component: "scriptTag"
      });
      throw new Error("Invalid response structure from Shopify API");
    }
    
    logger.info("Checkout script registered successfully", {
      shopDomain,
      scriptId: scriptTag.id,
      scriptUrl: scriptTag.src,
      event: scriptTag.event,
      displayScope: scriptTag.display_scope,
      component: "scriptTag"
    });

    return { script_tag: scriptTag };

  } catch (error: any) {
    let errorMessage = "Unknown error";
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
          // If we can't parse the response body, just include the raw body
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
      // Handle other objects by trying to extract useful information
      errorMessage = error.toString();
      errorDetails = { errorObject: error };
    } else {
      errorMessage = String(error);
    }
    
    logger.error("Failed to register checkout script", {
      shopDomain,
      scriptUrl,
      error: errorMessage,
      ...errorDetails,
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