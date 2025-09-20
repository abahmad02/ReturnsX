import { ExtensionConfig, RiskProfileResponse, ErrorState } from '../types';
import { sanitizeCustomMessage, sanitizeText } from '../utils/sanitization';

/**
 * Sanitize array of recommendation strings
 */
function sanitizeRecommendations(recommendations: string[]): string[] {
  return recommendations
    .filter(rec => typeof rec === 'string' && rec.trim().length > 0)
    .map(rec => sanitizeText(rec))
    .filter(rec => rec.length > 0);
}

/**
 * Message Generator Service
 * 
 * Handles dynamic message generation based on:
 * - Risk tier and customer status
 * - Custom merchant messages from theme customizer
 * - Fallback messages for error states and new customers
 * - Context-aware recommendations
 */

export interface MessageContext {
  riskProfile?: RiskProfileResponse;
  config: ExtensionConfig;
  customerName?: string;
  orderNumber?: string;
  error?: ErrorState;
}

export interface GeneratedMessage {
  primary: string;
  secondary?: string;
  recommendations?: string[];
  callToAction?: string;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
}

/**
 * Default messages for different scenarios
 */
const DEFAULT_MESSAGES = {
  ZERO_RISK: {
    primary: "🌟 Excellent delivery record! You're a trusted customer.",
    secondary: "Your consistent acceptance of orders makes you eligible for premium shipping options.",
    recommendations: [
      "Continue accepting deliveries promptly to maintain your excellent status",
      "Consider our express delivery options for faster service",
      "Share your positive experience with friends and family"
    ],
    tone: 'positive' as const
  },
  MEDIUM_RISK: {
    primary: "📊 Good delivery record with room for improvement.",
    secondary: "A few missed deliveries have been noted. Let's work together to improve your success rate.",
    recommendations: [
      "Ensure you're available during delivery windows",
      "Update your delivery address if you've moved recently",
      "Consider scheduling deliveries for times when you're home",
      "Contact us if you need to reschedule a delivery"
    ],
    tone: 'neutral' as const
  },
  HIGH_RISK: {
    primary: "⚠️ Multiple delivery attempts have failed recently.",
    secondary: "To ensure successful delivery, please follow the recommendations below or contact our support team.",
    recommendations: [
      "Verify your delivery address is correct and complete",
      "Ensure someone is available to receive the package",
      "Provide accurate contact information for delivery coordination",
      "Consider alternative delivery locations if needed",
      "Contact our support team to discuss delivery preferences"
    ],
    callToAction: "Contact support for assistance with your next delivery",
    tone: 'critical' as const
  },
  NEW_CUSTOMER: {
    primary: "👋 Welcome! Thank you for choosing us for your first order.",
    secondary: "We're committed to providing you with excellent delivery service.",
    recommendations: [
      "Ensure your delivery address is accurate and complete",
      "Be available during the delivery window",
      "Keep your phone accessible for delivery coordination",
      "Contact us if you have any delivery preferences"
    ],
    tone: 'positive' as const
  },
  ERROR_FALLBACK: {
    primary: "📦 Thank you for your order!",
    secondary: "We're processing your order and will keep you updated on delivery status.",
    recommendations: [
      "Check your email for order confirmation and tracking details",
      "Ensure your contact information is up to date",
      "Contact support if you have any questions about your order"
    ],
    tone: 'neutral' as const
  }
};

/**
 * Generate contextual message based on risk profile and configuration
 */
export function generateMessage(context: MessageContext): GeneratedMessage {
  const { riskProfile, config, error } = context;

  // Handle error states
  if (error || !riskProfile) {
    return generateErrorMessage(context);
  }

  // Handle new customers
  if (riskProfile.isNewCustomer) {
    return generateNewCustomerMessage(context);
  }

  // Generate message based on risk tier
  switch (riskProfile.riskTier) {
    case 'ZERO_RISK':
      return generateZeroRiskMessage(context);
    case 'MEDIUM_RISK':
      return generateMediumRiskMessage(context);
    case 'HIGH_RISK':
      return generateHighRiskMessage(context);
    default:
      return generateErrorMessage(context);
  }
}

/**
 * Generate message for zero-risk customers
 */
function generateZeroRiskMessage(context: MessageContext): GeneratedMessage {
  const { riskProfile, config } = context;
  const defaultMsg = DEFAULT_MESSAGES.ZERO_RISK;
  
  const customPrimary = sanitizeText(config.zero_risk_message || '');
  const apiMessage = sanitizeText(riskProfile?.message || '');

  return {
    primary: customPrimary || apiMessage || defaultMsg.primary,
    secondary: defaultMsg.secondary,
    recommendations: sanitizeRecommendations(riskProfile?.recommendations || defaultMsg.recommendations),
    tone: defaultMsg.tone
  };
}

/**
 * Generate message for medium-risk customers
 */
function generateMediumRiskMessage(context: MessageContext): GeneratedMessage {
  const { riskProfile, config } = context;
  const defaultMsg = DEFAULT_MESSAGES.MEDIUM_RISK;
  
  const customPrimary = sanitizeText(config.medium_risk_message || '');
  const apiMessage = sanitizeText(riskProfile?.message || '');

  return {
    primary: customPrimary || apiMessage || defaultMsg.primary,
    secondary: defaultMsg.secondary,
    recommendations: sanitizeRecommendations(riskProfile?.recommendations || defaultMsg.recommendations),
    tone: defaultMsg.tone
  };
}

/**
 * Generate message for high-risk customers
 */
