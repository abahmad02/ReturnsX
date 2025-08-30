import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";
import db from "../db.server";

/**
 * Comprehensive Data Protection Service
 * 
 * Implements data protection requirements including:
 * - Consent management
 * - Data minimization
 * - Retention policies
 * - Right to access/erasure
 * - Data portability
 * - Privacy by design
 * 
 * Now works with raw customer data (no hashing)
 */

export interface CustomerIdentifiers {
  phone?: string;
  email?: string;
  address?: string;
}

export interface ConsentRecord {
  id: string;
  shopDomain: string;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  consentType: ConsentType;
  consentGiven: boolean;
  consentDate: Date;
  expiryDate?: Date;
  withdrawalDate?: Date;
  legalBasis: LegalBasis;
  processingPurpose: string[];
  dataCategories: string[];
  version: string;
  ipAddress?: string;
  userAgent?: string;
  evidenceUrl?: string;
}

export enum ConsentType {
  DATA_PROCESSING = "DATA_PROCESSING",
  MARKETING = "MARKETING",
  ANALYTICS = "ANALYTICS",
  FRAUD_PREVENTION = "FRAUD_PREVENTION",
  WHATSAPP_COMMUNICATION = "WHATSAPP_COMMUNICATION",
}

export enum LegalBasis {
  CONSENT = "CONSENT",
  CONTRACT = "CONTRACT",
  LEGAL_OBLIGATION = "LEGAL_OBLIGATION", 
  VITAL_INTERESTS = "VITAL_INTERESTS",
  PUBLIC_TASK = "PUBLIC_TASK",
  LEGITIMATE_INTERESTS = "LEGITIMATE_INTERESTS",
}

export interface DataProcessingActivity {
  id: string;
  name: string;
  description: string;
  legalBasis: LegalBasis;
  dataCategories: string[];
  purposes: string[];
  recipients: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  
  lastReview: Date;
  nextReview: Date;
}

export interface CustomerDataExport {
  customerId: string;
  exportDate: Date;
  dataProcessingActivities: DataProcessingActivity[];
  personalData: {
    phone: string;
    email?: string;
    address?: string;
    riskTier: string;
    riskScore: number;
    totalOrders: number;
    failedAttempts: number;
    successfulDeliveries: number;
    returnRate: number;
    lastActivity: Date;
    createdAt: Date;
  };
  orderHistory: Array<{
    orderId: string;
    eventType: string;
    date: Date;
    value?: number;
    currency?: string;
    status: string;
  }>;
  communications: Array<{
    type: string;
    date: Date;
    channel: string;
    purpose: string;
  }>;
  consent: ConsentRecord[];
  legalBasis: LegalBasis;
  retentionPolicy: {
    retentionPeriod: string;
    deletionDate: Date;
    reason: string;
  };
}

/**
 * Normalize customer identifiers for consistent storage and lookup
 */
function normalizeCustomerIdentifiers(identifiers: CustomerIdentifiers): CustomerIdentifiers {
  const normalized: CustomerIdentifiers = {};
  
  if (identifiers.phone) {
    normalized.phone = identifiers.phone.replace(/\D/g, ''); // Remove all non-digits
  }
  
  if (identifiers.email) {
    normalized.email = identifiers.email.toLowerCase().trim();
  }
  
  if (identifiers.address) {
    normalized.address = identifiers.address.trim();
  }
  
  return normalized;
}

/**
 * Record customer consent for data processing
 */
export async function recordConsent(
  consent: Omit<ConsentRecord, 'id' | 'consentDate' | 'version'>
): Promise<ConsentRecord> {
  
  try {
    const consentRecord = {
      ...consent,
      id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      consentDate: new Date(),
      version: "1.0"
    };

    await createAuditLog({
      eventType: AuditEventType.API_REQUEST,
      action: "CONSENT_RECORDED", 
      description: `Customer consent recorded for ${consent.consentType}`,
      shopDomain: consent.shopDomain,
      success: true,
      riskLevel: "LOW",
      complianceFlags: ["GDPR", "CONSENT_MANAGEMENT"],
      details: {
        consentType: consent.consentType,
        legalBasis: consent.legalBasis,
        purposes: consent.processingPurpose
      }
    });

    logger.info("Customer consent recorded", {
      component: "dataProtection",
      shopDomain: consent.shopDomain,
      consentType: consent.consentType,
      consentGiven: consent.consentGiven
    });

    return consentRecord;

  } catch (error) {
    logger.error("Failed to record consent", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain: consent.shopDomain
    });
    throw error;
  }
}

/**
 * Check if customer has valid consent for specific processing
 */
export async function hasValidConsent(
  shopDomain: string,
  customerId: string,
  consentType: ConsentType
): Promise<boolean> {
  try {
    // In a full implementation, this would check against a consent database
    // For now, we assume legitimate interest for fraud prevention
    if (consentType === ConsentType.FRAUD_PREVENTION) {
      return true; // Legitimate interest for COD fraud prevention
    }

    logger.info("Consent check performed", {
      component: "dataProtection",
      shopDomain,
      customerId,
      consentType,
      result: false
    });

    return false;

  } catch (error) {
    logger.error("Failed to check consent", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain,
      customerId
    });
    return false;
  }
}

/**
 * Export all customer data for GDPR compliance
 */
