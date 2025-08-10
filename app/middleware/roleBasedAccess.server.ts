import { logger } from "../services/logger.server";

export enum UserRole {
  STORE_OWNER = "STORE_OWNER",           // Full access to all features
  ORDER_MANAGER = "ORDER_MANAGER",       // Customer management, overrides, analytics
  SHIPPER = "SHIPPER",                   // View-only access to orders and status
  SUPPORT_AGENT = "SUPPORT_AGENT",       // WhatsApp communication, view customer profiles
  VIEWER = "VIEWER"                      // Read-only access to dashboard
}

export enum Permission {
  // Customer Management
  VIEW_CUSTOMERS = "VIEW_CUSTOMERS",
  MANAGE_CUSTOMERS = "MANAGE_CUSTOMERS",
  APPLY_MANUAL_OVERRIDES = "APPLY_MANUAL_OVERRIDES",
  
  // Risk Management
  VIEW_RISK_ANALYTICS = "VIEW_RISK_ANALYTICS",
  CONFIGURE_RISK_SETTINGS = "CONFIGURE_RISK_SETTINGS",
  RECALCULATE_RISK_SCORES = "RECALCULATE_RISK_SCORES",
  
  // Communication
  SEND_WHATSAPP_MESSAGES = "SEND_WHATSAPP_MESSAGES",
  VIEW_MESSAGE_HISTORY = "VIEW_MESSAGE_HISTORY",
  
  // System Management
  MANAGE_WEBHOOKS = "MANAGE_WEBHOOKS",
  IMPORT_HISTORICAL_DATA = "IMPORT_HISTORICAL_DATA",
  CONFIGURE_CHECKOUT_ENFORCEMENT = "CONFIGURE_CHECKOUT_ENFORCEMENT",
  
  // API Access
  ACCESS_CUSTOMER_API = "ACCESS_CUSTOMER_API",
  ACCESS_RISK_CONFIG_API = "ACCESS_RISK_CONFIG_API",
  ACCESS_WHATSAPP_API = "ACCESS_WHATSAPP_API",
  
  // Audit & Compliance
  VIEW_AUDIT_LOGS = "VIEW_AUDIT_LOGS",
  EXPORT_DATA = "EXPORT_DATA",
  MANAGE_DATA_RETENTION = "MANAGE_DATA_RETENTION"
}

/**
 * Role-based permission matrix
 * Defines what permissions each role has
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STORE_OWNER]: [
    // Full access to everything
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_CUSTOMERS,
    Permission.APPLY_MANUAL_OVERRIDES,
    Permission.VIEW_RISK_ANALYTICS,
    Permission.CONFIGURE_RISK_SETTINGS,
    Permission.RECALCULATE_RISK_SCORES,
    Permission.SEND_WHATSAPP_MESSAGES,
    Permission.VIEW_MESSAGE_HISTORY,
    Permission.MANAGE_WEBHOOKS,
    Permission.IMPORT_HISTORICAL_DATA,
    Permission.CONFIGURE_CHECKOUT_ENFORCEMENT,
    Permission.ACCESS_CUSTOMER_API,
    Permission.ACCESS_RISK_CONFIG_API,
    Permission.ACCESS_WHATSAPP_API,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_DATA_RETENTION
  ],
  
  [UserRole.ORDER_MANAGER]: [
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_CUSTOMERS,
    Permission.APPLY_MANUAL_OVERRIDES,
    Permission.VIEW_RISK_ANALYTICS,
    Permission.SEND_WHATSAPP_MESSAGES,
    Permission.VIEW_MESSAGE_HISTORY,
    Permission.ACCESS_CUSTOMER_API,
    Permission.ACCESS_WHATSAPP_API,
    Permission.VIEW_AUDIT_LOGS
  ],
  
  [UserRole.SHIPPER]: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_RISK_ANALYTICS,
    Permission.VIEW_MESSAGE_HISTORY,
    Permission.ACCESS_CUSTOMER_API
  ],
  
  [UserRole.SUPPORT_AGENT]: [
    Permission.VIEW_CUSTOMERS,
    Permission.SEND_WHATSAPP_MESSAGES,
    Permission.VIEW_MESSAGE_HISTORY,
    Permission.ACCESS_WHATSAPP_API
  ],
  
  [UserRole.VIEWER]: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_RISK_ANALYTICS,
    Permission.VIEW_MESSAGE_HISTORY
  ]
};

export interface UserSession {
  shopDomain: string;
  userId: string;
  role: UserRole;
  email?: string;
  firstName?: string;
  lastName?: string;
  permissions: Permission[];
  sessionId: string;
  authenticatedAt: Date;
}

/**
 * Determine user role based on Shopify session
 * In a real implementation, this would check a user roles database
 */
export function determineUserRole(shopifySession: any): UserRole {
  // For now, assume store owner if accountOwner is true
  // In production, you'd have a separate user roles system
  if (shopifySession.accountOwner) {
    return UserRole.STORE_OWNER;
  }
  
  // Check for specific email patterns or user IDs for different roles
  if (shopifySession.email) {
    const email = shopifySession.email.toLowerCase();
    
    if (email.includes('manager') || email.includes('admin')) {
      return UserRole.ORDER_MANAGER;
    }
    
    if (email.includes('support') || email.includes('customer-service')) {
      return UserRole.SUPPORT_AGENT;
    }
    
    if (email.includes('shipping') || email.includes('fulfillment')) {
      return UserRole.SHIPPER;
    }
  }
  
  // Default to viewer for collaborators
  return shopifySession.collaborator ? UserRole.VIEWER : UserRole.STORE_OWNER;
}

