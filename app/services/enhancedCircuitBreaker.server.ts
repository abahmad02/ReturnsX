/**
 * Enhanced Circuit Breaker with Advanced Monitoring
 * 
 * Provides comprehensive circuit breaker functionality with:
 * - Configurable failure thresholds and recovery timeouts
 * - Half-open state with limited request allowance
 * - Comprehensive metrics collection and state transitions tracking
 * - State persistence to survive application restarts
 * - Performance monitoring and alerting capabilities
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',         // Normal operation - requests allowed
  OPEN = 'OPEN',             // Circuit open - requests blocked
  HALF_OPEN = 'HALF_OPEN'    // Testing recovery - limited requests allowed
}

export interface CircuitBreakerConfig {
  // Failure thresholds
  failureThreshold: number;           // Failures before opening circuit
  failureRateThreshold: number;       // Failure rate (0-1) before opening
  
  // Recovery settings
  recoveryTimeout: number;            // Time before attempting recovery (ms)
  halfOpenMaxCalls: number;           // Max calls allowed in half-open state
  successThreshold: number;           // Successes needed to close circuit
  
  // Monitoring settings
  monitoringWindow: number;           // Time window for tracking metrics (ms)
  metricsRetentionPeriod: number;     // How long to keep detailed metrics (ms)
  
  // Performance settings
  requestTimeout: number;             // Individual request timeout (ms)
  slowCallThreshold: number;          // Threshold for slow call detection (ms)
  slowCallRateThreshold: number;      // Slow call rate before opening (0-1)
  
  // Persistence settings
  persistenceEnabled: boolean;        // Enable state persistence
  persistencePath?: string;           // Path for persistence file
  
  // Alerting settings
  alertingEnabled: boolean;           // Enable alerting
  alertThresholds: AlertThresholds;   // Alert configuration
}

export interface AlertThresholds {
  errorRateAlert: number;             // Error rate for alerts (0-1)
  responseTimeAlert: number;          // Response time for alerts (ms)
  circuitOpenAlert: boolean;          // Alert when circuit opens
  recoveryAlert: boolean;             // Alert when circuit recovers
}

export interface StateTransition {
  fromState: CircuitBreakerState;
  toState: CircuitBreakerState;
  timestamp: number;
  reason: string;
  metrics: Partial<CircuitBreakerMetrics>;
  triggerEvent?: string;
}

export interface CircuitBreakerMetrics {
  // Request metrics
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  slowCalls: number;
  blockedCalls: number;
  
  // Performance metrics
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  
  // Rate metrics
  successRate: number;
  failureRate: number;
  slowCallRate: number;
  
  // State metrics
  currentState: CircuitBreakerState;
  stateTransitions: StateTransition[];
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  timeInCurrentState: number;
  
  // Circuit breaker specific
  circuitBreakerTrips: number;
  halfOpenCallCount: number;
  halfOpenSuccessCount: number;
  nextAttemptTime: number | null;
  
  // Time windows
  windowStart: number;
  windowEnd: number;
  lastUpdated: number;
}

interface CallRecord {
  timestamp: number;
  success: boolean;
  responseTime: number;
  error?: string;
  timeout?: boolean;
  slow?: boolean;
}

interface PersistedState {
  state: CircuitBreakerState;
  lastStateChange: number;
  metrics: CircuitBreakerMetrics;
  config: CircuitBreakerConfig;
  version: string;
}

export class EnhancedCircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private lastStateChange: number = Date.now();
  private callHistory: CallRecord[] = [];
  private stateTransitions: StateTransition[] = [];
  private halfOpenCallCount: number = 0;
  private halfOpenSuccessCount: number = 0;
  private circuitBreakerTrips: number = 0;
  private persistenceTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private responseTimes: number[] = [];
  private readonly maxResponseTimesSamples = 1000;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      // Default configuration
      failureThreshold: 5,
      failureRateThreshold: 0.5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
      successThreshold: 3,
      monitoringWindow: 300000,
      metricsRetentionPeriod: 3600000,
      requestTimeout: 30000,
      slowCallThreshold: 5000,
      slowCallRateThreshold: 0.3,
      persistenceEnabled: true,
      persistencePath: './data/circuit-breaker-state.json',
      alertingEnabled: true,
      alertThresholds: {
        errorRateAlert: 0.1,
        responseTimeAlert: 2000,
        circuitOpenAlert: true,
        recoveryAlert: true
      },
      ...config
    };
    
    // Initialize persistence
    if (this.config.persistenceEnabled) {
      this.loadPersistedState();
      this.startPersistenceTimer();
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    const startTime = Date.now();
    const callId = this.generateCallId();
    
    // Check if circuit allows execution
    if (!this.canExecute()) {
      this.recordBlockedCall();
      const error = new CircuitBreakerError(
        `Circuit breaker is ${this.state}. Request blocked.`,
        this.state,
        this.getTimeUntilNextAttempt()
      );
      throw error;
    }

    // Track half-open state calls
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCallCount++;
    }

    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);
    });

    try {
      // Execute with timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime, operationName);
      
      return result;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const responseTime = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      
      this.onFailure(responseTime, error instanceof Error ? error.message : 'Unknown error', isTimeout, operationName);
      throw error;
    }
  }

  /**
   * Check if circuit breaker allows execution
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (now - this.lastStateChange >= this.config.recoveryTimeout) {
          this.transitionToHalfOpen('Recovery timeout elapsed');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // Allow limited calls in half-open state
        return this.halfOpenCallCount < this.config.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(responseTime: number, operationName?: string): void {
    const now = Date.now();
    const isSlowCall = responseTime > this.config.slowCallThreshold;
    
    // Record the call
    this.recordCall({
      timestamp: now,
      success: true,
      responseTime,
      slow: isSlowCall
    });

    // Update response times for percentile calculations
    this.updateResponseTimes(responseTime);

    switch (this.state) {
      case CircuitBreakerState.HALF_OPEN:
        this.halfOpenSuccessCount++;
        if (this.halfOpenSuccessCount >= this.config.successThreshold) {
          this.transitionToClosed('Success threshold reached in half-open state');
        }
        break;

      case CircuitBreakerState.CLOSED:
        // Check if we should open due to slow calls
        if (this.shouldOpenDueToSlowCalls()) {
          this.transitionToOpen('Slow call rate threshold exceeded');
        }
        break;
    }

    this.triggerAlerts('success', { responseTime, operationName });
  }

  /**
   * Handle failed execution
   */
  private onFailure(responseTime: number, error: string, isTimeout: boolean, operationName?: string): void {
    const now = Date.now();
    
    // Record the call
    this.recordCall({
      timestamp: now,
      success: false,
      responseTime,
      error,
      timeout: isTimeout
    });

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        if (this.shouldOpenCircuit()) {
          this.transitionToOpen('Failure threshold exceeded');
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        this.transitionToOpen('Failure in half-open state');
        break;
    }

    this.triggerAlerts('failure', { responseTime, error, isTimeout, operationName });
  }

  /**
   * Record a blocked call
   */
  private recordBlockedCall(): void {
    // Update metrics for blocked calls
    this.cleanupOldRecords();
  }

  /**
   * Record a call in history
   */
  private recordCall(record: CallRecord): void {
    this.callHistory.push(record);
    this.cleanupOldRecords();
  }

  /**
   * Update response times for percentile calculations
   */
  private updateResponseTimes(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only recent samples
    if (this.responseTimes.length > this.maxResponseTimesSamples) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimesSamples);
    }
  }

  /**
   * Check if circuit should open due to failures
   */
  private shouldOpenCircuit(): boolean {
    const recentCalls = this.getRecentCalls();
    
    if (recentCalls.length < this.config.failureThreshold) {
      return false;
    }

    const failures = recentCalls.filter(call => !call.success).length;
    const failureRate = failures / recentCalls.length;

    return failures >= this.config.failureThreshold || 
           failureRate >= this.config.failureRateThreshold;
  }

  /**
   * Check if circuit should open due to slow calls
   */
  private shouldOpenDueToSlowCalls(): boolean {
    const recentCalls = this.getRecentCalls();
    
    if (recentCalls.length === 0) {
      return false;
    }

    const slowCalls = recentCalls.filter(call => call.slow).length;
    const slowCallRate = slowCalls / recentCalls.length;

    return slowCallRate >= this.config.slowCallRateThreshold;
  }

  /**
   * Get recent calls within monitoring window
   */
  private getRecentCalls(): CallRecord[] {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;
    return this.callHistory.filter(call => call.timestamp > cutoff);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(reason: string): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.lastStateChange = Date.now();
    this.halfOpenCallCount = 0;
    this.halfOpenSuccessCount = 0;
    
    this.recordStateTransition(previousState, this.state, reason);
    this.triggerAlerts('state_change', { 
      fromState: previousState, 
      toState: this.state, 
      reason 
    });
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(reason: string): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.lastStateChange = Date.now();
    this.halfOpenCallCount = 0;
    this.halfOpenSuccessCount = 0;
    this.circuitBreakerTrips++;
    
    this.recordStateTransition(previousState, this.state, reason);
    this.triggerAlerts('state_change', { 
      fromState: previousState, 
      toState: this.state, 
      reason 
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(reason: string): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.HALF_OPEN;
    this.lastStateChange = Date.now();
    this.halfOpenCallCount = 0;
    this.halfOpenSuccessCount = 0;
    
    this.recordStateTransition(previousState, this.state, reason);
    this.triggerAlerts('state_change', { 
      fromState: previousState, 
      toState: this.state, 
      reason 
    });
  }

  /**
   * Record state transition
   */
  private recordStateTransition(
    fromState: CircuitBreakerState, 
    toState: CircuitBreakerState, 
    reason: string
  ): void {
    const transition: StateTransition = {
      fromState,
      toState,
      timestamp: Date.now(),
      reason,
      metrics: this.getMetrics()
    };
    
    this.stateTransitions.push(transition);
    
    // Keep only recent transitions
    const cutoff = Date.now() - this.config.metricsRetentionPeriod;
    this.stateTransitions = this.stateTransitions.filter(t => t.timestamp > cutoff);
    
    console.log(`[Enhanced Circuit Breaker] State transition: ${fromState} -> ${toState} (${reason})`);
  }

  /**
   * Clean up old records
   */
  private cleanupOldRecords(): void {
    const now = Date.now();
    const cutoff = now - this.config.metricsRetentionPeriod;
    
    this.callHistory = this.callHistory.filter(call => call.timestamp > cutoff);
    this.stateTransitions = this.stateTransitions.filter(t => t.timestamp > cutoff);
  }

  /**
   * Calculate percentile from response times
   */
  private calculatePercentile(percentile: number): number {
    if (this.responseTimes.length === 0) return 0;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const now = Date.now();
    const recentCalls = this.getRecentCalls();
    const successfulCalls = recentCalls.filter(call => call.success);
    const failedCalls = recentCalls.filter(call => !call.success);
    const timeoutCalls = recentCalls.filter(call => call.timeout);
    const slowCalls = recentCalls.filter(call => call.slow);
    
    const totalCalls = recentCalls.length;
    const successRate = totalCalls > 0 ? successfulCalls.length / totalCalls : 1;
    const failureRate = totalCalls > 0 ? failedCalls.length / totalCalls : 0;
    const slowCallRate = totalCalls > 0 ? slowCalls.length / totalCalls : 0;
    
    const responseTimes = recentCalls.map(call => call.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      // Request metrics
      totalCalls,
      successfulCalls: successfulCalls.length,
      failedCalls: failedCalls.length,
      timeoutCalls: timeoutCalls.length,
      slowCalls: slowCalls.length,
      blockedCalls: 0, // Would need separate tracking
      
      // Performance metrics
      averageResponseTime: avgResponseTime,
      p95ResponseTime: this.calculatePercentile(95),
      p99ResponseTime: this.calculatePercentile(99),
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      
      // Rate metrics
      successRate,
      failureRate,
      slowCallRate,
      
      // State metrics
      currentState: this.state,
      stateTransitions: [...this.stateTransitions],
      lastFailureTime: failedCalls.length > 0 
        ? Math.max(...failedCalls.map(call => call.timestamp)) 
        : null,
      lastSuccessTime: successfulCalls.length > 0 
        ? Math.max(...successfulCalls.map(call => call.timestamp)) 
        : null,
      timeInCurrentState: now - this.lastStateChange,
      
      // Circuit breaker specific
      circuitBreakerTrips: this.circuitBreakerTrips,
      halfOpenCallCount: this.halfOpenCallCount,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      nextAttemptTime: this.state === CircuitBreakerState.OPEN 
        ? this.lastStateChange + this.config.recoveryTimeout 
        : null,
      
      // Time windows
      windowStart: now - this.config.monitoringWindow,
      windowEnd: now,
      lastUpdated: now
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get time until next attempt (for OPEN state)
   */
  getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitBreakerState.OPEN) {
      return 0;
    }
    
    const elapsed = Date.now() - this.lastStateChange;
    const remaining = this.config.recoveryTimeout - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Force circuit to specific state
   */
  forceState(state: CircuitBreakerState, reason: string = 'Manual override'): void {
    const previousState = this.state;
    this.state = state;
    this.lastStateChange = Date.now();
    
    if (state === CircuitBreakerState.CLOSED) {
      this.halfOpenCallCount = 0;
      this.halfOpenSuccessCount = 0;
    }
    
    this.recordStateTransition(previousState, state, reason);
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.lastStateChange = Date.now();
    this.callHistory = [];
    this.stateTransitions = [];
    this.halfOpenCallCount = 0;
    this.halfOpenSuccessCount = 0;
    this.circuitBreakerTrips = 0;
    this.responseTimes = [];
    
    console.log('[Enhanced Circuit Breaker] Reset to initial state');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart persistence if path changed
    if (newConfig.persistenceEnabled !== undefined || newConfig.persistencePath) {
      this.stopPersistenceTimer();
      if (this.config.persistenceEnabled) {
        this.startPersistenceTimer();
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }

  /**
   * Load persisted state
   */
  private async loadPersistedState(): Promise<void> {
    if (!this.config.persistencePath) return;
    
    try {
      const data = await readFile(this.config.persistencePath, 'utf-8');
      const persistedState: PersistedState = JSON.parse(data);
      
      // Validate and restore state
      if (this.isValidPersistedState(persistedState)) {
        this.state = persistedState.state;
        this.lastStateChange = persistedState.lastStateChange;
        this.circuitBreakerTrips = persistedState.metrics.circuitBreakerTrips;
        
        console.log(`[Enhanced Circuit Breaker] Loaded persisted state: ${this.state}`);
      }
    } catch (error) {
      console.warn('[Enhanced Circuit Breaker] Failed to load persisted state:', error);
    }
  }

  /**
   * Save current state to persistence
   */
  private async saveState(): Promise<void> {
    if (!this.config.persistenceEnabled || !this.config.persistencePath) return;
    
    try {
      const persistedState: PersistedState = {
        state: this.state,
        lastStateChange: this.lastStateChange,
        metrics: this.getMetrics(),
        config: this.config,
        version: '1.0.0'
      };
      
      // Ensure directory exists
      const dir = this.config.persistencePath.substring(0, this.config.persistencePath.lastIndexOf('/'));
      if (dir && !existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      await writeFile(this.config.persistencePath, JSON.stringify(persistedState, null, 2));
    } catch (error) {
      console.error('[Enhanced Circuit Breaker] Failed to save state:', error);
    }
  }

  /**
   * Validate persisted state
   */
  private isValidPersistedState(state: any): state is PersistedState {
    return state && 
           typeof state.state === 'string' &&
           Object.values(CircuitBreakerState).includes(state.state) &&
           typeof state.lastStateChange === 'number' &&
           state.metrics &&
           state.config;
  }

  /**
   * Start persistence timer
   */
  private startPersistenceTimer(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    // Save state every 30 seconds
    this.persistenceTimer = setInterval(() => {
      this.saveState();
    }, 30000);
  }

  /**
   * Stop persistence timer
   */
  private stopPersistenceTimer(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = undefined;
    }
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trigger alerts based on events
   */
  private triggerAlerts(eventType: string, data: any): void {
    if (!this.config.alertingEnabled) return;
    
    // Implementation would depend on alerting system
    // This is a placeholder for alert triggering logic
    console.log(`[Enhanced Circuit Breaker] Alert: ${eventType}`, data);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPersistenceTimer();
    if (this.config.persistenceEnabled) {
      this.saveState();
    }
  }
}

/**
 * Custom error class for circuit breaker
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Default configuration for API operations
 */
export const DEFAULT_ENHANCED_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  recoveryTimeout: 60000,
  halfOpenMaxCalls: 3,
  successThreshold: 3,
  monitoringWindow: 300000,
  metricsRetentionPeriod: 3600000,
  requestTimeout: 30000,
  slowCallThreshold: 5000,
  slowCallRateThreshold: 0.3,
  persistenceEnabled: true,
  persistencePath: './data/circuit-breaker-state.json',
  alertingEnabled: true,
  alertThresholds: {
    errorRateAlert: 0.1,
    responseTimeAlert: 2000,
    circuitOpenAlert: true,
    recoveryAlert: true
  }
};

/**
 * Factory function to create enhanced circuit breaker
 */
export function createEnhancedCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): EnhancedCircuitBreaker {
  return new EnhancedCircuitBreaker(config);
}