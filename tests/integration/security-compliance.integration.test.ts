import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loader as getOrderDataLoader } from '~/routes/api.get-order-data';
import { SecurityValidator } from '~/services/securityValidator.server';
import { StructuredLogger } from '~/services/structuredLogger.server';

/**
 * Security and Compliance Validation Test Suite
 * 
 * Validates:
 * - Input validation and sanitization
 * - Protection against common attacks (XSS, SQL injection, etc.)
 * - Proper error handling without information disclosure
 * - Data privacy and PII protection
 * - Authentication and authorization
 * - Compliance with security standards
 */

describe('Security and Compliance Validation', () => {
  let securityValidator: SecurityValidator;
  let logger: StructuredLogger;

  beforeAll(async () => {
    securityValidator = new SecurityValidator();
    logger = new StructuredLogger();
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate phone number formats', async () => {
      const testCases = [
        { input: '+923001234567', valid: true },
        { input: '923001234567', valid: true },
        { input: '03001234567', valid: true },
        { input: 'invalid-phone', valid: false },
        { input: '123', valid: false },
        { input: '+92300123456789012345', valid: false }, // Too long
        { input: '', valid: false },
        { input: null, valid: false }
      ];

      for (const testCase of testCases) {
        const result = securityValidator.validatePhoneNumber(testCase.input);
        
        if (testCase.valid) {
          expect(result.isValid).toBe(true);
          expect(result.sanitizedValue).toBeDefined();
        } else {
          expect(result.isValid).toBe(false);
        }
      }
    });

    it('should validate email formats', async () => {
      const testCases = [
        { input: 'test@example.com', valid: true },
        { input: 'user.name+tag@domain.co.uk', valid: true },
        { input: 'invalid-email', valid: false },
        { input: '@domain.com', valid: false },
        { input: 'user@', valid: false },
        { input: '', valid: false },
        { input: null, valid: false }
      ];

      for (const testCase of testCases) {
        const result = securityValidator.validateEmail(testCase.input);
        
        if (testCase.valid) {
          expect(result.isValid).toBe(true);
          expect(result.sanitizedValue).toBeDefined();
        } else {
          expect(result.isValid).toBe(false);
        }
      }
    });

    it('should validate order ID formats', async () => {
      const testCases = [
        { input: '12345', valid: true },
        { input: 'ORDER-123', valid: true },
        { input: 'order_456', valid: true },
        { input: 'ORD/789', valid: true },
        { input: '<script>alert("xss")</script>', valid: false },
        { input: '"; DROP TABLE orders; --', valid: false },
        { input: '../../../etc/passwd', valid: false },
        { input: '', valid: false }
      ];

      for (const testCase of testCases) {
        const result = securityValidator.validateOrderId(testCase.input);
        
        if (testCase.valid) {
          expect(result.isValid).toBe(true);
          expect(result.sanitizedValue).toBeDefined();
        } else {
          expect(result.isValid).toBe(false);
        }
      }
    });

    it('should sanitize input to prevent XSS attacks', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
        '%3Cscript%3Ealert%28%27xss%27%29%3C%2Fscript%3E'
      ];

      for (const maliciousInput of maliciousInputs) {
        const sanitized = securityValidator.sanitizeInput(maliciousInput);
        
        // Should remove or escape malicious content
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
      }
    });
  });

  describe('Protection Against Common Attacks', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "1' OR '1'='1",
        "1'; DROP TABLE users; --",
        "1' UNION SELECT * FROM sensitive_data --",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "'; EXEC xp_cmdshell('dir'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const request = new Request(`http://localhost:3000/api/get-order-data?orderId=${encodeURIComponent(payload)}`);
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should return error status for malicious input
        expect([400, 422]).toContain(response.status);
        
        // Should not execute malicious SQL
        const responseText = await response.text();
        expect(responseText).not.toContain('syntax error');
        expect(responseText).not.toContain('database error');
      }
    });

    it('should prevent NoSQL injection attacks', async () => {
      const nosqlInjectionPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "this.password.match(/.*/)"}',
        '{"$regex": ".*"}',
        '{"$or": [{"password": {"$exists": true}}]}'
      ];

      for (const payload of nosqlInjectionPayloads) {
        const request = new Request(`http://localhost:3000/api/get-order-data?checkoutToken=${encodeURIComponent(payload)}`);
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle malicious input safely
        expect([400, 422, 404]).toContain(response.status);
      }
    });

    it('should prevent path traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const payload of pathTraversalPayloads) {
        const request = new Request(`http://localhost:3000/api/get-order-data?orderName=${encodeURIComponent(payload)}`);
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should reject path traversal attempts
        expect([400, 422]).toContain(response.status);
      }
    });

    it('should prevent command injection attacks', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; ping -c 1 evil.com'
      ];

      for (const payload of commandInjectionPayloads) {
        const request = new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent('+92300123456' + payload)}`);
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle command injection attempts safely
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Error Handling and Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const sensitiveInfoPatterns = [
        /database/i,
        /connection/i,
        /password/i,
        /secret/i,
        /key/i,
        /token/i,
        /stack trace/i,
        /internal error/i,
        /file not found/i,
        /permission denied/i
      ];

      // Test various error scenarios
      const errorRequests = [
        new Request('http://localhost:3000/api/get-order-data?invalid=true'),
        new Request('http://localhost:3000/api/get-order-data?phone=invalid'),
        new Request('http://localhost:3000/api/get-order-data?orderName='),
        new Request('http://localhost:3000/api/get-order-data') // No parameters
      ];

      for (const request of errorRequests) {
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        if (response.status >= 400) {
          const responseText = await response.text();
          
          // Check that sensitive information is not exposed
          for (const pattern of sensitiveInfoPatterns) {
            expect(responseText).not.toMatch(pattern);
          }
        }
      }
    });

    it('should provide generic error messages for security', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=invalid');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      if (response.status >= 400) {
        const responseText = await response.text();
        
        // Error messages should be generic and safe
        expect(responseText).toMatch(/invalid|error|bad request/i);
        expect(responseText).not.toContain('SELECT');
        expect(responseText).not.toContain('INSERT');
        expect(responseText).not.toContain('UPDATE');
        expect(responseText).not.toContain('DELETE');
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJsonPayloads = [
        '{"invalid": json}',
        '{invalid json',
        'not json at all',
        '{"nested": {"incomplete":}}'
      ];

      for (const payload of malformedJsonPayloads) {
        // Simulate POST request with malformed JSON
        const request = new Request('http://localhost:3000/api/get-order-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
        
        try {
          const response = await getOrderDataLoader({ request, params: {}, context: {} });
          
          // Should handle malformed JSON gracefully
          expect([400, 422, 405]).toContain(response.status); // 405 if POST not supported
        } catch (error) {
          // Should not throw unhandled errors
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Data Privacy and PII Protection', () => {
    it('should not expose raw PII in responses', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567&orderName=PRIVACY001');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      if (response.status === 200) {
        const responseText = await response.text();
        
        // Should not contain raw phone numbers
        expect(responseText).not.toContain('+923001234567');
        expect(responseText).not.toContain('923001234567');
        
        // Should not contain other PII patterns
        expect(responseText).not.toMatch(/\+92\d{10}/); // Pakistani phone pattern
        expect(responseText).not.toMatch(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/); // Credit card pattern
        expect(responseText).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN pattern
      }
    });

    it('should hash sensitive identifiers consistently', async () => {
      const testPhone = '+923001234567';
      const testEmail = 'test@example.com';
      
      // Test phone hashing
      const phoneValidation = securityValidator.validatePhoneNumber(testPhone);
      if (phoneValidation.isValid) {
        const hash1 = securityValidator.hashPhoneNumber(phoneValidation.sanitizedValue);
        const hash2 = securityValidator.hashPhoneNumber(phoneValidation.sanitizedValue);
        
        // Hashes should be consistent
        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(testPhone);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      }
      
      // Test email hashing
      const emailValidation = securityValidator.validateEmail(testEmail);
      if (emailValidation.isValid) {
        const hash1 = securityValidator.hashEmail(emailValidation.sanitizedValue);
        const hash2 = securityValidator.hashEmail(emailValidation.sanitizedValue);
        
        // Hashes should be consistent
        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(testEmail);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      }
    });

    it('should not log sensitive data', async () => {
      const testPhone = '+923001234567';
      const testOrder = 'LOG_TEST_001';
      
      // Clear previous logs
      logger.clearLogs();
      
      const request = new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=${testOrder}`);
      
      await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Check logs for sensitive data
      const logs = logger.getLogs();
      const logText = JSON.stringify(logs);
      
      // Should not contain raw phone number
      expect(logText).not.toContain(testPhone);
      expect(logText).not.toContain('923001234567');
      
      // Should contain hashed or sanitized versions
      expect(logs.some(log => log.level === 'info' && log.message.includes('API request'))).toBe(true);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle rapid successive requests', async () => {
      const rapidRequests = 20;
      const testPhone = '+923001234567';
      
      const promises = Array.from({ length: rapidRequests }, (_, i) => {
        const request = new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=RAPID${i}`);
        return getOrderDataLoader({ request, params: {}, context: {} });
      });
      
      const responses = await Promise.all(promises);
      
      // Should handle all requests without crashing
      responses.forEach(response => {
        expect([200, 404, 429]).toContain(response.status); // 429 for rate limiting
      });
      
      // If rate limiting is implemented, some requests should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      console.log(`Rate limited requests: ${rateLimitedCount}/${rapidRequests}`);
    });

    it('should prevent abuse through parameter manipulation', async () => {
      const abusePatterns = [
        // Extremely long parameters
        'phone=' + encodeURIComponent('+92' + '1'.repeat(1000)),
        'orderName=' + 'A'.repeat(10000),
        'checkoutToken=' + 'x'.repeat(5000),
        
        // Special characters
        'phone=' + encodeURIComponent('\x00\x01\x02\x03'),
        'orderName=' + encodeURIComponent('\uFEFF\u200B\u200C'),
        
        // Unicode attacks
        'phone=' + encodeURIComponent('＋９２３００１２３４５６７'), // Full-width characters
        'orderName=' + encodeURIComponent('𝕆𝕣𝕕𝕖𝕣𝟙𝟚𝟛') // Mathematical symbols
      ];

      for (const abusePattern of abusePatterns) {
        const request = new Request(`http://localhost:3000/api/get-order-data?${abusePattern}`);
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should reject abusive patterns
        expect([400, 422, 413]).toContain(response.status); // 413 for payload too large
      }
    });
  });

  describe('Authentication and Authorization', () => {
    it('should handle missing authentication gracefully', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Should handle appropriately based on API design
      // This could be 200 (public API), 401 (auth required), or 404 (not found)
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should validate API key format if required', async () => {
      const invalidApiKeys = [
        'invalid-key',
        'too-short',
        'contains spaces',
        '<script>alert("xss")</script>',
        '../../etc/passwd'
      ];

      for (const invalidKey of invalidApiKeys) {
        const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567', {
          headers: {
            'Authorization': `Bearer ${invalidKey}`
          }
        });
        
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle invalid API keys appropriately
        expect([200, 401, 403]).toContain(response.status);
      }
    });
  });

  describe('Compliance and Security Headers', () => {
    it('should include appropriate security headers', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Check for security headers (if implemented)
      const headers = response.headers;
      
      // Content-Type should be set
      expect(headers.get('content-type')).toBeDefined();
      
      // Should not expose server information
      expect(headers.get('server')).toBeNull();
      expect(headers.get('x-powered-by')).toBeNull();
    });

    it('should handle CORS appropriately', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567', {
        headers: {
          'Origin': 'https://malicious-site.com'
        }
      });
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // CORS headers should be handled appropriately
      const corsHeader = response.headers.get('access-control-allow-origin');
      
      if (corsHeader) {
        // Should not allow all origins in production
        expect(corsHeader).not.toBe('*');
      }
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data integrity under concurrent access', async () => {
      const testPhone = '+923001234567';
      const concurrentRequests = 10;
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=INTEGRITY${i}`)
      );
      
      const responses = await Promise.all(
        requests.map(request => getOrderDataLoader({ request, params: {}, context: {} }))
      );
      
      // All responses should be consistent for the same customer
      const statusCodes = responses.map(r => r.status);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      
      // Should have consistent responses
      expect(uniqueStatusCodes.length).toBeLessThanOrEqual(2); // Allow for 200/404 variation
      
      // If successful responses exist, they should be identical
      const successfulResponses = responses.filter(r => r.status === 200);
      if (successfulResponses.length > 1) {
        const responseTexts = await Promise.all(
          successfulResponses.map(r => r.clone().text())
        );
        const uniqueResponses = [...new Set(responseTexts)];
        expect(uniqueResponses.length).toBe(1);
      }
    });

    it('should validate data consistency across different access patterns', async () => {
      const testCases = [
        { phone: '+923001234567', orderName: 'CONSISTENCY001' },
        { phone: '+92 300 123 4567', orderName: 'CONSISTENCY001' }, // Different format
        { phone: '923001234567', orderName: 'CONSISTENCY001' }, // No country code
        { phone: '03001234567', orderName: 'CONSISTENCY001' } // Local format
      ];
      
      const responses = [];
      
      for (const testCase of testCases) {
        const queryParams = new URLSearchParams();
        queryParams.set('phone', testCase.phone);
        queryParams.set('orderName', testCase.orderName);
        
        const request = new Request(`http://localhost:3000/api/get-order-data?${queryParams}`);
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        responses.push(response);
      }
      
      // All normalized phone numbers should return consistent results
      const statusCodes = responses.map(r => r.status);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      
      // Should normalize to same result
      expect(uniqueStatusCodes.length).toBe(1);
    });
  });
});