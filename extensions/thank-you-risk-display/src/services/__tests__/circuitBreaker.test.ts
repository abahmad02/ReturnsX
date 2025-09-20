import { vi } from 'vitest';
import { CircuitBreaker, CircuitState, createCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../circuitBreaker';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock console.log to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringWindow: 5000,
      successThreshold: 2,
      maxRetries: 3,
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    it('has correct initial statistics', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.blockedRequests).toBe(0);
    });
  });

  describe('Success Handling', () => {
    it('executes successful functions', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('tracks multiple successes', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(mockFn);
      await circuitBreaker.execute(mockFn);
      await circuitBreaker.execute(mockFn);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(3);
      expect(stats.totalRequests).toBe(3);
    });
  });

  describe('Failure Handling', () => {
    it('executes failing functions and tracks failures', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('test error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('opens circuit after failure threshold', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Execute failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.isHealthy()).toBe(false);
    });

    it('blocks requests when circuit is open', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Next request should be blocked
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      
      const stats = circuitBreaker.getStats();
      expect(stats.blockedRequests).toBe(1);
    });
  });

  describe('State Transitions', () => {
    it('transitions from CLOSED to OPEN on failures', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('transitions from OPEN to HALF_OPEN after recovery timeout', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Wait for recovery timeout
      vi.advanceTimersByTime(1000);
      
      // Next request should transition to HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('transitions from HALF_OPEN to CLOSED on success threshold', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      // Wait for recovery timeout
      vi.advanceTimersByTime(1000);
      
      // Execute successful requests to reach success threshold
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn); // Transitions to HALF_OPEN
      await circuitBreaker.execute(successFn); // Should transition to CLOSED
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('transitions from HALF_OPEN back to OPEN on failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      // Wait for recovery timeout
      vi.advanceTimersByTime(1000);
      
      // Execute one successful request to transition to HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      // Execute failing request should transition back to OPEN
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Time-based Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calculates time until retry correctly', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getTimeUntilRetry()).toBe(1000);
      
      vi.advanceTimersByTime(500);
      expect(circuitBreaker.getTimeUntilRetry()).toBe(500);
      
      vi.advanceTimersByTime(500);
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0);
    });

    it('cleans up old records outside monitoring window', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Execute some failures
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      
      let stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(2);
      
      // Advance time beyond monitoring window
      vi.advanceTimersByTime(6000);
      
      // Execute another request to trigger cleanup
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      
      stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1); // Only the recent failure should remain
    });
  });

  describe('Statistics and Monitoring', () => {
    it('calculates failure rate correctly', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('test error'));
      const successFn = vi.fn().mockResolvedValue('success');
      
      // Execute 2 failures and 3 successes
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      
      const failureRate = circuitBreaker.getFailureRate();
      expect(failureRate).toBe(0.4); // 2 failures out of 5 total
    });

    it('returns 0 failure rate when no requests', () => {
      expect(circuitBreaker.getFailureRate()).toBe(0);
    });

    it('tracks last failure and success times', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('test error'));
      const successFn = vi.fn().mockResolvedValue('success');
      
      const beforeFailure = Date.now();
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      const afterFailure = Date.now();
      
      const beforeSuccess = Date.now();
      await circuitBreaker.execute(successFn);
      const afterSuccess = Date.now();
      
      const stats = circuitBreaker.getStats();
      expect(stats.lastFailureTime).toBeGreaterThanOrEqual(beforeFailure);
      expect(stats.lastFailureTime).toBeLessThanOrEqual(afterFailure);
      expect(stats.lastSuccessTime).toBeGreaterThanOrEqual(beforeSuccess);
      expect(stats.lastSuccessTime).toBeLessThanOrEqual(afterSuccess);
    });
  });

  describe('Configuration Management', () => {
    it('updates configuration correctly', () => {
      const newConfig = {
        failureThreshold: 5,
        recoveryTimeout: 2000,
      };
      
      circuitBreaker.updateConfig(newConfig);
      
      const config = circuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeout).toBe(2000);
      expect(config.monitoringWindow).toBe(5000); // Should retain original value
    });

    it('resets circuit breaker correctly', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats().failures).toBe(0);
      expect(circuitBreaker.getStats().successes).toBe(0);
      expect(circuitBreaker.getStats().totalRequests).toBe(0);
    });
  });

  describe('Factory Functions', () => {
    it('creates circuit breaker with default config', () => {
      const cb = createCircuitBreaker();
      const config = cb.getConfig();
      
      expect(config.failureThreshold).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold);
      expect(config.recoveryTimeout).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG.recoveryTimeout);
    });

    it('creates circuit breaker with custom config', () => {
      const customConfig = { failureThreshold: 10 };
      const cb = createCircuitBreaker(customConfig);
      const config = cb.getConfig();
      
      expect(config.failureThreshold).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('handles synchronous errors', async () => {
      const mockFn = vi.fn(() => {
        throw new Error('sync error');
      });
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('sync error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('handles non-Error rejections', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toBe('string error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('handles zero thresholds gracefully', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0,
        successThreshold: 0,
      });
      
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Health Checks', () => {
    it('reports healthy when closed', () => {
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    it('reports unhealthy when open', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      expect(circuitBreaker.isHealthy()).toBe(false);
    });

    it('reports healthy in half-open with successes', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();
      }
      
      // Wait for recovery timeout
      vi.advanceTimersByTime(1000);
      
      // Execute successful request
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
  });
});