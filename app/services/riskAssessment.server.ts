import { logger } from './logger.server';
import db from '../db.server';
import { createHash } from 'crypto';

export interface RiskProfile {
  riskTier: 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  riskScore: number;
  totalOrders: number;
  failedAttempts: number;
  successfulDeliveries: number;
  isNewCustomer: boolean;
  message?: string;
  lastOrderDate?: string;
  riskFactors?: string[];
  improvementTips?: string[];
  phone?: string;
}

export interface RiskProfileRequest {
  hashedPhone?: string | null;
  hashedEmail?: string | null;
  customerId?: string | null;
  checkoutToken?: string | null;
  shopDomain?: string | null;
  context: string;
}

/**
 * Create privacy-compliant hash for customer identification
 */
export async function createCustomerHash(data: string): Promise<string> {
  if (!data) return '';
  
  // Normalize the data (remove spaces, convert to lowercase)
  const normalized = data.toLowerCase().trim().replace(/\s+/g, '');
  
  // Create SHA-256 hash
  const hash = createHash('sha256');
  hash.update(normalized);
  hash.update(process.env.RETURNSX_HASH_SALT || 'returnsx_default_salt');
  
  return hash.digest('hex');
}

/**
 * Get unified customer risk profile across all stores
 */
export async function getRiskProfile(request: RiskProfileRequest): Promise<RiskProfile> {
  try {
    logger.info("Getting risk profile", {
      component: "riskAssessment",
      context: request.context,
      hasPhone: !!request.hashedPhone,
      hasEmail: !!request.hashedEmail,
      hasCustomerId: !!request.customerId
    });

    // Try to find existing customer profile
    let customerProfile = null;
    
    if (request.hashedPhone) {
      customerProfile = await findCustomerByPhone(request.hashedPhone);
    }
    
    if (!customerProfile && request.hashedEmail) {
      customerProfile = await findCustomerByEmail(request.hashedEmail);
    }

    if (!customerProfile && request.customerId) {
      customerProfile = await findCustomerByShopifyId(request.customerId);
    }

    // If no existing profile, create new customer profile
    if (!customerProfile) {
      return createNewCustomerProfile(request);
    }

    // Calculate current risk score
    const riskScore = calculateRiskScore(customerProfile);
    const riskTier = determineRiskTier(riskScore);

    const profile: RiskProfile = {
      riskTier,
      riskScore,
      totalOrders: customerProfile.totalOrders || 0,
      failedAttempts: customerProfile.failedAttempts || 0,
      successfulDeliveries: customerProfile.successfulDeliveries || 0,
      isNewCustomer: false,
      lastOrderDate: customerProfile.lastEventAt?.toISOString(),
      riskFactors: generateRiskFactors(customerProfile),
      improvementTips: generateImprovementTips(riskTier),
      message: generateRiskMessage(riskTier, riskScore)
    };

    logger.info("Risk profile calculated", {
      component: "riskAssessment",
      riskTier: profile.riskTier,
      riskScore: profile.riskScore,
      totalOrders: profile.totalOrders,
      failedAttempts: profile.failedAttempts
    });

    return profile;

  } catch (error) {
    logger.error("Failed to get risk profile", {
      component: "riskAssessment",
      error: error instanceof Error ? error.message : String(error)
    });

    // Return safe default for errors
    return createNewCustomerProfile(request);
  }
}

/**
 * Find customer by hashed phone number
 */
