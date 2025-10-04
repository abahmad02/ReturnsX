/**
 * Enhanced Circuit Breaker Unit Tests
 * 
 * Comprehensive test suite covering all circuit breaker states,
 * transitions, metrics collection, and persistence functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  EnhancedCircuitBreaker, 
  CircuitBreakerState, 
  CircuitBreakerError,
  DEFAULT_ENHANCED_CONFIG 
} from '../../../app/services/enhancedCircuitBreaker.server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Mock file system operations
vi.mock('fs/promises');
vi.mock('fs');

const mockWriteFile = vi.mocked(writeFile);
const mockReadFile = vi.mocked(readFile);
const mockMkdir = vi.mocked(mkdir);
const mockExistsSync = vi.mocked(existsSync);

describe('EnhancedCircuitBreaker', () => {
  let circuitBreaker: EnhancedCircuitBreaker;
  let mockOperation: vi.MockedFunction<() => Promise<string>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    
    // Create circuit breaker with test configuration
    circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 3,
      failureRateThreshold: 0.5,
      recoveryTimeout: 1000, // 1 second for faster tests
      halfOpenMaxCalls: 2,
      successThreshold: 2,
      monitoringWindow: 5000,
      metricsRetentionPeriod: 10000,
      requestTimeout: 500,
      slowCallThreshold: 200,
      slowCallRateThreshold: 0.3,
      persistenceEnabled: false, // Disable for unit tests
      alertingEnabled: false
    });

    mockOperation = vi.fn();
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have initial metrics', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.currentState).toBe(CircuitBreakerState.CLOSED);
    });

    it('should allow execution in initial state', async () => {
      mockOperation.mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });
  });

  describe('CLOSED State Behavior', () => {
    it('should allow all requests in CLOSED state', async () => {
      mockOperation.mockResolvedValue('success');
      
      // Execute multiple successful operations
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(mockOperation);
      }
      
      expect(mockOperation).toHaveBeenCalledTimes(5);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should track successful calls', async () => {
      mockOperation.mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.successRate).toBe(1);
    });

    it('should track failed calls', async () => {
      mockOperation.mockRejectedValue(new Error('Test error'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to throw
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.failureRate).toBe(1);
    });

    it('should transition to OPEN when failure threshold is exceeded', async () => {
      mockOperation.mockRejectedValue(new Error('Test error'));
      
      // Execute enough failures to trigger circuit opening
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to throw
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to OPEN when failure rate threshold is exceeded', async () => {
      // Mix of success and failures to test failure rate
      mockOperation
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('error'))
        .mockRejectedValueOnce(new Error('error'))
        .mockRejectedValueOnce(new Error('error'));
      
      await circuitBreaker.execute(mockOperation); // success
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation); // failures
        } catch (error) {
          // Expected to throw
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should detect slow calls and transition to OPEN', async () => {
      // Create circuit breaker with lower slow call threshold for testing
      const slowCallCircuitBreaker = new EnhancedCircuitBreaker({
        slowCallThreshold: 50, // 50ms threshold
        slowCallRateThreshold: 0.8, // 80% slow call rate
        monitoringWindow: 5000,
        failureThreshold: 10, // High failure threshold to prevent failure-based opening
        persistenceEnabled: false,
        alertingEnabled: false
      });
      
      // Mock slow operations
      const slowMockOperation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow'), 100))
      );
      
      // Execute multiple slow calls to trigger slow call rate threshold
      for (let i = 0; i < 10; i++) {
        try {
          await slowCallCircuitBreaker.execute(slowMockOperation);
        } catch (error) {
          // Circuit might open during execution
          break;
        }
      }
      
      const metrics = slowCallCircuitBreaker.getMetrics();
      expect(metrics.slowCalls).toBeGreaterThan(0);
      
      // Should transition to OPEN due to slow call rate
      expect(slowCallCircuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      slowCallCircuitBreaker.destroy();
    });
  });

  describe('OPEN State Behavior', () => {
    beforeEach(async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceState(CircuitBreakerState.OPEN, 'Test setup');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should block all requests in OPEN state', async () => {
      const freshMockOperation = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(freshMockOperation))
        .rejects.toThrow(CircuitBreakerError);
      
      expect(freshMockOperation).not.toHaveBeenCalled();
    });

    it('should provide retry time information', () => {
      const retryTime = circuitBreaker.getTimeUntilNextAttempt();
      expect(retryTime).toBeGreaterThan(0);
      expect(retryTime).toBeLessThanOrEqual(1000); // Recovery timeout
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      mockOperation.mockResolvedValue('success');
      
      // This should trigger transition to HALF_OPEN
      await circuitBreaker.execute(mockOperation);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should track circuit breaker trips', async () => {
      // The circuit breaker was forced to OPEN state in beforeEach
      // But forceState doesn't increment the trip counter, only actual transitions do
      // Let's create a fresh circuit breaker and trigger an actual transition
      const tripCircuitBreaker = new EnhancedCircuitBreaker({
        failureThreshold: 2,
        persistenceEnabled: false,
        alertingEnabled: false
      });
      
      const failMockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Trigger failures to cause actual transition to OPEN
      for (let i = 0; i < 2; i++) {
        try {
          await tripCircuitBreaker.execute(failMockOperation);
        } catch (error) {
          // Expected to throw
        }
      }
      
      const metrics = tripCircuitBreaker.getMetrics();
      expect(metrics.circuitBreakerTrips).toBe(1);
      
      tripCircuitBreaker.destroy();
    });
  });

  describe('HALF_OPEN State Behavior', () => {
    beforeEach(async () => {
      // Force to HALF_OPEN state directly
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN, 'Test setup');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should allow limited requests in HALF_OPEN state', async () => {
      const freshMockOperation = vi.fn().mockResolvedValue('success');
      
      // Should allow up to halfOpenMaxCalls (2) but not transition to CLOSED
      // We need to prevent automatic transition by using a higher success threshold
      const halfOpenCircuitBreaker = new EnhancedCircuitBreaker({
        halfOpenMaxCalls: 2,
        successThreshold: 5, // Higher threshold to prevent auto-close
        persistenceEnabled: false,
        alertingEnabled: false
      });
      
      halfOpenCircuitBreaker.forceState(CircuitBreakerState.HALF_OPEN, 'Test setup');
      
      // Should allow first two calls
      await halfOpenCircuitBreaker.execute(freshMockOperation);
      await halfOpenCircuitBreaker.execute(freshMockOperation);
      
      // Third call should be blocked
      await expect(halfOpenCircuitBreaker.execute(freshMockOperation))
        .rejects.toThrow(CircuitBreakerError);
      
      expect(freshMockOperation).toHaveBeenCalledTimes(2);
      
      halfOpenCircuitBreaker.destroy();
    });

    it('should transition to CLOSED after enough successes', async () => {
      mockOperation.mockResolvedValue('success');
      
      // Execute success threshold number of calls (2)
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition to OPEN on any failure', async () => {
      mockOperation.mockRejectedValue(new Error('Test error'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to throw
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should track half-open call counts', async () => {
      mockOperation.mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.halfOpenCallCount).toBe(1);
      expect(metrics.halfOpenSuccessCount).toBe(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      mockOperation.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('delayed'), 1000))
      );
      
      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow('timeout');
    });

    it('should track timeout calls in metrics', async () => {
      mockOperation.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('delayed'), 1000))
      );
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected timeout
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.timeoutCalls).toBe(1);
    });
  });

  describe('Metrics Collection', () => {
    it('should calculate response time percentiles', async () => {
      // Create a fresh circuit breaker for this test to avoid interference
      const metricsCircuitBreaker = new EnhancedCircuitBreaker({
        slowCallThreshold: 1000, // High threshold to prevent opening
        slowCallRateThreshold: 0.9,
        persistenceEnabled: false,
        alertingEnabled: false
      });
      
      const responseTimes = [50, 100, 150, 200, 250]; // Shorter times to avoid slow call detection
      
      for (const time of responseTimes) {
        const timeMockOperation = vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve('success'), time))
        );
        await metricsCircuitBreaker.execute(timeMockOperation);
      }
      
      const metrics = metricsCircuitBreaker.getMetrics();
      expect(metrics.p95ResponseTime).toBeGreaterThan(0);
      expect(metrics.p99ResponseTime).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      
      metricsCircuitBreaker.destroy();
    });

    it('should track state transitions', async () => {
      mockOperation.mockRejectedValue(new Error('Test error'));
      
      // Trigger state transitions
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to throw
        }
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.stateTransitions).toHaveLength(1);
      expect(metrics.stateTransitions[0].fromState).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.stateTransitions[0].toState).toBe(CircuitBreakerState.OPEN);
    });

    it('should provide comprehensive metrics', async () => {
      mockOperation
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('error'));
      
      await circuitBreaker.execute(mockOperation);
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to throw
      }
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.successRate).toBe(0.5);
      expect(metrics.failureRate).toBe(0.5);
      expect(metrics.lastSuccessTime).toBeTypeOf('number');
      expect(metrics.lastFailureTime).toBeTypeOf('number');
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        failureThreshold: 10,
        recoveryTimeout: 5000
      };
      
      circuitBreaker.updateConfig(newConfig);
      
      const config = circuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.recoveryTimeout).toBe(5000);
    });

    it('should use default configuration values', () => {
      const defaultCircuitBreaker = new EnhancedCircuitBreaker();
      const config = defaultCircuitBreaker.getConfig();
      
      expect(config.failureThreshold).toBe(DEFAULT_ENHANCED_CONFIG.failureThreshold);
      expect(config.recoveryTimeout).toBe(DEFAULT_ENHANCED_CONFIG.recoveryTimeout);
      
      defaultCircuitBreaker.destroy();
    });
  });

  describe('Manual Control', () => {
    it('should allow manual state forcing', () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN, 'Manual test');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      circuitBreaker.forceState(CircuitBreakerState.CLOSED, 'Manual test');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should allow manual reset', async () => {
      mockOperation.mockRejectedValue(new Error('Test error'));
      
      // Trigger some failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to throw
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.circuitBreakerTrips).toBe(0);
    });
  });

  describe('State Persistence', () => {
    it('should save state when persistence is enabled', async () => {
      const persistentCircuitBreaker = new EnhancedCircuitBreaker({
        persistenceEnabled: true,
        persistencePath: './test-state.json'
      });
      
      // Trigger some activity
      const mockOp = vi.fn().mockResolvedValue('success');
      await persistentCircuitBreaker.execute(mockOp);
      
      // Destroy should trigger save
      persistentCircuitBreaker.destroy();
      
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should load persisted state on initialization', async () => {
      const persistedState = {
        state: CircuitBreakerState.OPEN,
        lastStateChange: Date.now() - 5000,
        metrics: {
          circuitBreakerTrips: 2,
          totalCalls: 10,
          successfulCalls: 5,
          failedCalls: 5
        },
        config: DEFAULT_ENHANCED_CONFIG,
        version: '1.0.0'
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(persistedState));
      
      const persistentCircuitBreaker = new EnhancedCircuitBreaker({
        persistenceEnabled: true,
        persistencePath: './test-state.json'
      });
      
      // Allow async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(persistentCircuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      persistentCircuitBreaker.destroy();
    });

    it('should handle persistence errors gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));
      
      const persistentCircuitBreaker = new EnhancedCircuitBreaker({
        persistenceEnabled: true,
        persistencePath: './nonexistent.json'
      });
      
      // Should still work despite persistence error
      expect(persistentCircuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      persistentCircuitBreaker.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should throw CircuitBreakerError when circuit is open', async () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN, 'Test');
      
      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow(CircuitBreakerError);
    });

    it('should include retry information in CircuitBreakerError', async () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN, 'Test');
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).state).toBe(CircuitBreakerState.OPEN);
        expect((error as CircuitBreakerError).retryAfter).toBeGreaterThan(0);
      }
    });

    it('should propagate original errors from operations', async () => {
      const originalError = new Error('Original operation error');
      mockOperation.mockRejectedValue(originalError);
      
      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow('Original operation error');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up old records', async () => {
      // Create circuit breaker with short retention period
      const shortRetentionCircuitBreaker = new EnhancedCircuitBreaker({
        metricsRetentionPeriod: 100, // 100ms
        monitoringWindow: 50
      });
      
      mockOperation.mockResolvedValue('success');
      
      // Execute some operations
      await shortRetentionCircuitBreaker.execute(mockOperation);
      
      // Wait for records to become old
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Execute another operation to trigger cleanup
      await shortRetentionCircuitBreaker.execute(mockOperation);
      
      const metrics = shortRetentionCircuitBreaker.getMetrics();
      // Should only have recent calls
      expect(metrics.totalCalls).toBe(1);
      
      shortRetentionCircuitBreaker.destroy();
    });

    it('should stop timers on destroy', () => {
      // Create a circuit breaker with persistence enabled to have active timers
      const timerCircuitBreaker = new EnhancedCircuitBreaker({
        persistenceEnabled: true,
        persistencePath: './test-timer-state.json'
      });
      
      const spy = vi.spyOn(global, 'clearInterval');
      
      timerCircuitBreaker.destroy();
      
      // Should clear any active timers
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero monitoring window', () => {
      const zeroWindowCircuitBreaker = new EnhancedCircuitBreaker({
        monitoringWindow: 0
      });
      
      expect(zeroWindowCircuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      zeroWindowCircuitBreaker.destroy();
    });

    it('should handle concurrent operations', async () => {
      mockOperation.mockResolvedValue('success');
      
      // Execute multiple operations concurrently
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockOperation)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(result => result === 'success')).toBe(true);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(10);
      expect(metrics.successfulCalls).toBe(10);
    });

    it('should handle operations that return undefined', async () => {
      mockOperation.mockResolvedValue(undefined as any);
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBeUndefined();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successfulCalls).toBe(1);
    });
  });
});