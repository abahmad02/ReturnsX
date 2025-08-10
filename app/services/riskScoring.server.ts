import prisma from "../db.server";
import { logger, PerformanceTimer } from "./logger.server";

/**
 * ReturnsX Advanced Risk Scoring Service
 * 
 * Implements sophisticated risk assessment algorithms with:
 * - Configurable thresholds per merchant
 * - Weighted calculations for high-value orders
 * - Machine learning preparation features
 * - Real-time risk tier updates
 */

// Types for risk calculation
export type RiskTier = "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK";

export interface CustomerProfile {
  id: string;
  totalOrders: number;
  failedAttempts: number;
  successfulDeliveries: number;
  returnRate: number;
  riskScore: number;
  riskTier: RiskTier;
  lastEventAt: Date;
}

export interface RiskConfig {
  shopDomain: string;
  zeroRiskMaxFailed: number;
  zeroRiskMaxReturnRate: number;
  mediumRiskMaxFailed: number;
  mediumRiskMaxReturnRate: number;
  highRiskThreshold: number;
  enableCodRestriction: boolean;
  depositPercentage: number;
  // Enhanced configuration options
  highValueThreshold?: number; // Orders above this amount get higher weight
  timeDecayFactor?: number; // How much to reduce impact of old failures
  newCustomerGracePeriod?: number; // Days to give new customers benefit of doubt
  minimumOrdersForAssessment?: number; // Minimum orders before applying full risk
}

export interface OrderEvent {
  eventType: string;
  orderValue?: number;
  currency?: string;
  cancelReason?: string;
  refundAmount?: number;
  createdAt: Date;
  eventData?: any;
}

export interface RiskCalculationResult {
  riskScore: number;
  riskTier: RiskTier;
  returnRate: number;
  factors: {
    baseFailureRate: number;
    highValuePenalty: number;
    timeDecayAdjustment: number;
    newCustomerBonus: number;
    volumeAdjustment: number;
  };
  recommendation: string;
  confidence: number;
}

/**
 * Get risk configuration for a shop with intelligent defaults
 */
export async function getRiskConfig(shopDomain: string): Promise<RiskConfig> {
  try {
    const config = await (prisma as any).riskConfig.findUnique({
      where: { shopDomain },
    });

    const defaultConfig: RiskConfig = {
      shopDomain,
      zeroRiskMaxFailed: 2,
      zeroRiskMaxReturnRate: 10.0,
      mediumRiskMaxFailed: 5,
      mediumRiskMaxReturnRate: 30.0,
      highRiskThreshold: 30.0,
      enableCodRestriction: true,
      depositPercentage: 50.0,
      // Enhanced defaults
      highValueThreshold: 5000, // PKR 5000+ orders get higher weight
      timeDecayFactor: 0.95, // 5% reduction per month for old failures
      newCustomerGracePeriod: 30, // 30 days grace period
      minimumOrdersForAssessment: 3, // Need 3+ orders for full assessment
    };

    return config ? { ...defaultConfig, ...config } : defaultConfig;
  } catch (error) {
    logger.error("Error fetching risk config", { shopDomain }, error instanceof Error ? error : new Error(String(error)));
    return {
      shopDomain,
      zeroRiskMaxFailed: 2,
      zeroRiskMaxReturnRate: 10.0,
      mediumRiskMaxFailed: 5,
      mediumRiskMaxReturnRate: 30.0,
      highRiskThreshold: 30.0,
      enableCodRestriction: true,
      depositPercentage: 50.0,
      highValueThreshold: 5000,
      timeDecayFactor: 0.95,
      newCustomerGracePeriod: 30,
      minimumOrdersForAssessment: 3,
    };
  }
}

/**
 * Enhanced risk scoring algorithm with multiple factors
 */
