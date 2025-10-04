import { createHash, randomUUID } from 'crypto';

/**
 * Interface for validation results
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: ValidationError[];
}

/**
 * Interface for validation errors
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Interface for validated and sanitized parameters
 */
export interface ValidatedParams {
  checkoutToken?: string;
  customerPhone?: string;
  orderName?: string;
  orderId?: string;
  requestId: string;
  timestamp: number;
}

/**
 * Security validator for input validation and sanitization
 * Implements requirements 6.1, 6.2, 6.3, and 6.4 from the specification
 */
export class SecurityValidator {
  // Regex patterns for validation
  private readonly PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly ORDER_ID_REGEX = /^[a-zA-Z0-9_\-\/:]+$/; // Added : for Shopify GID format
  private readonly CHECKOUT_TOKEN_REGEX = /^[a-zA-Z0-9_\-\.]+$/;
  private readonly ORDER_NAME_REGEX = /^[a-zA-Z0-9#_\-\s]+$/;

  // Dangerous patterns to detect
  private readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(;|\-\-|\/\*|\*\/)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /('|(\\x27)|(\\x2D\\x2D))/
  ];

  private readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]*\s(on\w+|href|src)\s*=\s*["'][^"']*["'][^>]*>/gi
  ];

  private readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]\\]/,
    /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp|chmod|chown|rm|mv|cp|mkdir|rmdir)\b/i
  ];

  /**
   * Validate checkout token format and sanitize
   */
  validateCheckoutToken(token: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!token || typeof token !== 'string') {
      errors.push({
        field: 'checkoutToken',
        message: 'Checkout token is required and must be a string',
        code: 'INVALID_FORMAT',
        severity: 'high'
      });
      return { isValid: false, errors };
    }

    // Check length
    if (token.length < 10 || token.length > 200) {
      errors.push({
        field: 'checkoutToken',
        message: 'Checkout token length must be between 10 and 200 characters',
        code: 'INVALID_LENGTH',
        severity: 'medium'
      });
    }

    // Check format
    if (!this.CHECKOUT_TOKEN_REGEX.test(token)) {
      errors.push({
        field: 'checkoutToken',
        message: 'Checkout token contains invalid characters',
        code: 'INVALID_CHARACTERS',
        severity: 'high'
      });
    }

    // Check for malicious patterns
    const maliciousCheck = this.checkForMaliciousPatterns(token, 'checkoutToken');
    errors.push(...maliciousCheck.errors);

    const sanitizedToken = this.sanitizeString(token);

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitizedToken,
      errors
    };
  }

  /**
   * Validate and normalize phone number
   */
  validatePhoneNumber(phone: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!phone || typeof phone !== 'string') {
      errors.push({
        field: 'customerPhone',
        message: 'Phone number is required and must be a string',
        code: 'INVALID_FORMAT',
        severity: 'high'
      });
      return { isValid: false, errors };
    }

    // Normalize phone number
    let normalizedPhone = phone
      .replace(/[\s\-\(\)\.]/g, '') // Remove spaces, dashes, parentheses, dots
      .replace(/^\+?92/, '')        // Remove Pakistan country code
      .replace(/^0/, '');           // Remove leading zero

    // Add Pakistan country code if not present
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+92' + normalizedPhone;
    }

    // Validate format
    if (!this.PHONE_REGEX.test(normalizedPhone)) {
      errors.push({
        field: 'customerPhone',
        message: 'Invalid phone number format',
        code: 'INVALID_FORMAT',
        severity: 'medium'
      });
    }

    // Check length (Pakistani numbers should be 13 characters with +92)
    if (normalizedPhone.length < 13 || normalizedPhone.length > 15) {
      errors.push({
        field: 'customerPhone',
        message: 'Phone number length is invalid',
        code: 'INVALID_LENGTH',
        severity: 'medium'
      });
    }

    // Check for malicious patterns
    const maliciousCheck = this.checkForMaliciousPatterns(phone, 'customerPhone');
    errors.push(...maliciousCheck.errors);

    return {
      isValid: errors.length === 0,
      sanitizedValue: normalizedPhone,
      errors
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!email || typeof email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email is required and must be a string',
        code: 'INVALID_FORMAT',
        severity: 'high'
      });
      return { isValid: false, errors };
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate format
    if (!this.EMAIL_REGEX.test(normalizedEmail)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_FORMAT',
        severity: 'medium'
      });
    }

    // Check length
    if (normalizedEmail.length > 254) {
      errors.push({
        field: 'email',
        message: 'Email address is too long',
        code: 'INVALID_LENGTH',
        severity: 'medium'
      });
    }

    // Check for malicious patterns
    const maliciousCheck = this.checkForMaliciousPatterns(email, 'email');
    errors.push(...maliciousCheck.errors);

    return {
      isValid: errors.length === 0,
      sanitizedValue: normalizedEmail,
      errors
    };
  }

  /**
   * Validate order ID format and extract numeric ID
   */
  validateOrderId(orderId: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!orderId || typeof orderId !== 'string') {
      errors.push({
        field: 'orderId',
        message: 'Order ID is required and must be a string',
        code: 'INVALID_FORMAT',
        severity: 'high'
      });
      return { isValid: false, errors };
    }

    // Check if it's a Shopify Global ID format
    const isShopifyGID = orderId.startsWith('gid://shopify/');
    
    // For Shopify GIDs, use more permissive validation
    if (isShopifyGID) {
      // Validate Shopify GID format: gid://shopify/ResourceType/ID
      // ResourceType can be any combination of letters (e.g., Order, OrderIdentity, Product, etc.)
      const gidPattern = /^gid:\/\/shopify\/[A-Za-z][A-Za-z0-9]*\/\d+$/;
      if (!gidPattern.test(orderId)) {
        errors.push({
          field: 'orderId',
          message: 'Invalid Shopify Global ID format',
          code: 'INVALID_SHOPIFY_GID',
          severity: 'high'
        });
      }
    } else {
      // For non-GID order IDs, use the original validation
      if (!this.ORDER_ID_REGEX.test(orderId)) {
        errors.push({
          field: 'orderId',
          message: 'Order ID contains invalid characters',
          code: 'INVALID_CHARACTERS',
          severity: 'high'
        });
      }
    }

    // Extract numeric ID from Shopify GID format or use as-is
    let numericOrderId = orderId;
    if (orderId.includes('/')) {
      const parts = orderId.split('/');
      numericOrderId = parts[parts.length - 1];
    }

    // Validate numeric part exists
    if (!/^\d+$/.test(numericOrderId)) {
      errors.push({
        field: 'orderId',
        message: 'Order ID must contain a valid numeric identifier',
        code: 'INVALID_NUMERIC_ID',
        severity: 'medium'
      });
    }

    // Check for malicious patterns (skip for valid Shopify GIDs with no validation errors)
    if (!isShopifyGID || errors.length > 0) {
      // Only run malicious pattern check on non-GID formats or failed GID validation
      // For failed GID validation, only check the extracted numeric part to avoid false positives
      const checkValue = isShopifyGID ? numericOrderId : orderId;
      const maliciousCheck = this.checkForMaliciousPatterns(checkValue, 'orderId');
      errors.push(...maliciousCheck.errors);
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: numericOrderId,
      errors
    };
  }

  /**
   * Validate order name format
   */
  validateOrderName(orderName: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!orderName || typeof orderName !== 'string') {
      errors.push({
        field: 'orderName',
        message: 'Order name is required and must be a string',
        code: 'INVALID_FORMAT',
        severity: 'high'
      });
      return { isValid: false, errors };
    }

    // Check format
    if (!this.ORDER_NAME_REGEX.test(orderName)) {
      errors.push({
        field: 'orderName',
        message: 'Order name contains invalid characters',
        code: 'INVALID_CHARACTERS',
        severity: 'medium'
      });
    }

    // Check length
    if (orderName.length > 100) {
      errors.push({
        field: 'orderName',
        message: 'Order name is too long',
        code: 'INVALID_LENGTH',
        severity: 'medium'
      });
    }

    // Check for malicious patterns
    const maliciousCheck = this.checkForMaliciousPatterns(orderName, 'orderName');
    errors.push(...maliciousCheck.errors);

    const sanitizedOrderName = this.sanitizeString(orderName);

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitizedOrderName,
      errors
    };
  }

  /**
   * Validate and sanitize all input parameters
   */
  validateInput(params: URLSearchParams): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedParams: Partial<ValidatedParams> = {
      requestId: randomUUID(),
      timestamp: Date.now()
    };

    // Validate checkout token
    const checkoutToken = params.get('checkoutToken');
    if (checkoutToken) {
      const result = this.validateCheckoutToken(checkoutToken);
      if (result.isValid) {
        sanitizedParams.checkoutToken = result.sanitizedValue;
      } else {
        errors.push(...result.errors);
      }
    }

    // Validate customer phone
    const customerPhone = params.get('customerPhone');
    if (customerPhone) {
      const result = this.validatePhoneNumber(customerPhone);
      if (result.isValid) {
        sanitizedParams.customerPhone = result.sanitizedValue;
      } else {
        errors.push(...result.errors);
      }
    }

    // Validate order name
    const orderName = params.get('orderName');
    if (orderName) {
      const result = this.validateOrderName(orderName);
      if (result.isValid) {
        sanitizedParams.orderName = result.sanitizedValue;
      } else {
        errors.push(...result.errors);
      }
    }

    // Validate order ID
    const orderId = params.get('orderId');
    if (orderId) {
      const result = this.validateOrderId(orderId);
      if (result.isValid) {
        sanitizedParams.orderId = result.sanitizedValue;
      } else {
        errors.push(...result.errors);
      }
    }

    // Check if at least one identifier is provided
    if (!sanitizedParams.checkoutToken && !sanitizedParams.customerPhone && 
        !sanitizedParams.orderName && !sanitizedParams.orderId) {
      errors.push({
        field: 'parameters',
        message: 'At least one identifier (checkoutToken, customerPhone, orderName, or orderId) is required',
        code: 'MISSING_IDENTIFIER',
        severity: 'high'
      });
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitizedParams as ValidatedParams,
      errors
    };
  }

  /**
   * Check for malicious patterns in input
   */
  private checkForMaliciousPatterns(input: string, fieldName: string): ValidationResult {
    const errors: ValidationError[] = [];

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        errors.push({
          field: fieldName,
          message: 'Input contains potential SQL injection patterns',
          code: 'SQL_INJECTION_DETECTED',
          severity: 'critical'
        });
        break;
      }
    }

    // Check for XSS patterns
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push({
          field: fieldName,
          message: 'Input contains potential XSS patterns',
          code: 'XSS_DETECTED',
          severity: 'critical'
        });
        break;
      }
    }

    // Check for command injection patterns
    for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        errors.push({
          field: fieldName,
          message: 'Input contains potential command injection patterns',
          code: 'COMMAND_INJECTION_DETECTED',
          severity: 'critical'
        });
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .replace(/[<>'"&]/g, (char) => {       // Escape HTML entities
        switch (char) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#x27;';
          case '&': return '&amp;';
          default: return char;
        }
      });
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };

    // Sanitize phone numbers
    if (sanitized.customerPhone) {
      sanitized.customerPhone = this.maskPhoneNumber(sanitized.customerPhone);
    }

    // Sanitize emails
    if (sanitized.email || sanitized.customerEmail) {
      const email = sanitized.email || sanitized.customerEmail;
      sanitized.email = this.maskEmail(email);
      sanitized.customerEmail = this.maskEmail(email);
    }

    // Sanitize tokens
    if (sanitized.checkoutToken) {
      sanitized.checkoutToken = this.maskToken(sanitized.checkoutToken);
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 6) return '***';
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 2);
  }

  /**
   * Mask email for logging
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    
    const maskedLocal = local.length > 2 ? 
      local.substring(0, 2) + '***' : 
      '***';
    
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask token for logging
   */
  private maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return token.substring(0, 8) + '...';
  }
}

// Singleton instance for application-wide use
export const securityValidator = new SecurityValidator();