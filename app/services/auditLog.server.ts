import { logger } from "./logger.server";

export enum AuditEventType {
  // Authentication & Access
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  ACCESS_DENIED = "ACCESS_DENIED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  
  // Customer Data
  CUSTOMER_PROFILE_CREATED = "CUSTOMER_PROFILE_CREATED",
  CUSTOMER_PROFILE_UPDATED = "CUSTOMER_PROFILE_UPDATED",
  CUSTOMER_PROFILE_VIEWED = "CUSTOMER_PROFILE_VIEWED",
  CUSTOMER_RISK_CALCULATED = "CUSTOMER_RISK_CALCULATED",
  
  // Manual Overrides
  MANUAL_OVERRIDE_APPLIED = "MANUAL_OVERRIDE_APPLIED",
  RISK_TIER_CHANGED = "RISK_TIER_CHANGED",
  FAILED_ATTEMPTS_RESET = "FAILED_ATTEMPTS_RESET",
  CUSTOMER_FORGIVEN = "CUSTOMER_FORGIVEN",
  
  // Risk Configuration
  RISK_CONFIG_UPDATED = "RISK_CONFIG_UPDATED",
  RISK_THRESHOLDS_CHANGED = "RISK_THRESHOLDS_CHANGED",
  BULK_RISK_RECALCULATION = "BULK_RISK_RECALCULATION",
  
  // WhatsApp Communication
  WHATSAPP_MESSAGE_SENT = "WHATSAPP_MESSAGE_SENT",
  WHATSAPP_MESSAGE_RECEIVED = "WHATSAPP_MESSAGE_RECEIVED",
  WHATSAPP_CONFIG_UPDATED = "WHATSAPP_CONFIG_UPDATED",
  
  // System Events
  WEBHOOK_REGISTERED = "WEBHOOK_REGISTERED",
  WEBHOOK_PROCESSED = "WEBHOOK_PROCESSED",
  WEBHOOK_FAILED = "WEBHOOK_FAILED",
  HISTORICAL_IMPORT_STARTED = "HISTORICAL_IMPORT_STARTED",
  HISTORICAL_IMPORT_COMPLETED = "HISTORICAL_IMPORT_COMPLETED",
  
  // API Access
  API_REQUEST = "API_REQUEST",
  API_RATE_LIMIT_EXCEEDED = "API_RATE_LIMIT_EXCEEDED",
  
  // Data Export & Privacy
  DATA_EXPORTED = "DATA_EXPORTED",
  DATA_RETENTION_APPLIED = "DATA_RETENTION_APPLIED",
  PII_ACCESS_REQUESTED = "PII_ACCESS_REQUESTED",
  
  // Security Events
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  SECURITY_VIOLATION = "SECURITY_VIOLATION",
  CHECKOUT_ENFORCEMENT_TRIGGERED = "CHECKOUT_ENFORCEMENT_TRIGGERED"
}

export interface AuditLogEntry {
  id?: string;
  eventType: AuditEventType;
  timestamp: Date;
  
  // User Context
  userId?: string;
  userRole?: string;
  sessionId?: string;
  
  // Shop Context
  shopDomain: string;
  
  // Resource Context
  resourceType?: string;
  resourceId?: string;
  
  // Event Details
  action: string;
  description: string;
  details?: Record<string, any>;
  
  // Request Context
  ipAddress?: string;
  userAgent?: string;
  requestUrl?: string;
  requestMethod?: string;
  
  // Risk & Compliance
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  complianceFlags?: string[];
  
  // Outcome
  success: boolean;
  errorMessage?: string;
}

export interface AuditQuery {
  shopDomain?: string;
  eventTypes?: AuditEventType[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  riskLevel?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Create and store an audit log entry
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const auditEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date()
  };
  
