import prisma from "../db.server";
import { updateCustomerProfileRisk } from "./riskScoring.server";
import { PerformanceTimer } from "./logger.server";

import { logger } from "./logger.server";

// Temporary types until Prisma client includes our models
type CustomerProfile = any;
type OrderEventType = string;
type RiskTier = "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK";

/**
 * ReturnsX Customer Profile Service
 * 
 * Manages customer profiles and risk assessment data for COD order management
 * Now stores raw customer data directly (no hashing)
 */

export interface CreateCustomerProfileData {
  phone?: string;
  email?: string;
  address?: string;
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
 * Get or create a customer profile by phone number
 * Primary lookup method for customer risk assessment
 */
export async function getOrCreateCustomerProfile(
  customerData: CreateCustomerProfileData,
  shopDomain?: string
): Promise<CustomerProfile> {
  const timer = new PerformanceTimer("get_or_create_customer_profile", {
    shopDomain: shopDomain || "unknown",
  });

  try {
    if (!customerData.phone && !customerData.email && !customerData.address) {
      throw new Error("At least one identifier (phone, email, or address) must be provided");
    }

    // Normalize phone number for consistent storage
    const normalizedPhone = customerData.phone ? customerData.phone.replace(/\D/g, '') : null;

    // Try to find existing customer by phone number first
    if (normalizedPhone) {
      const existingProfile = await (prisma as any).customerProfile.findUnique({
        where: { phone: normalizedPhone },
        include: {
          orderEvents: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (existingProfile) {
        // Update email and address if provided and not already set
        const updateData: any = {};
        if (customerData.email && !existingProfile.email) {
          updateData.email = customerData.email.toLowerCase().trim();
        }
        if (customerData.address && !existingProfile.address) {
          updateData.address = customerData.address.trim();
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
    if (!normalizedPhone) {
      throw new Error("Phone number is required for new customer profiles");
    }

    try {
      const newProfile = await (prisma as any).customerProfile.create({
        data: {
          phone: normalizedPhone,
          email: customerData.email ? customerData.email.toLowerCase().trim() : null,
          address: customerData.address ? customerData.address.trim() : null,
          riskScore: 0.0,
          returnRate: 0.0,
          riskTier: "ZERO_RISK",
        },
        include: {
          orderEvents: true,
        },
      });

      console.log(`✓ Created new customer profile for phone: ${normalizedPhone.substring(0, 3)}***`);
      
      timer.finish({ action: "created_new", customerId: newProfile.id });
      return newProfile;

    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        console.log("Customer profile already exists (race condition), attempting to fetch...");
        
        const existingProfile = await (prisma as any).customerProfile.findUnique({
          where: { phone: normalizedPhone },
          include: {
            orderEvents: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        });

        if (existingProfile) {
          timer.finish({ action: "found_after_race", customerId: existingProfile.id });
          return existingProfile;
        }
      }
      
      throw dbError;
    }

  } catch (error) {
    timer.finishWithError(
      error instanceof Error ? error : new Error(String(error)),
      { shopDomain: shopDomain || "unknown" }
    );
    throw error;
  }
}

/**
 * Get customer profile by phone number for risk assessment
 */
export async function getCustomerProfileByPhone(phone: string): Promise<CustomerProfile | null> {
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    return await (prisma as any).customerProfile.findUnique({
      where: { phone: normalizedPhone },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Increased for better risk calculation
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching customer profile by phone", {
      phone: phone.substring(0, 3) + "***", // Log partial phone for privacy
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Update customer profile with new data
 */
export async function updateCustomerProfile(profileId: string, updateData: any): Promise<CustomerProfile> {
  try {
    return await (prisma as any).customerProfile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  } catch (error) {
    logger.error("Error updating customer profile", {
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
    // Check if this order event already exists to prevent duplicates
    const existingEvent = await (prisma as any).orderEvent.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        shopifyOrderId: eventData.shopifyOrderId,
        eventType: eventData.eventType,
        shopDomain,
      },
    });

    if (existingEvent) {
      console.log(`Order event already exists: ${eventData.shopifyOrderId} (${eventData.eventType}) - skipping duplicate`);
      timer.finish({ action: "skipped_duplicate", orderId: eventData.shopifyOrderId });
      return customerProfile;
    }

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

    // Recalculate counters from all events to ensure accuracy
    const allEvents = await (prisma as any).orderEvent.findMany({
      where: {
        customerProfileId: customerProfile.id,
      },
    });

    // Calculate accurate counters from all events
    let totalOrders = 0;
    let failedAttempts = 0;
    let successfulDeliveries = 0;
    
    // Track unique orders to avoid double counting
    const uniqueOrderIds = new Set();

    for (const event of allEvents) {
      switch (event.eventType) {
        case "ORDER_CREATED":
          if (!uniqueOrderIds.has(event.shopifyOrderId)) {
            totalOrders++;
            uniqueOrderIds.add(event.shopifyOrderId);
          }
          break;
        
        case "ORDER_PAID":
          // Mark orders as paid - positive indicator for delivery likelihood
          break;
        
        case "ORDER_CANCELLED":
          // Consider cancelled orders as failed attempts if due to customer refusal
          if (event.cancelReason && 
              ['customer_refused', 'delivery_failed', 'customer_unavailable'].includes(event.cancelReason.toLowerCase())) {
            failedAttempts++;
          }
          break;
        
        case "ORDER_FULFILLED":
        case "ORDER_DELIVERED":
          successfulDeliveries++;
          break;
        
        case "ORDER_REFUNDED":
        case "ORDER_RETURN_INITIATED":
          // Refunds and returns count as failed attempts for COD risk assessment
          failedAttempts++;
          break;
        
        case "ORDER_UPDATED":
          // General updates - no specific action unless return-related
          if (event.eventData?.is_return_related) {
            failedAttempts++;
          }
          break;
      }
    }

    // Update the profile with recalculated counters
    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: customerProfile.id },
      data: {
        totalOrders,
        failedAttempts,
        successfulDeliveries,
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
 * Get high-risk customers for a shop
 */
export async function getHighRiskCustomers(shopDomain: string, limit: number = 50): Promise<CustomerProfile[]> {
  try {
    return await (prisma as any).customerProfile.findMany({
      where: {
        AND: [
          { riskTier: "HIGH_RISK" },
          {
            orderEvents: {
              some: {
                shopDomain: shopDomain,
              },
            },
          },
        ],
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
  } catch (error) {
    logger.error("Error fetching high-risk customers", {
      shopDomain,
      limit,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Apply manual override to customer profile
 */
export async function applyManualOverride(
  customerProfileId: string,
  shopDomain: string,
  overrideType: string,
  newValue: string,
  adminUserId: string,
  reason?: string
): Promise<CustomerProfile> {
  try {
    const updateData: any = {};

    switch (overrideType) {
      case "RESET_FAILED_ATTEMPTS":
        updateData.failedAttempts = 0;
        break;
      
      case "CHANGE_RISK_TIER":
        if (!["ZERO_RISK", "MEDIUM_RISK", "HIGH_RISK"].includes(newValue)) {
          throw new Error("Invalid risk tier value");
        }
        updateData.riskTier = newValue;
        break;
      
      case "FORGIVE_CUSTOMER":
        updateData.failedAttempts = 0;
        updateData.riskTier = "ZERO_RISK";
        updateData.riskScore = 0.0;
        break;
      
      default:
        throw new Error("Invalid override type");
    }

    // Update the customer profile
    const updatedProfile = await (prisma as any).customerProfile.update({
      where: { id: customerProfileId },
      data: updateData,
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    // Recalculate risk if needed (except for manual tier changes)
    if (overrideType !== "CHANGE_RISK_TIER") {
      return await updateCustomerProfileRisk(customerProfileId, shopDomain);
    }

    return updatedProfile;

  } catch (error) {
    logger.error("Error applying manual override", {
      customerProfileId,
      shopDomain,
      overrideType,
      adminUserId,
      reason,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Update risk configuration for a shop
 */
export async function updateRiskConfig(shopDomain: string, configData: any) {
  try {
    return await (prisma as any).riskConfig.upsert({
      where: { shopDomain },
      update: configData,
      create: {
        shopDomain,
        ...configData,
      },
    });
  } catch (error) {
    logger.error("Error updating risk configuration", {
      shopDomain,
      configData: Object.keys(configData),
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}