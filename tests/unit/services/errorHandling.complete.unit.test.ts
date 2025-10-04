/**
 * Complete Error Handling System Integration Tests (Unit Level)
 * 
 * Tests the complete error handling system without requiring database setup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  NotFoundError,
  ErrorFactory
} from '../../../app/services/errorHandling.server';

describe('Complete Error Handling System', () => {
  let retryManager: RetryManager;
  let recoveryManager: RecoveryStrategyManager;
  let degradationHandler: GracefulDegradationHandler;
  let mockCacheService: any;
  let fallbackProvider: DefaultFallbackDataProvider;
  let context: RequestContext;

  beforeEach(() => {
    // Mock cache service
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn()
    };

    // Real fallback provider
    fallbackProvider = new DefaultFallbackDataProvider();

    // Set up recovery manager with real strategies
    recoveryManager = new RecoveryStrategyManager();
    recoveryManager.registerStrategy(
      new DatabaseErrorRecovery({
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100
      }, mockCacheService, fallbackProvider)
    );
    recoveryManager.registerStrategy(
      new CircuitBreakerErrorRecovery({}, mockCacheService, fallbackProvider)
    );

    // Set up degradation handler
    degradationHandler = new GracefulDegradationHandler(fallbackProvider, mockCacheService);

    // Set up retry manager with fast settings for tests
    retryManager = new RetryManager(recoveryManager, {
      maxRetries: 2,
      baseDelayMs: 5,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      jitterEnabled: false,
      timeoutMs: 1000
    });

    context = {
      requestId: 'test-123',
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

  describe('End-to-End Success Scenarios', () => {
    it('should succeed on first attempt', async () => {
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
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should succeed after retries', async () => {
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
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cache-Based Recovery', () => {
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

  describe('Fallback Data Recovery', () => {
    it('should recover using fallback data when cache is empty', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database permanently down'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.riskTier).toBe('new'); // DatabaseErrorRecovery uses getNewCustomerProfile
      expect(result.data.riskScore).toBe(30);
      expect(result.data.metadata.source).toBe('fallback');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should generate new customer profile when no identifiers', async () => {
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

  describe('Error Factory Integration', () => {
    it('should create appropriate errors and handle them correctly', async () => {
      // Test error factory creating different error types
      const timeoutError = ErrorFactory.createTimeout('database_query', 5000);
      const dbError = ErrorFactory.createDatabase('SELECT', 'Connection lost');
      const notFoundError = ErrorFactory.createNotFound('Customer', 'cust-123');

      expect(timeoutError).toBeInstanceOf(TimeoutError);
      expect(dbError).toBeInstanceOf(DatabaseError);
      expect(notFoundError).toBeInstanceOf(NotFoundError);

      // Test that recovery manager can handle factory-created errors
      const dbRecoveryResult = await recoveryManager.recover(dbError, context);
      expect(dbRecoveryResult.strategy).toBe('DatabaseErrorRecovery');

      const timeoutRecoveryResult = await recoveryManager.recover(timeoutError, context);
      expect(timeoutRecoveryResult.strategy).toBe('TimeoutErrorRecovery');
    });

    it('should normalize unknown errors and handle them', async () => {
      const unknownError = new Error('Some unknown error');
      const normalizedError = ErrorFactory.createFromError(unknownError);

      expect(normalizedError.type).toBe('INTERNAL_SERVER_ERROR');
      expect(normalizedError.context.originalError).toBe(unknownError);

      // Should still be handled by the system
      const recoveryResult = await recoveryManager.recover(normalizedError, context);
      expect(recoveryResult).toBeDefined();
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      // Cache fails, but fallback succeeds
      mockCacheService.get.mockRejectedValue(new Error('Cache service down'));

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Primary database down'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data.metadata.source).toBe('fallback');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle non-retryable errors correctly', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new ValidationError('Invalid input'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(1); // No retries for validation errors
      expect(result.error?.type).toBe('VALIDATION_ERROR');
    });

    it('should respect retry limits', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new TimeoutError('Persistent timeout'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(3); // Initial + 2 retries
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance and Timing', () => {
    it('should apply exponential backoff correctly', async () => {
      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new NetworkError('Network error'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].delayMs).toBe(5);   // Base delay
      expect(result.attempts[1].delayMs).toBe(10);  // 5 * 2
      expect(result.attempts[2].delayMs).toBe(0);   // No delay after last attempt
    });

    it('should complete operations within reasonable time', async () => {
      const startTime = Date.now();

      const operation: RetryableOperation<any> = vi.fn()
        .mockResolvedValue({ success: true });

      await retryManager.executeWithRetry(operation, context);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete very quickly for successful operations
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Context and Metadata', () => {
    it('should maintain request context through the entire chain', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const operation: RetryableOperation<any> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      const result = await retryManager.executeWithRetry(operation, context);

      // Check that context was preserved in the fallback data
      expect(result.data.metadata.source).toBe('fallback');
      expect(result.data.metadata.confidence).toBeDefined();
    });

    it('should include comprehensive metadata in responses', async () => {
      const cachedData = { id: 'cached', metadata: { source: 'cache' } };
      mockCacheService.get.mockResolvedValue(cachedData);

      const error = new DatabaseError('Connection failed');
      const result = await degradationHandler.handleDegradation(error, context);

      expect(result.metadata).toEqual({
        cacheKey: expect.any(String),
        originalError: 'DATABASE_ERROR',
        strategy: 'cache_fallback',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Error Classification and Strategy Selection', () => {
    it('should route different error types to appropriate strategies', async () => {
      const strategies = recoveryManager.listStrategies();

      expect(strategies).toContain('DatabaseErrorRecovery');
      expect(strategies).toContain('CircuitBreakerErrorRecovery');
      expect(strategies).toContain('TimeoutErrorRecovery');
      expect(strategies).toContain('NetworkErrorRecovery');

      // Test routing
      const dbError = new DatabaseError('DB error');
      const dbResult = await recoveryManager.recover(dbError, context);
      expect(dbResult.strategy).toBe('DatabaseErrorRecovery');

      const cbError = new CircuitBreakerError('CB error');
      const cbResult = await recoveryManager.recover(cbError, context);
      expect(cbResult.strategy).toBe('CircuitBreakerErrorRecovery');
    });

    it('should handle unknown error types gracefully', async () => {
      const unknownError = new ValidationError('Unknown validation error');
      const result = await recoveryManager.recover(unknownError, context);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('NoStrategyFound');
    });
  });
});