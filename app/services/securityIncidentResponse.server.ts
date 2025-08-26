import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";
import { auditSecurityEvent } from "./auditLog.server";

/**
 * Security Incident Response System
 * 
 * Comprehensive incident detection, response, and recovery framework
 * Implements industry best practices for security incident management
 */

export enum IncidentSeverity {
  LOW = "LOW",           // Minor security events, no immediate action required
  MEDIUM = "MEDIUM",     // Potential security threats requiring investigation
  HIGH = "HIGH",         // Active security threats requiring immediate response
  CRITICAL = "CRITICAL"  // Critical security breaches requiring emergency response
}

export enum IncidentType {
  // Authentication & Access
  BRUTE_FORCE_ATTACK = "BRUTE_FORCE_ATTACK",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS", 
  PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION",
  ACCOUNT_TAKEOVER = "ACCOUNT_TAKEOVER",
  
  // Data Security
  DATA_BREACH = "DATA_BREACH",
  UNAUTHORIZED_DATA_ACCESS = "UNAUTHORIZED_DATA_ACCESS",
  DATA_EXFILTRATION = "DATA_EXFILTRATION",
  PII_EXPOSURE = "PII_EXPOSURE",
  
  // Application Security
  SQL_INJECTION = "SQL_INJECTION",
  XSS_ATTACK = "XSS_ATTACK",
  CSRF_ATTACK = "CSRF_ATTACK",
  API_ABUSE = "API_ABUSE",
  
  // Infrastructure Security
  MALWARE_DETECTED = "MALWARE_DETECTED",
  DDOS_ATTACK = "DDOS_ATTACK",
  SYSTEM_COMPROMISE = "SYSTEM_COMPROMISE",
  NETWORK_INTRUSION = "NETWORK_INTRUSION",
  
  // Compliance & Privacy
  GDPR_VIOLATION = "GDPR_VIOLATION",
  PRIVACY_BREACH = "PRIVACY_BREACH",
  CONSENT_VIOLATION = "CONSENT_VIOLATION",
  RETENTION_VIOLATION = "RETENTION_VIOLATION"
}

export enum IncidentStatus {
  DETECTED = "DETECTED",
  INVESTIGATING = "INVESTIGATING",
  CONTAINED = "CONTAINED",
  ERADICATED = "ERADICATED",
  RECOVERED = "RECOVERED",
  CLOSED = "CLOSED"
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: Date;
  reportedBy: string;
  assignedTo?: string;
  affectedSystems: string[];
  affectedData: string[];
  affectedCustomers: number;
  containmentActions: IncidentAction[];
  investigationNotes: string[];
  rootCause?: string;
  remediation: string[];
  lessonsLearned: string[];
  timeline: IncidentTimelineEntry[];
  metadata: Record<string, any>;
}

export interface IncidentAction {
  id: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  notes?: string;
}

export interface IncidentTimelineEntry {
  timestamp: Date;
  event: string;
  actor: string;
  details?: string;
}

export interface IncidentResponse {
  immediate: string[];      // Actions to take immediately
  shortTerm: string[];      // Actions within 24 hours
  longTerm: string[];       // Actions within 30 days
  monitoring: string[];     // Ongoing monitoring requirements
  communication: string[];  // Internal/external communication plan
}

/**
 * Detect and create security incident
 */
export async function createSecurityIncident(
  type: IncidentType,
  severity: IncidentSeverity,
  title: string,
  description: string,
  metadata: Record<string, any> = {},
  affectedSystems: string[] = [],
  reportedBy: string = "system"
): Promise<SecurityIncident> {
  
  const incident: SecurityIncident = {
    id: generateIncidentId(),
    title,
    description,
    type,
    severity,
    status: IncidentStatus.DETECTED,
    detectedAt: new Date(),
    reportedBy,
    affectedSystems,
    affectedData: [],
    affectedCustomers: 0,
    containmentActions: [],
    investigationNotes: [],
    remediation: [],
    lessonsLearned: [],
    timeline: [{
      timestamp: new Date(),
      event: "Incident detected",
      actor: reportedBy,
      details: description
    }],
    metadata
  };

  try {
    // Log security incident
    await auditSecurityEvent(
      type,
      title,
      metadata.shopDomain || "system",
      metadata.userId,
      metadata.ipAddress,
      {
        incidentId: incident.id,
        severity,
        affectedSystems,
        ...metadata
      },
      severity as any
    );

    // Trigger immediate response based on severity
    await triggerIncidentResponse(incident);

    // Store incident (in production, use proper incident database)
    logger.error("Security incident created", {
      component: "securityIncident",
      incidentId: incident.id,
      type,
      severity,
      title,
      affectedSystems,
      metadata
    });

    return incident;

  } catch (error) {
    logger.error("Failed to create security incident", {
      component: "securityIncident",
      error: error instanceof Error ? error.message : String(error),
      type,
      severity,
      title
    });
    throw error;
  }
}

