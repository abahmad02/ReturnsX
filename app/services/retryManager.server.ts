/**
 * Automatic Retry Manager with Exponential Backoff
 * 
 * Provides intelligent retry logic for transient errors with configurable
 * backoff strategies and retry policies.
 */

import { ApiError, ApiErrorType } from './errorHandling.server';
import { RecoveryStrategyManager, RequestContext, RecoveryResult } from './errorRecovery.server';

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: ApiErrorType[];
  timeoutMs?: number;
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  error?: ApiError;
  delayMs: number;
  success: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  attempts: RetryAttempt[];
  totalDuration: number;
  recoveryUsed: boolean;
  fallbackUsed: boolean;
}

export interface RetryableOperation<T> {
  (): Promise<T>;
}

/**
 * Retry Manager with intelligent backoff and recovery integration
 */
export class RetryManager {
  private recoveryManager: RecoveryStrategyManager;
  private defaultPolicy: RetryPolicy;

  constructor(recoveryManager?: RecoveryStrategyManager, defaultPolicy?: Partial<RetryPolicy>) {
    this.recoveryManager = recoveryManager || new RecoveryStrategyManager();
    this.defaultPolicy = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      retryableErrors: [
        ApiErrorType.TIMEOUT_ERROR,
        ApiErrorType.DATABASE_ERROR,
        ApiErrorType.NETWORK_ERROR,
        ApiErrorType.RATE_LIMIT_ERROR
      ],
      timeoutMs: 60000,
      ...defaultPolicy
    };
  }

  /**
   * Execute operation with automatic retry and recovery
   */
  async executeWithRetry<T>(
    operation: RetryableOperation<T>,
    context: RequestContext,
    policy?: Partial<RetryPolicy>
  ): Promise<RetryResult<T>> {
    const effectivePolicy = { ...this.defaultPolicy, ...policy };
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();
    
    let lastError: ApiError | undefined;
    let recoveryUsed = false;
    let fallbackUsed = false;

    for (let attempt = 1; attempt <= effectivePolicy.maxRetries + 1; attempt++) {
      const attemptStart = Date.now();
      
      try {
        // Check timeout
        if (effectivePolicy.timeoutMs && (Date.now() - startTime) > effectivePolicy.timeoutMs) {
          throw new ApiError(
            ApiErrorType.TIMEOUT_ERROR,
            `Retry operation timed out after ${effectivePolicy.timeoutMs}ms`,
            'RETRY_TIMEOUT',
            408,
            false,
            { totalAttempts: attempt - 1, timeoutMs: effectivePolicy.timeoutMs }
          );
        }

        // Execute the operation
        const result = await this.executeWithTimeout(operation, effectivePolicy.timeoutMs);
        
        // Success!
        attempts.push({
          attemptNumber: attempt,
          timestamp: attemptStart,
          delayMs: 0,
          success: true
        });

        return {
          success: true,
          data: result,
          attempts,
          totalDuration: Date.now() - startTime,
          recoveryUsed,
          fallbackUsed
        };

      } catch (error) {
        const apiError = this.normalizeError(error, context);
        lastError = apiError;

        const delayMs = attempt <= effectivePolicy.maxRetries 
          ? this.calculateDelay(attempt, effectivePolicy)
          : 0;

        attempts.push({
          attemptNumber: attempt,
          timestamp: attemptStart,
          error: apiError,
          delayMs,
          success: false
        });

        // Check if we should retry this error
        if (attempt > effectivePolicy.maxRetries || !this.shouldRetry(apiError, effectivePolicy)) {
          // Try recovery before giving up
          try {
            const recoveryResult = await this.attemptRecovery(apiError, {
              ...context,
              retryAttempt: attempt
            });

            if (recoveryResult && recoveryResult.success) {
              recoveryUsed = true;
              fallbackUsed = recoveryResult.fallbackUsed;
              
              return {
                success: true,
                data: recoveryResult.data,
                attempts,
                totalDuration: Date.now() - startTime,
                recoveryUsed,
                fallbackUsed
              };
            }

            // Recovery failed or not applicable
            recoveryUsed = true;
          } catch (recoveryError) {
            // Recovery itself failed
            recoveryUsed = true;
          }
          
          break;
        }

        // Wait before next attempt
        if (delayMs > 0) {
          await this.delay(delayMs);
        }

        // Update context for next attempt
        context.retryAttempt = attempt;
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime,
      recoveryUsed,
      fallbackUsed
    };
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: RetryableOperation<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return await operation();
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ApiError(
          ApiErrorType.TIMEOUT_ERROR,
          `Operation timed out after ${timeoutMs}ms`,
          'OPERATION_TIMEOUT',
          408,
          true,
          { timeoutMs }
        ));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Normalize error to ApiError
   */
  private normalizeError(error: any, context: RequestContext): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    // Convert regular errors to ApiError
    if (error instanceof Error) {
      return new ApiError(
        ApiErrorType.INTERNAL_SERVER_ERROR,
        error.message,
        'UNKNOWN_ERROR',
        500,
        false,
        { ...context, originalError: error }
      );
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new ApiError(
        ApiErrorType.INTERNAL_SERVER_ERROR,
        error,
        'STRING_ERROR',
        500,
        false,
        context
      );
    }

    // Handle unknown error types
    return new ApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      'Unknown error occurred',
      'UNKNOWN_ERROR_TYPE',
      500,
      false,
      { ...context, originalError: error }
    );
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: ApiError, policy: RetryPolicy): boolean {
    // Check if error type is retryable
    if (!policy.retryableErrors.includes(error.type)) {
      return false;
    }

    // Check if error is marked as retryable
    if (!error.retryable) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attemptNumber: number, policy: RetryPolicy): number {
    // Calculate exponential backoff
    const exponentialDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber - 1);
    
    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
    
    // Add jitter if enabled
    if (policy.jitterEnabled) {
      const jitterRange = cappedDelay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(0, Math.floor(cappedDelay + jitter));
    }
    
    return cappedDelay;
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: ApiError, context: RequestContext): Promise<RecoveryResult> {
    try {
      return await this.recoveryManager.recover(error, context);
    } catch (recoveryError) {
      return {
        success: false,
        fallbackUsed: false,
        retryRecommended: false,
        strategy: 'RecoveryFailed',
        metadata: {
          recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error'
        }
      };
    }
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry policy for specific error types
   */
  static createPolicyForErrorType(errorType: ApiErrorType): RetryPolicy {
    const basePolicies: Record<ApiErrorType, Partial<RetryPolicy>> = {
      [ApiErrorType.TIMEOUT_ERROR]: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2
      },
      [ApiErrorType.DATABASE_ERROR]: {
        maxRetries: 5,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 1.5
      },
      [ApiErrorType.NETWORK_ERROR]: {
        maxRetries: 4,
        baseDelayMs: 1500,
        maxDelayMs: 15000,
        backoffMultiplier: 2
      },
      [ApiErrorType.RATE_LIMIT_ERROR]: {
        maxRetries: 3,
        baseDelayMs: 5000,
        maxDelayMs: 30000,
        backoffMultiplier: 1.5,
        jitterEnabled: false // Use exact retry-after values
      },
      [ApiErrorType.CIRCUIT_BREAKER_ERROR]: {
        maxRetries: 0, // Don't retry circuit breaker errors
        baseDelayMs: 30000,
        maxDelayMs: 300000
      },
      [ApiErrorType.VALIDATION_ERROR]: {
        maxRetries: 0, // Don't retry validation errors
        baseDelayMs: 0,
        maxDelayMs: 0
      },
      [ApiErrorType.AUTHENTICATION_ERROR]: {
        maxRetries: 1, // Retry once in case of transient auth issues
        baseDelayMs: 1000,
        maxDelayMs: 5000
      },
      [ApiErrorType.AUTHORIZATION_ERROR]: {
        maxRetries: 0, // Don't retry authorization errors
        baseDelayMs: 0,
        maxDelayMs: 0
      },
      [ApiErrorType.NOT_FOUND_ERROR]: {
        maxRetries: 1, // Retry once in case of transient issues
        baseDelayMs: 500,
        maxDelayMs: 2000
      },
      [ApiErrorType.INTERNAL_SERVER_ERROR]: {
        maxRetries: 2,
        baseDelayMs: 2000,
        maxDelayMs: 10000,
        backoffMultiplier: 2
      }
    };

    const basePolicy = basePolicies[errorType] || {};
    
    return {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      retryableErrors: [errorType],
      timeoutMs: 60000,
      ...basePolicy
    };
  }

  /**
   * Get default retry policy
   */
  getDefaultPolicy(): RetryPolicy {
    return { ...this.defaultPolicy };
  }

  /**
   * Update default retry policy
   */
  setDefaultPolicy(policy: Partial<RetryPolicy>): void {
    this.defaultPolicy = { ...this.defaultPolicy, ...policy };
  }
}