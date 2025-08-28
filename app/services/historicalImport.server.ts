import { authenticate } from "../shopify.server";
import { getOrCreateCustomerProfile, recordOrderEvent } from "./customerProfile.server";

/**
 * ReturnsX Historical Data Import Service
 * 
 * Imports historical order data from Shopify to populate customer risk profiles
 * Handles pagination and rate limiting for large datasets
 */

export interface ImportOptions {
  shopDomain: string;
  accessToken: string;
  limitPerPage?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface ImportProgress {
  totalOrders: number;
  processedOrders: number;
  profilesCreated: number;
  profilesUpdated: number;
  errors: string[];
  isComplete: boolean;
  lastProcessedOrderId?: string;
}

/**
 * Import historical orders from Shopify REST Admin API
 */
export async function importHistoricalOrders(
  options: ImportOptions,
  progressCallback?: (progress: ImportProgress) => void
): Promise<ImportProgress> {
  const {
    shopDomain,
    accessToken,
    limitPerPage = 50,
    startDate,
    endDate,
    status = "any"
  } = options;

  const progress: ImportProgress = {
    totalOrders: 0,
    processedOrders: 0,
    profilesCreated: 0,
    profilesUpdated: 0,
    errors: [],
    isComplete: false,
  };

  try {
    console.log(`Starting historical import for shop: ${shopDomain}`);

    // First, get a count of total orders to track progress
    const countUrl = new URL(`https://${shopDomain}/admin/api/2025-01/orders/count.json`);
    if (startDate) countUrl.searchParams.set('created_at_min', startDate);
    if (endDate) countUrl.searchParams.set('created_at_max', endDate);
    countUrl.searchParams.set('status', status);

    const countResponse = await fetch(countUrl.toString(), {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (countResponse.ok) {
      const countData = await countResponse.json();
      progress.totalOrders = countData.count || 0;
      console.log(`Found ${progress.totalOrders} orders to import`);
    }

    // Import orders in batches with pagination
    let hasNextPage = true;
    let pageInfo = null;
    let sinceId = null;

    while (hasNextPage) {
      try {
        // Build URL for fetching orders
        const ordersUrl = new URL(`https://${shopDomain}/admin/api/2025-01/orders.json`);
        ordersUrl.searchParams.set('limit', limitPerPage.toString());
        ordersUrl.searchParams.set('status', status);
        
        if (startDate) ordersUrl.searchParams.set('created_at_min', startDate);
        if (endDate) ordersUrl.searchParams.set('created_at_max', endDate);
        
        // Use cursor-based pagination
        if (sinceId) {
          ordersUrl.searchParams.set('since_id', sinceId);
        }

        const ordersResponse = await fetch(ordersUrl.toString(), {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!ordersResponse.ok) {
          throw new Error(`Failed to fetch orders: ${ordersResponse.status} ${ordersResponse.statusText}`);
        }

        const ordersData = await ordersResponse.json();
        const orders = ordersData.orders || [];

        if (orders.length === 0) {
          hasNextPage = false;
          break;
        }

        console.log(`Processing batch of ${orders.length} orders...`);

        // Process each order in the batch
        for (const order of orders) {
          try {
            await processHistoricalOrder(order, shopDomain);
            progress.processedOrders++;
            progress.lastProcessedOrderId = order.id?.toString();
          } catch (orderError) {
            console.error(`Error processing order ${order.id}:`, orderError);
            progress.errors.push(`Order ${order.id}: ${orderError}`);
          }
        }

        // Update pagination
        sinceId = orders[orders.length - 1]?.id?.toString();
        hasNextPage = orders.length === limitPerPage;

        // Call progress callback if provided
        if (progressCallback) {
          progressCallback(progress);
        }

        // Rate limiting - pause between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (batchError) {
        console.error('Error processing batch:', batchError);
        progress.errors.push(`Batch error: ${batchError}`);
        break;
      }
    }

    progress.isComplete = true;
    console.log(`Historical import completed. Processed: ${progress.processedOrders}, Errors: ${progress.errors.length}`);

  } catch (error) {
    console.error('Error in historical import:', error);
    progress.errors.push(`Import error: ${error}`);
    progress.isComplete = true;
  }

  return progress;
}

/**
 * Process a single historical order and create/update customer profile
 */
async function processHistoricalOrder(order: any, shopDomain: string): Promise<void> {
  const {
    id: shopifyOrderId,
    customer,
    billing_address,
    shipping_address,
    total_price,
    currency,
    financial_status,
    fulfillment_status,
    cancel_reason,
    cancelled_at,
    created_at,
    updated_at,
    refunds = [],
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
    // Skip orders without customer identifiers
    return;
  }

  try {
    // Get or create customer profile
    const customerProfile = await getOrCreateCustomerProfile({
      phone,
      email,
      address: address || undefined,
    }, shopDomain);

    // Record the order creation event
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
          created_at,
          is_historical: true,
        },
      },
      shopDomain
    );

    // Record cancellation if applicable
    if (cancelled_at && cancel_reason) {
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: "ORDER_CANCELLED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          cancelReason: cancel_reason,
          eventData: {
            cancelled_at,
            customer_id: customer?.id,
            is_historical: true,
          },
        },
        shopDomain
      );
    }

    // Record fulfillment if applicable
    if (fulfillment_status === "fulfilled") {
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: "ORDER_DELIVERED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          fulfillmentStatus: fulfillment_status,
          eventData: {
            customer_id: customer?.id,
            is_historical: true,
          },
        },
        shopDomain
      );
    }

    // Record refunds if any
    for (const refund of refunds) {
      await recordOrderEvent(
        customerProfile,
        {
          shopifyOrderId: shopifyOrderId.toString(),
          eventType: "ORDER_REFUNDED",
          orderValue: parseFloat(total_price || "0"),
          currency,
          refundAmount: parseFloat(refund.amount || "0"),
          eventData: {
            refund_id: refund.id,
            refund_reason: refund.reason,
            customer_id: customer?.id,
            is_historical: true,
          },
        },
        shopDomain
      );
    }

  } catch (error) {
    // Log the specific error for debugging
    console.error(`Error processing historical order ${shopifyOrderId}:`, error);
    throw new Error(`Failed to process order ${shopifyOrderId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Import historical orders using authenticated admin session
 */
export async function importHistoricalOrdersForAuthenticatedShop(
  request: Request,
  options: Partial<ImportOptions> = {}
): Promise<ImportProgress> {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!session.accessToken) {
      throw new Error('No access token available for historical import');
    }

    const importOptions: ImportOptions = {
      shopDomain: session.shop,
      accessToken: session.accessToken,
      limitPerPage: 50,
      status: "any",
      ...options,
    };

    return await importHistoricalOrders(importOptions);

  } catch (error) {
    console.error('Error importing historical orders for authenticated shop:', error);
    return {
      totalOrders: 0,
      processedOrders: 0,
      profilesCreated: 0,
      profilesUpdated: 0,
      errors: [error?.toString() || 'Unknown authentication error'],
      isComplete: true,
    };
  }
}

/**
 * Get import status/progress (for background job monitoring)
 */
export async function getImportStatus(shopDomain: string): Promise<ImportProgress | null> {
  // TODO: Implement import status tracking using database or cache
  // For now, return null indicating no active import
  return null;
} 