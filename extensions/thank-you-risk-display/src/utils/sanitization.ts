/**
 * Content sanitization utilities for the ReturnsX Thank You Page Extension
 * 
 * This module provides sanitization functions to prevent XSS attacks and
 * ensure safe rendering of user-generated content in the extension.
 */

/**
 * HTML entities for escaping special characters
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Sanitizes HTML content by removing tags and escaping special characters
 */
export function sanitizeHtml(content: string): string {
  if (typeof content !== 'string') {
    return '';
  }

  return content
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape HTML entities
    .replace(/[&<>"'`=/]/g, (match) => HTML_ENTITIES[match] || match)
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes text content for safe display in React components
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Limit consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}

/**
 * Sanitizes custom messages from merchant configuration
 */
export function sanitizeCustomMessage(message: string, maxLength: number = 500): string {
  if (typeof message !== 'string') {
    return '';
  }

  let sanitized = sanitizeHtml(message);
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }

  return sanitized;
}

/**
 * Sanitizes WhatsApp message template
 */
export function sanitizeWhatsAppTemplate(template: string): string {
  if (typeof template !== 'string') {
    return '';
  }

  // Allow placeholders like {orderNumber}, {failedAttempts}
  const allowedPlaceholders = [
    '{orderNumber}',
    '{failedAttempts}',
    '{riskScore}',
    '{customerName}',
    '{totalOrders}'
  ];

  let sanitized = sanitizeText(template);

  // Validate placeholders
  const placeholderRegex = /\{[^}]+\}/g;
  const placeholders = sanitized.match(placeholderRegex) || [];
  
  for (const placeholder of placeholders) {
    if (!allowedPlaceholders.includes(placeholder)) {
      // Remove invalid placeholders
      sanitized = sanitized.replace(placeholder, '');
    }
  }

  // Ensure reasonable length for WhatsApp
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 997) + '...';
  }

  return sanitized.trim();
}

/**
 * Sanitizes CSS class names
 */
export function sanitizeCssClasses(classes: string): string {
  if (typeof classes !== 'string') {
    return '';
  }

  return classes
    // Split by whitespace and filter valid class names
    .split(/\s+/)
    .filter(className => {
      // CSS class name validation: must start with letter, can contain letters, numbers, hyphens, underscores
      return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(className);
    })
    .join(' ')
    .trim();
}

/**
 * Sanitizes phone numbers for display (masks sensitive parts)
 */
export function sanitizePhoneForDisplay(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }

  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.length < 4) {
    return '***';
  }

  // Show country code and last 4 digits
  if (cleaned.startsWith('+')) {
    const countryCode = cleaned.substring(0, 3); // +XX
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(Math.max(0, cleaned.length - 7));
    return `${countryCode}${masked}${lastFour}`;
  } else {
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(Math.max(0, cleaned.length - 4));
    return `${masked}${lastFour}`;
  }
}

/**
 * Sanitizes email addresses for display (masks sensitive parts)
 */
export function sanitizeEmailForDisplay(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return '***@***.***';
  }

  const [localPart, domain] = parts;
  
  // Mask local part (show first and last character if long enough)
  let maskedLocal: string;
  if (localPart.length <= 2) {
    maskedLocal = '*'.repeat(localPart.length);
  } else if (localPart.length <= 4) {
    maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
  } else {
    maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 4) + localPart.slice(-2);
  }

  // Mask domain (show TLD)
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    const tld = domainParts[domainParts.length - 1];
    const maskedDomain = '*'.repeat(Math.max(1, domain.length - tld.length - 1)) + '.' + tld;
    return `${maskedLocal}@${maskedDomain}`;
  }

  return `${maskedLocal}@***`;
}

/**
 * Sanitizes order ID for display (partial masking for privacy)
 */
export function sanitizeOrderIdForDisplay(orderId: string): string {
  if (typeof orderId !== 'string') {
    return '';
  }

  const cleaned = orderId.replace(/[^\d]/g, '');
  
  if (cleaned.length <= 4) {
    return cleaned;
  }

  // Show first 2 and last 4 digits
  const first = cleaned.substring(0, 2);
  const last = cleaned.slice(-4);
  const masked = '*'.repeat(Math.max(0, cleaned.length - 6));
  
  return `${first}${masked}${last}`;
}

/**
 * Sanitizes error messages for safe display to users
 */
export function sanitizeErrorMessage(error: string): string {
  if (typeof error !== 'string') {
    return 'An unknown error occurred';
  }

  let sanitized = sanitizeText(error);

  // Remove sensitive information patterns
  const sensitivePatterns = [
    /token[:\s]+[a-zA-Z0-9_-]+/gi,
    /password[:\s]+\S+/gi,
    /key[:\s]+[a-zA-Z0-9_-]+/gi,
    /secret[:\s]+\S+/gi,
    /api[_-]?key[:\s]+\S+/gi,
    /bearer\s+[a-zA-Z0-9_-]+/gi,
    /authorization[:\s]+\S+/gi
  ];

  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized || 'An error occurred';
}

/**
 * Sanitizes debug information for logging
 */
export function sanitizeDebugInfo(info: any): any {
  if (typeof info !== 'object' || info === null) {
    return info;
  }

  const sanitized = { ...info };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'token',
    'auth_token',
    'authorization',
    'api_key',
    'secret',
    'phone',
    'email',
    'customer_id'
  ];

  function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  return sanitizeObject(sanitized);
}

/**
 * Validates and sanitizes JSON input
 */
export function sanitizeJsonInput(input: string): { isValid: boolean; data?: any; error?: string } {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Input must be a string' };
  }

  const sanitized = sanitizeText(input);
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Input cannot be empty' };
  }

  try {
    const parsed = JSON.parse(sanitized);
    return { isValid: true, data: parsed };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON format' 
    };
  }
}

/**
 * Sanitizes URL parameters
 */
export function sanitizeUrlParams(params: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    // Sanitize key
    const sanitizedKey = sanitizeText(String(key));
    if (sanitizedKey && /^[a-zA-Z0-9_-]+$/.test(sanitizedKey)) {
      // Sanitize value
      const sanitizedValue = sanitizeText(String(value));
      if (sanitizedValue) {
        sanitized[sanitizedKey] = encodeURIComponent(sanitizedValue);
      }
    }
  }

  return sanitized;
}

/**
 * Creates a safe display version of configuration for debugging
 */
export function sanitizeConfigForDisplay(config: any): any {
  if (typeof config !== 'object' || config === null) {
    return config;
  }

  const sanitized = { ...config };

  // Mask sensitive configuration values
  const sensitiveConfigKeys = [
    'auth_token',
    'api_key',
    'secret',
    'password',
    'whatsapp_phone'
  ];

  for (const key of sensitiveConfigKeys) {
    if (sanitized[key]) {
      const value = String(sanitized[key]);
      if (value.length > 4) {
        sanitized[key] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
      } else {
        sanitized[key] = '*'.repeat(value.length);
      }
    }
  }

  return sanitized;
}