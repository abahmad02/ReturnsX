/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents repeated failed API calls by tracking failure rates and temporarily
 * disabling requests when failure threshold is exceeded.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  recoveryTimeout: number;     // Time to wait before trying again (ms)
  monitoringWindow: number;    // Time window for tracking failures (ms)
  successThreshold: number;    // Successes needed to close circuit from half-open
  maxRetries: number;          // Maximum retries before giving up
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  blockedRequests: number;
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

interface SuccessRecord {
  timestamp: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successes: SuccessRecord[] = [];
  private lastStateChange: number = Date.now();
  private totalRequests: number = 0;
  private blockedRequests: number = 0;
  private halfOpenSuccesses: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringWindow: config.monitoringWindow || 300000, // 5 minutes
      successThreshold: config.successThreshold || 3,
      maxRetries: config.maxRetries || 3,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should allow the request
    if (!this.canExecute()) {
      this.blockedRequests++;
      throw new Error(`Circuit breaker is ${this.state}. Request blocked.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Check if the circuit breaker allows execution
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (now - this.lastStateChange >= this.config.recoveryTimeout) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    const now = Date.now();
    this.successes.push({ timestamp: now });
    this.cleanupOldRecords();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.config.successThreshold) {
          this.transitionToClosed();
        }
        break;

      case CircuitState.CLOSED:
        // Already closed, nothing to do
        break;

      case CircuitState.OPEN:
        // Shouldn't happen, but handle gracefully
        this.transitionToHalfOpen();
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: string): void {
    const now = Date.now();
    this.failures.push({ timestamp: now, error });
    this.cleanupOldRecords();

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.getRecentFailureCount() >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;

      case CircuitState.HALF_OPEN:
        this.transitionToOpen();
        break;

      case CircuitState.OPEN:
        // Already open, update last failure time
        this.lastStateChange = now;
        break;
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = Date.now();
    this.halfOpenSuccesses = 0;
    console.log('[Circuit Breaker] Transitioned to CLOSED state');
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastStateChange = Date.now();
    this.halfOpenSuccesses = 0;
    console.log('[Circuit Breaker] Transitioned to OPEN state');
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = Date.now();
    this.halfOpenSuccesses = 0;
    console.log('[Circuit Breaker] Transitioned to HALF_OPEN state');
  }

  /**
   * Get the number of recent failures within the monitoring window
   */
  private getRecentFailureCount(): number {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;
    return this.failures.filter(f => f.timestamp > cutoff).length;
  }

  /**
   * Get the number of recent successes within the monitoring window
   */
  private getRecentSuccessCount(): number {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;
    return this.successes.filter(s => s.timestamp > cutoff).length;
  }

  /**
   * Clean up old records outside the monitoring window
   */
  private cleanupOldRecords(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;

    this.failures = this.failures.filter(f => f.timestamp > cutoff);
    this.successes = this.successes.filter(s => s.timestamp > cutoff);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.getRecentFailureCount(),
      successes: this.getRecentSuccessCount(),
      lastFailureTime: this.failures.length > 0 ? 
        Math.max(...this.failures.map(f => f.timestamp)) : null,
      lastSuccessTime: this.successes.length > 0 ? 
        Math.max(...this.successes.map(s => s.timestamp)) : null,
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is healthy (closed or recently successful)
   */
  isHealthy(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return this.halfOpenSuccesses > 0;
    }

    return false;
  }

  /**
   * Force reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = Date.now();
    this.failures = [];
    this.successes = [];
    this.halfOpenSuccesses = 0;
    this.totalRequests = 0;
    this.blockedRequests = 0;
    console.log('[Circuit Breaker] Manually reset to CLOSED state');
  }

  /**
   * Get time until next retry attempt (for OPEN state)
   */
  getTimeUntilRetry(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0;
    }

    const elapsed = Date.now() - this.lastStateChange;
    const remaining = this.config.recoveryTimeout - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Get failure rate within the monitoring window
   */
  getFailureRate(): number {
    const recentFailures = this.getRecentFailureCount();
    const recentSuccesses = this.getRecentSuccessCount();
    const total = recentFailures + recentSuccesses;

    if (total === 0) {
      return 0;
    }

    return recentFailures / total;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }
}

/**
 * Factory function to create a circuit breaker with default configuration
 */
export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Default circuit breaker configuration for API calls
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // Open after 5 failures
  recoveryTimeout: 60000,     // Wait 1 minute before retry
  monitoringWindow: 300000,   // Track failures over 5 minutes
  successThreshold: 3,        // Need 3 successes to close
  maxRetries: 3,              // Maximum retry attempts
};

/**
 * Aggressive circuit breaker configuration for critical failures
 */
export const AGGRESSIVE_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,        // Open after 3 failures
  recoveryTimeout: 30000,     // Wait 30 seconds before retry
  monitoringWindow: 180000,   // Track failures over 3 minutes
  successThreshold: 2,        // Need 2 successes to close
  maxRetries: 2,              // Maximum retry attempts
};

/**
 * Lenient circuit breaker configuration for non-critical operations
 */
export const LENIENT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 10,       // Open after 10 failures
  recoveryTimeout: 120000,    // Wait 2 minutes before retry
  monitoringWindow: 600000,   // Track failures over 10 minutes
  successThreshold: 5,        // Need 5 successes to close
  maxRetries: 5,              // Maximum retry attempts
};