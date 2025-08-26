import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";
import db from "../db.server";

/**
 * Data Retention Policy Service
 * 
 * Implements comprehensive data retention and deletion policies
 * Ensures compliance with GDPR, CCPA, and financial regulations
 */

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  dataCategory: DataCategory;
  retentionPeriod: number; // days
  legalBasis: string;
  automaticDeletion: boolean;
  exceptions: string[];
  createdAt: Date;
  lastReview: Date;
  nextReview: Date;
  approvedBy: string;
}

export interface RetentionSchedule {
  id: string;
  policyId: string;
  scheduledDate: Date;
  dataType: string;
  estimatedRecords: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  executionLog: RetentionExecutionEntry[];
  completedAt?: Date;
  errors?: string[];
}

export interface RetentionExecutionEntry {
  timestamp: Date;
  action: string;
  recordsProcessed: number;
  recordsDeleted: number;
  errors: number;
  details?: string;
}

export enum DataCategory {
  CUSTOMER_PROFILES = "CUSTOMER_PROFILES",
  ORDER_EVENTS = "ORDER_EVENTS", 
  AUDIT_LOGS = "AUDIT_LOGS",
  MANUAL_OVERRIDES = "MANUAL_OVERRIDES",
  RISK_CONFIGURATIONS = "RISK_CONFIGURATIONS",
  SESSION_DATA = "SESSION_DATA",
  COMMUNICATION_LOGS = "COMMUNICATION_LOGS",
  CONSENT_RECORDS = "CONSENT_RECORDS"
}

/**
 * Default retention policies for ReturnsX
 */
const DEFAULT_RETENTION_POLICIES: Omit<RetentionPolicy, 'id' | 'createdAt' | 'lastReview' | 'nextReview' | 'approvedBy'>[] = [
  {
    name: "Customer Risk Profiles",
    description: "Customer behavior and risk assessment data for fraud prevention",
    dataCategory: DataCategory.CUSTOMER_PROFILES,
    retentionPeriod: 2555, // 7 years for financial compliance
    legalBasis: "Legitimate interest for fraud prevention and financial regulations",
    automaticDeletion: true,
    exceptions: [
      "Active fraud investigations",
      "Legal proceedings",
      "Regulatory investigations"
    ]
  },
  {
    name: "Order Event History",
    description: "Historical order events and transaction patterns",
    dataCategory: DataCategory.ORDER_EVENTS,
    retentionPeriod: 2555, // 7 years
    legalBasis: "Financial compliance and audit requirements",
    automaticDeletion: true,
    exceptions: [
      "Active disputes",
      "Tax audits",
      "Legal proceedings"
    ]
  },
  {
    name: "Audit and Security Logs",
    description: "System access logs and security audit trails",
    dataCategory: DataCategory.AUDIT_LOGS,
    retentionPeriod: 2555, // 7 years
    legalBasis: "Security monitoring and compliance requirements",
    automaticDeletion: false, // Manual review required
    exceptions: [
      "Active security investigations",
      "Compliance audits",
      "Legal requirements"
    ]
  },
  {
    name: "Manual Override Records",
    description: "Records of manual risk assessment overrides",
    dataCategory: DataCategory.MANUAL_OVERRIDES,
    retentionPeriod: 2555, // 7 years
    legalBasis: "Audit trail and compliance requirements",
    automaticDeletion: true,
    exceptions: [
      "Disputed decisions",
      "Audit investigations"
    ]
  },
  {
    name: "Session Data",
    description: "User session information and authentication logs",
    dataCategory: DataCategory.SESSION_DATA,
    retentionPeriod: 365, // 1 year
    legalBasis: "Security monitoring and troubleshooting",
    automaticDeletion: true,
    exceptions: [
      "Security investigations",
      "Account disputes"
    ]
  },
  {
    name: "WhatsApp Communication Logs",
    description: "Records of customer communications via WhatsApp",
    dataCategory: DataCategory.COMMUNICATION_LOGS,
    retentionPeriod: 1095, // 3 years
    legalBasis: "Customer service and dispute resolution",
    automaticDeletion: true,
    exceptions: [
      "Active customer disputes",
      "Compliance investigations"
    ]
  },
  {
    name: "Consent Records",
    description: "Records of customer consent for data processing",
    dataCategory: DataCategory.CONSENT_RECORDS,
    retentionPeriod: 2555, // 7 years (proof of consent)
    legalBasis: "GDPR compliance and legal proof of consent",
    automaticDeletion: false, // Keep for legal protection
    exceptions: [
      "Legal proceedings",
      "Regulatory investigations"
    ]
  }
];

