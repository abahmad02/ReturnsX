/**
 * Unit tests for Graceful Degradation Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GracefulDegradationHandler,
  DefaultFallbackDataProvider,
  CustomerIdentifiers
} from '../../../app/services/gracefulDegradation.server';
import {
  DatabaseError,
  CircuitBreakerError,
  TimeoutError,
  NetworkError,
  ValidationError,
  ApiErrorType
} from '../../../app/services/errorHandling.server';
import { RequestContext } from '../../../app/services/errorRecovery.server';

describe('DefaultFallbackDataProvider', () => {
  let provider: DefaultFallbackDataProvider;

  beforeEach(() => {
    provider = new DefaultFallbackDataProvider();
  });

  it('should generate customer fallback with identifiers', () => {
    const identifiers: CustomerIdentifiers = {
      phone: '+1234567890',
      email: 'test@example.com',
      orderId: 'order-123'
    };

    const profile = provider.getCustomerFallback(identifiers);

    expect(profile.riskTier).toBe('medium');
    expect(profile.riskScore).toBe(50);
    expect(profile.orderCount).toBe(0);
    expect(profile.metadata.source).toBe('fallback');
    expect(profile.metadata.confidence).toBe(0.3);
    expect(profile.metadata.identifiers.hasPhone).toBe(true);
    expect(profile.metadata.identifiers.hasEmail).toBe(true);
    expect(profile.metadata.identifiers.hasOrderId).toBe(true);
  });

  it('should generate customer fallback without identifiers', () => {
    const identifiers: CustomerIdentifiers = {};
    const profile = provider.getCustomerFallback(identifiers);

    expect(profile.riskTier).toBe('medium');
    expect(profile.id).toContain('unknown_');
    expect(profile.metadata.identifiers.hasPhone).toBe(false);
    expect(profile.metadata.identifiers.hasEmail).toBe(false);
  });

  it('should generate order fallback', () => {
    const order = provider.getOrderFallback('order-123');

    expect(order.id).toBe('order-123');
    expect(order.status).toBe('unknown');
    expect(order.customerRisk).toBe('medium');
    expect(order.currency).toBe('PKR');
    expect(order.metadata.source).toBe('fallback');
  });

  it('should generate new customer profile', () => {
    const profile = provider.getNewCustomerProfile();

    expect(profile.riskTier).toBe('new');
    expect(profile.riskScore).toBe(30);
    expect(profile.orderCount).toBe(0);
    expect(profile.metadata.confidence).toBe(0.5);
    expect(profile.id).toContain('new_customer_');
  });

  it('should generate default risk assessment', () => {
    const assessment = provider.getDefaultRiskAssessment();

    expect(assessment.riskLevel).toBe('medium');
    expect(assessment.riskScore).toBe(50);
    expect(assessment.factors).toHaveLength(1);
    expect(assessment.recommendations).toHaveLength(1);
    expect(assessment.metadata.source).toBe('fallback');
    expect(assessment.metadata.confidence).toBe(0.3);
  });
});

describe('GracefulDegradationHandler', () => {
  let handler: GracefulDegradationHandler;
  let mockCacheService: any;
  let mockFallbackProvider: any;
  let context: RequestContext;

  beforeEach(() => {
    mockCacheService = {
      get: vi.fn()
    };

    mockFallbackProvider = {
      getCustomerFallback: vi.fn().mockReturnValue({
        id: 'fallback-customer',
        riskTier: 'medium',
        riskScore: 50,
        metadata: { source: 'fallback', confidence: 0.4 }
      }),
      getNewCustomerProfile: vi.fn().mockReturnValue({
        id: 'new-customer',
        riskTier: 'new',
        riskScore: 30,
        metadata: { source: 'fallback', confidence: 0.5 }
      }),
      getOrderFallback: vi.fn().mockReturnValue({
        id: 'fallback-order',
        status: 'unknown',
        metadata: { source: 'fallback' }
      }),
      getDefaultRiskAssessment: vi.fn().mockReturnValue({
        riskLevel: 'medium',
        riskScore: 50,
        metadata: { source: 'fallback', confidence: 0.3 }
      })
    };

    handler = new GracefulDegradationHandler(mockFallbackProvider, mockCacheService);

    context = {
      requestId: 'test-123',
      endpoint: '/api/get-order-data',
      method: 'GET',
      parameters: { customerPhone: '+1234567890' },
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 1,
      maxRetries: 3
    };
  });

  describe('Strategy Selection', () => {
    it('should select cache_fallback for circuit breaker errors', async () => {
      const cachedData = { id: 'cached-customer' };
      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new CircuitBreakerError('Circuit open');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.data).toEqual(cachedData);
      expect(result.confidence).toBe(0.8);
    });

    it('should select cache_fallback for database errors', async () => {
      const cachedData = { id: 'cached-customer' };
      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new DatabaseError('Connection failed');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.data).toEqual(cachedData);
    });

    it('should select data_fallback for timeout errors', async () => {
      const error = new TimeoutError('Request timeout');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback_generator');
      expect(result.confidence).toBe(0.4);
      expect(mockFallbackProvider.getCustomerFallback).toHaveBeenCalled();
    });

    it('should select minimal_response for validation errors', async () => {
      const error = new ValidationError('Invalid input');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(false);
      expect(result.source).toBe('minimal_response');
      expect(result.confidence).toBe(0);
      expect(result.message).toBe('Invalid input');
    });
  });

  describe('Cache Fallback', () => {
    it('should serve cached data when available', async () => {
      const cachedData = { id: 'cached-customer', riskTier: 'low' };
      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new DatabaseError('Connection failed');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.strategy).toBe('cache_fallback');
    });

    it('should fall back to data fallback when cache fails', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      const error = new DatabaseError('Connection failed');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback_generator');
      expect(result.confidence).toBe(0.4);
      expect(mockFallbackProvider.getCustomerFallback).toHaveBeenCalled();
    });

    it('should fall back to data fallback when cache returns null', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const error = new CircuitBreakerError('Circuit open');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback_generator');
      expect(mockFallbackProvider.getCustomerFallback).toHaveBeenCalled();
    });
  });

  describe('Data Fallback Generation', () => {
    it('should generate customer fallback for get-order-data endpoint with identifiers', async () => {
      const error = new TimeoutError('Request timeout');
      const result = await handler.handleDegradation(error, context);

      expect(mockFallbackProvider.getCustomerFallback).toHaveBeenCalledWith({
        phone: '+1234567890',
        email: undefined,
        orderId: undefined,
        checkoutToken: undefined
      });
      expect(result.data.id).toBe('fallback-customer');
    });

    it('should generate new customer profile when no identifiers', async () => {
      context.parameters = {}; // No identifiers
      
      const error = new TimeoutError('Request timeout');
      const result = await handler.handleDegradation(error, context);

      expect(mockFallbackProvider.getNewCustomerProfile).toHaveBeenCalled();
      expect(result.data.id).toBe('new-customer');
    });

    it('should generate order fallback for order endpoints', async () => {
      context.endpoint = '/api/order/status';
      context.parameters = { orderId: 'order-123' };
      
      const error = new NetworkError('Network error');
      const result = await handler.handleDegradation(error, context);

      expect(mockFallbackProvider.getOrderFallback).toHaveBeenCalledWith('order-123');
      expect(result.data.id).toBe('fallback-order');
    });

    it('should generate default risk assessment for unknown endpoints', async () => {
      context.endpoint = '/api/unknown';
      context.parameters = {};
      
      const error = new DatabaseError('Database error');
      const result = await handler.handleDegradation(error, context);

      expect(mockFallbackProvider.getDefaultRiskAssessment).toHaveBeenCalled();
      expect(result.data.riskLevel).toBe('medium');
    });
  });

  describe('Error Handling', () => {
    it('should handle degradation failures with emergency fallback', async () => {
      mockFallbackProvider.getCustomerFallback.mockImplementation(() => {
        throw new Error('Fallback provider failed');
      });

      const error = new DatabaseError('Database error');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(false);
      expect(result.source).toBe('emergency_fallback');
      expect(result.confidence).toBe(0);
      expect(result.message).toBe('Service temporarily unavailable');
      expect(result.metadata?.originalError).toBe(ApiErrorType.DATABASE_ERROR);
      expect(result.metadata?.degradationError).toBe('Fallback provider failed');
    });

    it('should handle cache service errors gracefully', async () => {
      mockCacheService.get.mockImplementation(() => {
        throw new Error('Cache service error');
      });

      const error = new CircuitBreakerError('Circuit open');
      const result = await handler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback_generator');
      expect(mockFallbackProvider.getCustomerFallback).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should allow setting custom fallback provider', () => {
      const customProvider = {
        getCustomerFallback: vi.fn(),
        getNewCustomerProfile: vi.fn(),
        getOrderFallback: vi.fn(),
        getDefaultRiskAssessment: vi.fn()
      };

      handler.setFallbackProvider(customProvider);
      
      // Verify the provider was set (we can't directly test private properties)
      expect(() => handler.setFallbackProvider(customProvider)).not.toThrow();
    });

    it('should allow setting custom cache service', () => {
      const customCache = {
        get: vi.fn(),
        set: vi.fn()
      };

      handler.setCacheService(customCache);
      
      // Verify the cache service was set
      expect(() => handler.setCacheService(customCache)).not.toThrow();
    });
  });

  describe('Response Metadata', () => {
    it('should include comprehensive metadata in responses', async () => {
      const error = new DatabaseError('Connection failed');
      const result = await handler.handleDegradation(error, context);

      expect(result.metadata).toEqual({
        originalError: ApiErrorType.DATABASE_ERROR,
        strategy: 'data_fallback',
        timestamp: expect.any(String),
        endpoint: '/api/get-order-data'
      });
    });

    it('should include cache key in cache fallback metadata', async () => {
      const cachedData = { id: 'cached-customer' };
      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new CircuitBreakerError('Circuit open');
      const result = await handler.handleDegradation(error, context);

      expect(result.metadata?.cacheKey).toBeDefined();
      expect(result.metadata?.originalError).toBe(ApiErrorType.CIRCUIT_BREAKER_ERROR);
      expect(result.metadata?.strategy).toBe('cache_fallback');
    });
  });
});