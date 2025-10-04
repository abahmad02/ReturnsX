/**
 * Unit tests for Retry Manager with Exponential Backoff
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  RetryManager,
  RetryPolicy,
  RetryableOperation
} from '../../../app/services/retryManager.server';
import {
  RecoveryStrategyManager,
  RequestContext
} from '../../../app/services/errorRecovery.server';
import {
  ApiError,
  ApiErrorType,
  TimeoutError,
  DatabaseError,
  NetworkError,
  ValidationError,
  RateLimitError
} from '../../../app/services/errorHandling.server';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockRecoveryManager: RecoveryStrategyManager;
  let context: RequestContext;

  beforeEach(() => {
    mockRecoveryManager = {
      recover: vi.fn()
    } as any;

    retryManager = new RetryManager(mockRecoveryManager, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterEnabled: false, // Disable for predictable tests
      timeoutMs: 10000
    });

    context = {
      requestId: 'test-123',
      endpoint: '/api/test',
      method: 'GET',
      parameters: {},
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 0,
      maxRetries: 3
    };
  });

  describe('Successful Operations', () => {
    it('should return success on first attempt', async () => {
      const operation: RetryableOperation<string> = vi.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].success).toBe(true);
      expect(result.recoveryUsed).toBe(false);
      expect(result.fallbackUsed).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should succeed after retries', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout 1'))
        .mockRejectedValueOnce(new TimeoutError('Timeout 2'))
        .mockResolvedValue('success');

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(false);
      expect(result.attempts[2].success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors up to max attempts', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new TimeoutError('Persistent timeout'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(4); // Initial + 3 retries
      expect(operation).toHaveBeenCalledTimes(4);
      expect(result.error).toBeInstanceOf(TimeoutError);
    });

    it('should not retry non-retryable errors', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new ValidationError('Invalid input'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('should calculate exponential backoff delays correctly', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new NetworkError('Network error'));

      const startTime = Date.now();
      await retryManager.executeWithRetry(operation, context);
      const endTime = Date.now();

      const result = await retryManager.executeWithRetry(operation, context);
      
      // Check that delays were applied (total time should be > sum of expected delays)
      const expectedMinDelay = 100 + 200 + 400; // Base delays without jitter
      expect(result.attempts).toHaveLength(4);
      expect(result.attempts[0].delayMs).toBe(100);
      expect(result.attempts[1].delayMs).toBe(200);
      expect(result.attempts[2].delayMs).toBe(400);
    });

    it('should respect maximum delay cap', async () => {
      const retryManagerWithLowCap = new RetryManager(mockRecoveryManager, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        backoffMultiplier: 3,
        jitterEnabled: false
      });

      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      const result = await retryManagerWithLowCap.executeWithRetry(operation, context);

      // Later attempts should be capped at maxDelayMs
      const laterAttempts = result.attempts.slice(2);
      laterAttempts.forEach(attempt => {
        expect(attempt.delayMs).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe('Recovery Integration', () => {
    it('should use recovery when retries are exhausted', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      (mockRecoveryManager.recover as Mock).mockResolvedValue({
        success: true,
        data: 'recovered-data',
        fallbackUsed: true,
        retryRecommended: false,
        strategy: 'DatabaseErrorRecovery'
      });

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('recovered-data');
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockRecoveryManager.recover).toHaveBeenCalled();
    });

    it('should fail when both retries and recovery fail', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      (mockRecoveryManager.recover as Mock).mockResolvedValue({
        success: false,
        fallbackUsed: false,
        retryRecommended: false,
        strategy: 'DatabaseErrorRecovery'
      });

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.recoveryUsed).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.error).toBeInstanceOf(DatabaseError);
    });

    it('should handle recovery errors gracefully', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new NetworkError('Network error'));

      (mockRecoveryManager.recover as Mock).mockRejectedValue(new Error('Recovery failed'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.recoveryUsed).toBe(true);
      expect(result.error).toBeInstanceOf(NetworkError);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 15000)));

      const result = await retryManager.executeWithRetry(operation, context, {
        timeoutMs: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.type).toBe(ApiErrorType.TIMEOUT_ERROR);
    });

    it('should timeout entire retry operation', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new TimeoutError('Individual timeout'));

      const result = await retryManager.executeWithRetry(operation, context, {
        timeoutMs: 500,
        baseDelayMs: 200
      });

      expect(result.success).toBe(false);
      expect(result.attempts.length).toBeLessThan(4); // Should stop before all retries due to timeout
    });
  });

  describe('Error Normalization', () => {
    it('should normalize regular Error to ApiError', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new Error('Regular error'));

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.type).toBe(ApiErrorType.INTERNAL_SERVER_ERROR);
      expect(result.error?.context.originalError).toBeInstanceOf(Error);
    });

    it('should normalize string errors to ApiError', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue('String error');

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.message).toBe('String error');
    });

    it('should handle unknown error types', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue({ unknown: 'error' });

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.message).toBe('Unknown error occurred');
    });
  });

  describe('Policy Configuration', () => {
    it('should use custom retry policy', async () => {
      const customPolicy: Partial<RetryPolicy> = {
        maxRetries: 1,
        baseDelayMs: 50,
        retryableErrors: [ApiErrorType.NETWORK_ERROR]
      };

      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new NetworkError('Network error'));

      const result = await retryManager.executeWithRetry(operation, context, customPolicy);

      expect(result.attempts).toHaveLength(2); // Initial + 1 retry
      expect(result.attempts[0].delayMs).toBe(50);
    });

    it('should not retry errors not in retryableErrors list', async () => {
      const customPolicy: Partial<RetryPolicy> = {
        retryableErrors: [ApiErrorType.NETWORK_ERROR] // Only network errors
      };

      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new DatabaseError('Database error'));

      const result = await retryManager.executeWithRetry(operation, context, customPolicy);

      expect(result.attempts).toHaveLength(1); // No retries
      expect(result.success).toBe(false);
    });
  });

  describe('Static Policy Creation', () => {
    it('should create appropriate policy for timeout errors', () => {
      const policy = RetryManager.createPolicyForErrorType(ApiErrorType.TIMEOUT_ERROR);

      expect(policy.maxRetries).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.maxDelayMs).toBe(10000);
      expect(policy.backoffMultiplier).toBe(2);
      expect(policy.retryableErrors).toContain(ApiErrorType.TIMEOUT_ERROR);
    });

    it('should create appropriate policy for database errors', () => {
      const policy = RetryManager.createPolicyForErrorType(ApiErrorType.DATABASE_ERROR);

      expect(policy.maxRetries).toBe(5);
      expect(policy.baseDelayMs).toBe(2000);
      expect(policy.maxDelayMs).toBe(60000);
      expect(policy.backoffMultiplier).toBe(1.5);
    });

    it('should create no-retry policy for validation errors', () => {
      const policy = RetryManager.createPolicyForErrorType(ApiErrorType.VALIDATION_ERROR);

      expect(policy.maxRetries).toBe(0);
      expect(policy.baseDelayMs).toBe(0);
      expect(policy.maxDelayMs).toBe(0);
    });

    it('should create no-retry policy for circuit breaker errors', () => {
      const policy = RetryManager.createPolicyForErrorType(ApiErrorType.CIRCUIT_BREAKER_ERROR);

      expect(policy.maxRetries).toBe(0);
      expect(policy.baseDelayMs).toBe(30000);
      expect(policy.maxDelayMs).toBe(300000);
    });
  });

  describe('Jitter Handling', () => {
    it('should apply jitter when enabled', async () => {
      const retryManagerWithJitter = new RetryManager(mockRecoveryManager, {
        maxRetries: 2,
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        jitterEnabled: true
      });

      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new TimeoutError('Timeout'));

      const result = await retryManagerWithJitter.executeWithRetry(operation, context);

      // With jitter, delays should vary slightly from exact exponential values
      const delays = result.attempts.slice(0, -1).map(a => a.delayMs);
      
      // Delays should be close to expected values but not exact due to jitter
      expect(delays[0]).toBeGreaterThanOrEqual(900); // ~1000ms ± 10%
      expect(delays[0]).toBeLessThanOrEqual(1100);
    });
  });

  describe('Context Updates', () => {
    it('should update retry attempt in context', async () => {
      const operation: RetryableOperation<string> = vi.fn()
        .mockRejectedValue(new TimeoutError('Timeout'));

      (mockRecoveryManager.recover as Mock).mockImplementation((error, ctx) => {
        expect(ctx.retryAttempt).toBe(4); // After 3 retries + initial attempt
        return {
          success: false,
          fallbackUsed: false,
          retryRecommended: false,
          strategy: 'TimeoutErrorRecovery'
        };
      });

      await retryManager.executeWithRetry(operation, context);

      expect(mockRecoveryManager.recover).toHaveBeenCalled();
    });
  });
});