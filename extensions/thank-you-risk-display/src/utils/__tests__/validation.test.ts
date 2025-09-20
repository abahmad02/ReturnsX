/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
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
  isValidRiskThreshold
} from '../validation';
import { ExtensionConfig, RiskProfileResponse } from '../../types';

describe('validateCustomerData', () => {
  it('should validate valid customer data with phone', () => {
    const data = {
      phone: '+923001234567',
      email: 'test@example.com',
      orderId: '12345',
      checkoutToken: 'abc123'
    };

    const result = validateCustomerData(data);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized).toBeDefined();
  });

  it('should validate valid customer data with email only', () => {
    const data = {
      email: 'test@example.com',
      orderId: '12345'
    };

    const result = validateCustomerData(data);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject data without phone or email', () => {
    const data = {
      orderId: '12345'
    };

    const result = validateCustomerData(data);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least one customer identifier (phone or email) is required');
  });

  it('should handle empty strings as undefined', () => {
    const data = {
      phone: '',
      email: 'test@example.com'
    };

    const result = validateCustomerData(data);
    expect(result.isValid).toBe(true);
    expect(result.sanitized?.phone).toBeUndefined();
  });

  it('should validate invalid phone number', () => {
    const data = {
      phone: 'invalid-phone',
      email: 'test@example.com'
    };

    const result = validateCustomerData(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid phone number'))).toBe(true);
  });
});

