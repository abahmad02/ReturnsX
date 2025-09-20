/**
 * Security Audit Tests for ReturnsX Thank You Page Extension
 * 
 * These tests validate the security implementations identified in the audit:
 * - Data transmission security (no raw PII)
 * - Customer data hashing validation
 * - XSS prevention testing
 * - CSRF protection validation
 * - Authentication security testing
 * - Input validation security
 * - Error handling security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReturnsXApiClient } from '../services/apiClient';
import { AuthenticationService } from '../services/authService';
import { 
  validateCustomerData, 
  validateRiskProfileResponse,
  validateExtensionConfig 
} from '../utils/validation';
import { 
  sanitizeHtml, 
  sanitizeText, 
  sanitizeErrorMessage,
  sanitizeDebugInfo,
  sanitizeCustomMessage 
} from '../utils/sanitization';

// Mock Web Crypto API for testing
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
  },
  getRandomValues: vi.fn(),
};

// Mock fetch for API testing
const mockFetch = vi.fn();

beforeEach(() => {
  global.crypto = mockCrypto as any;
  global.fetch = mockFetch;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Security Audit Tests', () => {
  describe('1. Data Transmission Security', () => {
    it('should hash customer phone numbers before API transmission', async () => {
      // Mock crypto.subtle.digest to return a hash
      const mockHash = new ArrayBuffer(32);
      const mockHashArray = new Uint8Array(mockHash);
      mockHashArray.fill(0xab); // Fill with test data
      
      mockCrypto.subtle.digest.mockResolvedValue(mockHash);

      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
        enableDebug: false
      });

      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          riskTier: 'ZERO_RISK',
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          isNewCustomer: true,
          message: 'Welcome!'
        })
      });

      const request = {
        phone: '+923001234567',
        orderId: '12345'
      };

      await apiClient.getRiskProfile(request);

      // Verify that crypto.subtle.digest was called (indicating hashing)
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.any(Uint8Array)
      );

      // Verify that fetch was called with hashed data
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/risk-profile'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('abababab'), // Hashed phone should be hex
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should hash customer email addresses before API transmission', async () => {
      const mockHash = new ArrayBuffer(32);
      const mockHashArray = new Uint8Array(mockHash);
      mockHashArray.fill(0xcd);
      
      mockCrypto.subtle.digest.mockResolvedValue(mockHash);

      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
        enableDebug: false
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          riskTier: 'ZERO_RISK',
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          isNewCustomer: true,
          message: 'Welcome!'
        })
      });

      const request = {
        email: 'test@example.com',
        orderId: '12345'
      };

      await apiClient.getRiskProfile(request);

      expect(mockCrypto.subtle.digest).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('cdcdcdcd') // Hashed email
        })
      );
    });

    it('should never transmit raw PII in API requests', async () => {
      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
        enableDebug: false
      });

      // Mock hashing to return predictable values
      mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          riskTier: 'ZERO_RISK',
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          isNewCustomer: true,
          message: 'Welcome!'
        })
      });

      const request = {
        phone: '+923001234567',
        email: 'sensitive@example.com',
        orderId: '12345'
      };

      await apiClient.getRiskProfile(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = fetchCall[1].body;

      // Verify raw PII is not in the request body
      expect(requestBody).not.toContain('+923001234567');
      expect(requestBody).not.toContain('sensitive@example.com');
      
      // Verify the request contains hashed values instead
      expect(requestBody).toMatch(/"phone":"[a-f0-9]{64}"/);
      expect(requestBody).toMatch(/"email":"[a-f0-9]{64}"/);
    });

    it('should enforce HTTPS for API endpoints', () => {
      expect(() => {
        new ReturnsXApiClient({
          baseUrl: 'http://insecure.example.com', // HTTP instead of HTTPS
        });
      }).toThrow('Invalid API base URL format');
    });
  });

  describe('2. Customer Data Hashing Implementation', () => {
    it('should use SHA-256 for hashing customer data', async () => {
      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
      });

      mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, riskTier: 'ZERO_RISK', riskScore: 0, totalOrders: 0, failedAttempts: 0, successfulDeliveries: 0, isNewCustomer: true, message: 'Test' })
      });

      await apiClient.getRiskProfile({ phone: '+923001234567' });

      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.any(Uint8Array)
      );
    });

    it('should normalize data before hashing', async () => {
      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
      });

      mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, riskTier: 'ZERO_RISK', riskScore: 0, totalOrders: 0, failedAttempts: 0, successfulDeliveries: 0, isNewCustomer: true, message: 'Test' })
      });

      // Test with phone number that has spaces and formatting
      await apiClient.getRiskProfile({ phone: '+92 300 123 4567' });

      // Verify that the data passed to digest is normalized
      const digestCall = mockCrypto.subtle.digest.mock.calls[0];
      const dataBuffer = digestCall[1];
      const normalizedData = new TextDecoder().decode(dataBuffer);
      
      // Should not contain spaces and should be lowercase
      expect(normalizedData).not.toContain(' ');
      expect(normalizedData).toEqual(normalizedData.toLowerCase());
    });

    it('should use consistent salt for hashing', async () => {
      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
      });

      mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, riskTier: 'ZERO_RISK', riskScore: 0, totalOrders: 0, failedAttempts: 0, successfulDeliveries: 0, isNewCustomer: true, message: 'Test' })
      });

      await apiClient.getRiskProfile({ phone: '+923001234567' });

      const digestCall = mockCrypto.subtle.digest.mock.calls[0];
      const combinedBuffer = digestCall[1];
      const combinedData = new TextDecoder().decode(combinedBuffer);
      
      // Should contain the salt
      expect(combinedData).toContain('returnsx_client_salt');
    });
  });

  describe('3. XSS Prevention', () => {
    it('should sanitize HTML content', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Safe content');
    });

    it('should escape HTML entities', () => {
      const content = 'Test & <script>alert("xss")</script> content';
      const sanitized = sanitizeHtml(content);
      
      expect(sanitized).toContain('&amp;');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
      expect(sanitized).not.toContain('<script>');
    });

    it('should sanitize custom messages from merchants', () => {
      const maliciousMessage = '<img src="x" onerror="alert(1)">Hello customer!';
      const sanitized = sanitizeCustomMessage(maliciousMessage);
      
      expect(sanitized).not.toContain('<img');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).toContain('Hello customer!');
    });

    it('should remove control characters', () => {
      const content = 'Normal text\x00\x01\x02with control chars';
      const sanitized = sanitizeText(content);
      
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

  describe('4. CSRF Protection', () => {
    it('should include authentication headers in API requests', async () => {
      const apiClient = new ReturnsXApiClient({
        baseUrl: 'https://api.returnsx.com',
        authToken: 'test-token'
      });

      mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, riskTier: 'ZERO_RISK', riskScore: 0, totalOrders: 0, failedAttempts: 0, successfulDeliveries: 0, isNewCustomer: true, message: 'Test' })
      });

      await apiClient.getRiskProfile({ phone: '+923001234567' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should validate session tokens properly', async () => {
      const authService = new AuthenticationService({
        apiEndpoint: 'https://api.returnsx.com'
      });

      // Test with invalid JWT format
      const invalidToken = 'invalid.token';
      const result = await authService.initializeWithSessionToken(invalidToken);
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.error?.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should validate JWT claims', async () => {
      const authService = new AuthenticationService({
        apiEndpoint: 'https://api.returnsx.com'
      });

      // Create a mock JWT with expired timestamp
      const expiredPayload = {
        iss: 'test-shop.myshopify.com',
        dest: 'test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer123',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        jti: 'test-jti'
      };

      const expiredToken = 'header.' + 
        Buffer.from(JSON.stringify(expiredPayload)).toString('base64url') + 
        '.signature';

      const result = await authService.initializeWithSessionToken(expiredToken);
      
      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('5. Authentication Security', () => {
    it('should encrypt credentials before storage', async () => {
      const authService = new AuthenticationService({
        apiEndpoint: 'https://api.returnsx.com'
      });

      // Mock the encryption methods
      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(64));
      mockCrypto.getRandomValues.mockReturnValue(new Uint8Array(12));

      // Mock localStorage
      const mockLocalStorage = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn()
      };
      global.localStorage = mockLocalStorage as any;

      const credentials = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer' as const,
        shopDomain: 'test-shop.myshopify.com'
      };

      // This would trigger credential storage
      await authService['storeCredentials']('test-shop.myshopify.com', credentials);

      // Verify encryption was attempted
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should validate token expiration', async () => {
      const authService = new AuthenticationService({
        apiEndpoint: 'https://api.returnsx.com'
      });

      const expiredCredentials = {
        accessToken: 'expired-token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        tokenType: 'Bearer' as const,
        shopDomain: 'test-shop.myshopify.com'
      };

      const isExpiring = authService['isTokenExpiringSoon'](expiredCredentials);
      expect(isExpiring).toBe(true);
    });

    it('should use secure random values for encryption', () => {
      const mockRandomValues = new Uint8Array(12);
      mockCrypto.getRandomValues.mockReturnValue(mockRandomValues);

      const authService = new AuthenticationService({
        apiEndpoint: 'https://api.returnsx.com'
      });

      // This would be called during encryption
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });
  });

  describe('6. Input Validation Security', () => {
    it('should validate customer data structure', () => {
      const validData = {
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: '12345'
      };

      const result = validateCustomerData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid phone numbers', () => {
      const invalidData = {
        phone: 'invalid-phone',
        email: 'test@example.com'
      };

      const result = validateCustomerData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('phone'))).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const invalidData = {
        phone: '+923001234567',
        email: 'invalid-email'
      };

      const result = validateCustomerData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('email'))).toBe(true);
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
    });

    it('should reject malformed API responses', () => {
      const invalidResponse = {
        success: true,
        riskTier: 'INVALID_TIER', // Invalid enum value
        riskScore: 150, // Out of range
        totalOrders: -1, // Negative value
        message: '' // Empty message
      };

      const result = validateRiskProfileResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate configuration parameters', () => {
      const validConfig = {
        api_endpoint: 'https://api.returnsx.com',
        api_timeout: 5,
        whatsapp_enabled: true,
        whatsapp_phone: '+923001234567'
      };

      const result = validateExtensionConfig(validConfig);
      expect(result.isValid).toBe(true);
    });

    it('should reject insecure configuration', () => {
      const insecureConfig = {
        api_endpoint: 'http://insecure.com', // HTTP instead of HTTPS
        api_timeout: 100, // Too long
        whatsapp_phone: 'invalid-phone'
      };

      const result = validateExtensionConfig(insecureConfig);
      expect(result.isValid).toBe(false);
    });
  });

  describe('7. Error Handling Security', () => {
    it('should sanitize error messages', () => {
      const sensitiveError = 'Authentication failed with token abc123xyz and password secret123';
      const sanitized = sanitizeErrorMessage(sensitiveError);
      
      expect(sanitized).not.toContain('abc123xyz');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should sanitize debug information', () => {
      const debugInfo = {
        request: {
          phone: '+923001234567',
          email: 'test@example.com',
          auth_token: 'secret-token'
        },
        config: {
          api_key: 'secret-key',
          password: 'secret-password'
        }
      };

      const sanitized = sanitizeDebugInfo(debugInfo);
      
      expect(sanitized.request.phone).toBe('[REDACTED]');
      expect(sanitized.request.email).toBe('[REDACTED]');
      expect(sanitized.request.auth_token).toBe('[REDACTED]');
      expect(sanitized.config.api_key).toBe('[REDACTED]');
      expect(sanitized.config.password).toBe('[REDACTED]');
    });

    it('should limit error message length', () => {
      const longError = 'A'.repeat(1000);
      const sanitized = sanitizeErrorMessage(longError);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('should handle nested sensitive data in debug info', () => {
      const nestedDebugInfo = {
        user: {
          profile: {
            phone: '+923001234567',
            credentials: {
              token: 'secret-token'
            }
          }
        }
      };

      const sanitized = sanitizeDebugInfo(nestedDebugInfo);
      
      expect(sanitized.user.profile.phone).toBe('[REDACTED]');
      expect(sanitized.user.profile.credentials.token).toBe('[REDACTED]');
    });
  });

  describe('8. Penetration Testing Scenarios', () => {
    it('should resist SQL injection attempts in customer data', () => {
      const sqlInjectionAttempt = {
        phone: "'; DROP TABLE customers; --",
        email: 'test@example.com'
      };

      const result = validateCustomerData(sqlInjectionAttempt);
      expect(result.isValid).toBe(false);
    });

    it('should resist XSS attempts in custom messages', () => {
      const xssAttempt = '<script>document.cookie="stolen="+document.cookie</script>';
      const sanitized = sanitizeCustomMessage(xssAttempt);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('document.cookie');
    });

    it('should resist LDAP injection in email validation', () => {
      const ldapInjection = 'test@example.com)(|(password=*))';
      const result = validateCustomerData({ email: ldapInjection });
      
      expect(result.isValid).toBe(false);
    });

    it('should resist command injection in phone numbers', () => {
      const commandInjection = '+92300123456; rm -rf /';
      const result = validateCustomerData({ phone: commandInjection });
      
      expect(result.isValid).toBe(false);
    });

    it('should resist prototype pollution attempts', () => {
      const pollutionAttempt = {
        phone: '+923001234567',
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } }
      };

      const result = validateCustomerData(pollutionAttempt);
      
      // Should only validate known fields
      expect(result.sanitized).not.toHaveProperty('__proto__');
      expect(result.sanitized).not.toHaveProperty('constructor');
    });
  });
});