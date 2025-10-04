/**
 * Integration tests for complete Error Handling and Recovery System
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RetryManager,
  RetryableOperation
} from '../../../app/services/retryManager.server';
import {
  RecoveryStrategyManager,
  DatabaseErrorRecovery,
  CircuitBreakerErrorRecovery,
  RequestContext
} from '../../../app/services/errorRecovery.server';
import {
  GracefulDegradationHandler,
  DefaultFallbackDataProvider
} from '../../../app/services/gracefulDegradation.server';
import {
  DatabaseError,
  CircuitBreakerError,
  TimeoutError,
  NetworkError,
  ValidationError,
  ApiErrorType
} from '../../../app/services/errorHandling.server';

describe('Error Handling System Integration', () => {
  let retryManager: RetryManager;
  let recoveryManager: RecoveryStrategyManager;
  let degradationHandler: GracefulDegradationHandler;
  let mockCacheService: any;
  let mockFallbackProvider: any;
  let context: RequestContext;

  beforeEach(() => {
    // Mock cache service
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn()
    };

    // Mock fallback provider
    mockFallbackProvider = new DefaultFallbackDataProvider();

    // Set up recovery manager with cache and fallback services
    recoveryManager = new RecoveryStrategyManager();
    recoveryManager.registerStrategy(
      new DatabaseErrorRecovery({}, mockCacheService, mockFallbackProvider)
    );
    recoveryManager.registerStrategy(
      new CircuitBreakerErrorRecovery({}, mockCacheService, mockFallbackProvider)
    );

    // Set up degradation handler
    degradationHandler = new GracefulDegradationHandler(mockFallbackProvider, mockCacheService);

    // Set up retry manager
    retryManager = new RetryManager(recoveryManager, {
      maxRetries: 2,
      baseDelayMs: 10, // Fast tests
      maxDelayMs: 100,
      backoffMultiplier: 2,
      jitterEnabled: false,
      timeoutMs: 5000
    });

    context = {
      requestId: 'integration-test-123',
      endpoint: '/api/get-order-data',
      method: 'GET',
      parameters: {
        customerPhone: '+1234567890',
        orderId: 'order-123'
      },
      headers: { 'user-agent': 'test-client' },
      timestamp: Date.now(),
      retryAttempt: 0,
      maxRetries: 2
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Success Scenarios', () => {
    it('should succeed on first attempt without any error handling', async () => {
      const operation: RetryableOperation<any> = vi.fn().mockResolvedValue({
        id: 'customer-123',
        riskTier: 'low',
        riskScore: 25
      });

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('customer-123');
      expect(result.attempts).toHaveLength(1);
      expect(result.recoveryUsed).toBe(false);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should succeed after retries with transient errors', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValueOnce(new TimeoutError('Temporary timeout'))
        .mockRejectedValueOnce(new NetworkError('Network blip'))
        .mockResolvedValue({
          id: 'customer-123',
          riskTier: 'medium',
          riskScore: 45
        });

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('customer-123');
      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(false);
      expect(result.attempts[2].success).toBe(true);
    });
  });

  describe('Cache-Based Recovery Scenarios', () => {
    it('should recover from database error using cached data', async () => {
      const cachedData = {
        id: 'cached-customer-123',
        riskTier: 'low',
        riskScore: 30,
        metadata: { source: 'cache' }
      };

      mockCacheService.get.mockResolvedValue(cachedData);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database connection failed'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.attempts).toHaveLength(3); // Initial + 2 retries
    });

    it('should recover from circuit breaker error using cached data', async () => {
      const cachedData = {
        id: 'cached-customer-456',
        riskTier: 'medium',
        riskScore: 50,
        metadata: { source: 'cache' }
      };

      mockCacheService.get.mockResolvedValue(cachedData);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new CircuitBreakerError('Circuit breaker is open'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.attempts).toHaveLength(1); // Circuit breaker errors don't retry
    });
  });

  describe('Fallback Data Recovery Scenarios', () => {
    it('should recover from database error using fallback data when cache is empty', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database permanently down'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.riskTier).toBe('medium'); // Default fallback
      expect(result.data.riskScore).toBe(50);
      expect(result.data.metadata.source).toBe('fallback');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should generate new customer profile when no identifiers available', async () => {
      mockCacheService.get.mockResolvedValue(null);
      context.parameters = {}; // No customer identifiers

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.riskTier).toBe('new'); // New customer fallback
      expect(result.data.riskScore).toBe(30);
      expect(result.data.id).toContain('new_customer_');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Graceful Degradation Integration', () => {
    it('should handle degradation for circuit breaker errors', async () => {
      const cachedData = {
        id: 'degraded-customer',
        riskTier: 'medium',
        riskScore: 45
      };

      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new CircuitBreakerError('Service unavailable', {
        circuitState: 'OPEN'
      });

      const result = await degradationHandler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.strategy).toBe('cache_fallback');
    });

    it('should cascade from cache to fallback data', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const error = new DatabaseError('Database connection lost');

      const result = await degradationHandler.handleDegradation(error, context);

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('fallback_generator');
      expect(result.confidence).toBe(0.4);
      expect(result.data.riskTier).toBe('medium');
    });

    it('should provide minimal response for validation errors', async () => {
      const error = new ValidationError('Invalid phone number format', {
        field: 'customerPhone',
        value: 'invalid-phone'
      });

      const result = await degradationHandler.handleDegradation(error, context);

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.source).toBe('minimal_response');
      expect(result.confidence).toBe(0);
      expect(result.message).toBe('Invalid phone number format');
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle multiple cascading failures', async () => {
      // Cache fails, fallback succeeds
      mockCacheService.get.mockRejectedValue(new Error('Cache service down'));

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Primary database down'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.metadata.source).toBe('fallback');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle recovery strategy failures gracefully', async () => {
      // Mock recovery to fail
      const mockRecoveryManager = {
        recover: vi.fn().mockRejectedValue(new Error('Recovery system failed'))
      };

      const retryManagerWithFailingRecovery = new RetryManager(mockRecoveryManager as any, {
        maxRetries: 1,
        baseDelayMs: 10
      });

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      const result = await retryManagerWithFailingRecovery.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.recoveryUsed).toBe(true);
      expect(result.error).toBeInstanceOf(DatabaseError);
    });

    it('should handle timeout during retry operations', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      const result = await retryManager.executeWithRetry(operation, context, {
        timeoutMs: 500
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(ApiErrorType.TIMEOUT_ERROR);
      expect(result.attempts.length).toBeLessThan(3); // Should timeout before all retries
    });
  });

  describe('Performance and Timing', () => {
    it('should complete retries within reasonable time', async () => {
      const startTime = Date.now();

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new TimeoutError('Timeout'));

      await retryManager.executeWithRetry(operation, context);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within expected time (base delays: 10ms + 20ms = 30ms + overhead)
      expect(totalTime).toBeLessThan(200);
    });

    it('should apply exponential backoff correctly', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new NetworkError('Network error'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].delayMs).toBe(10);  // Base delay
      expect(result.attempts[1].delayMs).toBe(20);  // 10 * 2
      expect(result.attempts[2].delayMs).toBe(0);   // No delay after last attempt
    });
  });

  describe('Context Propagation', () => {
    it('should maintain request context through recovery chain', async () => {
      let capturedContext: RequestContext | undefined;

      const mockRecoveryManager = {
        recover: vi.fn().mockImplementation((error, ctx) => {
          capturedContext = ctx;
          return {
            success: true,
            data: { recovered: true },
            fallbackUsed: true,
            retryRecommended: false,
            strategy: 'TestRecovery'
          };
        })
      };

      const retryManagerWithMockRecovery = new RetryManager(mockRecoveryManager as any);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      await retryManagerWithMockRecovery.executeWithRetry(operation, context);

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.requestId).toBe('integration-test-123');
      expect(capturedContext?.endpoint).toBe('/api/get-order-data');
      expect(capturedContext?.parameters.customerPhone).toBe('+1234567890');
      expect(capturedContext?.retryAttempt).toBeGreaterThan(0);
    });
  });

  describe('Error Classification and Routing', () => {
    it('should route different error types to appropriate strategies', async () => {
      const strategies = recoveryManager.listStrategies();

      expect(strategies).toContain('DatabaseErrorRecovery');
      expect(strategies).toContain('CircuitBreakerErrorRecovery');
      expect(strategies).toContain('TimeoutErrorRecovery');
      expect(strategies).toContain('NetworkErrorRecovery');

      // Test database error routing
      const dbError = new DatabaseError('DB error');
      const dbResult = await recoveryManager.recover(dbError, context);
      expect(dbResult.strategy).toBe('DatabaseErrorRecovery');

      // Test circuit breaker error routing
      const cbError = new CircuitBreakerError('CB error');
      const cbResult = await recoveryManager.recover(cbError, context);
      expect(cbResult.strategy).toBe('CircuitBreakerErrorRecovery');
    });

    it('should handle unknown error types gracefully', async () => {
      const unknownError = new ValidationError('Unknown validation error');
      const result = await recoveryManager.recover(unknownError, context);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('NoStrategyFound');
      expect(result.metadata?.errorType).toBe(ApiErrorType.VALIDATION_ERROR);
    });
  });
});