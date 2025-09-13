/**
 * Authentication State Handler for ReturnsX UI Extensions
 * 
 * Handles different authentication states for both Customer Account and Post-Purchase extensions
 * with proper privacy compliance and graceful degradation
 */

export interface AuthenticationState {
  level: 'authenticated' | 'pre-authenticated' | 'unauthenticated' | 'anonymous';
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  canAccessPrivateData: boolean;
  canDisplayRiskScore: boolean;
  restrictions: string[];
}

/**
 * Determine authentication state from extension context
 */
export function determineAuthState(buyerIdentity: any, context: 'customer-account' | 'post-purchase'): AuthenticationState {
  // Customer Account extensions require authenticated state
  if (context === 'customer-account') {
    if (!buyerIdentity?.customer) {
      return {
        level: 'unauthenticated',
        canAccessPrivateData: false,
        canDisplayRiskScore: false,
        restrictions: [
          'Customer must log in to view risk profile',
          'Private customer data not accessible',
          'Risk scoring requires authentication'
        ]
      };
    }

    if (!buyerIdentity.customer.id) {
      return {
        level: 'pre-authenticated',
        customerEmail: buyerIdentity.customer.email,
        canAccessPrivateData: false,
        canDisplayRiskScore: false,
        restrictions: [
          'Complete login required for full risk profile',
          'Limited customer information available',
          'Phone number access restricted'
        ]
      };
    }

    // Fully authenticated
    return {
      level: 'authenticated',
      customerId: buyerIdentity.customer.id,
      customerEmail: buyerIdentity.customer.email,
      customerPhone: buyerIdentity.customer.phone,
      canAccessPrivateData: true,
      canDisplayRiskScore: true,
      restrictions: []
    };
  }

  // Post-Purchase extensions work with checkout context
  if (context === 'post-purchase') {
    // In post-purchase, we have limited customer data from checkout
    return {
      level: 'anonymous',
      canAccessPrivateData: false,
      canDisplayRiskScore: true, // Can show basic risk info
      restrictions: [
        'Limited customer data available in post-purchase context',
        'Phone number may not be accessible',
        'Risk profile based on checkout information only'
      ]
    };
  }

  return {
    level: 'unauthenticated',
    canAccessPrivateData: false,
    canDisplayRiskScore: false,
    restrictions: ['Unknown context']
  };
}

/**
 * Get customer identification data based on auth state and privacy rules
 */
export function getCustomerIdentification(
  authState: AuthenticationState,
  checkoutData?: any
): {
  phone?: string;
  email?: string;
  customerId?: string;
  canMakeApiCall: boolean;
  privacyCompliant: boolean;
} {
  const result = {
    canMakeApiCall: false,
    privacyCompliant: true
  };

  // Authenticated customer account access
  if (authState.level === 'authenticated' && authState.canAccessPrivateData) {
    return {
      ...result,
      phone: authState.customerPhone,
      email: authState.customerEmail,
      customerId: authState.customerId,
      canMakeApiCall: true
    };
  }

  // Post-purchase context with checkout data
  if (authState.level === 'anonymous' && checkoutData) {
    const phone = checkoutData.customerPhone || checkoutData.shippingPhone;
    const email = checkoutData.customerEmail;
    
    if (phone || email) {
      return {
        ...result,
        phone,
        email,
        customerId: checkoutData.customerId,
        canMakeApiCall: true,
        privacyCompliant: true // Checkout data is already consented
      };
    }
  }

  return result;
}

/**
 * Sanitize risk data for display based on authentication level
 */
export function sanitizeRiskDataForDisplay(
  riskData: any,
  authState: AuthenticationState
): any {
  if (!riskData) return null;

  // Base data always available
  const baseData = {
    riskTier: riskData.riskTier,
    riskScore: riskData.riskScore,
    isNewCustomer: riskData.isNewCustomer,
    message: riskData.message
  };

  // Authenticated users get full data
  if (authState.level === 'authenticated' && authState.canAccessPrivateData) {
    return {
      ...baseData,
      totalOrders: riskData.totalOrders,
      failedAttempts: riskData.failedAttempts,
      successfulDeliveries: riskData.successfulDeliveries,
      riskFactors: riskData.riskFactors,
      improvementTips: riskData.improvementTips,
      lastOrderDate: riskData.lastOrderDate,
      phone: riskData.phone ? `***-***-${riskData.phone.slice(-4)}` : undefined
    };
  }

  // Post-purchase gets limited stats
  if (authState.level === 'anonymous') {
    return {
      ...baseData,
      totalOrders: riskData.totalOrders,
      successRate: riskData.totalOrders > 0 
        ? Math.round(((riskData.totalOrders - riskData.failedAttempts) / riskData.totalOrders) * 100)
        : 100
    };
  }

  return baseData;
}

/**
 * Generate appropriate error messages for authentication failures
 */
export function getAuthErrorMessage(authState: AuthenticationState, context: string): {
  title: string;
  message: string;
  actionRequired?: string;
} {
  switch (authState.level) {
    case 'unauthenticated':
      return {
        title: '🔒 Login Required',
        message: 'Please log in to your customer account to view your personalized ReturnsX risk profile and order history.',
        actionRequired: 'Log in to continue'
      };

    case 'pre-authenticated':
      return {
        title: '⚠️ Complete Login Required',
        message: 'Complete your login to access your full risk profile with detailed statistics and improvement recommendations.',
        actionRequired: 'Complete authentication'
      };

    default:
      return {
        title: '❓ Access Limited',
        message: 'Your ReturnsX profile information is not available in this context.',
      };
  }
}

/**
 * Check if API call should be made based on privacy and authentication rules
 */
export function shouldMakeApiCall(
  authState: AuthenticationState,
  customerData: any
): {
  proceed: boolean;
  reason?: string;
} {
  // No customer identification available
  if (!customerData?.phone && !customerData?.email && !customerData?.customerId) {
    return {
      proceed: false,
      reason: 'No customer identification available'
    };
  }

  // Unauthenticated users cannot access private data
  if (authState.level === 'unauthenticated') {
    return {
      proceed: false,
      reason: 'Authentication required for private data access'
    };
  }

  // Pre-authenticated users have limited access
  if (authState.level === 'pre-authenticated' && !authState.canDisplayRiskScore) {
    return {
      proceed: false,
      reason: 'Complete authentication required for risk data'
    };
  }

  return { proceed: true };
}

/**
 * Privacy-compliant logging for extensions
 */
export function logPrivacyCompliant(level: 'info' | 'warn' | 'error', message: string, data: any) {
  const sanitizedData = {
    ...data,
    // Remove or hash sensitive fields
    phone: data.phone ? `***-${data.phone.slice(-4)}` : undefined,
    email: data.email ? `${data.email.split('@')[0].slice(0,2)}***@${data.email.split('@')[1]}` : undefined,
    customerId: data.customerId ? `customer_${data.customerId.slice(-4)}` : undefined
  };

  console[level](`[ReturnsX Extension] ${message}`, sanitizedData);
}