import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getHighRiskCustomers, applyManualOverride } from "../services/customerProfile.server";
import { getRiskDistributionStats } from "../services/riskScoring.server";
import { logger } from "../services/logger.server";

/**
 * GET /api/high-risk-customers - Get list of high-risk customers
 * POST /api/high-risk-customers/override - Apply manual override to customer
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const [highRiskCustomers, riskStats] = await Promise.all([
      getHighRiskCustomers(session.shop, limit),
      getRiskDistributionStats(session.shop),
    ]);

    // Format customer data for dashboard display
    const formattedCustomers = highRiskCustomers.map((customer: any) => ({
      id: customer.id,
      phone: customer.phone ? customer.phone.substring(0, 3) + "***" : "N/A", // Partial phone for privacy
      email: customer.email || "N/A",
      riskScore: customer.riskScore,
      riskTier: customer.riskTier,
      totalOrders: customer.totalOrders,
      failedAttempts: customer.failedAttempts,
      successfulDeliveries: customer.successfulDeliveries,
      returnRate: customer.returnRate,
      lastEventAt: customer.lastEventAt,
      recentEvents: customer.orderEvents?.slice(0, 3).map((event: any) => ({
        eventType: event.eventType,
        orderValue: event.orderValue,
        currency: event.currency,
        cancelReason: event.cancelReason,
        createdAt: event.createdAt,
      })),
    }));

    return json({
      success: true,
      customers: formattedCustomers,
      stats: riskStats,
      totalHighRisk: riskStats.distribution.highRisk,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    logger.error("Error fetching high-risk customers", {
    }, error instanceof Error ? error : new Error(String(error)));

    return json(
      { error: "Failed to fetch high-risk customers" },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    const {
      customerProfileId,
      overrideType,
      newValue,
      reason,
    } = body;

    // Validate required fields
    if (!customerProfileId || !overrideType) {
      return json(
        { error: "Customer profile ID and override type are required" },
        { status: 400 }
      );
    }

    // Validate override type
    const validOverrideTypes = ["RESET_FAILED_ATTEMPTS", "CHANGE_RISK_TIER", "FORGIVE_CUSTOMER"];
    if (!validOverrideTypes.includes(overrideType)) {
      return json(
        { error: "Invalid override type" },
        { status: 400 }
      );
    }

    // Apply manual override
    const updatedProfile = await applyManualOverride(
      customerProfileId,
      session.shop,
      overrideType,
      newValue || "",
      session.id, // Admin user ID from session
      reason
    );

    logger.info("Manual override applied by merchant", {
      customerProfileId,
      shopDomain: session.shop,
      overrideType,
      adminUserId: session.id,
      reason: reason || "No reason provided",
    });

    return json({
      success: true,
      message: "Override applied successfully",
      customer: {
        id: updatedProfile.id,
        riskScore: updatedProfile.riskScore,
        riskTier: updatedProfile.riskTier,
        totalOrders: updatedProfile.totalOrders,
        failedAttempts: updatedProfile.failedAttempts,
        successfulDeliveries: updatedProfile.successfulDeliveries,
        returnRate: updatedProfile.returnRate,
        lastEventAt: updatedProfile.lastEventAt,
      },
    });

  } catch (error) {
    logger.error("Error applying manual override", {
    }, error instanceof Error ? error : new Error(String(error)));

    return json(
      { error: "Failed to apply manual override" },
      { status: 500 }
    );
  }
} 