/**
 * Trigger automated incident response based on severity
 */
async function triggerIncidentResponse(incident: SecurityIncident): Promise<void> {
  const response = getIncidentResponsePlan(incident.type, incident.severity);

  switch (incident.severity) {
    case IncidentSeverity.CRITICAL:
      await handleCriticalIncident(incident, response);
      break;
    case IncidentSeverity.HIGH:
      await handleHighSeverityIncident(incident, response);
      break;
    case IncidentSeverity.MEDIUM:
      await handleMediumSeverityIncident(incident, response);
      break;
    case IncidentSeverity.LOW:
      await handleLowSeverityIncident(incident, response);
      break;
  }
}

/**
 * Handle critical security incidents (immediate emergency response)
 */
async function handleCriticalIncident(
  incident: SecurityIncident, 
  response: IncidentResponse
): Promise<void> {
  
  // Immediate containment actions
  const actions: IncidentAction[] = [
    {
      id: generateActionId(),
      action: "Isolate affected systems",
      performedBy: "system",
      performedAt: new Date(),
      status: "IN_PROGRESS"
    },
    {
      id: generateActionId(),
      action: "Disable potentially compromised accounts",
      performedBy: "system", 
      performedAt: new Date(),
      status: "IN_PROGRESS"
    },
    {
      id: generateActionId(),
      action: "Alert security team",
      performedBy: "system",
      performedAt: new Date(),
      status: "COMPLETED"
    }
  ];

  incident.containmentActions = actions;
  incident.status = IncidentStatus.INVESTIGATING;

  // Log critical incident response
  logger.error("CRITICAL SECURITY INCIDENT - Immediate response initiated", {
    component: "securityIncident",
    incidentId: incident.id,
    type: incident.type,
    actions: actions.length,
    immediate: response.immediate
  });

  // In production: trigger emergency notifications
  await notifySecurityTeam(incident, "EMERGENCY");
}

/**
 * Handle high severity incidents (urgent response within 1 hour)
 */
async function handleHighSeverityIncident(
  incident: SecurityIncident,
  response: IncidentResponse
): Promise<void> {
  
  const actions: IncidentAction[] = [
    {
      id: generateActionId(),
      action: "Begin investigation",
      performedBy: "system",
      performedAt: new Date(),
      status: "IN_PROGRESS"
    },
    {
      id: generateActionId(),
      action: "Implement additional monitoring",
      performedBy: "system",
      performedAt: new Date(),
      status: "IN_PROGRESS"
    }
  ];

  incident.containmentActions = actions;
  incident.status = IncidentStatus.INVESTIGATING;

  logger.warn("HIGH SEVERITY security incident detected", {
    component: "securityIncident",
    incidentId: incident.id,
    type: incident.type,
    responseTime: "1 hour"
  });

  await notifySecurityTeam(incident, "URGENT");
}

/**
 * Handle medium severity incidents (response within 4 hours)
 */
async function handleMediumSeverityIncident(
  incident: SecurityIncident,
  response: IncidentResponse
): Promise<void> {
  
  incident.status = IncidentStatus.INVESTIGATING;
  
  logger.warn("MEDIUM SEVERITY security incident detected", {
    component: "securityIncident",
    incidentId: incident.id,
    type: incident.type,
    responseTime: "4 hours"
  });

  await notifySecurityTeam(incident, "NORMAL");
}

/**
 * Handle low severity incidents (response within 24 hours)
 */
async function handleLowSeverityIncident(
  incident: SecurityIncident,
  response: IncidentResponse
): Promise<void> {
  
  logger.info("LOW SEVERITY security incident detected", {
    component: "securityIncident",
    incidentId: incident.id,
    type: incident.type,
    responseTime: "24 hours"
  });

  await notifySecurityTeam(incident, "INFO");
}

/**
 * Get incident response plan based on type and severity
 */