/**
 * Get permissions for a user role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userSession: UserSession, permission: Permission): boolean {
  return userSession.permissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(userSession: UserSession, permissions: Permission[]): boolean {
  return permissions.some(permission => userSession.permissions.includes(permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(userSession: UserSession, permissions: Permission[]): boolean {
  return permissions.every(permission => userSession.permissions.includes(permission));
}

/**
 * Create user session from Shopify authentication
 */
export function createUserSession(shopifySession: any): UserSession {
  const role = determineUserRole(shopifySession);
  const permissions = getPermissionsForRole(role);
  
  const userSession: UserSession = {
    shopDomain: shopifySession.shop,
    userId: shopifySession.userId?.toString() || shopifySession.id,
    role,
    email: shopifySession.email,
    firstName: shopifySession.firstName,
    lastName: shopifySession.lastName,
    permissions,
    sessionId: shopifySession.id,
    authenticatedAt: new Date()
  };
  
  logger.info("User session created", {
    component: "roleBasedAccess",
    shopDomain: userSession.shopDomain,
    userId: userSession.userId,
    role: userSession.role,
    permissionCount: permissions.length
  });
  
  return userSession;
}

/**
 * Middleware to enforce permission requirements
 */
export function requirePermissions(requiredPermissions: Permission[]) {
  return function(userSession: UserSession): { allowed: boolean; missingPermissions: Permission[] } {
    const missingPermissions = requiredPermissions.filter(
      permission => !userSession.permissions.includes(permission)
    );
    
    const allowed = missingPermissions.length === 0;
    
    if (!allowed) {
      logger.warn("Permission denied", {
        component: "roleBasedAccess",
        shopDomain: userSession.shopDomain,
        userId: userSession.userId,
        role: userSession.role,
        requiredPermissions,
        missingPermissions
      });
    }
    
    return { allowed, missingPermissions };
  };
}

/**
 * Check if user can access specific customer data
 * Additional privacy control beyond role permissions
 */
export function canAccessCustomerData(userSession: UserSession, customerProfileId?: string): boolean {
  // Store owners and order managers can access all customer data
  if ([UserRole.STORE_OWNER, UserRole.ORDER_MANAGER].includes(userSession.role)) {
    return true;
  }
  
  // Support agents can access customer data for communication purposes
  if (userSession.role === UserRole.SUPPORT_AGENT) {
    return hasPermission(userSession, Permission.VIEW_CUSTOMERS);
  }
  
  // Shippers can view basic customer info for delivery purposes
  if (userSession.role === UserRole.SHIPPER) {
    return hasPermission(userSession, Permission.VIEW_CUSTOMERS);
  }
  
  // Viewers have limited access
  return userSession.role === UserRole.VIEWER && hasPermission(userSession, Permission.VIEW_CUSTOMERS);
}

/**
 * Get filtered customer data based on user role
 * Ensures data minimization based on role requirements
 */
export function filterCustomerDataByRole(customerData: any, userSession: UserSession): any {
  const baseData = {
    id: customerData.id,
    riskTier: customerData.riskTier,
    riskScore: customerData.riskScore,
    totalOrders: customerData.totalOrders,
    lastEventAt: customerData.lastEventAt
  };
  
  // Store owners and order managers get full access
  if ([UserRole.STORE_OWNER, UserRole.ORDER_MANAGER].includes(userSession.role)) {
    return customerData;
  }
  
  // Support agents get communication-relevant data
  if (userSession.role === UserRole.SUPPORT_AGENT) {
    return {
      ...baseData,
      phoneHash: customerData.phoneHash,
      emailHash: customerData.emailHash,
      recentEvents: customerData.recentEvents?.map((event: any) => ({
        eventType: event.eventType,
        createdAt: event.createdAt,
        orderValue: event.orderValue,
        currency: event.currency
      }))
    };
  }
  
  // Shippers get delivery-relevant data only
  if (userSession.role === UserRole.SHIPPER) {
    return {
      ...baseData,
      addressHash: customerData.addressHash?.substring(0, 8) + "...", // Partial hash for reference
      failedAttempts: customerData.failedAttempts,
      successfulDeliveries: customerData.successfulDeliveries
    };
  }
  
  // Viewers get minimal data
  return baseData;
}

/**
 * Audit log user action with role context
 */
export function auditUserAction(
  userSession: UserSession,
  action: string,
  resource: string,
  details?: any
) {
  logger.info("User action audited", {
    component: "roleBasedAccess",
    action,
    resource,
    userId: userSession.userId,
    userRole: userSession.role,
    shopDomain: userSession.shopDomain,
    sessionId: userSession.sessionId,
    timestamp: new Date().toISOString(),
    details
  });
}

/**
 * Enhanced authentication that includes role-based access
 */
export async function authenticateWithRoles(request: Request): Promise<{
  admin: any;
  session: any;
  userSession: UserSession;
}> {
  const { authenticate } = await import("../shopify.server");
  const { admin, session } = await authenticate.admin(request);
  
  const userSession = createUserSession(session);
  
  // Log authentication event
  auditUserAction(userSession, "AUTHENTICATE", "SESSION", {
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    url: request.url
  });
  
  return { admin, session, userSession };
}

/**
 * Permission-based route protection decorator
 */
export function withPermissions(permissions: Permission[]) {
  return function(handler: Function) {
    return async function(request: Request, ...args: any[]) {
      const { userSession } = await authenticateWithRoles(request);
      
      const permissionCheck = requirePermissions(permissions);
      const { allowed, missingPermissions } = permissionCheck(userSession);
      
      if (!allowed) {
        auditUserAction(userSession, "ACCESS_DENIED", "ROUTE", {
          url: request.url,
          method: request.method,
          requiredPermissions: permissions,
          missingPermissions
        });
        
        throw new Response("Forbidden: Insufficient permissions", { 
          status: 403,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      
      return handler(request, userSession, ...args);
    };
  };
} 