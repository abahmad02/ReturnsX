import type { ActionFunctionArgs } from "@remix-run/node";

import { validateSessionToken } from "../services/sessionToken.server";
import { storeCheckoutCorrelation } from "../services/checkoutCorrelation.server";

/**
 * Checkout Correlation API Endpoint
 * 
 * Stores checkout token correlation data for later matching with order webhooks
 * This allows us to connect post-purchase extension context with actual order data
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Authentication validation
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({
        success: false,
        error: "Authentication required"
      }, { status: 401 });
    }

    const sessionToken = authHeader.replace('Bearer ', '');
    const tokenValidation = await validateSessionToken(sessionToken, request);
    
    if (!tokenValidation.valid) {
      return Response.json({
        success: false,
        error: "Invalid session token"
      }, { status: 401 });
    }

    // Parse request data
    const correlationData = await request.json();
    
    const {
      checkoutToken,
      customerPhone,
      customerEmail,
      customerId,
      orderId,
      orderName,
      totalPrice,
      timestamp,
      webUrl
    } = correlationData;

    // Validate required fields
    if (!checkoutToken) {
      return Response.json({
        success: false,
        error: "Checkout token is required"
      }, { status: 400 });
    }

    // Store checkout correlation in database
    const correlation = await storeCheckoutCorrelation({
      checkoutToken,
      customerPhone,
      customerEmail,
      customerId,
      orderId,
      orderName,
      totalPrice,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      webUrl,
      shopDomain: tokenValidation.shopDomain
    });

    return Response.json({
      success: true,
      correlationId: correlation.id,
      checkoutToken: checkoutToken.slice(-8), // Only return last 8 chars for security
      timestamp: correlation.createdAt.toISOString()
    });

  } catch (error) {
    console.error("Checkout correlation API error:", error);
    return Response.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
};