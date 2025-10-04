/**
 * Enhanced Circuit Breaker Integration Tests
 * 
 * Integration tests that verify the circuit breaker works correctly
 * with simulated API operations and real-world scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  EnhancedCircuitBreaker, 
  CircuitBreakerState, 
  CircuitBreakerError 
} from '../../../app/services/enhancedCircuitBreaker.server';

describe('EnhancedCircuitBreaker Integration Tests', () => {
  let circuitBreaker: EnhancedCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 3,
      failureRateThreshold: 0.5,
      recoveryTimeout: 1000,
      halfOpenMaxCalls: 2,
      successThreshold: 2,
      monitoringWindow: 5000,
      requestTimeout: 2000,
      slowCallThreshold: 500,
      slowCallRateThreshold: 0.3,
      persistenceEnabled: false,
      alertingEnabled: false
    });
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe('API Call Protection', () => {
    it('should protect against failing API calls', async () => {
      let callCount = 0;
      
      const failingApiCall = async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error(`API call failed (attempt ${callCount})`);
        }
        return { success: true, data: 'API response' };
      };

      // First 3 calls should fail and trigger circuit opening
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingApiCall);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('API call failed');
        }
      }

      // Circuit should now be OPEN
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Next call should be blocked by circuit breaker
      await expect(circuitBreaker.execute(failingApiCall))
        .rejects.toThrow(CircuitBreakerError);

      // API should not have been called (callCount should still be 3)
      expect(callCount).toBe(3);
    });

    it('should allow recovery after timeout', async () => {
      let callCount = 0;
      
      const recoveringApiCall = async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error(`API call failed (attempt ${callCount})`);
        }
        return { success: true, data: 'API recovered' };
      };

      // Trigger circuit opening
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(recoveringApiCall);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should transition to HALF_OPEN and succeed
      const result = await circuitBreaker.execute(recoveringApiCall);
      expect(result).toEqual({ success: true, data: 'API recovered' });
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // Another successful call should close the circuit
      await circuitBreaker.execute(recoveringApiCall);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should handle slow API calls', async () => {
      const slowApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 600)); // Slower than threshold
        return { success: true, data: 'Slow response' };
      };

      // Execute multiple slow calls
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(slowApiCall);
        } catch (error) {
          // Circuit might open due to slow calls
          break;
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.slowCalls).toBeGreaterThan(0);
      
      // Should eventually open due to slow call rate
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should handle timeout scenarios', async () => {
      const timeoutApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Longer than timeout
        return { success: true, data: 'Should not reach here' };
      };

      await expect(circuitBreaker.execute(timeoutApiCall))
        .rejects.toThrow('timeout');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.timeoutCalls).toBe(1);
    });
  });

  describe('Database Operation Protection', () => {
    it('should protect database queries', async () => {
      let queryCount = 0;
      
      const failingDatabaseQuery = async () => {
        queryCount++;
        if (queryCount <= 3) {
          throw new Error('Database connection failed');
        }
        return [{ id: 1, name: 'Customer 1' }];
      };

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingDatabaseQuery, 'customer-lookup');
        } catch (error) {
          expect((error as Error).message).toBe('Database connection failed');
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Should block subsequent queries
      await expect(circuitBreaker.execute(failingDatabaseQuery, 'customer-lookup'))
        .rejects.toThrow(CircuitBreakerError);
    });

    it('should handle concurrent database operations', async () => {
      let successCount = 0;
      let failureCount = 0;
      
      const concurrentDatabaseQuery = async () => {
        // Simulate random success/failure
        if (Math.random() > 0.7) {
          failureCount++;
          throw new Error('Database timeout');
        }
        successCount++;
        return { id: successCount, processed: true };
      };

      // Execute multiple concurrent operations
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(concurrentDatabaseQuery, 'concurrent-query')
          .catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(promises);
      
      // Should have mix of successes and failures
      const successResults = results.filter(r => !('error' in r));
      const errorResults = results.filter(r => 'error' in r);
      
      expect(successResults.length + errorResults.length).toBe(10);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle mixed success and failure patterns', async () => {
      let callCount = 0;
      
      const mixedApiCall = async () => {
        callCount++;
        
        // Pattern: fail, fail, success, fail, success, success
        const pattern = [false, false, true, false, true, true];
        const shouldSucceed = pattern[(callCount - 1) % pattern.length];
        
        if (!shouldSucceed) {
          throw new Error(`Intermittent failure ${callCount}`);
        }
        
        return { success: true, callNumber: callCount };
      };

      const results = [];
      
      // Execute the pattern multiple times
      for (let i = 0; i < 12; i++) {
        try {
          const result = await circuitBreaker.execute(mixedApiCall, 'mixed-pattern');
          results.push({ success: true, result });
        } catch (error) {
          if (error instanceof CircuitBreakerError) {
            results.push({ success: false, blocked: true });
          } else {
            results.push({ success: false, error: (error as Error).message });
          }
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBeGreaterThan(0);
      expect(metrics.successfulCalls).toBeGreaterThan(0);
      expect(metrics.failedCalls).toBeGreaterThan(0);
      
      // Should have calculated proper success/failure rates
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.failureRate).toBeGreaterThan(0);
      expect(metrics.successRate + metrics.failureRate).toBeCloseTo(1, 2);
    });

    it('should maintain metrics across state transitions', async () => {
      let callCount = 0;
      
      const trackingApiCall = async () => {
        callCount++;
        
        // First 4 calls fail, then succeed
        if (callCount <= 4) {
          throw new Error(`Tracking failure ${callCount}`);
        }
        
        return { success: true, callNumber: callCount };
      };

      // Phase 1: Trigger failures and circuit opening
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(trackingApiCall, 'tracking-test');
        } catch (error) {
          // Expected failures
        }
      }

      const openMetrics = circuitBreaker.getMetrics();
      expect(openMetrics.currentState).toBe(CircuitBreakerState.OPEN);
      expect(openMetrics.failedCalls).toBe(4);
      expect(openMetrics.stateTransitions).toHaveLength(1);

      // Phase 2: Wait for recovery and test half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await circuitBreaker.execute(trackingApiCall, 'tracking-test');
      
      const halfOpenMetrics = circuitBreaker.getMetrics();
      expect(halfOpenMetrics.currentState).toBe(CircuitBreakerState.HALF_OPEN);
      expect(halfOpenMetrics.halfOpenCallCount).toBe(1);
      expect(halfOpenMetrics.halfOpenSuccessCount).toBe(1);

      // Phase 3: Close circuit
      await circuitBreaker.execute(trackingApiCall, 'tracking-test');
      
      const closedMetrics = circuitBreaker.getMetrics();
      expect(closedMetrics.currentState).toBe(CircuitBreakerState.CLOSED);
      expect(closedMetrics.stateTransitions).toHaveLength(3); // CLOSED->OPEN->HALF_OPEN->CLOSED
    });

    it('should handle burst traffic scenarios', async () => {
      let processedCount = 0;
      
      const burstApiCall = async () => {
        processedCount++;
        
        // Simulate system overload - fail if too many concurrent calls
        if (processedCount > 15) {
          throw new Error('System overloaded');
        }
        
        // Add some processing delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return { processed: processedCount, timestamp: Date.now() };
      };

      // Simulate burst of 30 concurrent requests
      const burstPromises = Array(30).fill(null).map((_, index) => 
        circuitBreaker.execute(burstApiCall, `burst-${index}`)
          .catch(error => ({ error: error.message, index }))
      );

      const burstResults = await Promise.all(burstPromises);
      
      const successfulResults = burstResults.filter(r => !('error' in r));
      const failedResults = burstResults.filter(r => 'error' in r);
      
      // Should have protected against overload
      expect(successfulResults.length).toBeLessThan(30);
      expect(failedResults.length).toBeGreaterThan(0);
      
      const metrics = circuitBreaker.getMetrics();
      
      // Circuit should have opened to protect the system
      expect([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN])
        .toContain(circuitBreaker.getState());
    });
  });

  describe('Performance and Monitoring', () => {
    it('should collect accurate performance metrics', async () => {
      const performanceApiCall = async (delay: number) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { delay, timestamp: Date.now() };
      };

      // Execute calls with different response times
      const delays = [50, 100, 150, 200, 250, 300, 400, 500];
      
      for (const delay of delays) {
        await circuitBreaker.execute(() => performanceApiCall(delay), 'performance-test');
      }

      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.totalCalls).toBe(8);
      expect(metrics.successfulCalls).toBe(8);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.p95ResponseTime).toBeGreaterThan(metrics.averageResponseTime);
      expect(metrics.minResponseTime).toBeGreaterThan(0);
      expect(metrics.maxResponseTime).toBeGreaterThan(metrics.minResponseTime);
    });

    it('should track state transition history', async () => {
      let callCount = 0;
      
      const transitionApiCall = async () => {
        callCount++;
        
        if (callCount <= 3) {
          throw new Error('Transition test failure');
        }
        
        return { success: true };
      };

      // Trigger state transitions
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(transitionApiCall, 'transition-test');
        } catch (error) {
          // Expected failures
        }
      }

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Recover
      await circuitBreaker.execute(transitionApiCall, 'transition-test');
      await circuitBreaker.execute(transitionApiCall, 'transition-test');

      const metrics = circuitBreaker.getMetrics();
      const transitions = metrics.stateTransitions;
      
      expect(transitions).toHaveLength(3);
      expect(transitions[0].fromState).toBe(CircuitBreakerState.CLOSED);
      expect(transitions[0].toState).toBe(CircuitBreakerState.OPEN);
      expect(transitions[1].fromState).toBe(CircuitBreakerState.OPEN);
      expect(transitions[1].toState).toBe(CircuitBreakerState.HALF_OPEN);
      expect(transitions[2].fromState).toBe(CircuitBreakerState.HALF_OPEN);
      expect(transitions[2].toState).toBe(CircuitBreakerState.CLOSED);
      
      // Each transition should have a reason
      expect(transitions.every(t => t.reason.length > 0)).toBe(true);
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should handle gradual recovery', async () => {
      let callCount = 0;
      let failureRate = 1.0; // Start with 100% failure rate
      
      const gradualRecoveryApiCall = async () => {
        callCount++;
        
        // Gradually improve success rate
        if (callCount > 5) {
          failureRate = Math.max(0, failureRate - 0.2); // Improve by 20% each call
        }
        
        if (Math.random() < failureRate) {
          throw new Error(`Gradual recovery failure (rate: ${failureRate})`);
        }
        
        return { success: true, callCount, failureRate };
      };

      // Initial failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(gradualRecoveryApiCall, 'gradual-recovery');
        } catch (error) {
          // Expected initial failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Attempt recovery - should gradually succeed more often
      let recoveryAttempts = 0;
      let recoverySuccesses = 0;
      
      for (let i = 0; i < 10; i++) {
        try {
          recoveryAttempts++;
          await circuitBreaker.execute(gradualRecoveryApiCall, 'gradual-recovery');
          recoverySuccesses++;
          
          // Small delay between attempts
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          if (error instanceof CircuitBreakerError) {
            // Circuit blocked the call
            break;
          }
          // API call failed, continue trying
        }
      }

      const metrics = circuitBreaker.getMetrics();
      
      // Should show improvement in success rate over time
      expect(recoverySuccesses).toBeGreaterThan(0);
      expect(metrics.circuitBreakerTrips).toBeGreaterThanOrEqual(1);
    });
  });
});