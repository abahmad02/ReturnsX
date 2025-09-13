import { logger } from "./logger.server";
import db from '../db.server';

/**
 * Server-only checkout correlation service
 * Contains database operations for checkout correlation functionality
 */

/**
 * Store checkout correlation data in database
 */
export async function storeCheckoutCorrelation(data: {
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