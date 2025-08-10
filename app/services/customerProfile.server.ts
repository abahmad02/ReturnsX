// TODO: Fix types when Prisma client is properly generated
// import type { CustomerProfile, OrderEventType, RiskTier } from "@prisma/client";
import prisma from "../db.server";
import { hashCustomerIdentifiers, type CustomerIdentifiers } from "../utils/crypto.server";
import { updateCustomerProfileRisk, getRiskConfig } from "./riskScoring.server";
import { logger, PerformanceTimer } from "./logger.server";

// Temporary types until Prisma client includes our models
type CustomerProfile = any;
type OrderEventType = string;
type RiskTier = "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK";

/**
 * ReturnsX Customer Profile Service (Enhanced)
 * 
 * Handles all customer profile operations with enhanced risk scoring:
 * - Creating and updating customer profiles
 * - Real-time risk score calculation and tier assignment
 * - Order event tracking with weighted calculations
 * - Risk configuration management
 */

export interface CreateCustomerProfileData {
  phone?: string;
  email?: string;
  address?: string;
  shopDomain: string;
}

export interface OrderEventData {
  shopifyOrderId: string;
  eventType: OrderEventType;
  orderValue?: number;
  currency?: string;
  cancelReason?: string;
  fulfillmentStatus?: string;
  refundAmount?: number;
  eventData?: any;
}

/**
 * Get or create a customer profile by phone hash
 * Primary lookup method for customer risk assessment
 */
