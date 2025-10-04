/**
 * Example integration of RequestDeduplicator with the API route
 * This demonstrates how to use the deduplication service in practice
 */

import { requestDeduplicator, type RequestParams } from './requestDeduplicator.server';
import { getCheckoutCorrelation } from './checkoutCorrelation.server';
import { getCustomerProfileByPhone } from './customerProfile.server';
import { logger } from './logger.server';

/**
 * Example of how to integrate RequestDeduplicator into the API route
 * This would replace the direct calls in the loader function
 */
export async function getOrderDataWithDeduplication(
  checkoutToken: string | null,
  customerPhone: string | null,
  orderName: string | null,
  orderId: string | null
): Promise<any> {
  // Create request parameters for deduplication key generation
  const requestParams: RequestParams = {
    checkoutToken: checkoutToken || undefined,
    customerPhone: customerPhone || undefined,
    orderName: orderName || undefined,
    orderId: orderId || undefined,
  };

  // Generate unique key for this request
  const requestKey = requestDeduplicator.generateRequestKey(requestParams);

  logger.info("Processing order data request", {
    component: "getOrderDataWithDeduplication",
    requestKey: requestKey.substring(0, 8) + "...",
    isDuplicate: requestDeduplicator.isDuplicateRequest(requestKey),
    checkoutToken: checkoutToken ? `${checkoutToken.slice(0, 8)}...` : "none",
    customerPhone: customerPhone ? `${customerPhone.slice(0, 3)}***` : "none",
  });

  // Use deduplicator to handle the request
  return await requestDeduplicator.registerRequest(
    requestKey,
    async () => {
      logger.info("Executing actual order data retrieval", {
        component: "getOrderDataWithDeduplication",
        requestKey: requestKey.substring(0, 8) + "...",
      });

      // This is the actual business logic that would be deduplicated
      return await performOrderDataRetrieval(
        checkoutToken,
        customerPhone,
        orderName,
        orderId
      );
    }
  );
}

/**
 * The actual order data retrieval logic (extracted from the original function)
 * This is what gets deduplicated
 */
async function performOrderDataRetrieval(
  checkoutToken: string | null,
  customerPhone: string | null,
  orderName: string | null,
  orderId: string | null
): Promise<any> {
  let customerData = null;
  let orderInfo = null;

  // Try to get correlation data by checkout token first
  if (checkoutToken) {
    const correlation = await getCheckoutCorrelation(checkoutToken);
    if (correlation) {
      orderInfo = {
        orderId: correlation.orderId,
        orderName: correlation.orderName,
        totalAmount: correlation.totalAmount,
        currency: correlation.currency,
        customerEmail: correlation.customerEmail,
        customerPhone: correlation.customerPhone,
        customerId: correlation.customerId
      };
      
      // If we have customer phone from correlation, fetch their profile
      if (correlation.customerPhone) {
        customerData = await getCustomerProfileByPhone(correlation.customerPhone);
      }
    }
  }

  // If no data yet and we have customerPhone, try direct customer lookup
  if (!customerData && customerPhone) {
    customerData = await getCustomerProfileByPhone(customerPhone);
  }

  return {
    orderInfo,
    customerData,
    metadata: {
      timestamp: new Date().toISOString(),
      requestParams: { checkoutToken, customerPhone, orderName, orderId }
    }
  };
}

/**
 * Example usage in a Remix loader function
 */
export async function exampleLoaderWithDeduplication({ request }: { request: Request }) {
  const url = new URL(request.url);
  const checkoutToken = url.searchParams.get("checkoutToken");
  const customerPhone = url.searchParams.get("customerPhone");
  const orderName = url.searchParams.get("orderName");
  const orderId = url.searchParams.get("orderId");

  try {
    // Use the deduplicated version
    const result = await getOrderDataWithDeduplication(
      checkoutToken,
      customerPhone,
      orderName,
      orderId
    );

    // Get deduplication statistics for monitoring
    const stats = requestDeduplicator.getStats();
    
    logger.info("Request completed", {
      component: "exampleLoaderWithDeduplication",
      deduplicationStats: stats,
      hasResult: !!result
    });

    return new Response(JSON.stringify({
      ...result,
      _meta: {
        deduplicationStats: stats,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
      }
    });

  } catch (error) {
    logger.error("Error in deduplicated loader", {
      component: "exampleLoaderWithDeduplication",
      error: error instanceof Error ? error.message : String(error)
    });

    return new Response(JSON.stringify({
      error: "Internal server error",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
      }
    });
  }
}

/**
 * Utility function to demonstrate concurrent request handling
 */
export async function demonstrateConcurrentRequests() {
  const params: RequestParams = {
    checkoutToken: "demo-token-123",
    customerPhone: "3001234567"
  };

  console.log("Starting 5 concurrent requests with identical parameters...");

  const startTime = Date.now();
  
  // Start 5 concurrent requests with the same parameters
  const promises = Array.from({ length: 5 }, (_, i) =>
    getOrderDataWithDeduplication(
      params.checkoutToken!,
      params.customerPhone!,
      null,
      null
    ).then(result => ({
      requestIndex: i,
      result,
      completedAt: Date.now()
    }))
  );

  const results = await Promise.all(promises);
  const endTime = Date.now();

  console.log("All requests completed:", {
    totalTime: endTime - startTime,
    results: results.map(r => ({
      requestIndex: r.requestIndex,
      completedAt: r.completedAt - startTime,
      hasResult: !!r.result
    })),
    deduplicationStats: requestDeduplicator.getStats()
  });

  return results;
}

/**
 * Health check function that includes deduplication statistics
 */
export function getDeduplicationHealthCheck() {
  const stats = requestDeduplicator.getStats();
  
  return {
    service: "RequestDeduplicator",
    status: "healthy",
    statistics: stats,
    timestamp: new Date().toISOString(),
    checks: {
      pendingRequestsWithinLimit: stats.pendingRequests < 100,
      cachedTimestampsWithinLimit: stats.cachedTimestamps < 1000,
      hasRecentActivity: stats.newestPendingRequest ? 
        (Date.now() - stats.newestPendingRequest) < 60000 : true
    }
  };
}