/**
 * Comprehensive validation utilities for the ReturnsX Thank You Page Extension
 * 
 * This module provides validation functions for:
 * - Customer data (phone numbers, emails)
 * - API responses
 * - Extension configuration
 * - User-generated content sanitization
 */

import { ExtensionConfig, RiskProfileResponse, CustomerData } from '../types';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

// Phone number validation patterns
const PHONE_PATTERNS = {
  PAKISTAN_MOBILE: /^(\+92|0)?3[0-9]{9}$/,
  INTERNATIONAL: /^\+[1-9]\d{1,14}$/,
  GENERAL: /^[\+]?[1-9][\d]{0,15}$/
};

// Email validation pattern (RFC 5322 compliant)
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// URL validation pattern
const URL_PATTERN = /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/;

// WhatsApp phone number pattern (must include country code)
const WHATSAPP_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

// Shopify order ID pattern
const SHOPIFY_ORDER_ID_PATTERN = /^[0-9]+$/;

// Shopify checkout token pattern
const CHECKOUT_TOKEN_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Input validation utilities
 */
export const validateInput = {
  phone: (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return PHONE_PATTERNS.GENERAL.test(cleaned);
  },

  email: (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_PATTERN.test(email.trim());
  },

  url: (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Input sanitization utilities
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove style attributes that could contain expressions
    .replace(/\s*style\s*=\s*["'][^"']*["']/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Validates customer data for API requests
 */
export function validateCustomerData(data: CustomerData): ValidationResult {
  const errors: string[] = [];
  const sanitized: CustomerData = {};

  // Validate phone number if provided
  if (data.phone !== undefined) {
    if (data.phone === null || data.phone === '') {
      sanitized.phone = undefined;
    } else {
      const phoneValidation = validatePhoneNumber(data.phone);
      if (phoneValidation.isValid) {
        sanitized.phone = phoneValidation.sanitized;
      } else {
        errors.push(`Invalid phone number: ${phoneValidation.errors.join(', ')}`);
      }
    }
  }

  // Validate email if provided
  if (data.email !== undefined) {
    if (data.email === null || data.email === '') {
      sanitized.email = undefined;
    } else {
      const emailValidation = validateEmail(data.email);
      if (emailValidation.isValid) {
        sanitized.email = emailValidation.sanitized;
      } else {
        errors.push(`Invalid email: ${emailValidation.errors.join(', ')}`);
      }
    }
  }

  // Ensure at least one identifier is provided
  if (!sanitized.phone && !sanitized.email) {
    errors.push('At least one customer identifier (phone or email) is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Validates phone number format
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  
  if (typeof phone !== 'string') {
    errors.push('Phone number must be a string');
    return { isValid: false, errors };
  }

  const sanitized = phone.trim();
  
  if (sanitized.length === 0) {
    errors.push('Phone number cannot be empty');
    return { isValid: false, errors };
  }

  if (sanitized.length > 20) {
    errors.push('Phone number is too long (max 20 characters)');
  }

  // Check for valid characters
  if (!/^[\+\d\s\-\(\)]+$/.test(sanitized)) {
    errors.push('Phone number contains invalid characters');
  }

  // Normalize phone number (remove spaces, dashes, parentheses)
  const normalized = sanitized.replace(/[\s\-\(\)]/g, '');

  // Validate format
  let isValidFormat = false;
  
  if (PHONE_PATTERNS.PAKISTAN_MOBILE.test(normalized) || 
      PHONE_PATTERNS.INTERNATIONAL.test(normalized) || 
      PHONE_PATTERNS.GENERAL.test(normalized)) {
    isValidFormat = true;
  }

  if (!isValidFormat) {
    errors.push('Phone number format is invalid. Use international format (+92XXXXXXXXXX)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? normalized : undefined
  };
}

/**
 * Validates email address format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (typeof email !== 'string') {
    errors.push('Email must be a string');
    return { isValid: false, errors };
  }

  const sanitized = email.trim().toLowerCase();
  
  if (sanitized.length === 0) {
    errors.push('Email cannot be empty');
    return { isValid: false, errors };
  }

  if (sanitized.length > 254) {
    errors.push('Email is too long (max 254 characters)');
  }

  if (!EMAIL_PATTERN.test(sanitized)) {
    errors.push('Email format is invalid');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Validates API response structure
 */
export function validateRiskProfileResponse(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Response must be an object');
    return { isValid: false, errors };
  }

  // Validate success field
  if (typeof data.success !== 'boolean') {
    errors.push('Response must have a boolean success field');
  }

  // If success is false, validate error message
  if (data.success === false) {
    if (typeof data.error !== 'string' || data.error.trim().length === 0) {
      errors.push('Failed response must have a non-empty error message');
    }
  }

  // If success is true, validate required fields
  if (data.success === true) {
    const requiredFields = [
      { name: 'riskTier', type: 'string', values: ['ZERO_RISK', 'MEDIUM_RISK', 'HIGH_RISK'] },
      { name: 'riskScore', type: 'number', min: 0, max: 100 },
      { name: 'totalOrders', type: 'number', min: 0 },
      { name: 'failedAttempts', type: 'number', min: 0 },
      { name: 'successfulDeliveries', type: 'number', min: 0 },
      { name: 'isNewCustomer', type: 'boolean' },
      { name: 'message', type: 'string' }
    ];

    for (const field of requiredFields) {
      if (data[field.name] === undefined || data[field.name] === null) {
        errors.push(`Missing required field: ${field.name}`);
        continue;
      }

      if (typeof data[field.name] !== field.type) {
        errors.push(`Field ${field.name} must be of type ${field.type}`);
        continue;
      }

      // Validate enum values
      if (field.values && !field.values.includes(data[field.name])) {
        errors.push(`Field ${field.name} must be one of: ${field.values.join(', ')}`);
      }

      // Validate numeric ranges
      if (field.type === 'number') {
        if (field.min !== undefined && data[field.name] < field.min) {
          errors.push(`Field ${field.name} must be >= ${field.min}`);
        }
        if (field.max !== undefined && data[field.name] > field.max) {
          errors.push(`Field ${field.name} must be <= ${field.max}`);
        }
      }

      // Validate string fields
      if (field.type === 'string' && field.name === 'message') {
        if (data[field.name].trim().length === 0) {
          errors.push(`Field ${field.name} cannot be empty`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? data : undefined
  };
}

/**
 * Validates extension configuration
 */
export function validateExtensionConfig(config: Partial<ExtensionConfig>): ValidationResult {
  const errors: string[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { isValid: false, errors };
  }

  // Validate API endpoint
  if (config.api_endpoint !== undefined) {
    if (typeof config.api_endpoint !== 'string') {
      errors.push('API endpoint must be a string');
    } else if (config.api_endpoint.trim().length > 0) {
      if (!URL_PATTERN.test(config.api_endpoint.trim())) {
        errors.push('API endpoint must be a valid HTTPS URL');
      }
    }
  }

  // Validate auth token
  if (config.auth_token !== undefined) {
    if (typeof config.auth_token !== 'string') {
      errors.push('Auth token must be a string');
    } else if (config.auth_token.length > 0 && config.auth_token.length < 10) {
      errors.push('Auth token is too short (minimum 10 characters)');
    }
  }

  // Validate API timeout
  if (config.api_timeout !== undefined) {
    if (typeof config.api_timeout !== 'number') {
      errors.push('API timeout must be a number');
    } else if (config.api_timeout < 1 || config.api_timeout > 30) {
      errors.push('API timeout must be between 1 and 30 seconds');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates WhatsApp phone number
 */
export function validateWhatsAppPhone(phone: string): ValidationResult {
  const errors: string[] = [];
  
  if (typeof phone !== 'string') {
    errors.push('WhatsApp phone must be a string');
    return { isValid: false, errors };
  }

  const sanitized = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (!WHATSAPP_PHONE_PATTERN.test(sanitized)) {
    errors.push('WhatsApp phone must be in international format (+XXXXXXXXXXX)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Sanitizes user-generated content to prevent XSS
 */
export function sanitizeUserContent(content: string): string {
  if (typeof content !== 'string') {
    return '';
  }

  return content
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Type guard to check if a value is a valid risk tier
 */
export function isValidRiskTier(value: any): value is 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' {
  return typeof value === 'string' && ['ZERO_RISK', 'MEDIUM_RISK', 'HIGH_RISK'].includes(value);
}

/**
 * Type guard to check if a value is a valid display position
 */
export function isValidDisplayPosition(value: any): value is 'top' | 'middle' | 'bottom' {
  return typeof value === 'string' && ['top', 'middle', 'bottom'].includes(value);
}

/**
 * Type guard to check if a value is a valid risk threshold
 */
export function isValidRiskThreshold(value: any): value is 'all' | 'medium' | 'high' {
  return typeof value === 'string' && ['all', 'medium', 'high'].includes(value);
}