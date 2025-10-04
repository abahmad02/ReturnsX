/**
 * Error Recovery Strategy System
 * 
 * Provides intelligent recovery mechanisms for different types of errors
 * with automatic retry logic and exponential backoff.
 */

import { ApiError, ApiErrorType, DatabaseError, CircuitBreakerError, TimeoutError, NetworkError } from './errorHandling.server';

export interface RequestContext {
  requestId: string;
  endpoint: string;
  method: string;
  parameters: Record<string, any>;
  headers: Record<string, string>;
  timestamp: number;
  retryAttempt: number;
  maxRetries: number;
  userId?: string;
}

export interface RecoveryResult {
  success: boolean;
  data?: any;
  fallbackUsed: boolean;
  retryRecommended: boolean;
  retryDelay?: number;
  strategy: string;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

/**
 * Base interface for error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  canRecover(error: ApiError): boolean;
  recover(error: ApiError, context: RequestContext): Promise<RecoveryResult>;
  getRetryDelay(attemptNumber: number): number;
  getMaxRetries(): number;
  getName(): string;
}

/**
 * Base recovery strategy with common retry logic
 */
export abstract class BaseRecoveryStrategy implements ErrorRecoveryStrategy {
  protected config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      ...config
    };
  }

  abstract canRecover(error: ApiError): boolean;
  abstract recover(error: ApiError, context: RequestContext): Promise<RecoveryResult>;
  abstract getName(): string;

  getRetryDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    if (this.config.jitterEnabled) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * cappedDelay;
      return Math.floor(cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  protected createSuccessResult(data: any, strategy: string, metadata: Record<string, any> = {}): RecoveryResult {
    return {
      success: true,
      data,
      fallbackUsed: false,
      retryRecommended: false,
      strategy,
      metadata
    };
  }

  protected createFallbackResult(data: any, strategy: string, metadata: Record<string, any> = {}): RecoveryResult {
    return {
      success: true,
      data,
      fallbackUsed: true,
      retryRecommended: false,
      strategy,
      metadata
    };
  }

  protected createRetryResult(retryDelay: number, strategy: string, metadata: Record<string, any> = {}): RecoveryResult {
    return {
      success: false,
      fallbackUsed: false,
      retryRecommended: true,
      retryDelay,
      strategy,
      metadata
    };
  }

  protected createFailureResult(strategy: string, metadata: Record<string, any> = {}): RecoveryResult {
    return {
      success: false,
      fallbackUsed: false,
      retryRecommended: false,
      strategy,
      metadata
    };
  }
}

/**
 * Database Error Recovery Strategy
 */
export class DatabaseErrorRecovery extends BaseRecoveryStrategy {
  private cacheService?: any; // Will be injected
  private fallbackDataProvider?: any; // Will be injected

  constructor(config: Partial<RetryConfig> = {}, cacheService?: any, fallbackDataProvider?: any) {
    super({
      maxRetries: 5,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      backoffMultiplier: 1.5,
      jitterEnabled: true,
      ...config
    });
    this.cacheService = cacheService;
    this.fallbackDataProvider = fallbackDataProvider;
  }

  canRecover(error: ApiError): boolean {
    return error.type === ApiErrorType.DATABASE_ERROR || error instanceof DatabaseError;
  }

  async recover(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    const strategy = 'DatabaseErrorRecovery';
    
    // Try to get cached data first
    if (this.cacheService) {
      try {
        const cacheKey = this.generateCacheKey(context);
        const cachedData = await this.cacheService.get(cacheKey);
        
        if (cachedData) {
          return this.createFallbackResult(cachedData, strategy, {
            source: 'cache',
            cacheKey,
            originalError: error.message
          });
        }
      } catch (cacheError) {
        // Cache is also failing, continue to other recovery methods
      }
    }

    // Check if we should retry based on error details
    if (this.shouldRetryDatabaseError(error, context)) {
      const retryDelay = this.getRetryDelay(context.retryAttempt);
      return this.createRetryResult(retryDelay, strategy, {
        reason: 'transient_database_error',
        retryAttempt: context.retryAttempt,
        maxRetries: this.getMaxRetries()
      });
    }

    // Try fallback data provider
    if (this.fallbackDataProvider) {
      try {
        const fallbackData = await this.getFallbackData(context);
        if (fallbackData) {
          return this.createFallbackResult(fallbackData, strategy, {
            source: 'fallback_provider',
            originalError: error.message
          });
        }
      } catch (fallbackError) {
        // Fallback also failed
      }
    }

    return this.createFailureResult(strategy, {
      reason: 'all_recovery_methods_failed',
      originalError: error.message
    });
  }