describe('validatePhoneNumber', () => {
  it('should validate Pakistani mobile numbers', () => {
    const validNumbers = [
      '+923001234567',
      '+923451234567',
      '+923331234567'
    ];

    validNumbers.forEach(phone => {
      const result = validatePhoneNumber(phone);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should validate international numbers', () => {
    const validNumbers = [
      '+14155552671',
      '+447911123456',
      '+33123456789'
    ];

    validNumbers.forEach(phone => {
      const result = validatePhoneNumber(phone);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject invalid phone numbers', () => {
    const invalidNumbers = [
      'not-a-phone',
      '123',
      '+',
      '+92abc123',
      '+92300123456789012345', // too long
      ''
    ];

    invalidNumbers.forEach(phone => {
      const result = validatePhoneNumber(phone);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it('should normalize phone numbers', () => {
    const testCases = [
      { input: '+92 300 123 4567', expected: '+923001234567' },
      { input: '+92-300-123-4567', expected: '+923001234567' },
      { input: '+92 (300) 123-4567', expected: '+923001234567' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = validatePhoneNumber(input);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(expected);
    });
  });

  it('should reject non-string input', () => {
    const result = validatePhoneNumber(123 as any);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Phone number must be a string');
  });
});

describe('validateEmail', () => {
  it('should validate correct email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'test123@test-domain.com'
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject invalid email addresses', () => {
    const invalidEmails = [
      'not-an-email',
      '@domain.com',
      'user@',
      ''
    ];

    invalidEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it('should normalize email addresses', () => {
    const result = validateEmail('  TEST@EXAMPLE.COM  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('test@example.com');
  });

  it('should validate email length limits', () => {
    const longLocal = 'a'.repeat(65) + '@example.com';
    const result = validateEmail(longLocal);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('local part is too long'))).toBe(true);
  });
});

describe('validateOrderId', () => {
  it('should validate numeric order IDs', () => {
    const validIds = ['12345', '999999999', '1'];

    validIds.forEach(id => {
      const result = validateOrderId(id);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject non-numeric order IDs', () => {
    const invalidIds = ['abc123', '123abc', '12-34', ''];

    invalidIds.forEach(id => {
      const result = validateOrderId(id);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it('should trim whitespace', () => {
    const result = validateOrderId('  12345  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('12345');
  });
});

describe('validateCheckoutToken', () => {
  it('should validate valid checkout tokens', () => {
    const validTokens = ['abc123', 'token_123', 'checkout-token-456'];

    validTokens.forEach(token => {
      const result = validateCheckoutToken(token);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject invalid checkout tokens', () => {
    const invalidTokens = ['token with spaces', 'token@invalid', ''];

    invalidTokens.forEach(token => {
      const result = validateCheckoutToken(token);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('validateRiskProfileResponse', () => {
  it('should validate successful response', () => {
    const response: RiskProfileResponse = {
      success: true,
      riskTier: 'MEDIUM_RISK',
      riskScore: 45,
      totalOrders: 10,
      failedAttempts: 3,
      successfulDeliveries: 7,
      isNewCustomer: false,
      message: 'Customer has moderate risk'
    };

    const result = validateRiskProfileResponse(response);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate failed response', () => {
    const response = {
      success: false,
      error: 'Customer not found'
    };

    const result = validateRiskProfileResponse(response);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid risk tier', () => {
    const response = {
      success: true,
      riskTier: 'INVALID_TIER',
      riskScore: 45,
      totalOrders: 10,
      failedAttempts: 3,
      successfulDeliveries: 7,
      isNewCustomer: false,
      message: 'Test'
    };

    const result = validateRiskProfileResponse(response);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('must be one of'))).toBe(true);
  });

  it('should reject invalid risk score range', () => {
    const response = {
      success: true,
      riskTier: 'MEDIUM_RISK',
      riskScore: 150, // Invalid: > 100
      totalOrders: 10,
      failedAttempts: 3,
      successfulDeliveries: 7,
      isNewCustomer: false,
      message: 'Test'
    };

    const result = validateRiskProfileResponse(response);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('must be <= 100'))).toBe(true);
  });

  it('should reject missing required fields', () => {
    const response = {
      success: true,
      riskTier: 'MEDIUM_RISK'
      // Missing other required fields
    };

    const result = validateRiskProfileResponse(response);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing required field'))).toBe(true);
  });
});

describe('validateExtensionConfig', () => {
  it('should validate valid configuration', () => {
    const config: Partial<ExtensionConfig> = {
      api_endpoint: 'https://api.example.com',
      auth_token: 'valid-token-123',
      api_timeout: 5,
      whatsapp_enabled: true,
      whatsapp_phone: '+923001234567',
      display_position: 'middle',
      minimum_risk_threshold: 'medium'
    };

    const result = validateExtensionConfig(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid API endpoint', () => {
    const config = {
      api_endpoint: 'not-a-url'
    };

    const result = validateExtensionConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('valid HTTPS URL'))).toBe(true);
  });

  it('should reject invalid timeout', () => {
    const config = {
      api_timeout: 50 // Too high
    };

    const result = validateExtensionConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('between 1 and 30 seconds'))).toBe(true);
  });

  it('should require WhatsApp phone when enabled', () => {
    const config = {
      whatsapp_enabled: true
      // Missing whatsapp_phone
    };

    const result = validateExtensionConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('WhatsApp phone number is required'))).toBe(true);
  });
});

describe('validateWhatsAppPhone', () => {
  it('should validate international WhatsApp numbers', () => {
    const validNumbers = [
      '+923001234567',
      '+14155552671',
      '+447911123456'
    ];

    validNumbers.forEach(phone => {
      const result = validateWhatsAppPhone(phone);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject invalid WhatsApp numbers', () => {
    const invalidNumbers = [
      '923001234567', // Missing +
      'invalid',
      '+92abc',
      ''
    ];

    invalidNumbers.forEach(phone => {
      const result = validateWhatsAppPhone(phone);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('validateAndSanitizeMessage', () => {
  it('should validate and sanitize clean message', () => {
    const message = 'This is a clean message';
    const result = validateAndSanitizeMessage(message);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe(message);
  });

  it('should sanitize HTML content', () => {
    const message = 'Hello <script>alert("xss")</script> world';
    const result = validateAndSanitizeMessage(message);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('Hello alert(&quot;xss&quot;) world');
  });

  it('should reject empty messages', () => {
    const result = validateAndSanitizeMessage('   ');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Message cannot be empty after sanitization');
  });

  it('should reject messages that are too long', () => {
    const longMessage = 'a'.repeat(501);
    const result = validateAndSanitizeMessage(longMessage);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('too long'))).toBe(true);
  });
});

describe('validateUrl', () => {
  it('should validate HTTPS URLs', () => {
    const validUrls = [
      'https://example.com',
      'https://api.example.com/v1',
      'https://subdomain.example.co.uk/path?query=value'
    ];

    validUrls.forEach(url => {
      const result = validateUrl(url);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject HTTP URLs', () => {
    const result = validateUrl('http://example.com');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('URL must use HTTPS protocol');
  });

  it('should reject invalid URLs', () => {
    const invalidUrls = [
      'not-a-url',
      'ftp://example.com',
      'javascript:alert(1)',
      ''
    ];

    invalidUrls.forEach(url => {
      const result = validateUrl(url);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Type Guards', () => {
  describe('isValidRiskTier', () => {
    it('should validate risk tiers', () => {
      expect(isValidRiskTier('ZERO_RISK')).toBe(true);
      expect(isValidRiskTier('MEDIUM_RISK')).toBe(true);
      expect(isValidRiskTier('HIGH_RISK')).toBe(true);
      expect(isValidRiskTier('INVALID')).toBe(false);
      expect(isValidRiskTier(123)).toBe(false);
    });
  });

  describe('isValidDisplayPosition', () => {
    it('should validate display positions', () => {
      expect(isValidDisplayPosition('top')).toBe(true);
      expect(isValidDisplayPosition('middle')).toBe(true);
      expect(isValidDisplayPosition('bottom')).toBe(true);
      expect(isValidDisplayPosition('invalid')).toBe(false);
    });
  });

  describe('isValidRiskThreshold', () => {
    it('should validate risk thresholds', () => {
      expect(isValidRiskThreshold('all')).toBe(true);
      expect(isValidRiskThreshold('medium')).toBe(true);
      expect(isValidRiskThreshold('high')).toBe(true);
      expect(isValidRiskThreshold('invalid')).toBe(false);
    });
  });
});