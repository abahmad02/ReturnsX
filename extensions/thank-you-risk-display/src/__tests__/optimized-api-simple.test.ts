/**
 * Simple integration test for optimized API client
 * Tests basic functionality without complex dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReturnsXApiClient, createApiClient } from '../services/apiClient';
import { RiskProfileRequest } from '../types';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto for hashing
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

describe('Optimized API Simple Integration', () => {
  let apiClient: ReturnsXApiClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = createApiClient({
      baseUrl: 'https://test-api.returnsx.com',
      timeout: 5000,
      enableDebug: false, // Disable debug to reduce noise
    });
  });

  afterEach(() => {
    apiClient.cancelRequests();
  });

  it('should make GET request to optimized endpoint', async () => {
    const mockResponse = {
      data: {
        customer: {
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

    await apiClient.getRiskProfile(request);

    // Verify the request was made to the correct endpoint with GET method
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/get-order-data'),
      expect.objectContaining({
        method: 'GET',
      })
    );

    // Verify query parameters were included
    const callArgs = mockFetch.mock.calls[0];
    const url = callArgs[0];
    expect(url).toContain('customerPhone=%2B923001234567');
    expect(url).toContain('orderId=12345');
  });

  it('should transform optimized response correctly', async () => {
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
        requestId: 'req_124',
        processingTime: 200,
        cacheHit: false,
        dataSource: 'database',
        queryCount: 1,
        timestamp: Date.now(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const request: RiskProfileRequest = {
      email: 'test@example.com',
    };

    const result = await apiClient.getRiskProfile(request);

    expect(result.riskTier).toBe('HIGH_RISK');
    expect(result.riskScore).toBe(80);
    expect(result.totalOrders).toBe(10);
    expect(result.failedAttempts).toBe(3);
    expect(result.successfulDeliveries).toBe(7);
    expect(result.isNewCustomer).toBe(false);
  });

  it('should handle new customer response', async () => {
    const mockResponse = {
      data: {
        customer: null,
      },
      metadata: {
        requestId: 'req_125',
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
      checkoutToken: 'checkout_new_customer',
    };

    const result = await apiClient.getRiskProfile(request);

    expect(result.success).toBe(false); // No customer data found
    expect(result.riskTier).toBe('ZERO_RISK');
    expect(result.isNewCustomer).toBe(true);
    expect(result.message).toContain('Welcome');
  });

  it('should handle error responses', async () => {
    const mockErrorResponse = {
      error: {
        type: 'NOT_FOUND_ERROR',
        message: 'No customer data found',
        code: 'NOT_FOUND',
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
      status: 404,
      json: () => Promise.resolve(mockErrorResponse),
    });

    const request: RiskProfileRequest = {
      phone: '+923009999999',
    };

    const result = await apiClient.getRiskProfile(request);

    expect(result.success).toBe(false);
    expect(result.isNewCustomer).toBe(true);
    expect(result.riskTier).toBe('ZERO_RISK');
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request: RiskProfileRequest = {
      phone: '+923001234567',
    };

    const result = await apiClient.getRiskProfile(request);

    expect(result.success).toBe(false);
    expect(result.isNewCustomer).toBe(true);
    expect(result.message).toContain('Welcome');
  });
});