/**
 * Unit tests for Error Recovery System
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  DatabaseErrorRecovery,
  CircuitBreakerErrorRecovery,
  TimeoutErrorRecovery,
  NetworkErrorRecovery,
  RecoveryStrategyManager,
  RequestContext
} from '../../../app/services/errorRecovery.server';
import {
  DatabaseError,
  CircuitBreakerError,
  TimeoutError,
  NetworkError,
  ValidationError,
  ApiErrorType
} from '../../../app/services/errorHandling.server';

describe('DatabaseErrorRecovery', () => {
  let recovery: DatabaseErrorRecovery;
  let mockCacheService: any;
  let mockFallbackProvider: any;
  let context: RequestContext;

  beforeEach(() => {
    mockCacheService = {
      get: vi.fn()
    };
    
    mockFallbackProvider = {
      getNewCustomerProfile: vi.fn().mockReturnValue({
        id: 'fallback-customer',
        riskTier: 'new',
        riskScore: 30
      })
    };

    recovery = new DatabaseErrorRecovery({}, mockCacheService, mockFallbackProvider);
    
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

  it('should identify database errors correctly', () => {
    const dbError = new DatabaseError('Connection failed');
    const validationError = new ValidationError('Invalid input');

    expect(recovery.canRecover(dbError)).toBe(true);
    expect(recovery.canRecover(validationError)).toBe(false);
  });

  it('should return cached data when available', async () => {
    const cachedData = { id: 'cached-customer', riskTier: 'low' };
    mockCacheService.get.mockResolvedValue(cachedData);

    const error = new DatabaseError('Connection failed');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(cachedData);
    expect(result.fallbackUsed).toBe(true);
    expect(result.strategy).toBe('DatabaseErrorRecovery');
    expect(result.metadata?.source).toBe('cache');
  });

  it('should recommend retry for transient database errors', async () => {
    mockCacheService.get.mockResolvedValue(null);
    
    const error = new DatabaseError('Connection timeout occurred');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(true);
    expect(result.retryDelay).toBeGreaterThan(0);
    expect(result.metadata?.reason).toBe('transient_database_error');
  });

  it('should use fallback provider when cache fails', async () => {
    mockCacheService.get.mockRejectedValue(new Error('Cache error'));
    
    const error = new DatabaseError('Permanent database failure');
    context.retryAttempt = 5; // Exceed max retries
    
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.data.id).toBe('fallback-customer');
    expect(result.metadata?.source).toBe('fallback_provider');
  });

  it('should fail when all recovery methods fail', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockFallbackProvider.getNewCustomerProfile.mockImplementation(() => {
      throw new Error('Fallback failed');
    });
    
    const error = new DatabaseError('Permanent failure');
    context.retryAttempt = 5; // Exceed max retries
    
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.retryRecommended).toBe(false);
    expect(result.metadata?.reason).toBe('all_recovery_methods_failed');
  });

  it('should calculate retry delay with exponential backoff', () => {
    const delay1 = recovery.getRetryDelay(1);
    const delay2 = recovery.getRetryDelay(2);
    const delay3 = recovery.getRetryDelay(3);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
    expect(delay3).toBeLessThanOrEqual(60000); // Max delay
  });
});

describe('CircuitBreakerErrorRecovery', () => {
  let recovery: CircuitBreakerErrorRecovery;
  let mockCacheService: any;
  let mockFallbackProvider: any;
  let context: RequestContext;

  beforeEach(() => {
    mockCacheService = {
      get: vi.fn()
    };
    
    mockFallbackProvider = {
      getNewCustomerProfile: vi.fn().mockReturnValue({
        id: 'fallback-customer',
        riskTier: 'new'
      })
    };

    recovery = new CircuitBreakerErrorRecovery({}, mockCacheService, mockFallbackProvider);
    
    context = {
      requestId: 'test-123',
      endpoint: '/api/get-order-data',
      method: 'GET',
      parameters: {},
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 1,
      maxRetries: 0
    };
  });

  it('should identify circuit breaker errors correctly', () => {
    const cbError = new CircuitBreakerError('Circuit open');
    const dbError = new DatabaseError('Connection failed');

    expect(recovery.canRecover(cbError)).toBe(true);
    expect(recovery.canRecover(dbError)).toBe(false);
  });

  it('should prioritize cached data for circuit breaker errors', async () => {
    const cachedData = { id: 'cached-customer' };
    mockCacheService.get.mockResolvedValue(cachedData);

    const error = new CircuitBreakerError('Circuit open', { circuitState: 'OPEN' });
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(cachedData);
    expect(result.fallbackUsed).toBe(true);
    expect(result.metadata?.circuitState).toBe('OPEN');
  });

  it('should use fallback data when cache is unavailable', async () => {
    mockCacheService.get.mockResolvedValue(null);

    const error = new CircuitBreakerError('Circuit open');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.data.id).toBe('fallback-customer');
    expect(result.metadata?.source).toBe('fallback_provider');
  });

  it('should recommend retry with circuit breaker timeout', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockFallbackProvider.getNewCustomerProfile.mockImplementation(() => {
      throw new Error('Fallback failed');
    });

    const error = new CircuitBreakerError('Circuit open');
    error.retryAfter = 45000;
    
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(true);
    expect(result.retryDelay).toBe(45000);
    expect(result.metadata?.reason).toBe('circuit_breaker_recovery_wait');
  });
});

describe('TimeoutErrorRecovery', () => {
  let recovery: TimeoutErrorRecovery;
  let context: RequestContext;

  beforeEach(() => {
    recovery = new TimeoutErrorRecovery();
    
    context = {
      requestId: 'test-123',
      endpoint: '/api/test',
      method: 'GET',
      parameters: {},
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 1,
      maxRetries: 3
    };
  });

  it('should identify timeout errors correctly', () => {
    const timeoutError = new TimeoutError('Request timeout');
    const dbError = new DatabaseError('Connection failed');

    expect(recovery.canRecover(timeoutError)).toBe(true);
    expect(recovery.canRecover(dbError)).toBe(false);
  });

  it('should recommend retry for timeout errors within limit', async () => {
    const error = new TimeoutError('Request timeout', { timeoutMs: 5000 });
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(true);
    expect(result.retryDelay).toBeGreaterThan(0);
    expect(result.metadata?.reason).toBe('timeout_retry');
    expect(result.metadata?.originalTimeout).toBe(5000);
  });

  it('should fail when max retries exceeded', async () => {
    context.retryAttempt = 5; // Exceed max retries
    
    const error = new TimeoutError('Request timeout');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(false);
    expect(result.metadata?.reason).toBe('max_timeout_retries_exceeded');
  });
});

describe('NetworkErrorRecovery', () => {
  let recovery: NetworkErrorRecovery;
  let context: RequestContext;

  beforeEach(() => {
    recovery = new NetworkErrorRecovery();
    
    context = {
      requestId: 'test-123',
      endpoint: '/api/test',
      method: 'GET',
      parameters: {},
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 1,
      maxRetries: 4
    };
  });

  it('should identify network errors correctly', () => {
    const networkError = new NetworkError('Network unreachable');
    const validationError = new ValidationError('Invalid input');

    expect(recovery.canRecover(networkError)).toBe(true);
    expect(recovery.canRecover(validationError)).toBe(false);
  });

  it('should recommend retry for network errors within limit', async () => {
    const error = new NetworkError('ECONNREFUSED');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(true);
    expect(result.retryDelay).toBeGreaterThan(0);
    expect(result.metadata?.reason).toBe('network_retry');
  });

  it('should fail when max retries exceeded', async () => {
    context.retryAttempt = 6; // Exceed max retries
    
    const error = new NetworkError('Network error');
    const result = await recovery.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.retryRecommended).toBe(false);
    expect(result.metadata?.reason).toBe('max_network_retries_exceeded');
  });
});

describe('RecoveryStrategyManager', () => {
  let manager: RecoveryStrategyManager;
  let context: RequestContext;

  beforeEach(() => {
    manager = new RecoveryStrategyManager();
    
    context = {
      requestId: 'test-123',
      endpoint: '/api/test',
      method: 'GET',
      parameters: {},
      headers: {},
      timestamp: Date.now(),
      retryAttempt: 1,
      maxRetries: 3
    };
  });

  it('should register and list strategies', () => {
    const strategies = manager.listStrategies();
    
    expect(strategies).toContain('DatabaseErrorRecovery');
    expect(strategies).toContain('CircuitBreakerErrorRecovery');
    expect(strategies).toContain('TimeoutErrorRecovery');
    expect(strategies).toContain('NetworkErrorRecovery');
  });

  it('should find appropriate strategy for database error', async () => {
    const error = new DatabaseError('Connection failed');
    const result = await manager.recover(error, context);

    expect(result.strategy).toBe('DatabaseErrorRecovery');
  });

  it('should find appropriate strategy for circuit breaker error', async () => {
    const error = new CircuitBreakerError('Circuit open');
    const result = await manager.recover(error, context);

    expect(result.strategy).toBe('CircuitBreakerErrorRecovery');
  });

  it('should find appropriate strategy for timeout error', async () => {
    const error = new TimeoutError('Request timeout');
    const result = await manager.recover(error, context);

    expect(result.strategy).toBe('TimeoutErrorRecovery');
  });

  it('should find appropriate strategy for network error', async () => {
    const error = new NetworkError('Network error');
    const result = await manager.recover(error, context);

    expect(result.strategy).toBe('NetworkErrorRecovery');
  });

  it('should handle errors with no matching strategy', async () => {
    const error = new ValidationError('Invalid input');
    const result = await manager.recover(error, context);

    expect(result.success).toBe(false);
    expect(result.strategy).toBe('NoStrategyFound');
    expect(result.metadata?.errorType).toBe(ApiErrorType.VALIDATION_ERROR);
  });

  it('should handle strategy execution failures', async () => {
    // Create a mock strategy that throws an error
    const mockStrategy = {
      getName: () => 'MockStrategy',
      canRecover: () => true,
      recover: vi.fn().mockRejectedValue(new Error('Strategy failed')),
      getRetryDelay: () => 1000,
      getMaxRetries: () => 3
    };

    manager.registerStrategy(mockStrategy);
    
    const error = new DatabaseError('Test error');
    const result = await manager.recover(error, context);

    // Should fall back to another strategy or return failure
    expect(result).toBeDefined();
  });

  it('should get specific strategy by name', () => {
    const strategy = manager.getStrategy('DatabaseErrorRecovery');
    
    expect(strategy).toBeDefined();
    expect(strategy?.getName()).toBe('DatabaseErrorRecovery');
  });

  it('should return undefined for non-existent strategy', () => {
    const strategy = manager.getStrategy('NonExistentStrategy');
    
    expect(strategy).toBeUndefined();
  });
});