/**
 * Utility functions for validation and sanitization
 * 
 * This module exports all validation and sanitization utilities
 * used throughout the ReturnsX Thank You Page Extension.
 */

// Validation utilities
export {
  validateCustomerData,
  validatePhoneNumber,
  validateEmail,
  validateOrderId,
  validateCheckoutToken,
  validateRiskProfileResponse,
  validateExtensionConfig,
  validateWhatsAppPhone,
  validateAndSanitizeMessage,
  validateUrl,
  isValidRiskTier,
  isValidDisplayPosition,
  isValidRiskThreshold,
  type ValidationResult
} from './validation';

// Sanitization utilities
export {
  sanitizeHtml,
  sanitizeText,
  sanitizeCustomMessage,
  sanitizeWhatsAppTemplate,
  sanitizeCssClasses,
  sanitizePhoneForDisplay,
  sanitizeEmailForDisplay,
  sanitizeOrderIdForDisplay,
  sanitizeErrorMessage,
  sanitizeDebugInfo,
  sanitizeJsonInput,
  sanitizeUrlParams,
  sanitizeConfigForDisplay
} from './sanitization';