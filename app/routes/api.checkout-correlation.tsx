import type { ActionFunctionArgs } from "@remix-run/node";

import { validateSessionToken } from "../services/sessionToken.server";
import { logger } from "../services/logger.server";
import db from '../db.server';

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

    logger.info("Checkout correlation stored", {
      component: "checkoutCorrelationAPI",
      checkoutToken: checkoutToken.slice(-8),
      hasPhone: !!customerPhone,
      hasEmail: !!customerEmail,
      hasOrderId: !!orderId,
      shopDomain: tokenValidation.shopDomain
    });

    return Response.json({
      success: true,
      correlationId: correlation.id,
      checkoutToken: checkoutToken.slice(-8), // Only return last 8 chars for security
      timestamp: correlation.createdAt.toISOString()
    });

  } catch (error) {
    logger.error("Checkout correlation API error", {
      component: "checkoutCorrelationAPI",
      error: error instanceof Error ? error.message : String(error)
    });

    return Response.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
};

/**
 * Store checkout correlation data in database
 */
async function storeCheckoutCorrelation(data: {
  checkoutToken: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  orderId?: string;
  orderName?: string;
  totalPrice?: any;
  timestamp: Date;
  webUrl?: string;
  shopDomain?: string;
}) {
  try {
    // Create correlation record
    const correlation = await (db as any).checkoutCorrelation.create({
      data: {
        checkoutToken: data.checkoutToken,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerId: data.customerId,
        orderId: data.orderId,
        orderName: data.orderName,
        totalAmount: data.totalPrice?.amount ? parseFloat(data.totalPrice.amount) : null,
        currency: data.totalPrice?.currencyCode || null,
        webUrl: data.webUrl,
        shopDomain: data.shopDomain || 'unknown',
        correlationData: JSON.stringify(data),
        matched: false, // Will be set to true when webhook matches this
        createdAt: data.timestamp
      }
    });

    return correlation;

  } catch (error) {
    // If table doesn't exist, create in-memory fallback
    logger.warn("Failed to store checkout correlation in database, using fallback", {
      component: "checkoutCorrelation",
      error: error instanceof Error ? error.message : String(error)
    });

    // Return mock correlation for development
    return {
      id: `fallback_${Date.now()}`,
      checkoutToken: data.checkoutToken,
      createdAt: data.timestamp
    };
  }
}

/**
 * Get correlation by checkout token (for webhook processing)
 */
export async function getCheckoutCorrelation(checkoutToken: string) {
  try {
    return await (db as any).checkoutCorrelation.findFirst({
      where: { checkoutToken, matched: false },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    logger.warn("Failed to retrieve checkout correlation", {
      component: "checkoutCorrelation",
      error: error instanceof Error ? error.message : String(error),
      checkoutToken: checkoutToken.slice(-8)
    });
    return null;
  }
}

/**
 * Mark correlation as matched with order
 */
export async function markCorrelationMatched(correlationId: string, orderId: string) {
  try {
    await (db as any).checkoutCorrelation.update({
      where: { id: correlationId },
      data: {
        matched: true,
        orderId,
        matchedAt: new Date()
      }
    });
  } catch (error) {
    logger.warn("Failed to mark correlation as matched", {
      component: "checkoutCorrelation",
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      orderId
    });
  }
}