function generateHighRiskMessage(context: MessageContext): GeneratedMessage {
  const { riskProfile, config } = context;
  const defaultMsg = DEFAULT_MESSAGES.HIGH_RISK;
  
  const customPrimary = sanitizeText(config.high_risk_message || '');
  const apiMessage = sanitizeText(riskProfile?.message || '');

  return {
    primary: customPrimary || apiMessage || defaultMsg.primary,
    secondary: defaultMsg.secondary,
    recommendations: sanitizeRecommendations(riskProfile?.recommendations || defaultMsg.recommendations),
    callToAction: defaultMsg.callToAction,
    tone: defaultMsg.tone
  };
}

/**
 * Generate message for new customers
 */
function generateNewCustomerMessage(context: MessageContext): GeneratedMessage {
  const { config } = context;
  const defaultMsg = DEFAULT_MESSAGES.NEW_CUSTOMER;
  
  const customPrimary = sanitizeText(config.new_customer_message || config.zero_risk_message || '');
  
  return {
    primary: customPrimary || defaultMsg.primary,
    secondary: defaultMsg.secondary,
    recommendations: sanitizeRecommendations(defaultMsg.recommendations),
    tone: defaultMsg.tone
  };
}

/**
 * Generate fallback message for error states
 */
function generateErrorMessage(context: MessageContext): GeneratedMessage {
  const { error } = context;
  const defaultMsg = DEFAULT_MESSAGES.ERROR_FALLBACK;
  
  // Customize message based on error type if available
  if (error) {
    switch (error.type) {
      case 'NETWORK_ERROR':
        return {
          ...defaultMsg,
          secondary: "We're having connectivity issues but your order is being processed normally."
        };
      case 'TIMEOUT_ERROR':
        return {
          ...defaultMsg,
          secondary: "Our systems are running slowly but your order has been received successfully."
        };
      case 'AUTHENTICATION_ERROR':
        return {
          ...defaultMsg,
          secondary: "We're updating our systems. Your order is secure and being processed."
        };
      default:
        return defaultMsg;
    }
  }
  
  return defaultMsg;
}

/**
 * Generate personalized recommendations based on customer history
 */
export function generatePersonalizedRecommendations(
  riskProfile: RiskProfileResponse,
  config: ExtensionConfig
): string[] {
  const baseRecommendations = riskProfile.recommendations || [];
  const personalizedRecommendations: string[] = [];

  // Add context-specific recommendations based on customer data
  if (riskProfile.failedAttempts > 0) {
    if (riskProfile.failedAttempts >= 5) {
      personalizedRecommendations.push(
        `You have ${riskProfile.failedAttempts} failed delivery attempts. Please ensure you're available for the next delivery.`
      );
    } else if (riskProfile.failedAttempts >= 2) {
      personalizedRecommendations.push(
        `${riskProfile.failedAttempts} recent delivery attempts were unsuccessful. Let's make sure the next one succeeds!`
      );
    }
  }

  // Add success rate specific recommendations
  const successRate = riskProfile.totalOrders > 0 
    ? (riskProfile.successfulDeliveries / riskProfile.totalOrders) * 100 
    : 0;

  if (successRate > 0 && successRate < 70) {
    personalizedRecommendations.push(
      `Your current success rate is ${Math.round(successRate)}%. Following these tips can help improve it significantly.`
    );
  }

  // Combine with base recommendations, removing duplicates
  const allRecommendations = [...personalizedRecommendations, ...baseRecommendations];
  return Array.from(new Set(allRecommendations));
}

/**
 * Truncate text with "read more" functionality
 */
export function truncateText(text: string, maxLength: number = 100): {
  truncated: string;
  needsTruncation: boolean;
  fullText: string;
} {
  if (text.length <= maxLength) {
    return {
      truncated: text,
      needsTruncation: false,
      fullText: text
    };
  }

  // Find the last space before the max length to avoid cutting words
  let truncateAt = maxLength;
  for (let i = maxLength; i >= 0; i--) {
    if (text[i] === ' ') {
      truncateAt = i;
      break;
    }
  }

  return {
    truncated: text.substring(0, truncateAt) + '...',
    needsTruncation: true,
    fullText: text
  };
}

/**
 * Format message with dynamic placeholders
 */
export function formatMessage(
  template: string, 
  context: MessageContext
): string {
  // Sanitize the template first
  let formatted = sanitizeText(template);

  // Replace common placeholders with sanitized values
  if (context.customerName) {
    const sanitizedName = sanitizeText(context.customerName);
    formatted = formatted.replace(/\{customerName\}/g, sanitizedName);
  }
  
  if (context.orderNumber) {
    const sanitizedOrderNumber = sanitizeText(context.orderNumber);
    formatted = formatted.replace(/\{orderNumber\}/g, sanitizedOrderNumber);
  }

  if (context.riskProfile) {
    const successRate = context.riskProfile.totalOrders > 0 
      ? Math.round((context.riskProfile.successfulDeliveries / context.riskProfile.totalOrders) * 100)
      : 0;
    
    formatted = formatted.replace(/\{successRate\}/g, successRate.toString());
    formatted = formatted.replace(/\{riskScore\}/g, Math.round(context.riskProfile.riskScore).toString());
    formatted = formatted.replace(/\{totalOrders\}/g, context.riskProfile.totalOrders.toString());
    formatted = formatted.replace(/\{failedAttempts\}/g, context.riskProfile.failedAttempts.toString());
  }

  return formatted;
}