  try {
    // Log to structured logger for immediate monitoring
    logger.info("Audit event recorded", {
      component: "auditLog",
      eventType: auditEntry.eventType,
      action: auditEntry.action,
      shopDomain: auditEntry.shopDomain,
      userId: auditEntry.userId,
      resourceType: auditEntry.resourceType,
      resourceId: auditEntry.resourceId,
      success: auditEntry.success,
      riskLevel: auditEntry.riskLevel,
      timestamp: auditEntry.timestamp.toISOString()
    });
    
    // Store in database for compliance and querying
    // Note: In production, you'd want a separate audit log table
    // For now, we'll use the logger as the primary audit store
    
    // Flag high-risk events for immediate attention
    if (auditEntry.riskLevel === "CRITICAL" || auditEntry.riskLevel === "HIGH") {
      logger.warn("High-risk audit event detected", {
        component: "auditLog",
        eventType: auditEntry.eventType,
        action: auditEntry.action,
        shopDomain: auditEntry.shopDomain,
        userId: auditEntry.userId,
        details: auditEntry.details,
        riskLevel: auditEntry.riskLevel
      });
    }
    
    // Check for compliance flags
    if (auditEntry.complianceFlags && auditEntry.complianceFlags.length > 0) {
      logger.info("Compliance-flagged event", {
        component: "auditLog",
        eventType: auditEntry.eventType,
        complianceFlags: auditEntry.complianceFlags,
        shopDomain: auditEntry.shopDomain,
        userId: auditEntry.userId
      });
    }
    
  } catch (error) {
    logger.error("Failed to create audit log entry", {
      component: "auditLog",
      error: error instanceof Error ? error.message : String(error),
      eventType: auditEntry.eventType,
      shopDomain: auditEntry.shopDomain
    });
  }
}

/**
 * Convenience functions for common audit events
 */

export async function auditUserAuthentication(
  userId: string,
  shopDomain: string,
  sessionId: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
) {
  await createAuditLog({
    eventType: success ? AuditEventType.USER_LOGIN : AuditEventType.ACCESS_DENIED,
    action: success ? "USER_AUTHENTICATED" : "AUTHENTICATION_FAILED",
    description: success ? "User successfully authenticated" : "User authentication failed",
    shopDomain,
    userId,
    sessionId,
    ipAddress,
    userAgent,
    success,
    errorMessage,
    riskLevel: success ? "LOW" : "MEDIUM",
    details: { authenticationMethod: "shopify_oauth" }
  });
}

export async function auditCustomerProfileAccess(
  customerProfileId: string,
  action: string,
  shopDomain: string,
  userId: string,
  userRole: string,
  details?: any,
  success: boolean = true
) {
  await createAuditLog({
    eventType: AuditEventType.CUSTOMER_PROFILE_VIEWED,
    action,
    description: `Customer profile ${action}`,
    shopDomain,
    userId,
    userRole,
    resourceType: "customer_profile",
    resourceId: customerProfileId,
    success,
    riskLevel: "MEDIUM", // Customer data access is always medium risk
    complianceFlags: ["PII_ACCESS"],
    details
  });
}

export async function auditManualOverride(
  customerProfileId: string,
  overrideType: string,
  previousValue: string,
  newValue: string,
  reason: string,
  shopDomain: string,
  userId: string,
  userRole: string
) {
  await createAuditLog({
    eventType: AuditEventType.MANUAL_OVERRIDE_APPLIED,
    action: "MANUAL_OVERRIDE",
    description: `Manual override applied: ${overrideType}`,
    shopDomain,
    userId,
    userRole,
    resourceType: "customer_profile",
    resourceId: customerProfileId,
    success: true,
    riskLevel: "HIGH", // Manual overrides are high-risk events
    complianceFlags: ["MANUAL_INTERVENTION", "RISK_MODIFICATION"],
    details: {
      overrideType,
      previousValue,
      newValue,
      reason,
      timestamp: new Date().toISOString()
    }
  });
}

export async function auditWhatsAppCommunication(
  messageType: string,
  customerPhone: string,
  messageContent: string,
  shopDomain: string,
  userId?: string,
  success: boolean = true,
  errorMessage?: string
) {
  await createAuditLog({
    eventType: AuditEventType.WHATSAPP_MESSAGE_SENT,
    action: "WHATSAPP_MESSAGE",
    description: `WhatsApp ${messageType} message sent`,
    shopDomain,
    userId,
    resourceType: "whatsapp_message",
    success,
    errorMessage,
    riskLevel: "LOW",
    complianceFlags: ["CUSTOMER_COMMUNICATION"],
    details: {
      messageType,
      customerPhone: customerPhone.substring(0, 8) + "...", // Partial phone for audit
      messageLength: messageContent.length,
      timestamp: new Date().toISOString()
    }
  });
}

export async function auditRiskCalculation(
  customerProfileId: string,
  previousRiskScore: number,
  newRiskScore: number,
  previousTier: string,
  newTier: string,
  shopDomain: string,
  calculationDetails?: any
) {
  await createAuditLog({
    eventType: AuditEventType.CUSTOMER_RISK_CALCULATED,
    action: "RISK_CALCULATION",
    description: "Customer risk score calculated",
    shopDomain,
    resourceType: "customer_profile",
    resourceId: customerProfileId,
    success: true,
    riskLevel: newTier === "HIGH_RISK" ? "HIGH" : "LOW",
    details: {
      previousRiskScore,
      newRiskScore,
      previousTier,
      newTier,
      scoreChange: newRiskScore - previousRiskScore,
      calculationDetails,
      timestamp: new Date().toISOString()
    }
  });
}

