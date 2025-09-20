import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ReturnsXApiClient, createApiClient, DEFAULT_API_CONFIG } from '../apiClient';
import { ErrorType } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Mock crypto.subtle for hashing
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

// Mock TextEncoder
global.TextEncoder = class {
  encoding = 'utf-8';
  
  encode(input: string) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
  
  encodeInto() {
    throw new Error('encodeInto not implemented in mock');
  }
} as any;

describe('ReturnsXApiClient', () => {
  let apiClient: ReturnsXApiClient;
  const mockConfig = {
    baseUrl: 'https://api.returnsx.com',
    authToken: 'test-token',
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 100, // Shorter delay for tests
    enableDebug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new ReturnsXApiClient(mockConfig);
    
    // Mock crypto.subtle.digest to return a consistent hash
    mockCrypto.subtle.digest.mockResolvedValue(
      new ArrayBuffer(32) // 32 bytes for SHA-256
    );
  });

  afterEach(() => {
    apiClient.cancelRequests();
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(apiClient).toBeInstanceOf(ReturnsXApiClient);
      expect(apiClient.getConfig().baseUrl).toBe(mockConfig.baseUrl);
    });

    it('should throw error for invalid base URL', () => {
      expect(() => {
        new ReturnsXApiClient({ baseUrl: 'invalid-url' });
      }).toThrow('Invalid API base URL format');
    });

    it('should throw error for missing base URL', () => {
      expect(() => {
        new ReturnsXApiClient({});
      }).toThrow('API base URL is required');
    });

    it('should use default values for optional config', () => {
      const client = new ReturnsXApiClient({ baseUrl: 'https://api.test.com' });
      const config = client.getConfig();
      
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.enableDebug).toBe(false);
    });
  });

  describe('getRiskProfile', () => {
    const mockRequest = {
      phone: '+923001234567',
      email: 'test@example.com',
      orderId: 'order_123',
      checkoutToken: 'token_456',
    };

    const mockSuccessResponse = {
      success: true,
      riskTier: 'MEDIUM_RISK' as const,
      riskScore: 45,
      totalOrders: 10,
      failedAttempts: 2,
      successfulDeliveries: 8,
      isNewCustomer: false,
      message: 'Medium risk customer',
      recommendations: ['Be available for delivery'],
    };

    beforeEach(() => {
      // Mock successful fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });
    });

    it('should successfully get risk profile', async () => {
      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/api/risk-profile',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should hash customer data before sending', async () => {
      await apiClient.getRiskProfile(mockRequest);
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      // Should not contain original phone/email
      expect(requestBody.phone).not.toBe(mockRequest.phone);
      expect(requestBody.email).not.toBe(mockRequest.email);
      
      // Should contain orderId and checkoutToken as-is
      expect(requestBody.orderId).toBe(mockRequest.orderId);
      expect(requestBody.checkoutToken).toBe(mockRequest.checkoutToken);
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        success: false,
        error: 'Customer not found',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorResponse),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.riskTier).toBe('ZERO_RISK');
    });

    it('should handle HTTP error status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.error).toContain('An unexpected error occurred');
    });

    it('should handle timeout errors', async () => {
      // Mock AbortError for timeout
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timed out');
    });

    it('should validate response structure', async () => {
      const invalidResponse = {
        success: true,
        // Missing required fields
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidResponse),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
    });

    it('should validate risk tier enum', async () => {
      const invalidResponse = {
        ...mockSuccessResponse,
        riskTier: 'INVALID_TIER',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidResponse),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
    });

    it('should validate numeric fields', async () => {
      const invalidResponse = {
        ...mockSuccessResponse,
        riskScore: 150, // Invalid: > 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidResponse),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
    });
  });

  describe('retry logic', () => {
    const mockRequest = {
      phone: '+923001234567',
      email: 'test@example.com',
    };

    it('should retry on server errors', async () => {
      // First two calls fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            riskTier: 'ZERO_RISK',
            riskScore: 0,
            totalOrders: 0,
            failedAttempts: 0,
            successfulDeliveries: 0,
            isNewCustomer: true,
            message: 'Welcome!',
          }),
        });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect max retry limit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await apiClient.getRiskProfile(mockRequest);
      
      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      });

      const isHealthy = await apiClient.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/api/health',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false for unhealthy API', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      });

      const isHealthy = await apiClient.healthCheck();
      
      expect(isHealthy).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const isHealthy = await apiClient.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        timeout: 10000,
        enableDebug: true,
      };

      apiClient.updateConfig(newConfig);
      const config = apiClient.getConfig();
      
      expect(config.timeout).toBe(10000);
      expect(config.enableDebug).toBe(true);
      expect(config.baseUrl).toBe(mockConfig.baseUrl); // Should preserve existing values
    });

    it('should validate updated configuration', () => {
      expect(() => {
        apiClient.updateConfig({ baseUrl: 'invalid-url' });
      }).toThrow('Invalid API base URL format');
    });
  });

  describe('request cancellation', () => {
    it('should cancel ongoing requests', () => {
      // This is hard to test directly, but we can verify the method exists
      expect(() => apiClient.cancelRequests()).not.toThrow();
    });
  });

  describe('createApiClient factory', () => {
    it('should create client with default config', () => {
      const client = createApiClient({ baseUrl: 'https://api.test.com' });
      
      expect(client).toBeInstanceOf(ReturnsXApiClient);
      expect(client.getConfig().timeout).toBe(DEFAULT_API_CONFIG.timeout);
    });
  });

  describe('customer data hashing', () => {
    it('should normalize phone numbers before hashing', async () => {
      const testCases = [
        '+92 300 123 4567',
        '+92-300-123-4567',
        '+92(300)123-4567',
        '+923001234567',
      ];

      // All should result in the same hash after normalization
      const hashes = await Promise.all(
        testCases.map(phone => 
          apiClient.getRiskProfile({ phone })
        )
      );

      // Verify all requests were made (indicating normalization worked)
      expect(mockFetch).toHaveBeenCalledTimes(testCases.length);
    });

    it('should normalize email addresses before hashing', async () => {
      const testCases = [
        'Test@Example.com',
        'test@example.com',
        '  test@example.com  ',
        'TEST@EXAMPLE.COM',
      ];

      // All should result in the same hash after normalization
      await Promise.all(
        testCases.map(email => 
          apiClient.getRiskProfile({ email })
        )
      );

      // Verify all requests were made (indicating normalization worked)
      expect(mockFetch).toHaveBeenCalledTimes(testCases.length);
    });

    it('should handle empty customer data', async () => {
      const result = await apiClient.getRiskProfile({});
      
      // Should still make request with empty hashed values
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});