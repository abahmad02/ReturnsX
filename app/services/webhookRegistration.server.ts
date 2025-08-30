import { authenticate } from "../shopify.server";

/**
 * ReturnsX Webhook Registration Service
 * 
 * Manages registration and deregistration of Shopify webhooks
 * for real-time order tracking and risk assessment
 */

export interface WebhookConfig {
  topic: string;
  endpoint: string;
  format?: string;
}

// Define the webhooks ReturnsX needs to track customer behavior
export const RETURNSX_WEBHOOKS: WebhookConfig[] = [
  {
    topic: "orders/create",
    endpoint: "/webhooks/orders/created",
    format: "json"
  },
  {
    topic: "orders/paid",
    endpoint: "/webhooks/orders/paid",
    format: "json"
  },
  {
    topic: "orders/updated", 
    endpoint: "/webhooks/orders/updated",
    format: "json"
  },
  {
    topic: "orders/cancelled",
    endpoint: "/webhooks/orders/cancelled", 
    format: "json"
  },
  {
    topic: "orders/fulfilled",
    endpoint: "/webhooks/orders/fulfilled",
    format: "json"
  },
  {
    topic: "refunds/create",
    endpoint: "/webhooks/refunds/created",
    format: "json"
  }
];

/**
 * Register all ReturnsX webhooks for a shop
 * Called during app installation or manual refresh
 */
export async function registerReturnxWebhooks(
  shop: string, 
  accessToken: string,
  appUrl: string
): Promise<{ success: boolean; registered: string[]; errors: string[] }> {
  const registered: string[] = [];
  const errors: string[] = [];

  console.log(`Registering ReturnsX webhooks for shop: ${shop}`);

  for (const webhook of RETURNSX_WEBHOOKS) {
    try {
      const webhookUrl = `${appUrl}${webhook.endpoint}`;
      
      const response = await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: webhook.topic,
            address: webhookUrl,
            format: webhook.format || 'json',
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✓ Registered webhook: ${webhook.topic} -> ${webhookUrl}`);
        registered.push(webhook.topic);
      } else {
        const errorText = await response.text();
        console.error(`✗ Failed to register webhook: ${webhook.topic}`, errorText);
        errors.push(`${webhook.topic}: ${errorText}`);
      }
    } catch (error) {
      console.error(`✗ Error registering webhook: ${webhook.topic}`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${webhook.topic}: ${errorMessage}`);
    }
  }

  console.log(`Webhook registration completed. Success: ${registered.length}, Errors: ${errors.length}`);
  
  return {
    success: errors.length === 0,
    registered,
    errors,
  };
}

/**
 * Get existing webhooks for a shop
 */
export async function getExistingWebhooks(
  shop: string,
  accessToken: string
): Promise<any[]> {
  try {
    const response = await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result.webhooks || [];
    } else {
      console.error('Failed to fetch existing webhooks:', await response.text());
      return [];
    }
  } catch (error) {
    console.error('Error fetching existing webhooks:', error);
    return [];
  }
}

/**
 * Delete a specific webhook
 */
export async function deleteWebhook(
  shop: string,
  accessToken: string,
  webhookId: string
): Promise<boolean> {
  try {
    const response = await fetch(`https://${shop}/admin/api/2025-01/webhooks/${webhookId}.json`, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return false;
  }
}

/**
 * Clean up existing ReturnsX webhooks and re-register
 * Useful for updating webhook URLs during development
 */
export async function refreshReturnxWebhooks(
  shop: string,
  accessToken: string,
  appUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Refreshing ReturnsX webhooks for shop: ${shop}`);

    // Get existing webhooks
    const existingWebhooks = await getExistingWebhooks(shop, accessToken);
    
    // Find and delete existing ReturnsX webhooks
    const returnxTopics = RETURNSX_WEBHOOKS.map(w => w.topic);
    const returnxWebhooks = existingWebhooks.filter(webhook => 
      returnxTopics.includes(webhook.topic) || 
      webhook.address?.includes('/webhooks/')
    );

    console.log(`Found ${returnxWebhooks.length} existing ReturnsX webhooks to remove`);

    for (const webhook of returnxWebhooks) {
      await deleteWebhook(shop, accessToken, webhook.id);
      console.log(`Deleted webhook: ${webhook.topic} (${webhook.id})`);
    }

    // Register fresh webhooks
    const result = await registerReturnxWebhooks(shop, accessToken, appUrl);
    
    return {
      success: result.success,
      message: `Refreshed webhooks. Registered: ${result.registered.length}, Errors: ${result.errors.length}`,
    };

  } catch (error) {
    console.error('Error refreshing webhooks:', error);
    return {
      success: false,
      message: `Failed to refresh webhooks: ${error}`,
    };
  }
}

/**
 * Verify webhook signature from Shopify
 * Critical for security - ensures webhooks are actually from Shopify
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody, 'utf8');
    const computedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature), 
      Buffer.from(computedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Register webhooks using Shopify App Bridge authentication
 * Helper function that works with authenticated admin requests
 */
export async function registerWebhooksForAuthenticatedShop(
  request: Request,
  appUrl: string
): Promise<{ success: boolean; registered: string[]; errors: string[] }> {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    if (!session.accessToken) {
      throw new Error('No access token available for webhook registration');
    }
    
    return await registerReturnxWebhooks(
      session.shop,
      session.accessToken,
      appUrl
    );
  } catch (error) {
    console.error('Error registering webhooks for authenticated shop:', error);
    return {
      success: false,
      registered: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
} 