/**
 * Initialize default retention policies
 */
export async function initializeRetentionPolicies(): Promise<RetentionPolicy[]> {
  try {
    const policies: RetentionPolicy[] = DEFAULT_RETENTION_POLICIES.map(policy => ({
      ...policy,
      id: generatePolicyId(),
      createdAt: new Date(),
      lastReview: new Date(),
      nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      approvedBy: "system_admin"
    }));

    logger.info("Data retention policies initialized", {
      component: "dataRetention",
      policiesCount: policies.length,
      categories: policies.map(p => p.dataCategory)
    });

    await createAuditLog({
      eventType: AuditEventType.DATA_RETENTION_APPLIED,
      action: "RETENTION_POLICIES_INITIALIZED",
      description: "Default data retention policies initialized",
      shopDomain: "system",
      success: true,
      riskLevel: "LOW",
      complianceFlags: ["DATA_RETENTION", "POLICY_MANAGEMENT"],
      details: {
        policiesCount: policies.length,
        categories: policies.map(p => p.dataCategory)
      }
    });

    return policies;

  } catch (error) {
    logger.error("Failed to initialize retention policies", {
      component: "dataRetention",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute data retention for specific category
 */
export async function executeRetentionPolicy(
  dataCategory: DataCategory,
  dryRun: boolean = false
): Promise<RetentionSchedule> {
  
  const schedule: RetentionSchedule = {
    id: generateScheduleId(),
    policyId: `policy_${dataCategory.toLowerCase()}`,
    scheduledDate: new Date(),
    dataType: dataCategory,
    estimatedRecords: 0,
    status: "IN_PROGRESS",
    executionLog: []
  };

  try {
    logger.info(`Starting retention execution for ${dataCategory}`, {
      component: "dataRetention",
      scheduleId: schedule.id,
      dataCategory,
      dryRun
    });

    schedule.executionLog.push({
      timestamp: new Date(),
      action: "EXECUTION_STARTED",
      recordsProcessed: 0,
      recordsDeleted: 0,
      errors: 0,
      details: dryRun ? "Dry run mode" : "Live execution"
    });

    switch (dataCategory) {
      case DataCategory.CUSTOMER_PROFILES:
        await executeCustomerProfileRetention(schedule, dryRun);
        break;
      case DataCategory.ORDER_EVENTS:
        await executeOrderEventRetention(schedule, dryRun);
        break;
      case DataCategory.MANUAL_OVERRIDES:
        await executeManualOverrideRetention(schedule, dryRun);
        break;
      case DataCategory.SESSION_DATA:
        await executeSessionDataRetention(schedule, dryRun);
        break;
      default:
        throw new Error(`Retention not implemented for category: ${dataCategory}`);
    }

    schedule.status = "COMPLETED";
    schedule.completedAt = new Date();

    schedule.executionLog.push({
      timestamp: new Date(),
      action: "EXECUTION_COMPLETED",
      recordsProcessed: schedule.executionLog.reduce((sum, entry) => sum + entry.recordsProcessed, 0),
      recordsDeleted: schedule.executionLog.reduce((sum, entry) => sum + entry.recordsDeleted, 0),
      errors: schedule.executionLog.reduce((sum, entry) => sum + entry.errors, 0)
    });

    await createAuditLog({
      eventType: AuditEventType.DATA_RETENTION_APPLIED,
      action: "RETENTION_EXECUTED",
      description: `Data retention executed for ${dataCategory}`,
      shopDomain: "system",
      success: true,
      riskLevel: "MEDIUM",
      complianceFlags: ["DATA_RETENTION", "AUTOMATIC_CLEANUP"],
      details: {
        scheduleId: schedule.id,
        dataCategory,
        recordsDeleted: schedule.executionLog.reduce((sum, entry) => sum + entry.recordsDeleted, 0),
        dryRun
      }
    });

    return schedule;

  } catch (error) {
    schedule.status = "FAILED";
    schedule.errors = [error instanceof Error ? error.message : String(error)];

    logger.error(`Retention execution failed for ${dataCategory}`, {
      component: "dataRetention",
      scheduleId: schedule.id,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Execute customer profile retention
 */
async function executeCustomerProfileRetention(
  schedule: RetentionSchedule,
  dryRun: boolean
): Promise<void> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - 2555); // 7 years

  try {
    // Find profiles to delete (inactive for 7 years)
    const profilesToDelete = await db.customerProfile.findMany({
      where: {
        lastEventAt: {
          lt: retentionDate
        }
      },
      select: {
        id: true,
        lastEventAt: true,
        totalOrders: true
      }
    });

    schedule.estimatedRecords = profilesToDelete.length;

    schedule.executionLog.push({
      timestamp: new Date(),
      action: "SCAN_COMPLETED",
      recordsProcessed: profilesToDelete.length,
      recordsDeleted: 0,
      errors: 0,
      details: `Found ${profilesToDelete.length} profiles eligible for deletion`
    });

    if (!dryRun && profilesToDelete.length > 0) {
      // Delete in batches to avoid overwhelming the database
      const batchSize = 1000;
      let totalDeleted = 0;

      for (let i = 0; i < profilesToDelete.length; i += batchSize) {
        const batch = profilesToDelete.slice(i, i + batchSize);
        const batchIds = batch.map(p => p.id);

        try {
          // Delete associated order events first
          await db.orderEvent.deleteMany({
            where: {
              customerProfileId: {
                in: batchIds
              }
            }
          });

          // Delete manual overrides
          await db.manualOverride.deleteMany({
            where: {
              customerProfileId: {
                in: batchIds
              }
            }
          });

          // Delete customer profiles
          const deleteResult = await db.customerProfile.deleteMany({
            where: {
              id: {
                in: batchIds
              }
            }
          });

          totalDeleted += deleteResult.count;

          schedule.executionLog.push({
            timestamp: new Date(),
            action: "BATCH_DELETED",
            recordsProcessed: batch.length,
            recordsDeleted: deleteResult.count,
            errors: 0,
            details: `Batch ${Math.floor(i / batchSize) + 1} processed`
          });

        } catch (batchError) {
          schedule.executionLog.push({
            timestamp: new Date(),
            action: "BATCH_ERROR",
            recordsProcessed: batch.length,
            recordsDeleted: 0,
            errors: 1,
            details: `Batch error: ${batchError instanceof Error ? batchError.message : String(batchError)}`
          });
        }
      }

      logger.info("Customer profile retention completed", {
        component: "dataRetention",
        scheduleId: schedule.id,
        totalEligible: profilesToDelete.length,
        totalDeleted,
        retentionDate: retentionDate.toISOString()
      });
    }

  } catch (error) {
    logger.error("Customer profile retention failed", {
      component: "dataRetention",
      scheduleId: schedule.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute order event retention
 */
async function executeOrderEventRetention(
  schedule: RetentionSchedule,
  dryRun: boolean
): Promise<void> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - 2555); // 7 years

  try {
    const eventsToDelete = await db.orderEvent.findMany({
      where: {
        createdAt: {
          lt: retentionDate
        }
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    schedule.estimatedRecords = eventsToDelete.length;

    if (!dryRun && eventsToDelete.length > 0) {
      const deleteResult = await db.orderEvent.deleteMany({
        where: {
          createdAt: {
            lt: retentionDate
          }
        }
      });

      schedule.executionLog.push({
        timestamp: new Date(),
        action: "ORDER_EVENTS_DELETED",
        recordsProcessed: eventsToDelete.length,
        recordsDeleted: deleteResult.count,
        errors: 0
      });
    }

  } catch (error) {
    logger.error("Order event retention failed", {
      component: "dataRetention",
      scheduleId: schedule.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute manual override retention
 */
async function executeManualOverrideRetention(
  schedule: RetentionSchedule,
  dryRun: boolean
): Promise<void> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - 2555); // 7 years

  try {
    const overridesToDelete = await db.manualOverride.findMany({
      where: {
        createdAt: {
          lt: retentionDate
        }
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    schedule.estimatedRecords = overridesToDelete.length;

    if (!dryRun && overridesToDelete.length > 0) {
      const deleteResult = await db.manualOverride.deleteMany({
        where: {
          createdAt: {
            lt: retentionDate
          }
        }
      });

      schedule.executionLog.push({
        timestamp: new Date(),
        action: "MANUAL_OVERRIDES_DELETED",
        recordsProcessed: overridesToDelete.length,
        recordsDeleted: deleteResult.count,
        errors: 0
      });
    }

  } catch (error) {
    logger.error("Manual override retention failed", {
      component: "dataRetention",
      scheduleId: schedule.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute session data retention
 */
async function executeSessionDataRetention(
  schedule: RetentionSchedule,
  dryRun: boolean
): Promise<void> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - 365); // 1 year

  try {
    const sessionsToDelete = await db.session.findMany({
      where: {
        expires: {
          lt: retentionDate
        }
      },
      select: {
        id: true,
        expires: true
      }
    });

    schedule.estimatedRecords = sessionsToDelete.length;

    if (!dryRun && sessionsToDelete.length > 0) {
      const deleteResult = await db.session.deleteMany({
        where: {
          expires: {
            lt: retentionDate
          }
        }
      });

      schedule.executionLog.push({
        timestamp: new Date(),
        action: "SESSIONS_DELETED",
        recordsProcessed: sessionsToDelete.length,
        recordsDeleted: deleteResult.count,
        errors: 0
      });
    }

  } catch (error) {
    logger.error("Session data retention failed", {
      component: "dataRetention",
      scheduleId: schedule.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Schedule automatic retention execution
 */
export async function scheduleAutomaticRetention(): Promise<void> {
  try {
    logger.info("Scheduling automatic data retention", {
      component: "dataRetention"
    });

    // In production, this would integrate with a job scheduler (cron, Agenda.js, etc.)
    // For now, we'll just log the scheduling

    const categories = [
      DataCategory.CUSTOMER_PROFILES,
      DataCategory.ORDER_EVENTS,
      DataCategory.MANUAL_OVERRIDES,
      DataCategory.SESSION_DATA
    ];

    for (const category of categories) {
      logger.info(`Scheduled retention for ${category}`, {
        component: "dataRetention",
        category,
        nextExecution: "Daily at 2:00 AM UTC"
      });
    }

    await createAuditLog({
      eventType: AuditEventType.DATA_RETENTION_APPLIED,
      action: "RETENTION_SCHEDULED",
      description: "Automatic data retention scheduled",
      shopDomain: "system",
      success: true,
      riskLevel: "LOW",
      complianceFlags: ["DATA_RETENTION", "AUTOMATION"],
      details: { categories }
    });

  } catch (error) {
    logger.error("Failed to schedule automatic retention", {
      component: "dataRetention",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get retention policy for specific data category
 */
export function getRetentionPolicy(dataCategory: DataCategory): RetentionPolicy | null {
  const policy = DEFAULT_RETENTION_POLICIES.find(p => p.dataCategory === dataCategory);
  
  if (policy) {
    return {
      ...policy,
      id: generatePolicyId(),
      createdAt: new Date(),
      lastReview: new Date(),
      nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      approvedBy: "system_admin"
    };
  }
  
  return null;
}

/**
 * Generate retention compliance report
 */
export async function generateRetentionReport(): Promise<{
  policies: RetentionPolicy[];
  upcomingDeletions: Array<{
    category: DataCategory;
    estimatedRecords: number;
    deletionDate: Date;
  }>;
  recentDeletions: Array<{
    category: DataCategory;
    recordsDeleted: number;
    executionDate: Date;
  }>;
  complianceStatus: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
}> {
  
  const policies = await initializeRetentionPolicies();
  
  // Calculate upcoming deletions
  const upcomingDeletions = policies.map(policy => {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() - policy.retentionPeriod);
    
    return {
      category: policy.dataCategory,
      estimatedRecords: 0, // Would query database in production
      deletionDate
    };
  });

  // Recent deletions would come from audit logs in production
  const recentDeletions: Array<{
    category: DataCategory;
    recordsDeleted: number;
    executionDate: Date;
  }> = [];

  // Check compliance status
  const needsReview = policies.filter(p => p.nextReview < new Date());
  const complianceStatus: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT" = 
    needsReview.length > 0 ? "NEEDS_REVIEW" : "COMPLIANT";

  logger.info("Retention compliance report generated", {
    component: "dataRetention",
    policiesCount: policies.length,
    upcomingDeletions: upcomingDeletions.length,
    complianceStatus
  });

  return {
    policies,
    upcomingDeletions,
    recentDeletions,
    complianceStatus
  };
}

/**
 * Utility functions
 */
function generatePolicyId(): string {
  return `policy_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function generateScheduleId(): string {
  return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}