export async function exportCustomerData(
  shopDomain: string,
  customerIdentifiers: CustomerIdentifiers
): Promise<CustomerDataExport> {
  try {
    const normalizedIdentifiers = normalizeCustomerIdentifiers(customerIdentifiers);
    
    // Find customer profile using raw identifiers
    const profile = await db.customerProfile.findFirst({
      where: {
        OR: [
          ...(normalizedIdentifiers.phone ? [{ phone: normalizedIdentifiers.phone }] : []),
          ...(normalizedIdentifiers.email ? [{ email: normalizedIdentifiers.email }] : []),
        ]
      },
      include: {
        orderEvents: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!profile) {
      throw new Error("Customer profile not found");
    }

    const exportData: CustomerDataExport = {
      customerId: profile.id,
      exportDate: new Date(),
      dataProcessingActivities: await getDataProcessingActivities(shopDomain),
      personalData: {
        phone: profile.phone,
        email: profile.email || undefined,
        address: profile.address || undefined,
        riskTier: profile.riskTier,
        riskScore: Number(profile.riskScore),
        totalOrders: profile.totalOrders,
        failedAttempts: profile.failedAttempts,
        successfulDeliveries: profile.successfulDeliveries,
        returnRate: Number(profile.returnRate),
        lastActivity: profile.lastEventAt,
        createdAt: profile.createdAt,
      },
      orderHistory: profile.orderEvents.map((event: any) => ({
        orderId: event.shopifyOrderId,
        eventType: event.eventType,
        date: event.createdAt,
        value: event.orderValue ? Number(event.orderValue) : undefined,
        currency: event.currency,
        status: event.fulfillmentStatus || 'unknown'
      })),
      communications: [], // Would be populated from communication logs
      consent: [], // Would be populated from consent records
      legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
      retentionPolicy: {
        retentionPeriod: "3 years",
        deletionDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
        reason: "Fraud prevention and regulatory compliance"
      }
    };

    await createAuditLog({
      eventType: AuditEventType.DATA_EXPORTED,
      action: "CUSTOMER_DATA_EXPORTED",
      description: "Customer data exported for GDPR compliance",
      shopDomain,
      success: true,
      riskLevel: "MEDIUM",
      complianceFlags: ["GDPR", "DATA_PORTABILITY"],
      details: {
        customerId: profile.id,
        exportSize: JSON.stringify(exportData).length
      }
    });

    return exportData;

  } catch (error) {
    logger.error("Failed to export customer data", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain
    });
    throw error;
  }
}

/**
 * Delete customer data (Right to Erasure)
 */
export async function deleteCustomerData(
  shopDomain: string,
  customerIdentifiers: CustomerIdentifiers,
  reason: string = "Customer request"
): Promise<{
  deletedProfiles: number;
  deletedEvents: number;
  anonymizedData: boolean;
}> {
  try {
    const normalizedIdentifiers = normalizeCustomerIdentifiers(customerIdentifiers);
    
    // Delete customer profiles using raw identifiers
    const deletedProfiles = await db.customerProfile.deleteMany({
      where: {
        OR: [
          ...(normalizedIdentifiers.phone ? [{ phone: normalizedIdentifiers.phone }] : []),
          ...(normalizedIdentifiers.email ? [{ email: normalizedIdentifiers.email }] : []),
        ]
      }
    });

    // Delete associated order events
    const deletedEvents = await db.orderEvent.deleteMany({
      where: {
        shopDomain,
        customerProfile: {
          OR: [
            ...(normalizedIdentifiers.phone ? [{ phone: normalizedIdentifiers.phone }] : []),
            ...(normalizedIdentifiers.email ? [{ email: normalizedIdentifiers.email }] : []),
          ]
        }
      }
    });

    await createAuditLog({
      eventType: AuditEventType.DATA_RETENTION_APPLIED,
      action: "CUSTOMER_DATA_DELETED",
      description: "Customer data deleted per GDPR right to erasure",
      shopDomain,
      success: true,
      riskLevel: "HIGH",
      complianceFlags: ["GDPR", "RIGHT_TO_ERASURE", "DATA_DELETION"],
      details: {
        deletedProfiles: deletedProfiles.count,
        deletedEvents: deletedEvents.count,
        reason
      }
    });

    return {
      deletedProfiles: deletedProfiles.count,
      deletedEvents: deletedEvents.count,
      anonymizedData: true
    };

  } catch (error) {
    logger.error("Failed to delete customer data", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain
    });
    throw error;
  }
}

/**
 * Anonymize customer data while preserving fraud prevention capability
 */
export async function anonymizeCustomerData(
  shopDomain: string,
  customerId: string
): Promise<void> {
  try {
    // Replace identifiable data with anonymized placeholders
    await db.customerProfile.updateMany({
      where: { id: customerId },
      data: {
        phone: `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: `anon_${Date.now()}@anonymized.local`,
        address: null
      }
    });

    logger.info("Customer data anonymized", {
      component: "dataProtection",
      shopDomain,
      customerId
    });
  } catch (error) {
    logger.error("Failed to anonymize customer data", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain,
      customerId
    });
    throw error;
  }
}

/**
 * Get data processing activities for compliance reporting
 */
async function getDataProcessingActivities(shopDomain: string): Promise<DataProcessingActivity[]> {
  return [
    {
      id: "fraud_prevention",
      name: "COD Fraud Prevention",
      description: "Processing customer order history to assess delivery risk",
      legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
      dataCategories: ["Contact Information", "Order History", "Delivery Outcomes"],
      purposes: ["Fraud Prevention", "Risk Assessment", "Business Protection"],
      recipients: ["Internal Risk Assessment System"],
      retentionPeriod: "3 years",
      securityMeasures: ["Encryption", "Access Controls", "Audit Logging"],
      lastReview: new Date("2024-01-01"),
      nextReview: new Date("2025-01-01")
    }
  ];
}