async function findCustomerByPhone(hashedPhone: string) {
  try {
    return await db.customerProfile.findFirst({
      where: { phone: hashedPhone },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  } catch (error) {
    logger.warn("Database query failed for phone lookup", {
      component: "riskAssessment",
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Find customer by hashed email
 */
async function findCustomerByEmail(hashedEmail: string) {
  try {
    return await db.customerProfile.findFirst({
      where: { email: hashedEmail },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  } catch (error) {
    logger.warn("Database query failed for email lookup", {
      component: "riskAssessment",
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Find customer by Shopify customer ID
 */
async function findCustomerByShopifyId(customerId: string) {
  try {
    // For now, we'll find by exact customer ID in phone field or create a mapping table later
    // This is a simplified approach - in production you'd have a separate customer ID mapping
    return await db.customerProfile.findFirst({
      where: { 
        id: customerId // Temporary - should use proper customer ID mapping
      },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  } catch (error) {
    logger.warn("Database query failed for Shopify ID lookup", {
      component: "riskAssessment",
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Create profile for new customer
 */
function createNewCustomerProfile(request: RiskProfileRequest): RiskProfile {
  return {
    riskTier: 'ZERO_RISK',
    riskScore: 0,
    totalOrders: 0,
    failedAttempts: 0,
    successfulDeliveries: 0,
    isNewCustomer: true,
    message: "Welcome! You are a new customer with Zero Risk status.",
    riskFactors: [],
    improvementTips: [
      "Accept deliveries promptly when they arrive",
      "Keep your contact information up to date",
      "Avoid canceling orders after placement"
    ]
  };
}

/**
 * Calculate risk score based on customer history
 */
function calculateRiskScore(customerProfile: any): number {
  const totalOrders = customerProfile.totalOrders || 0;
  const failedAttempts = customerProfile.failedAttempts || 0;
  const successfulDeliveries = customerProfile.successfulDeliveries || 0;
  const returnRate = parseFloat(customerProfile.returnRate || 0);

  if (totalOrders === 0) return 0;

  // Base failure rate (0-1)
  const failureRate = failedAttempts / totalOrders;

  // Combined risk factors
  const baseRisk = (failureRate * 0.7) + (returnRate * 0.3);

  // Apply modifiers
  let riskScore = baseRisk * 100;

  // Recent activity modifier (favor recent good behavior)
  const daysSinceLastOrder = customerProfile.lastEventAt 
    ? Math.floor((Date.now() - new Date(customerProfile.lastEventAt).getTime()) / (1000 * 60 * 60 * 24))
    : 365;

  if (daysSinceLastOrder > 90) {
    riskScore *= 0.8; // Reduce risk for inactive customers
  }

  // Volume modifier (more orders = more reliable data)
  if (totalOrders > 20) {
    riskScore *= 0.95;
  } else if (totalOrders < 5) {
    riskScore *= 1.1; // Slightly higher risk for new customers
  }

  return Math.max(0, Math.min(100, Math.round(riskScore * 10) / 10));
}

/**
 * Determine risk tier from score
 */
function determineRiskTier(score: number): 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' {
  if (score < 25) return 'ZERO_RISK';
  if (score < 60) return 'MEDIUM_RISK';
  return 'HIGH_RISK';
}

/**
 * Generate risk factors explanation
 */
function generateRiskFactors(customerProfile: any): string[] {
  const factors = [];
  const totalOrders = customerProfile.totalOrders || 0;
  const failedAttempts = customerProfile.failedAttempts || 0;
  const returnRate = parseFloat(customerProfile.returnRate || 0);

  if (failedAttempts > 0) {
    const failureRate = Math.round((failedAttempts / totalOrders) * 100);
    factors.push(`${failureRate}% delivery failure rate (${failedAttempts}/${totalOrders} orders)`);
  }

  if (returnRate > 0) {
    const returnRatePercent = Math.round(returnRate * 100);
    factors.push(`${returnRatePercent}% return rate`);
  }

  if (totalOrders < 5) {
    factors.push("Limited order history available");
  }

  if (factors.length === 0) {
    factors.push("Strong delivery acceptance record");
  }

  return factors;
}

/**
 * Generate improvement tips
 */
function generateImprovementTips(riskTier: string): string[] {
  switch (riskTier) {
    case 'HIGH_RISK':
      return [
        "Accept deliveries when they arrive at your address",
        "Avoid canceling orders after placement",
        "Consider prepayment for faster order processing",
        "Contact merchants before canceling if needed",
        "Keep your contact information updated"
      ];
    
    case 'MEDIUM_RISK':
      return [
        "Continue accepting deliveries promptly",
        "Minimize order cancellations when possible",
        "Ensure your contact information is current",
        "Communicate with merchants if delivery issues arise"
      ];
    
    default:
      return [
        "Keep up the excellent work!",
        "Continue accepting deliveries reliably",
        "Your consistent behavior is appreciated"
      ];
  }
}

/**
 * Generate risk message
 */
function generateRiskMessage(riskTier: string, riskScore: number): string {
  switch (riskTier) {
    case 'HIGH_RISK':
      return `Your current risk score is ${riskScore}/100. Future COD orders may require advance payment or additional verification.`;
    
    case 'MEDIUM_RISK':
      return `Your current risk score is ${riskScore}/100. Some orders may require additional verification before shipping.`;
    
    default:
      return `Excellent! Your risk score is ${riskScore}/100. You are a trusted customer with full COD access.`;
  }
}