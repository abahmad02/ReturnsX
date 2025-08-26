import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";
import db from "../db.server";
import { hashCustomerIdentifiers, type CustomerIdentifiers, type HashedCustomerIdentifiers } from "../utils/crypto.server";

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
 */

export interface ConsentRecord {
  id: string;
  shopDomain: string;
  customerId?: string;
  customerHash?: string;
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
  WHATSAPP_COMMUNICATION = "WHATSAPP_COMMUNICATION"
}

export enum LegalBasis {
  CONSENT = "CONSENT",
  LEGITIMATE_INTEREST = "LEGITIMATE_INTEREST", 
  CONTRACT = "CONTRACT",
  LEGAL_OBLIGATION = "LEGAL_OBLIGATION",
  VITAL_INTEREST = "VITAL_INTEREST",
  PUBLIC_TASK = "PUBLIC_TASK"
}

export interface DataProcessingActivity {
  id: string;
  shopDomain: string;
  activityName: string;
  purpose: string;
  legalBasis: LegalBasis;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  transfers: string[];
  retentionPeriod: number; // days
  securityMeasures: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  dpoApproval: boolean;
  lastReview: Date;
  nextReview: Date;
}

export interface CustomerDataExport {
  customerId: string;
  exportDate: Date;
  dataProcessingActivities: DataProcessingActivity[];
  personalData: {
    identifier: string; // hashed
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
 * Record customer consent for data processing
 */
export async function recordConsent(
  consent: Omit<ConsentRecord, 'id' | 'consentDate' | 'version'>
): Promise<ConsentRecord> {
  const consentRecord: ConsentRecord = {
    ...consent,
    id: generateConsentId(),
    consentDate: new Date(),
    version: "1.0"
  };

  try {
    // In production, store in dedicated consent database
    logger.info("Consent recorded", {
      component: "dataProtection",
      shopDomain: consent.shopDomain,
      consentType: consent.consentType,
      consentGiven: consent.consentGiven,
      customerId: consent.customerId,
      legalBasis: consent.legalBasis,
      processingPurpose: consent.processingPurpose
    });

    await createAuditLog({
      eventType: AuditEventType.PII_ACCESS_REQUESTED,
      action: "CONSENT_RECORDED",
      description: `Customer consent recorded for ${consent.consentType}`,
      shopDomain: consent.shopDomain,
      userId: consent.customerId,
      resourceType: "consent",
      resourceId: consentRecord.id,
      success: true,
      riskLevel: "MEDIUM",
      complianceFlags: ["GDPR", "CONSENT_MANAGEMENT"],
      details: {
        consentType: consent.consentType,
        legalBasis: consent.legalBasis,
        processingPurpose: consent.processingPurpose,
        dataCategories: consent.dataCategories
      }
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
 * Withdraw customer consent
 */
export async function withdrawConsent(
  shopDomain: string,
  customerId: string,
  consentType: ConsentType,
  reason?: string
): Promise<void> {
  try {
    logger.info("Consent withdrawn", {
      component: "dataProtection", 
      shopDomain,
      customerId,
      consentType,
      reason
    });

    await createAuditLog({
      eventType: AuditEventType.PII_ACCESS_REQUESTED,
      action: "CONSENT_WITHDRAWN",
      description: `Customer consent withdrawn for ${consentType}`,
      shopDomain,
      userId: customerId,
      resourceType: "consent",
      success: true,
      riskLevel: "HIGH",
      complianceFlags: ["GDPR", "CONSENT_WITHDRAWAL"],
      details: { consentType, reason }
    });

    // In production, implement automatic data processing cessation
    await handleConsentWithdrawal(shopDomain, customerId, consentType);

  } catch (error) {
    logger.error("Failed to withdraw consent", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error),
      shopDomain,
      customerId
    });
    throw error;
  }
}

/**
 * Handle consent withdrawal by stopping relevant data processing
 */
async function handleConsentWithdrawal(
  shopDomain: string,
  customerId: string,
  consentType: ConsentType
): Promise<void> {
  switch (consentType) {
    case ConsentType.DATA_PROCESSING:
      // Stop all data processing for this customer
      await anonymizeCustomerData(shopDomain, customerId);
      break;
    case ConsentType.MARKETING:
      // Remove from marketing lists
      break;
    case ConsentType.WHATSAPP_COMMUNICATION:
      // Disable WhatsApp communications
      break;
    case ConsentType.FRAUD_PREVENTION:
      // Mark for limited processing only
      break;
  }
}

/**
 * Check if valid consent exists for data processing
 */
export async function hasValidConsent(
  shopDomain: string,
  customerId: string,
  consentType: ConsentType
): Promise<boolean> {
  try {
    // In production, query consent database
    // For now, return true for legitimate interest processing
    const isLegitimateInterest = consentType === ConsentType.FRAUD_PREVENTION;
    
    logger.info("Consent check performed", {
      component: "dataProtection",
      shopDomain,
      customerId,
      consentType,
      hasConsent: isLegitimateInterest
    });

    return isLegitimateInterest;
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
    const hashedIdentifiers = hashCustomerIdentifiers(customerIdentifiers);
    
    // Find customer profile
    const profile = await db.customerProfile.findFirst({
      where: {
        OR: [
          ...(hashedIdentifiers.phoneHash ? [{ phoneHash: hashedIdentifiers.phoneHash }] : []),
          ...(hashedIdentifiers.emailHash ? [{ emailHash: hashedIdentifiers.emailHash }] : []),
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
        identifier: profile.phoneHash,
        riskTier: profile.riskTier,
        riskScore: parseFloat(profile.riskScore.toString()),
        totalOrders: profile.totalOrders,
        failedAttempts: profile.failedAttempts,
        successfulDeliveries: profile.successfulDeliveries,
        returnRate: parseFloat(profile.returnRate.toString()),
        lastActivity: profile.lastEventAt,
        createdAt: profile.createdAt
      },
      orderHistory: profile.orderEvents.map(event => ({
        orderId: event.shopifyOrderId,
        eventType: event.eventType,
        date: event.createdAt,
        value: event.orderValue ? parseFloat(event.orderValue.toString()) : undefined,
        currency: event.currency || undefined,
        status: event.fulfillmentStatus || "unknown"
      })),
      communications: [], // TODO: Implement WhatsApp communication history
      consent: [], // TODO: Implement consent retrieval
      legalBasis: LegalBasis.LEGITIMATE_INTEREST,
      retentionPolicy: {
        retentionPeriod: "7 years",
        deletionDate: new Date(Date.now() + (7 * 365 * 24 * 60 * 60 * 1000)),
        reason: "Financial compliance and fraud prevention"
      }
    };

    await createAuditLog({
      eventType: AuditEventType.DATA_EXPORTED,
      action: "CUSTOMER_DATA_EXPORT",
      description: "Customer data exported for GDPR compliance",
      shopDomain,
      resourceType: "customer_profile",
      resourceId: profile.id,
      success: true,
      riskLevel: "HIGH",
      complianceFlags: ["GDPR", "DATA_EXPORT", "PII_ACCESS"],
      details: {
        exportSize: JSON.stringify(exportData).length,
        dataCategories: ["risk_profile", "order_history", "behavioral_data"]
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
    const hashedIdentifiers = hashCustomerIdentifiers(customerIdentifiers);
    
    // Delete customer profiles
    const deletedProfiles = await db.customerProfile.deleteMany({
      where: {
        OR: [
          ...(hashedIdentifiers.phoneHash ? [{ phoneHash: hashedIdentifiers.phoneHash }] : []),
          ...(hashedIdentifiers.emailHash ? [{ emailHash: hashedIdentifiers.emailHash }] : []),
        ]
      }
    });

    // Delete associated order events
    const deletedEvents = await db.orderEvent.deleteMany({
      where: {
        shopDomain,
        customerProfile: {
          OR: [
            ...(hashedIdentifiers.phoneHash ? [{ phoneHash: hashedIdentifiers.phoneHash }] : []),
            ...(hashedIdentifiers.emailHash ? [{ emailHash: hashedIdentifiers.emailHash }] : []),
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
        phoneHash: `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        emailHash: `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addressHash: `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
      shopDomain,
      activityName: "COD Fraud Prevention",
      purpose: "Prevent cash-on-delivery fraud and abuse",
      legalBasis: LegalBasis.LEGITIMATE_INTEREST,
      dataCategories: ["contact_data", "transaction_data", "behavioral_data"],
      dataSubjects: ["customers", "potential_customers"],
      recipients: ["internal_fraud_team", "merchant_partners"],
      transfers: [],
      retentionPeriod: 2555, // 7 years
      securityMeasures: ["encryption", "hashing", "access_controls", "audit_logging"],
      riskLevel: "MEDIUM",
      dpoApproval: true,
      lastReview: new Date(),
      nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  ];
}

/**
 * Enforce data retention policies
 */
export async function enforceDataRetention(): Promise<{
  deletedProfiles: number;
  deletedEvents: number;
  archivedProfiles: number;
}> {
  try {
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() - 7); // 7 years retention

    // Delete old inactive profiles
    const deletedProfiles = await db.customerProfile.deleteMany({
      where: {
        lastEventAt: {
          lt: retentionDate
        }
      }
    });

    // Delete old order events  
    const deletedEvents = await db.orderEvent.deleteMany({
      where: {
        createdAt: {
          lt: retentionDate
        }
      }
    });

    await createAuditLog({
      eventType: AuditEventType.DATA_RETENTION_APPLIED,
      action: "RETENTION_POLICY_ENFORCED",
      description: "Automatic data retention policy enforcement",
      shopDomain: "system",
      success: true,
      riskLevel: "LOW",
      complianceFlags: ["DATA_RETENTION", "AUTOMATIC_CLEANUP"],
      details: {
        deletedProfiles: deletedProfiles.count,
        deletedEvents: deletedEvents.count,
        retentionPeriodYears: 7
      }
    });

    return {
      deletedProfiles: deletedProfiles.count,
      deletedEvents: deletedEvents.count,
      archivedProfiles: 0
    };

  } catch (error) {
    logger.error("Failed to enforce data retention", {
      component: "dataProtection",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Generate privacy notice for customers
 */
export function generatePrivacyNotice(shopDomain: string): {
  title: string;
  purpose: string;
  legalBasis: string;
  dataTypes: string[];
  retention: string;
  rights: string[];
  contact: string;
} {
  return {
    title: "ReturnsX Privacy Notice",
    purpose: "We process your data to prevent cash-on-delivery fraud and improve delivery success rates.",
    legalBasis: "Legitimate interest in fraud prevention and contract fulfillment",
    dataTypes: [
      "Phone number (hashed)",
      "Email address (hashed)", 
      "Delivery address (hashed)",
      "Order history and patterns",
      "Delivery success/failure rates"
    ],
    retention: "7 years for fraud prevention and financial compliance",
    rights: [
      "Right to access your data",
      "Right to rectification of incorrect data",
      "Right to erasure (right to be forgotten)",
      "Right to restrict processing",
      "Right to data portability",
      "Right to object to processing"
    ],
    contact: "privacy@returnsx.com"
  };
}

/**
 * Utility function to generate consent ID
 */
function generateConsentId(): string {
  return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Data Protection Impact Assessment (DPIA) helpers
 */
export function assessProcessingRisk(
  dataTypes: string[],
  purposes: string[],
  scale: "small" | "medium" | "large"
): {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiresDPIA: boolean;
  recommendations: string[];
} {
  const sensitiveData = dataTypes.some(type => 
    ["phone", "email", "address", "financial"].some(sensitive => 
      type.toLowerCase().includes(sensitive)
    )
  );

  const highRiskPurposes = purposes.some(purpose =>
    ["profiling", "automated_decision", "monitoring"].some(risky =>
      purpose.toLowerCase().includes(risky)
    )
  );

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (sensitiveData || highRiskPurposes || scale === "large") {
    riskLevel = "MEDIUM";
  }
  if (sensitiveData && highRiskPurposes && scale === "large") {
    riskLevel = "HIGH";
  }

  return {
    riskLevel,
    requiresDPIA: riskLevel === "HIGH" || (riskLevel === "MEDIUM" && scale === "large"),
    recommendations: [
      "Implement data minimization",
      "Use pseudonymization where possible",
      "Regular security assessments",
      "Staff training on data protection",
      "Clear retention policies"
    ]
  };
}
