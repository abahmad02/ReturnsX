/**
 * Integration tests for optimized API client
 * Tests extension behavior with optimized API under various network conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReturnsXApiClient, createApiClient } from '../services/apiClient';
import { RiskProfileRequest } from '../types';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto for hashing (not needed with optimized API but kept for compatibility)
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

describe('Optimized API Integration', () => {
  let apiClient: ReturnsXApiClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = createApiClient({
      baseUrl: 'https://test-api.returnsx.com',
      timeout: 5000,
      enableDebug: true,
    });
  });

  afterEach(() => {
    apiClient.cancelRequests();
  });

  describe('Successful API Responses', () => {
    it('should handle successful response with customer data', async () => {
      const mockResponse = {
        data: {
          orderInfo: {
            orderId: '12345',
            orderName: '#1001',
            totalAmount: '1500',
            currency: 'PKR',
            customerPhone: '+923001234567',
            customerEmail: 'test@example.com',
          },
          customer: {
            id: 'cust_123',
            phone: '+923001234567',
            email: 'test@example.com',
            riskLevel: 'medium',
            riskScore: 45,
            orderCount: 5,
            fraudReports: 1,
          },
        },
        metadata: {
          requestId: 'req_123',
          processingTime: 150,
          cacheHit: false,
          dataSource: 'database',
          queryCount: 2,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923001234567',
        orderId: '12345',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(true);
      expect(result.riskTier).toBe('MEDIUM_RISK');
      expect(result.riskScore).toBe(45);
      expect(result.totalOrders).toBe(5);
      expect(result.isNewCustomer).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/get-order-data'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle new customer response', async () => {
      const mockResponse = {
        data: {
          orderInfo: null,
          customer: null,
        },
        metadata: {
          requestId: 'req_124',
          processingTime: 50,
          cacheHit: false,
          dataSource: 'database',
          queryCount: 1,
          timestamp: Date.now(),
        },
        message: 'Welcome! We\'re excited to serve you.',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923009876543',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(false); // No data found
      expect(result.riskTier).toBe('ZERO_RISK');
      expect(result.isNewCustomer).toBe(true);
      expect(result.message).toContain('Welcome');
    });

    it('should handle server cache hit', async () => {
      const mockResponse = {
        data: {
          customer: {
            riskLevel: 'low',
            riskScore: 10,
            orderCount: 3,
          },
        },
        metadata: {
          requestId: 'req_125',
          processingTime: 25,
          cacheHit: true,
          dataSource: 'cache',
          queryCount: 0,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        checkoutToken: 'checkout_abc123',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(true);
      expect(result.riskTier).toBe('ZERO_RISK');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const mockErrorResponse = {
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          code: 'VALIDATION_FAILED',
          retryable: false,
          timestamp: Date.now(),
          requestId: 'req_126',
        },
        metadata: {
          requestId: 'req_126',
          processingTime: 10,
          cacheHit: false,
          dataSource: 'fallback',
          queryCount: 0,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const request: RiskProfileRequest = {
        // Invalid request with no identifiers
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.error).toContain('Invalid');
    });

    it('should handle circuit breaker errors', async () => {
      const mockErrorResponse = {
        error: {
          type: 'CIRCUIT_BREAKER_ERROR',
          message: 'Service temporarily unavailable due to circuit breaker',
          code: 'CIRCUIT_BREAKER_OPEN',
          retryable: true,
          retryAfter: 30,
          timestamp: Date.now(),
          requestId: 'req_127',
        },
        metadata: {
          requestId: 'req_127',
          processingTime: 5,
          cacheHit: false,
          dataSource: 'fallback',
          queryCount: 0,
          timestamp: Date.now(),
          circuitBreakerState: 'OPEN',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923001234567',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('should handle rate limiting errors', async () => {
      const mockErrorResponse = {
        error: {
          type: 'RATE_LIMIT_ERROR',
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryable: true,
          retryAfter: 60,
          timestamp: Date.now(),
          requestId: 'req_128',
        },
        metadata: {
          requestId: 'req_128',
          processingTime: 2,
          cacheHit: false,
          dataSource: 'fallback',
          queryCount: 0,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923001234567',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('many requests');
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const request: RiskProfileRequest = {
        phone: '+923001234567',
      };

      const result = await apiClient.getRiskProfile(request);

      expect(result.success).toBe(false);
      expect(result.isNewCustomer).toBe(true);
      expect(result.error).toContain('Welcome');
    });
  });

  describe('Client-side Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const mockResponse = {
        data: {
          customer: {
            riskLevel: 'low',
            riskScore: 15,
            orderCount: 2,
          },
        },
        metadata: {
          requestId: 'req_129',
          processingTime: 100,
          cacheHit: false,
          dataSource: 'database',
          queryCount: 1,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923001234567',
        orderId: '12345',
      };

      // Make two identical requests simultaneously
      const [result1, result2] = await Promise.all([
        apiClient.getRiskProfile(request),
        apiClient.getRiskProfile(request),
      ]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // But only one network request should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Integration', () => {
    it('should use client cache for repeated requests', async () => {
      const mockResponse = {
        data: {
          customer: {
            riskLevel: 'high',
            riskScore: 80,
            orderCount: 10,
            fraudReports: 3,
          },
        },
        metadata: {
          requestId: 'req_130',
          processingTime: 200,
          cacheHit: false,
          dataSource: 'database',
          queryCount: 2,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        phone: '+923001234567',
      };

      // First request
      const result1 = await apiClient.getRiskProfile(request);
      expect(result1.success).toBe(true);
      expect(result1.riskTier).toBe('HIGH_RISK');

      // Second request should use cache
      const result2 = await apiClient.getRiskProfile(request);
      expect(result2.success).toBe(true);
      expect(result2.riskTier).toBe('HIGH_RISK');

      // Only one network request should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when requested', async () => {
      const mockResponse = {
        data: {
          customer: {
            riskLevel: 'medium',
            riskScore: 50,
            orderCount: 5,
          },
        },
        metadata: {
          requestId: 'req_131',
          processingTime: 150,
          cacheHit: false,
          dataSource: 'database',
          queryCount: 1,
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RiskProfileRequest = {
        email: 'test@example.com',
      };

      // First request
      await apiClient.getRiskProfile(request);
      
      // Second request with cache bypass
      await apiClient.getRiskProfile(request, true);

      // Two network requests should have been made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          metadata: {
            requestId: 'health_check',
            processingTime: 10,
            timestamp: Date.now(),
          },
        }),
      });

      const isHealthy = await apiClient.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('healthCheck=true'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle health check failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await apiClient.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });
});