  getName(): string {
    return 'DatabaseErrorRecovery';
  }

  private shouldRetryDatabaseError(error: ApiError, context: RequestContext): boolean {
    // Don't retry if we've exceeded max attempts
    if (context.retryAttempt >= this.getMaxRetries()) {
      return false;
    }

    // Retry for connection errors, timeouts, and temporary failures
    const retryableMessages = [
      'connection',
      'timeout',
      'temporary',
      'unavailable',
      'busy',
      'lock'
    ];

    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  private generateCacheKey(context: RequestContext): string {
    const params = JSON.stringify(context.parameters);
    return `api:${context.endpoint}:${Buffer.from(params).toString('base64')}`;
  }

  private async getFallbackData(context: RequestContext): Promise<any> {
    if (!this.fallbackDataProvider) {
      return null;
    }

    // Generate appropriate fallback based on endpoint
    if (context.endpoint.includes('get-order-data')) {
      return this.fallbackDataProvider.getNewCustomerProfile();
    }

    return null;
  }
}

/**
 * Circuit Breaker Error Recovery Strategy
 */
export class CircuitBreakerErrorRecovery extends BaseRecoveryStrategy {
  private cacheService?: any;
  private fallbackDataProvider?: any;

  constructor(config: Partial<RetryConfig> = {}, cacheService?: any, fallbackDataProvider?: any) {
    super({
      maxRetries: 0, // Don't retry circuit breaker errors immediately
      baseDelayMs: 30000, // Wait 30 seconds before suggesting retry
      maxDelayMs: 300000, // Max 5 minutes
      backoffMultiplier: 1,
      jitterEnabled: false,
      ...config
    });
    this.cacheService = cacheService;
    this.fallbackDataProvider = fallbackDataProvider;
  }

  canRecover(error: ApiError): boolean {
    return error.type === ApiErrorType.CIRCUIT_BREAKER_ERROR || error instanceof CircuitBreakerError;
  }

  async recover(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    const strategy = 'CircuitBreakerErrorRecovery';

    // Always try cache first for circuit breaker errors
    if (this.cacheService) {
      try {
        const cacheKey = this.generateCacheKey(context);
        const cachedData = await this.cacheService.get(cacheKey);
        
        if (cachedData) {
          return this.createFallbackResult(cachedData, strategy, {
            source: 'cache',
            cacheKey,
            circuitState: error.context.circuitState || 'unknown'
          });
        }
      } catch (cacheError) {
        // Continue to fallback data
      }
    }

    // Provide fallback data
    if (this.fallbackDataProvider) {
      try {
        const fallbackData = await this.getFallbackData(context);
        if (fallbackData) {
          return this.createFallbackResult(fallbackData, strategy, {
            source: 'fallback_provider',
            circuitState: error.context.circuitState || 'unknown'
          });
        }
      } catch (fallbackError) {
        // Continue to retry recommendation
      }
    }

    // Suggest retry after circuit breaker timeout
    const retryDelay = error.retryAfter || this.config.baseDelayMs;
    return this.createRetryResult(retryDelay, strategy, {
      reason: 'circuit_breaker_recovery_wait',
      circuitState: error.context.circuitState || 'unknown'
    });
  }

  getName(): string {
    return 'CircuitBreakerErrorRecovery';
  }

  private generateCacheKey(context: RequestContext): string {
    const params = JSON.stringify(context.parameters);
    return `api:${context.endpoint}:${Buffer.from(params).toString('base64')}`;
  }

