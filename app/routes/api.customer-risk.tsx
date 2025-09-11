import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// Simple CORS helper function
function addCorsHeaders(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
import { getCustomerRiskFromDatabase } from "../services/dualTagging.server";
import { logger } from "../services/logger.server";

/**
 * API endpoint to fetch customer risk data for Order Status Page extension
 * 
 * This endpoint is called by the Shopify extension to display risk information
 * on the thank you/order status page after order completion
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");
    const email = url.searchParams.get("email");
    const orderId = url.searchParams.get("orderId");

    logger.info("Customer risk API request", {
      hasPhone: !!phone,
      hasEmail: !!email,
      orderId,
      userAgent: request.headers.get("user-agent"),
      origin: request.headers.get("origin"),
    });

    // Validate that we have at least one identifier
    if (!phone && !email) {
      const response = json({
        success: false,
        error: "Phone number or email is required",
        code: "MISSING_IDENTIFIER"
      }, { status: 400 });

      return addCorsHeaders(response);
    }

    // Get customer risk data from database
    const riskData = await getCustomerRiskFromDatabase(phone || undefined, email || undefined);

    if (!riskData) {
      // New customer - return default zero risk data
      const response = json({
        success: true,
        isNewCustomer: true,
        riskTier: "ZERO_RISK",
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        returnRate: 0,
        message: "Welcome! You are classified as a Zero Risk customer.",
        recommendations: [
          "Continue accepting deliveries on time",
          "Keep your contact information updated",
          "Enjoy full COD service with no restrictions"
        ]
      });

      return addCorsHeaders(response);
    }

    // Get additional customer profile data for display
    const profileData = await getCustomerProfileData(phone, email);

    // Generate personalized message and recommendations
    const { message, recommendations } = generateRiskMessage(riskData, profileData);

    const response = json({
      success: true,
      isNewCustomer: false,
      riskTier: riskData.riskTier,
      riskScore: riskData.riskScore,
      totalOrders: profileData?.totalOrders || 0,
      failedAttempts: profileData?.failedAttempts || 0,
      successfulDeliveries: profileData?.successfulDeliveries || 0,
      returnRate: profileData?.returnRate || 0,
      lastOrderDate: profileData?.lastEventAt,
      message,
      recommendations,
      displayInfo: getRiskDisplayInfo(riskData.riskTier)
    });

    logger.info("Customer risk data served", {
      riskTier: riskData.riskTier,
      riskScore: riskData.riskScore,
      isNewCustomer: false,
      orderId,
    });

    return addCorsHeaders(response);

  } catch (error) {
    logger.error("Error in customer risk API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const response = json({
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, { status: 500 });

    return addCorsHeaders(response);
  }
}

/**
 * Get additional customer profile data from database
 */
async function getCustomerProfileData(phone?: string, email?: string) {
  try {
    const prisma = (await import("../db.server")).default;

    // Normalize phone for database lookup
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;

    // Find customer profile in database
    const profile = await (prisma as any).customerProfile.findFirst({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ]
      },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Get recent events for context
        },
      },
    });

    return profile;
  } catch (error) {
    logger.error("Error fetching customer profile data", { phone, email }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Generate personalized message and recommendations based on risk data
 */
function generateRiskMessage(riskData: any, profileData: any) {
  const { riskTier, riskScore } = riskData;
  const totalOrders = profileData?.totalOrders || 0;
  const failedAttempts = profileData?.failedAttempts || 0;
  const successRate = totalOrders > 0 ? Math.round(((totalOrders - failedAttempts) / totalOrders) * 100) : 100;

  switch (riskTier) {
    case 'ZERO_RISK':
      return {
        message: `Excellent! With a ${successRate}% delivery success rate, you are classified as a trusted Zero Risk customer. You have full access to our Cash-on-Delivery service.`,
        recommendations: [
          "Keep up the great work! 🎉",
          "Continue accepting deliveries promptly",
          "Your reliability helps us serve you better",
          "Enjoy hassle-free COD on all orders"
        ]
      };

    case 'MEDIUM_RISK':
      return {
        message: `With ${totalOrders} orders and a ${successRate}% success rate, you are currently classified as Medium Risk. Some orders may require additional verification.`,
        recommendations: [
          "Continue accepting deliveries when they arrive",
          "Try to minimize order cancellations",
          "Keep your contact information updated",
          "Consider prepayment for faster processing"
        ]
      };

    case 'HIGH_RISK':
      return {
        message: `Based on ${failedAttempts} failed deliveries out of ${totalOrders} orders (${successRate}% success rate), you are classified as High Risk. Future COD orders may require advance payment.`,
        recommendations: [
          "Accept deliveries when they arrive to improve your score",
          "Contact us before cancelling orders if needed",
          "Consider prepayment or bank transfer for faster service",
          "WhatsApp us for personalized assistance"
        ]
      };

    default:
      return {
        message: "We are still evaluating your order history to determine your risk classification.",
        recommendations: [
          "Accept deliveries promptly to build a good history",
          "Keep your contact information updated",
          "Contact support if you have any questions"
        ]
      };
  }
}

/**
 * Get display information for risk tiers
 */
function getRiskDisplayInfo(riskTier: string) {
  switch (riskTier) {
    case 'ZERO_RISK':
      return {
        color: 'success',
        icon: '✅',
        label: 'Zero Risk',
        bgColor: '#e8f5e8',
        textColor: '#2e7d2e'
      };
    case 'MEDIUM_RISK':
      return {
        color: 'warning', 
        icon: '⚠️',
        label: 'Medium Risk',
        bgColor: '#fff8e1',
        textColor: '#f57c00'
      };
    case 'HIGH_RISK':
      return {
        color: 'critical',
        icon: '❌', 
        label: 'High Risk',
        bgColor: '#ffebee',
        textColor: '#d32f2f'
      };
    default:
      return {
        color: 'base',
        icon: '❓',
        label: 'Unknown',
        bgColor: '#f5f5f5',
        textColor: '#666666'
      };
  }
}

// Handle preflight requests for CORS
export async function options({ request }: LoaderFunctionArgs) {
  const response = new Response(null, { status: 200 });
  return addCorsHeaders(response);
}