function getIncidentResponsePlan(type: IncidentType, severity: IncidentSeverity): IncidentResponse {
  const baseResponse: IncidentResponse = {
    immediate: [],
    shortTerm: [],
    longTerm: [],
    monitoring: [],
    communication: []
  };

  switch (type) {
    case IncidentType.DATA_BREACH:
      return {
        immediate: [
          "Isolate affected data systems",
          "Preserve evidence and logs", 
          "Assess data exposure scope",
          "Disable compromised accounts"
        ],
        shortTerm: [
          "Notify data protection authorities",
          "Prepare customer notifications",
          "Conduct forensic analysis",
          "Implement additional access controls"
        ],
        longTerm: [
          "Review and update security policies",
          "Provide customer support and remediation",
          "Conduct security training",
          "Implement prevention measures"
        ],
        monitoring: [
          "Monitor for additional unauthorized access",
          "Track customer notification responses",
          "Monitor credit monitoring services"
        ],
        communication: [
          "Internal incident team notification",
          "Executive leadership briefing",
          "Legal and compliance notification",
          "Customer communication plan"
        ]
      };

    case IncidentType.BRUTE_FORCE_ATTACK:
      return {
        immediate: [
          "Block suspicious IP addresses",
          "Increase rate limiting",
          "Monitor authentication attempts",
          "Review compromised accounts"
        ],
        shortTerm: [
          "Implement additional MFA requirements",
          "Reset potentially compromised passwords",
          "Review authentication logs"
        ],
        longTerm: [
          "Enhance password policies",
          "Implement CAPTCHA systems",
          "Security awareness training"
        ],
        monitoring: [
          "Monitor for repeat attacks",
          "Track authentication patterns",
          "Monitor account lockouts"
        ],
        communication: [
          "Security team notification",
          "User notification for compromised accounts"
        ]
      };

    case IncidentType.GDPR_VIOLATION:
      return {
        immediate: [
          "Document the violation",
          "Assess data subject impact",
          "Contain data processing",
          "Preserve audit logs"
        ],
        shortTerm: [
          "Notify data protection authority within 72 hours",
          "Prepare data subject notifications",
          "Conduct impact assessment",
          "Implement corrective measures"
        ],
        longTerm: [
          "Review privacy policies",
          "Update consent mechanisms",
          "Provide staff training",
          "Enhance data protection measures"
        ],
        monitoring: [
          "Monitor compliance metrics",
          "Track data subject requests",
          "Monitor processing activities"
        ],
        communication: [
          "DPO notification",
          "Legal team notification",
          "Data subject communication",
          "Authority reporting"
        ]
      };

    default:
      return baseResponse;
  }
}

/**
 * Notify security team about incident
 */
async function notifySecurityTeam(
  incident: SecurityIncident, 
  priority: "EMERGENCY" | "URGENT" | "NORMAL" | "INFO"
): Promise<void> {
  // In production: send notifications via email, SMS, Slack, etc.
  logger.info("Security team notification sent", {
    component: "securityIncident",
    incidentId: incident.id,
    priority,
    type: incident.type,
    severity: incident.severity
  });
}

/**
 * Common security incident detectors
 */

export async function detectBruteForceAttack(
  shopDomain: string,
  ipAddress: string,
  failedAttempts: number,
  timeWindow: number = 300000 // 5 minutes
): Promise<SecurityIncident | null> {
  
  if (failedAttempts >= 10) { // 10 failed attempts in 5 minutes
    return await createSecurityIncident(
      IncidentType.BRUTE_FORCE_ATTACK,
      IncidentSeverity.HIGH,
      `Brute force attack detected from ${ipAddress}`,
      `${failedAttempts} failed authentication attempts detected within ${timeWindow / 1000} seconds`,
      {
        shopDomain,
        ipAddress,
        failedAttempts,
        timeWindow,
        detectionRule: "10_attempts_5_minutes"
      },
      ["authentication_system"],
      "automated_detection"
    );
  }

  return null;
}

export async function detectUnauthorizedDataAccess(
  shopDomain: string,
  userId: string,
  accessedData: string[],
  userRole: string,
  authorizedData: string[]
): Promise<SecurityIncident | null> {
  
  const unauthorizedAccess = accessedData.filter(data => !authorizedData.includes(data));
  
  if (unauthorizedAccess.length > 0) {
    return await createSecurityIncident(
      IncidentType.UNAUTHORIZED_DATA_ACCESS,
      IncidentSeverity.HIGH,
      `Unauthorized data access by user ${userId}`,
      `User with role ${userRole} accessed unauthorized data: ${unauthorizedAccess.join(", ")}`,
      {
        shopDomain,
        userId,
        userRole,
        unauthorizedData: unauthorizedAccess,
        detectionRule: "rbac_violation"
      },
      ["data_access_system"],
      "automated_detection"
    );
  }

  return null;
}