  private async getFallbackData(context: RequestContext): Promise<any> {
    if (!this.fallbackDataProvider) {
      return null;
    }

    if (context.endpoint.includes('get-order-data')) {
      return this.fallbackDataProvider.getNewCustomerProfile();
    }

    return null;
  }
}

/**
 * Timeout Error Recovery Strategy
 */
export class TimeoutErrorRecovery extends BaseRecoveryStrategy {
  constructor(config: Partial<RetryConfig> = {}) {
    super({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      ...config
    });
  }

  canRecover(error: ApiError): boolean {
    return error.type === ApiErrorType.TIMEOUT_ERROR || error instanceof TimeoutError;
  }

  async recover(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    const strategy = 'TimeoutErrorRecovery';

    // Retry timeout errors with exponential backoff
    if (context.retryAttempt < this.getMaxRetries()) {
      const retryDelay = this.getRetryDelay(context.retryAttempt);
      return this.createRetryResult(retryDelay, strategy, {
        reason: 'timeout_retry',
        retryAttempt: context.retryAttempt,
        maxRetries: this.getMaxRetries(),
        originalTimeout: error.context.timeoutMs
      });
    }

    return this.createFailureResult(strategy, {
      reason: 'max_timeout_retries_exceeded',
      retryAttempt: context.retryAttempt,
      maxRetries: this.getMaxRetries()
    });
  }

  getName(): string {
    return 'TimeoutErrorRecovery';
  }
}

/**
 * Network Error Recovery Strategy
 */
export class NetworkErrorRecovery extends BaseRecoveryStrategy {
  constructor(config: Partial<RetryConfig> = {}) {
    super({
      maxRetries: 4,
      baseDelayMs: 1500,
      maxDelayMs: 15000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      ...config
    });
  }

  canRecover(error: ApiError): boolean {
    return error.type === ApiErrorType.NETWORK_ERROR || error instanceof NetworkError;
  }

  async recover(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    const strategy = 'NetworkErrorRecovery';

    // Retry network errors with exponential backoff
    if (context.retryAttempt < this.getMaxRetries()) {
      const retryDelay = this.getRetryDelay(context.retryAttempt);
      return this.createRetryResult(retryDelay, strategy, {
        reason: 'network_retry',
        retryAttempt: context.retryAttempt,
        maxRetries: this.getMaxRetries(),
        networkError: error.message
      });
    }

    return this.createFailureResult(strategy, {
      reason: 'max_network_retries_exceeded',
      retryAttempt: context.retryAttempt,
      maxRetries: this.getMaxRetries()
    });
  }

  getName(): string {
    return 'NetworkErrorRecovery';
  }
}

/**
 * Recovery Strategy Manager
 */
export class RecoveryStrategyManager {
  private strategies: Map<string, ErrorRecoveryStrategy> = new Map();

  constructor() {
    // Register default strategies
    this.registerStrategy(new DatabaseErrorRecovery());
    this.registerStrategy(new CircuitBreakerErrorRecovery());
    this.registerStrategy(new TimeoutErrorRecovery());
    this.registerStrategy(new NetworkErrorRecovery());
  }

  registerStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
  }

  async recover(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    // Find appropriate strategy
    for (const strategy of this.strategies.values()) {
      if (strategy.canRecover(error)) {
        try {
          return await strategy.recover(error, context);
        } catch (recoveryError) {
          // Log recovery error and try next strategy
          console.error(`Recovery strategy ${strategy.getName()} failed:`, recoveryError);
        }
      }
    }

    // No strategy could handle this error
    return {
      success: false,
      fallbackUsed: false,
      retryRecommended: false,
      strategy: 'NoStrategyFound',
      metadata: {
        errorType: error.type,
        availableStrategies: Array.from(this.strategies.keys())
      }
    };
  }

  getStrategy(name: string): ErrorRecoveryStrategy | undefined {
    return this.strategies.get(name);
  }

  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}