export async function getOrCreateCustomerProfile(
  customerData: CreateCustomerProfileData
): Promise<CustomerProfile> {
  const timer = new PerformanceTimer("get_or_create_customer_profile", {
    shopDomain: customerData.shopDomain,
  });

  try {
    if (!customerData.phone && !customerData.email && !customerData.address) {
      throw new Error("At least one identifier (phone, email, or address) must be provided");
    }

    // Hash the customer identifiers
    const hashedIdentifiers = hashCustomerIdentifiers({
      phone: customerData.phone,
      email: customerData.email,
      address: customerData.address,
    });

    // Try to find existing profile by phone hash (primary identifier)
    if (hashedIdentifiers.phoneHash) {
      const existingProfile = await (prisma as any).customerProfile.findUnique({
        where: { phoneHash: hashedIdentifiers.phoneHash },
        include: {
          orderEvents: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (existingProfile) {
        // Update email and address hashes if provided and not already set
        const updateData: any = {};
        if (hashedIdentifiers.emailHash && !existingProfile.emailHash) {
          updateData.emailHash = hashedIdentifiers.emailHash;
        }
        if (hashedIdentifiers.addressHash && !existingProfile.addressHash) {
          updateData.addressHash = hashedIdentifiers.addressHash;
        }

        if (Object.keys(updateData).length > 0) {
          const updated = await (prisma as any).customerProfile.update({
            where: { id: existingProfile.id },
            data: updateData,
          });
          
          timer.finish({ action: "updated_existing", customerId: updated.id });
          return updated;
        }

        timer.finish({ action: "found_existing", customerId: existingProfile.id });
        return existingProfile;
      }
    }

    // Create new customer profile if none exists
    if (!hashedIdentifiers.phoneHash) {
      throw new Error("Phone number is required for new customer profiles");
    }

    const newProfile = await (prisma as any).customerProfile.create({
      data: {
        phoneHash: hashedIdentifiers.phoneHash,
        emailHash: hashedIdentifiers.emailHash,
        addressHash: hashedIdentifiers.addressHash,
      },
    });

    logger.customerProfileCreated(
      newProfile.id,
      customerData.shopDomain,
      newProfile.riskTier
    );

    timer.finish({ action: "created_new", customerId: newProfile.id });
    return newProfile;

  } catch (error) {
    timer.finishWithError(
      error instanceof Error ? error : new Error(String(error)),
      { shopDomain: customerData.shopDomain }
    );
    throw error;
  }
}

/**
 * Get customer profile by phone hash for risk assessment
 */
export async function getCustomerProfileByPhoneHash(phoneHash: string): Promise<CustomerProfile | null> {
  try {
    return await (prisma as any).customerProfile.findUnique({
      where: { phoneHash },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Increased for better risk calculation
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching customer profile by phone hash", {
      phoneHash: phoneHash.substring(0, 8) + "...", // Log partial hash for privacy
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Update customer profile with new data
 */
export async function updateCustomerProfile(profileId: string, updateData: any): Promise<CustomerProfile> {
  try {
    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: profileId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    logger.info("Customer profile updated successfully", {
      component: "customerProfile",
      profileId,
      updateData: Object.keys(updateData),
    });

    return updatedProfile;
  } catch (error) {
    logger.error("Error updating customer profile", {
      component: "customerProfile",
      profileId,
      updateData: Object.keys(updateData),
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Record an order event and update customer profile with enhanced risk calculation
 */
export async function recordOrderEvent(
  customerProfile: CustomerProfile,
  eventData: OrderEventData,
  shopDomain: string
): Promise<CustomerProfile> {
  const timer = new PerformanceTimer("record_order_event", {
    customerId: customerProfile.id,
    shopDomain,
    eventType: eventData.eventType,
  });

  try {
    // Create the order event record
    await (prisma as any).orderEvent.create({
      data: {
        customerProfileId: customerProfile.id,
        shopDomain,
        shopifyOrderId: eventData.shopifyOrderId,
        eventType: eventData.eventType,
        orderValue: eventData.orderValue,
        currency: eventData.currency,
        cancelReason: eventData.cancelReason,
        fulfillmentStatus: eventData.fulfillmentStatus,
        refundAmount: eventData.refundAmount,
        eventData: eventData.eventData,
      },
    });

    // Update customer profile counters based on event type
    const updateData: any = {};

    switch (eventData.eventType) {
      case "ORDER_CREATED":
        updateData.totalOrders = customerProfile.totalOrders + 1;
        break;
      
      case "ORDER_CANCELLED":
        // Consider cancelled orders as failed attempts if due to customer refusal
        if (eventData.cancelReason && 
            ['customer_refused', 'delivery_failed', 'customer_unavailable'].includes(eventData.cancelReason.toLowerCase())) {
          updateData.failedAttempts = customerProfile.failedAttempts + 1;
        }
        break;
      
      case "ORDER_FULFILLED":
      case "ORDER_DELIVERED":
        updateData.successfulDeliveries = customerProfile.successfulDeliveries + 1;
        break;
      
      case "ORDER_REFUNDED":
        // Refunds count as failed attempts for COD risk assessment
        updateData.failedAttempts = customerProfile.failedAttempts + 1;
        break;
    }

    // Update the profile with new counters
    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: customerProfile.id },
      data: {
        ...updateData,
        lastEventAt: new Date(),
      },
    });

    // Perform enhanced risk recalculation using the new service
    const profileWithRisk = await updateCustomerProfileRisk(updatedProfile.id, shopDomain);

    timer.finish({
      orderValue: eventData.orderValue,
      newRiskTier: profileWithRisk.riskTier,
      riskScore: profileWithRisk.riskScore,
    });

    return profileWithRisk;

  } catch (error) {
    timer.finishWithError(
      error instanceof Error ? error : new Error(String(error)),
      {
        customerId: customerProfile.id,
        shopDomain,
        eventType: eventData.eventType,
      }
    );
    throw error;
  }
}

/**
 * Update risk configuration for a shop
 */
export async function updateRiskConfig(shopDomain: string, configData: any) {
  try {
    const updatedConfig = await (prisma as any).riskConfig.upsert({
      where: { shopDomain },
      update: {
        ...configData,
        updatedAt: new Date(),
      },
      create: {
        shopDomain,
        ...configData,
      },
    });

    logger.info("Risk configuration updated", {
      shopDomain,
      configFields: Object.keys(configData),
    });

    return updatedConfig;

  } catch (error) {
    logger.error("Error updating risk configuration", {
      shopDomain,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get customer profile statistics for dashboard with enhanced metrics
 */
export async function getCustomerProfileStats(shopDomain?: string) {
  try {
    const whereClause = shopDomain ? {
      orderEvents: {
        some: {
          shopDomain,
        },
      },
    } : {};

    const [total, zeroRisk, mediumRisk, highRisk, averageRiskScore, recentEvents] = await Promise.all([
      (prisma as any).customerProfile.count({ where: whereClause }),
      (prisma as any).customerProfile.count({ 
        where: { ...whereClause, riskTier: "ZERO_RISK" },
      }),
      (prisma as any).customerProfile.count({ 
        where: { ...whereClause, riskTier: "MEDIUM_RISK" },
      }),
      (prisma as any).customerProfile.count({ 
        where: { ...whereClause, riskTier: "HIGH_RISK" },
      }),
      (prisma as any).customerProfile.aggregate({
        where: whereClause,
        _avg: {
          riskScore: true,
        },
      }),
      shopDomain ? (prisma as any).orderEvent.count({
        where: {
          shopDomain,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }) : 0,
    ]);

    const stats = {
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
      averageRiskScore: averageRiskScore._avg.riskScore || 0,
      recentEvents,
      lastUpdated: new Date().toISOString(),
    };

    logger.info("Customer profile statistics generated", {
      shopDomain,
      total: stats.total,
      averageRiskScore: stats.averageRiskScore,
    });

    return stats;

  } catch (error) {
    logger.error("Error getting customer profile statistics", {
      shopDomain,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get high-risk customers for merchant review
 */
export async function getHighRiskCustomers(
  shopDomain: string,
  limit: number = 50
): Promise<CustomerProfile[]> {
  try {
    const highRiskCustomers = await (prisma as any).customerProfile.findMany({
      where: {
        riskTier: "HIGH_RISK",
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
          take: 5,
        },
      },
      orderBy: [
        { riskScore: 'desc' },
        { lastEventAt: 'desc' },
      ],
      take: limit,
    });

    logger.info("High-risk customers retrieved", {
      shopDomain,
      count: highRiskCustomers.length,
    });

    return highRiskCustomers;

  } catch (error) {
    logger.error("Error getting high-risk customers", {
      shopDomain,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Manual override for customer risk tier (merchant intervention)
 */
export async function applyManualOverride(
  customerProfileId: string,
  shopDomain: string,
  overrideType: string,
  newValue: string,
  adminUserId?: string,
  reason?: string
): Promise<CustomerProfile> {
  try {
    const profile = await (prisma as any).customerProfile.findUnique({
      where: { id: customerProfileId },
    });

    if (!profile) {
      throw new Error("Customer profile not found");
    }

    // Record the manual override for audit trail
    await (prisma as any).manualOverride.create({
      data: {
        customerProfileId,
        shopDomain,
        adminUserId,
        overrideType,
        previousValue: profile[overrideType.toLowerCase()] || profile.riskTier,
        newValue,
        reason,
      },
    });

    // Apply the override
    const updateData: any = {};
    
    switch (overrideType) {
      case "RESET_FAILED_ATTEMPTS":
        updateData.failedAttempts = 0;
        break;
      case "CHANGE_RISK_TIER":
        updateData.riskTier = newValue;
        break;
      case "FORGIVE_CUSTOMER":
        updateData.failedAttempts = 0;
        updateData.riskTier = "ZERO_RISK";
        updateData.riskScore = 0;
        break;
    }

    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: customerProfileId },
      data: {
        ...updateData,
        lastEventAt: new Date(),
      },
    });

    logger.info("Manual override applied", {
      customerProfileId,
      shopDomain,
      overrideType,
      adminUserId,
      previousValue: profile.riskTier,
      newValue: updatedProfile.riskTier,
    });

    return updatedProfile;

  } catch (error) {
    logger.error("Error applying manual override", {
      customerProfileId,
      shopDomain,
      overrideType,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
} 