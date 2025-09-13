import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { validateSessionToken } from "../services/sessionToken.server";
import { getRiskProfile, createCustomerHash } from "../services/riskAssessment.server";
import { logger } from "../services/logger.server";

/**
 * Secure Risk Profile API Endpoint
 * 
 * Handles requests from both Customer Account UI Extensions and Post-Purchase Extensions
 * with proper authentication and privacy controls
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    const email = url.searchParams.get('email');
    const customerId = url.searchParams.get('customerId');
    const checkoutToken = url.searchParams.get('checkoutToken');
    const context = url.searchParams.get('context') || 'customer-account';

    // Authentication validation
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn("Risk profile API: Missing or invalid authorization header", {
        component: "riskProfileAPI",
        context,
        hasPhone: !!phone
      });

      return json({
        success: false,
        error: "Authentication required",
        riskTier: "ZERO_RISK",
        riskScore: 0
      }, { status: 401 });
    }

    const sessionToken = authHeader.replace('Bearer ', '');

    // Validate session token authenticity
    let tokenValidation;
    try {
      tokenValidation = await validateSessionToken(sessionToken, request);
      
      if (!tokenValidation.valid) {
        throw new Error('Invalid session token');
      }
    } catch (err) {
      logger.warn("Risk profile API: Session token validation failed", {
        component: "riskProfileAPI",
        error: err instanceof Error ? err.message : String(err),
        context
      });

      return json({
        success: false,
        error: "Invalid session token",
        riskTier: "ZERO_RISK",
        riskScore: 0
      }, { status: 401 });
    }

    // Verify shop authentication for additional security
    let shopSession;
    try {
      const { session } = await authenticate.public.appProxy(request);
      shopSession = session;
    } catch (err) {
      // For extensions, fall back to session token validation
      logger.info("Risk profile API: Using session token auth (extension context)", {
        component: "riskProfileAPI",
        context
      });
    }

    // Privacy validation - ensure we have customer identification
    if (!phone && !email && !customerId) {
      logger.warn("Risk profile API: No customer identification provided", {
        component: "riskProfileAPI",
        context,
        shopDomain: shopSession?.shop
      });

      return json({
        success: false,
        error: "Customer identification required",
        isNewCustomer: true,
        riskTier: "ZERO_RISK",
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        message: "Welcome! You are classified as a Zero Risk customer."
      });
    }

    // Get risk profile data
    let riskProfile;
    try {
      // Create hashed identifier for privacy
      const identifier = phone || email || customerId;
      const hashedIdentifier = await createCustomerHash(identifier);

      riskProfile = await getRiskProfile({
        hashedPhone: phone ? await createCustomerHash(phone) : null,
        hashedEmail: email ? await createCustomerHash(email) : null,
        customerId,
        checkoutToken,
        shopDomain: shopSession?.shop || tokenValidation.shopDomain,
        context
      });

      logger.info("Risk profile retrieved successfully", {
        component: "riskProfileAPI",
        riskTier: riskProfile.riskTier,
        totalOrders: riskProfile.totalOrders,
        context,
        shopDomain: shopSession?.shop || tokenValidation.shopDomain
      });

    } catch (err) {
      logger.error("Risk profile API: Failed to retrieve risk data", {
        component: "riskProfileAPI",
        error: err instanceof Error ? err.message : String(err),
        context,
        hasPhone: !!phone,
        hasEmail: !!email
      });

      // Return safe fallback for new customers
      return json({
        success: true,
        isNewCustomer: true,
        riskTier: "ZERO_RISK",
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        message: "Welcome! You are a new customer with Zero Risk status."
      });
    }

    // Privacy filtering based on authentication level
    const sanitizedProfile = sanitizeProfileForContext(riskProfile, context, tokenValidation);

    return json({
      success: true,
      ...sanitizedProfile,
      timestamp: new Date().toISOString(),
      context
    });

  } catch (error) {
    logger.error("Risk profile API: Unexpected error", {
      component: "riskProfileAPI",
      error: error instanceof Error ? error.message : String(error)
    });

    return json({
      success: false,
      error: "Internal server error",
      riskTier: "ZERO_RISK",
      riskScore: 0
    }, { status: 500 });
  }
};

/**
 * Sanitize profile data based on context and authentication level
 */
function sanitizeProfileForContext(profile: any, context: string, tokenValidation: any) {
  // Base profile data always available
  const baseProfile = {
    riskTier: profile.riskTier,
    riskScore: profile.riskScore,
    totalOrders: profile.totalOrders,
    failedAttempts: profile.failedAttempts,
    successfulDeliveries: profile.successfulDeliveries,
    isNewCustomer: profile.isNewCustomer || false,
    message: profile.message
  };

  // Additional data for authenticated contexts
  if (tokenValidation.authenticated && context === 'customer-account') {
    return {
      ...baseProfile,
      lastOrderDate: profile.lastOrderDate,
      riskFactors: profile.riskFactors,
      improvementTips: profile.improvementTips,
      phone: profile.phone ? `***-***-${profile.phone.slice(-4)}` : undefined // Partial phone for display
    };
  }

  // Limited data for post-purchase context
  if (context === 'post-purchase') {
    return {
      ...baseProfile,
      // Only basic stats for post-purchase display
      message: profile.isNewCustomer 
        ? "Welcome! You are a new customer with Zero Risk status."
        : `Your current risk level is ${profile.riskTier.replace('_', ' ').toLowerCase()}.`
    };
  }

  return baseProfile;
}