export async function auditAPIRequest(
  endpoint: string,
  method: string,
  shopDomain: string,
  userId?: string,
  userRole?: string,
  ipAddress?: string,
  userAgent?: string,
  responseStatus?: number,
  responseTime?: number,
  rateLimitExceeded: boolean = false
) {
  await createAuditLog({
    eventType: rateLimitExceeded ? AuditEventType.API_RATE_LIMIT_EXCEEDED : AuditEventType.API_REQUEST,
    action: "API_REQUEST",
    description: `API ${method} request to ${endpoint}`,
    shopDomain,
    userId,
    userRole,
    requestUrl: endpoint,
    requestMethod: method,
    ipAddress,
    userAgent,
    success: !rateLimitExceeded && (responseStatus ? responseStatus < 400 : true),
    riskLevel: rateLimitExceeded ? "HIGH" : "LOW",
    details: {
      responseStatus,
      responseTime,
      rateLimitExceeded,
      timestamp: new Date().toISOString()
    }
  });
}

export async function auditDataExport(
  exportType: string,
  recordCount: number,
  shopDomain: string,
  userId: string,
  userRole: string,
  ipAddress?: string
) {
  await createAuditLog({
    eventType: AuditEventType.DATA_EXPORTED,
    action: "DATA_EXPORT",
    description: `Data export performed: ${exportType}`,
    shopDomain,
    userId,
    userRole,
    ipAddress,
    success: true,
    riskLevel: "HIGH", // Data exports are high-risk for privacy
    complianceFlags: ["DATA_EXPORT", "PII_ACCESS", "GDPR_RELEVANT"],
    details: {
      exportType,
      recordCount,
      timestamp: new Date().toISOString()
    }
  });
}

export async function auditSecurityEvent(
  eventType: string,
  description: string,
  shopDomain: string,
  userId?: string,
  ipAddress?: string,
  details?: any,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "HIGH"
) {
  await createAuditLog({
    eventType: AuditEventType.SECURITY_VIOLATION,
    action: "SECURITY_EVENT",
    description: `Security event: ${description}`,
    shopDomain,
    userId,
    ipAddress,
    success: false, // Security events are always failures
    riskLevel,
    complianceFlags: ["SECURITY_INCIDENT"],
    details: {
      securityEventType: eventType,
      ...details,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Query audit logs with filtering
 * In production, this would query a proper audit log database
 */
export async function queryAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
  // For now, return empty array as we're using logger-based auditing
  // In production, implement actual database queries
  logger.info("Audit log query requested", {
    component: "auditLog",
    query,
    note: "Database querying not implemented - using structured logs"
  });
  
  return [];
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(
  shopDomain: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  securityEvents: number;
  dataAccessEvents: number;
  complianceFlags: Record<string, number>;
}> {
  // In production, this would query the audit database
  logger.info("Compliance report requested", {
    component: "auditLog",
    shopDomain,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    note: "Report generation not implemented - using structured logs"
  });
  
  return {
    totalEvents: 0,
    eventsByType: {},
    securityEvents: 0,
    dataAccessEvents: 0,
    complianceFlags: {}
  };
}

/**
 * Check for suspicious activity patterns
 */
export async function detectSuspiciousActivity(
  shopDomain: string,
  userId?: string,
  timeWindow: number = 3600000 // 1 hour in milliseconds
): Promise<{
  suspiciousPatterns: string[];
  riskScore: number;
  recommendedActions: string[];
}> {
  // In production, implement actual pattern detection
  logger.info("Suspicious activity check requested", {
    component: "auditLog",
    shopDomain,
    userId,
    timeWindow,
    note: "Pattern detection not implemented - using basic monitoring"
  });
  
  return {
    suspiciousPatterns: [],
    riskScore: 0,
    recommendedActions: []
  };
}

/**
 * Retention policy enforcement
 * Automatically clean up old audit logs based on compliance requirements
 */
export async function enforceRetentionPolicy(
  retentionPeriodDays: number = 2555 // 7 years default for financial compliance
): Promise<{
  deletedRecords: number;
  oldestRemainingRecord: Date;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodDays);
  
  logger.info("Audit log retention policy enforcement", {
    component: "auditLog",
    retentionPeriodDays,
    cutoffDate: cutoffDate.toISOString(),
    note: "Retention enforcement not implemented - define policy"
  });
  
  return {
    deletedRecords: 0,
    oldestRemainingRecord: new Date()
  };
} 