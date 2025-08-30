import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { getCustomerProfileByPhone } from "../services/customerProfile.server";
import { calculateRiskScore } from "../services/riskScoring.server";
import { logger } from "../services/logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    
    const orderId = url.searchParams.get("orderId");
    const phone = url.searchParams.get("phone");
    const email = url.searchParams.get("email");

    if (!orderId || (!phone && !email)) {
      return json({
        success: false,
        error: "Missing required parameters: orderId and (phone or email)"
      }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;
    
    // Get customer profile by phone number
    const customerProfile = await getCustomerProfileByPhone(normalizedPhone || '');
    
    if (!customerProfile) {
      return json({
        success: true,
        orderId,
        riskAssessment: {
          riskTier: "ZERO_RISK",
          riskScore: 0,
          isNewCustomer: true,
          totalOrders: 0,
          failedAttempts: 0,
          returnRate: 0,
          recommendation: "Proceed with normal processing"
        }
      });
    }

    // Calculate current risk score
    const riskCalculation = await calculateRiskScore(customerProfile, session.shop, {});

    return json({
      success: true,
      orderId,
      riskAssessment: {
        riskTier: riskCalculation.riskTier,
        riskScore: riskCalculation.riskScore,
        confidence: riskCalculation.confidence,
        recommendation: riskCalculation.recommendation,
        isNewCustomer: customerProfile.totalOrders === 0,
        totalOrders: customerProfile.totalOrders,
        failedAttempts: customerProfile.failedAttempts,
        successfulDeliveries: customerProfile.successfulDeliveries,
        returnRate: customerProfile.returnRate,
        lastEventAt: customerProfile.lastEventAt,
        riskFactors: (riskCalculation as any).riskFactors || []
      }
    });

  } catch (error) {
    logger.error("Failed to assess order risk", {
      error: error instanceof Error ? error.message : String(error),
      component: "orderRiskAssessment"
    });

    return json({
      success: false,
      error: "Failed to assess order risk"
    }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    
    const orderId = formData.get("orderId") as string;
    const riskOverride = formData.get("riskOverride") as string;
    const notes = formData.get("notes") as string;

    if (!orderId || !riskOverride) {
      return json({
        success: false,
        error: "Missing required parameters"
      }, { status: 400 });
    }

    // Log the risk override for this order
    logger.info("Order risk override applied", {
      orderId,
      riskOverride,
      notes,
      shopDomain: session.shop,
      adminUserId: session.id,
      component: "orderRiskAssessment"
    });

    return json({
      success: true,
      message: "Risk override applied successfully",
      orderId,
      riskOverride
    });

  } catch (error) {
    logger.error("Failed to apply order risk override", {
      error: error instanceof Error ? error.message : String(error),
      component: "orderRiskAssessment"
    });

    return json({
      success: false,
      error: "Failed to apply risk override"
    }, { status: 500 });
  }
}; 