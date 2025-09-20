/**
 * Security Fixes for ReturnsX Thank You Page Extension
 * 
 * This module contains enhanced security implementations to address
 * issues identified in the security audit.
 */

import crypto from 'crypto';

/**
 * Hash customer data using SHA-256 for privacy protection
 */
export function hashCustomerData(data: string): string {
  if (!data || typeof data !== 'string') {
    return '';
  }
  
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

/**
 * Enhanced HTML sanitization with comprehensive XSS prevention
 */
export function enhancedSanitizeHtml(content: string): string {
  if (typeof content !== 'string') {
    return '';
  }

  return content
    // Remove script tags and their content (case insensitive)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (potential XSS vector)
    .replace(/data:/gi, '')
    // Remove event handlers (onclick, onload, etc.)
    .replace(/on\w+\s*=/gi, '')
    // Remove expression() CSS (IE specific XSS)
    .replace(/expression\s*\(/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript:/gi, '')
    // Remove mocha: URLs
    .replace(/mocha:/gi, '')
    // Remove livescript: URLs
    .replace(/livescript:/gi, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;')
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enhanced email validation with stricter patterns
 */
export function enhancedValidateEmail(email: string): { isValid: boolean; errors: string[]; sanitized?: string } {
  const errors: string[] = [];
  
  if (typeof email !== 'string') {
    errors.push('Email must be a string');
    return { isValid: false, errors };
  }

  // Sanitize input
  const sanitized = email.trim().toLowerCase();
  
  if (sanitized.length === 0) {
    errors.push('Email cannot be empty');
    return { isValid: false, errors };
  }

  if (sanitized.length > 254) {
    errors.push('Email is too long (max 254 characters)');
  }

  // More restrictive email pattern
  const STRICT_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!STRICT_EMAIL_PATTERN.test(sanitized)) {
    errors.push('Email format is invalid');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /[<>]/,                    // HTML tags
    /javascript:/i,            // JavaScript URLs
    /data:/i,                  // Data URLs
    /[()]/,                    // LDAP injection patterns
    /[|&;$`\\]/,              // Command injection patterns
    /\.\./,                    // Path traversal
    /%[0-9a-f]{2}/i,          // URL encoding (potential bypass)
  ];

  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(sanitized)) {
      errors.push(`Email contains suspicious pattern (${index + 1})`);
    }
  });

  // Additional checks
  const parts = sanitized.split('@');
  if (parts.length === 2) {
    const [localPart, domain] = parts;
    
    if (localPart.length > 64) {
      errors.push('Email local part is too long (max 64 characters)');
    }
    
    if (domain.length > 253) {
      errors.push('Email domain is too long (max 253 characters)');
    }

    // Check for consecutive dots
    if (localPart.includes('..') || domain.includes('..')) {
      errors.push('Email cannot contain consecutive dots');
    }

    // Check domain has valid TLD
    if (!domain.includes('.') || domain.endsWith('.')) {
      errors.push('Email domain must have valid TLD');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Enhanced error message sanitization with comprehensive pattern detection
 */
export function enhancedSanitizeErrorMessage(error: string): string {
  if (typeof error !== 'string') {
    return 'An unknown error occurred';
  }

  let sanitized = error;

  // Comprehensive sensitive patterns
  const sensitivePatterns = [
    // Authentication tokens
    /token[:\s=]+[a-zA-Z0-9_.-]+/gi,
    /bearer\s+[a-zA-Z0-9_.-]+/gi,
    /authorization[:\s=]+[^\s]+/gi,
    
    // API keys and secrets
    /api[_-]?key[:\s=]+[a-zA-Z0-9_.-]+/gi,
    /secret[:\s=]+[^\s]+/gi,
    /key[:\s=]+[a-zA-Z0-9_.-]+/gi,
    
    // Passwords and credentials
    /password[:\s=]+[^\s]+/gi,
    /passwd[:\s=]+[^\s]+/gi,
    /pwd[:\s=]+[^\s]+/gi,
    
    // Database connection strings
    /mongodb:\/\/[^\s]+/gi,
    /mysql:\/\/[^\s]+/gi,
    /postgres:\/\/[^\s]+/gi,
    
    // JWT tokens (basic pattern)
    /eyJ[a-zA-Z0-9_.-]+/gi,
    
    // Credit card patterns (basic)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    
    // Phone numbers (international format)
    /\+\d{1,3}[\s-]?\d{3,14}/g,
    
    // Email addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    
    // IP addresses
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    
    // File paths (Windows and Unix)
    /[a-zA-Z]:\\[^\s]+/g,
    /\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+/g,
  ];

  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized || 'An error occurred';
}

/**
 * Enhanced configuration validation with stricter security checks
 */
export function enhancedValidateConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { isValid: false, errors };
  }

  // Validate API endpoint with strict HTTPS requirement
  if (config.api_endpoint !== undefined) {
    if (typeof config.api_endpoint !== 'string') {
      errors.push('API endpoint must be a string');
    } else if (config.api_endpoint.trim().length > 0) {
      const endpoint = config.api_endpoint.trim();
      
      // Must be HTTPS
      if (!endpoint.startsWith('https://')) {
        errors.push('API endpoint must use HTTPS protocol');
      }
      
      // Validate URL format
      try {
        const url = new URL(endpoint);
        
        // Check for suspicious domains
        const suspiciousDomains = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '192.168.',
          '10.',
          '172.16.',
          '172.17.',
          '172.18.',
          '172.19.',
          '172.20.',
          '172.21.',
          '172.22.',
          '172.23.',
          '172.24.',
          '172.25.',
          '172.26.',
          '172.27.',
          '172.28.',
          '172.29.',
          '172.30.',
          '172.31.'
        ];
        
        const hostname = url.hostname.toLowerCase();
        if (suspiciousDomains.some(domain => hostname.includes(domain))) {
          errors.push('API endpoint cannot use local or private network addresses');
        }
        
        // Check for non-standard ports (except 443)
        if (url.port && url.port !== '443') {
          errors.push('API endpoint should use standard HTTPS port (443)');
        }
        
      } catch {
        errors.push('API endpoint must be a valid URL');
      }
    }
  }

  // Validate API timeout with reasonable limits
  if (config.api_timeout !== undefined) {
    if (typeof config.api_timeout !== 'number') {
      errors.push('API timeout must be a number');
    } else if (config.api_timeout < 1 || config.api_timeout > 30) {
      errors.push('API timeout must be between 1 and 30 seconds');
    }
  }

  // Validate WhatsApp configuration with enhanced phone validation
  if (config.whatsapp_enabled === true) {
    if (!config.whatsapp_phone || typeof config.whatsapp_phone !== 'string') {
      errors.push('WhatsApp phone number is required when WhatsApp is enabled');
    } else {
      const phone = config.whatsapp_phone.trim();
      
      // Must be international format
      if (!phone.startsWith('+')) {
        errors.push('WhatsApp phone must be in international format (+XXXXXXXXXXX)');
      }
      
      // Validate phone number pattern
      const phonePattern = /^\+[1-9]\d{7,14}$/;
      if (!phonePattern.test(phone)) {
        errors.push('WhatsApp phone number format is invalid');
      }
    }

    // Validate message template
    if (config.whatsapp_message_template && typeof config.whatsapp_message_template !== 'string') {
      errors.push('WhatsApp message template must be a string');
    } else if (config.whatsapp_message_template) {
      const template = config.whatsapp_message_template;
      
      // Check for suspicious content
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /data:/i,
        /on\w+=/i
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(template))) {
        errors.push('WhatsApp message template contains suspicious content');
      }
      
      // Check length
      if (template.length > 1000) {
        errors.push('WhatsApp message template is too long (max 1000 characters)');
      }
    }
  }

  // Validate auth token if present
  if (config.auth_token !== undefined) {
    if (typeof config.auth_token !== 'string') {
      errors.push('Auth token must be a string');
    } else if (config.auth_token.length > 0) {
      if (config.auth_token.length < 32) {
        errors.push('Auth token is too short (minimum 32 characters)');
      }
      
      if (config.auth_token.length > 512) {
        errors.push('Auth token is too long (maximum 512 characters)');
      }
      
      // Check for suspicious patterns in token
      if (!/^[a-zA-Z0-9_.-]+$/.test(config.auth_token)) {
        errors.push('Auth token contains invalid characters');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Path traversal detection and prevention
 */
export function detectPathTraversal(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const pathTraversalPatterns = [
    /\.\./,                           // Basic path traversal
    /\.\.\/|\.\.\\/, // Path traversal with slashes
    /%2e%2e%2f|%2e%2e%5c/i,          // URL encoded path traversal
    /\.\.%2f|\.\.%5c/i,              // Mixed encoding
    /%252e%252e%252f/i,              // Double URL encoded
    /\.\.\x2f|\.\.\x5c/,             // Hex encoded
    /\.\.\u002f|\.\.\u005c/,         // Unicode encoded
  ];

  return pathTraversalPatterns.some(pattern => pattern.test(input));
}

/**
 * Enhanced phone number validation with path traversal detection
 */
export function enhancedValidatePhone(phone: string): { isValid: boolean; errors: string[]; sanitized?: string } {
  const errors: string[] = [];
  
  if (typeof phone !== 'string') {
    errors.push('Phone number must be a string');
    return { isValid: false, errors };
  }

  // Check for path traversal attempts
  if (detectPathTraversal(phone)) {
    errors.push('Phone number contains path traversal patterns');
    return { isValid: false, errors };
  }

  // Sanitize input
  const sanitized = phone.trim();
  
  if (sanitized.length === 0) {
    errors.push('Phone number cannot be empty');
    return { isValid: false, errors };
  }

  if (sanitized.length > 20) {
    errors.push('Phone number is too long (max 20 characters)');
  }

  // Check for valid characters only
  if (!/^[\+\d\s\-\(\)]+$/.test(sanitized)) {
    errors.push('Phone number contains invalid characters');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /[<>]/,                    // HTML tags
    /javascript:/i,            // JavaScript URLs
    /[|&;$`\\]/,              // Command injection
    /%[0-9a-f]{2}/i,          // URL encoding
    /\x00-\x1f/,              // Control characters
  ];

  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(sanitized)) {
      errors.push(`Phone number contains suspicious pattern (${index + 1})`);
    }
  });

  // Normalize phone number (remove spaces, dashes, parentheses)
  const normalized = sanitized.replace(/[\s\-\(\)]/g, '');

  // Validate format patterns
  const phonePatterns = [
    /^\+92[0-9]{10}$/,        // Pakistani format
    /^\+[1-9]\d{7,14}$/,      // International format
  ];

  const isValidFormat = phonePatterns.some(pattern => pattern.test(normalized));
  
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
 * Comprehensive input sanitization for all user inputs
 */
export function sanitizeAllInputs(data: any): any {
  if (typeof data === 'string') {
    return enhancedSanitizeHtml(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeAllInputs(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeAllInputs(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Security headers validation
 */
export function validateSecurityHeaders(headers: Record<string, string>): string[] {
  const issues: string[] = [];
  
  // Check for required security headers
  const requiredHeaders = [
    'Content-Type',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection'
  ];
  
  requiredHeaders.forEach(header => {
    if (!headers[header] && !headers[header.toLowerCase()]) {
      issues.push(`Missing security header: ${header}`);
    }
  });
  
  // Validate Content-Type
  const contentType = headers['Content-Type'] || headers['content-type'];
  if (contentType && !contentType.includes('application/json')) {
    issues.push('Content-Type should be application/json for API requests');
  }
  
  return issues;
}

/**
 * Rate limiting validation (for future implementation)
 */
export function validateRateLimit(requests: number, timeWindow: number, limit: number): boolean {
  return requests <= limit;
}

/**
 * Content Security Policy validation
 */
export function generateCSPHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Shopify extensions may need unsafe-inline
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.returnsx.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}