export async function calculateRiskScore(
  profile: CustomerProfile,
  orderEvents: OrderEvent[] = [],
  shopDomain: string
): Promise<RiskCalculationResult> {
  const timer = new PerformanceTimer("risk_calculation", {
    customerId: profile.id,
    shopDomain,
  });

  try {
    const config = await getRiskConfig(shopDomain);
    
    const {
      totalOrders,
      failedAttempts,
      successfulDeliveries,
      lastEventAt,
    } = profile;

    // Initialize calculation factors
    const factors = {
      baseFailureRate: 0,
      highValuePenalty: 0,
      timeDecayAdjustment: 0,
      newCustomerBonus: 0,
      volumeAdjustment: 0,
    };

    // 1. Calculate base return rate
    const totalCompletedTransactions = totalOrders + successfulDeliveries;
    const baseReturnRate = totalCompletedTransactions > 0 
      ? (failedAttempts / totalCompletedTransactions) * 100 
      : 0;
    
    factors.baseFailureRate = baseReturnRate;

    // 2. High-value order penalty
    let highValueFailures = 0;
    let totalHighValueOrders = 0;
    
    if (orderEvents.length > 0 && config.highValueThreshold) {
      for (const event of orderEvents) {
        if (event.orderValue && event.orderValue >= config.highValueThreshold) {
          totalHighValueOrders++;
          if (event.eventType === "ORDER_CANCELLED" || event.eventType === "ORDER_REFUNDED") {
            highValueFailures++;
          }
        }
      }
      
      if (totalHighValueOrders > 0) {
        const highValueFailureRate = (highValueFailures / totalHighValueOrders) * 100;
        factors.highValuePenalty = Math.max(0, highValueFailureRate - baseReturnRate) * 1.5;
      }
    }

    // 3. Time decay adjustment (reduce impact of old failures)
    if (config.timeDecayFactor && orderEvents.length > 0) {
      const now = new Date();
      let weightedFailures = 0;
      let weightedTotal = 0;

      for (const event of orderEvents) {
        const monthsAgo = Math.floor(
          (now.getTime() - event.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        const weight = Math.pow(config.timeDecayFactor, monthsAgo);
        
        weightedTotal += weight;
        if (event.eventType === "ORDER_CANCELLED" || event.eventType === "ORDER_REFUNDED") {
          weightedFailures += weight;
        }
      }

      if (weightedTotal > 0) {
        const timeAdjustedRate = (weightedFailures / weightedTotal) * 100;
        factors.timeDecayAdjustment = timeAdjustedRate - baseReturnRate;
      }
    }

    // 4. New customer bonus (grace period)
    const daysSinceFirstOrder = Math.floor(
      (new Date().getTime() - lastEventAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (config.newCustomerGracePeriod && daysSinceFirstOrder <= config.newCustomerGracePeriod) {
      const gracePeriodRemaining = (config.newCustomerGracePeriod - daysSinceFirstOrder) / config.newCustomerGracePeriod;
      factors.newCustomerBonus = -baseReturnRate * 0.3 * gracePeriodRemaining; // Up to 30% reduction
    }

    // 5. Volume adjustment (more orders = more confidence)
    if (config.minimumOrdersForAssessment && totalOrders < config.minimumOrdersForAssessment) {
      const volumePenalty = ((config.minimumOrdersForAssessment - totalOrders) / config.minimumOrdersForAssessment) * 10;
      factors.volumeAdjustment = volumePenalty;
    } else if (totalOrders >= 10) {
      // Volume bonus for established customers
      factors.volumeAdjustment = -Math.min(totalOrders / 50, 0.2) * baseReturnRate;
    }

    // Calculate final risk score (0-100)
    let finalRiskScore = Math.max(0, 
      factors.baseFailureRate + 
      factors.highValuePenalty + 
      factors.timeDecayAdjustment + 
      factors.newCustomerBonus + 
      factors.volumeAdjustment
    );

    // Apply ceiling
    finalRiskScore = Math.min(finalRiskScore, 100);

    // Calculate final return rate for tier determination
    const finalReturnRate = baseReturnRate + factors.timeDecayAdjustment;

    // Determine risk tier based on enhanced criteria
    let riskTier: RiskTier;
    let recommendation: string;
    let confidence: number;

    if (failedAttempts < config.zeroRiskMaxFailed && finalReturnRate < config.zeroRiskMaxReturnRate) {
      riskTier = "ZERO_RISK";
      recommendation = "No restrictions needed. Customer shows reliable payment behavior.";
      confidence = Math.min(95, 60 + totalOrders * 5); // Higher confidence with more orders
    } else if (
      failedAttempts < config.mediumRiskMaxFailed && 
      finalReturnRate < config.mediumRiskMaxReturnRate
    ) {
      riskTier = "MEDIUM_RISK";
      recommendation = "Monitor closely. Consider manual verification for high-value orders.";
      confidence = Math.min(85, 50 + totalOrders * 3);
    } else {
      riskTier = "HIGH_RISK";
      recommendation = `Require ${config.depositPercentage}% deposit or alternative payment method.`;
      confidence = Math.min(90, 70 + Math.min(failedAttempts * 5, 20));
    }

    const result: RiskCalculationResult = {
      riskScore: Math.round(finalRiskScore * 100) / 100,
      riskTier,
      returnRate: Math.round(finalReturnRate * 100) / 100,
      factors,
      recommendation,
      confidence,
    };

    timer.finish({
      riskScore: result.riskScore,
      riskTier: result.riskTier,
      returnRate: result.returnRate,
    });

    logger.riskAssessmentPerformed(
      profile.id,
      shopDomain,
      result.riskScore,
      result.riskTier
    );

    return result;

  } catch (error) {
    timer.finishWithError(error instanceof Error ? error : new Error(String(error)), { customerId: profile.id });
    throw error;
  }
}

/**
 * Update customer profile with new risk calculation
 */
export async function updateCustomerProfileRisk(
  profileId: string,
  shopDomain: string
): Promise<any> {
  try {
    // Get current profile with recent order events
    const profile = await (prisma as any).customerProfile.findUnique({
      where: { id: profileId },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Get recent events for calculation
        },
      },
    });

    if (!profile) {
      throw new Error("Customer profile not found");
    }

    // Calculate new risk assessment
    const riskResult = await calculateRiskScore(profile, profile.orderEvents, shopDomain);

    // Update the profile
    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: profileId },
      data: {
        riskScore: riskResult.riskScore,
        riskTier: riskResult.riskTier,
        returnRate: riskResult.returnRate,
        lastEventAt: new Date(),
      },
    });

    logger.customerProfileUpdated(
      profileId,
      shopDomain,
      profile.riskTier,
      riskResult.riskTier
    );

    return {
      ...updatedProfile,
      riskCalculation: riskResult,
    };

  } catch (error) {
    logger.error("Error updating customer profile risk", {
      profileId,
      shopDomain,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Batch risk recalculation for all profiles in a shop
 * Useful for config changes or periodic updates
 */
export async function recalculateAllRiskScores(
  shopDomain: string,
  progressCallback?: (processed: number, total: number) => void
): Promise<{ processed: number; errors: number }> {
  try {
    logger.info("Starting batch risk recalculation", { shopDomain });

    // Get all profiles for the shop
    const profiles = await (prisma as any).customerProfile.findMany({
      where: {
        orderEvents: {
          some: {
            shopDomain,
          },
        },
      },
      include: {
        orderEvents: {
          where: { shopDomain },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    let processed = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        await updateCustomerProfileRisk(profile.id, shopDomain);
        processed++;

        if (progressCallback) {
          progressCallback(processed, profiles.length);
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        errors++;
        logger.error("Error recalculating risk for profile", {
          profileId: profile.id,
          shopDomain,
        }, error instanceof Error ? error : new Error(String(error)));
      }
    }

    logger.info("Batch risk recalculation completed", {
      shopDomain,
      processed,
      errors,
      total: profiles.length,
    });

    return { processed, errors };

  } catch (error) {
    logger.error("Error in batch risk recalculation", { shopDomain }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get risk distribution statistics for a shop
 */
export async function getRiskDistributionStats(shopDomain: string) {
  try {
    const [total, zeroRisk, mediumRisk, highRisk, avgRiskScore] = await Promise.all([
      (prisma as any).customerProfile.count({
        where: {
          orderEvents: {
            some: { shopDomain },
          },
        },
      }),
      (prisma as any).customerProfile.count({
        where: {
          riskTier: "ZERO_RISK",
          orderEvents: {
            some: { shopDomain },
          },
        },
      }),
      (prisma as any).customerProfile.count({
        where: {
          riskTier: "MEDIUM_RISK",
          orderEvents: {
            some: { shopDomain },
          },
        },
      }),
      (prisma as any).customerProfile.count({
        where: {
          riskTier: "HIGH_RISK",
          orderEvents: {
            some: { shopDomain },
          },
        },
      }),
      (prisma as any).customerProfile.aggregate({
        where: {
          orderEvents: {
            some: { shopDomain },
          },
        },
        _avg: {
          riskScore: true,
        },
      }),
    ]);

    return {
      total,
      distribution: {
        zeroRisk,
        mediumRisk,
        highRisk,
      },
      percentages: {
        zeroRisk: total > 0 ? Math.round((zeroRisk / total) * 100) : 0,
        mediumRisk: total > 0 ? Math.round((mediumRisk / total) * 100) : 0,
        highRisk: total > 0 ? Math.round((highRisk / total) * 100) : 0,
      },
      averageRiskScore: avgRiskScore._avg.riskScore || 0,
    };
  } catch (error) {
    logger.error("Error getting risk distribution stats", { shopDomain }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
} 