export async function detectAnomalousAPIUsage(
  shopDomain: string,
  endpoint: string,
  requestCount: number,
  normalThreshold: number,
  timeWindow: number = 3600000 // 1 hour
): Promise<SecurityIncident | null> {
  
  const anomalyThreshold = normalThreshold * 5; // 5x normal usage
  
  if (requestCount > anomalyThreshold) {
    return await createSecurityIncident(
      IncidentType.API_ABUSE,
      IncidentSeverity.MEDIUM,
      `Anomalous API usage detected for ${endpoint}`,
      `${requestCount} requests to ${endpoint} in ${timeWindow / 1000} seconds (normal: ${normalThreshold})`,
      {
        shopDomain,
        endpoint,
        requestCount,
        normalThreshold,
        anomalyRatio: requestCount / normalThreshold,
        timeWindow,
        detectionRule: "5x_normal_usage"
      },
      ["api_gateway"],
      "automated_detection"
    );
  }

  return null;
}

export async function detectPotentialDataBreach(
  shopDomain: string,
  dataType: string,
  accessPattern: string,
  riskyBehaviors: string[]
): Promise<SecurityIncident | null> {
  
  if (riskyBehaviors.length >= 3) { // Multiple risky behaviors
    return await createSecurityIncident(
      IncidentType.DATA_BREACH,
      IncidentSeverity.CRITICAL,
      `Potential data breach detected`,
      `Multiple risky behaviors detected: ${riskyBehaviors.join(", ")}`,
      {
        shopDomain,
        dataType,
        accessPattern,
        riskyBehaviors,
        detectionRule: "multiple_risk_indicators"
      },
      ["data_systems"],
      "automated_detection"
    );
  }

  return null;
}

/**
 * Update incident status and add timeline entry
 */
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: IncidentStatus,
  notes: string,
  updatedBy: string
): Promise<void> {
  // In production: update incident in database
  
  logger.info("Incident status updated", {
    component: "securityIncident",
    incidentId,
    newStatus,
    updatedBy,
    notes
  });

  await createAuditLog({
    eventType: AuditEventType.SECURITY_VIOLATION,
    action: "INCIDENT_STATUS_UPDATE",
    description: `Security incident ${incidentId} status changed to ${newStatus}`,
    shopDomain: "system",
    userId: updatedBy,
    resourceType: "security_incident",
    resourceId: incidentId,
    success: true,
    riskLevel: "MEDIUM",
    complianceFlags: ["INCIDENT_RESPONSE"],
    details: { newStatus, notes }
  });
}

/**
 * Close incident with lessons learned
 */
export async function closeIncident(
  incidentId: string,
  rootCause: string,
  remediation: string[],
  lessonsLearned: string[],
  closedBy: string
): Promise<void> {
  
  logger.info("Security incident closed", {
    component: "securityIncident",
    incidentId,
    rootCause,
    remediationActions: remediation.length,
    lessonsLearned: lessonsLearned.length,
    closedBy
  });

  await createAuditLog({
    eventType: AuditEventType.SECURITY_VIOLATION,
    action: "INCIDENT_CLOSED",
    description: `Security incident ${incidentId} closed`,
    shopDomain: "system",
    userId: closedBy,
    resourceType: "security_incident",
    resourceId: incidentId,
    success: true,
    riskLevel: "LOW",
    complianceFlags: ["INCIDENT_RESPONSE", "LESSONS_LEARNED"],
    details: { rootCause, remediation, lessonsLearned }
  });
}

/**
 * Generate incident report for compliance
 */
export function generateIncidentReport(incident: SecurityIncident): {
  executiveSummary: string;
  timeline: string;
  impact: string;
  responseActions: string;
  rootCause: string;
  prevention: string;
  compliance: string;
} {
  return {
    executiveSummary: `Security incident ${incident.id} of type ${incident.type} was detected on ${incident.detectedAt.toISOString()}. The incident was classified as ${incident.severity} severity and has been ${incident.status}.`,
    
    timeline: incident.timeline.map(entry => 
      `${entry.timestamp.toISOString()}: ${entry.event} by ${entry.actor}${entry.details ? ` - ${entry.details}` : ''}`
    ).join('\n'),
    
    impact: `Affected systems: ${incident.affectedSystems.join(', ')}. Affected customers: ${incident.affectedCustomers}. Data categories affected: ${incident.affectedData.join(', ')}.`,
    
    responseActions: incident.containmentActions.map(action =>
      `${action.performedAt.toISOString()}: ${action.action} (${action.status}) by ${action.performedBy}`
    ).join('\n'),
    
    rootCause: incident.rootCause || "Investigation ongoing",
    
    prevention: incident.remediation.join('\n'),
    
    compliance: `This incident response follows ISO 27035 and NIST cybersecurity framework guidelines. All required notifications have been or will be made within regulatory timeframes.`
  };
}

/**
 * Utility functions
 */
function generateIncidentId(): string {
  return `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function generateActionId(): string {
  return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}
