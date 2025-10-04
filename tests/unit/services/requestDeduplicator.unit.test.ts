import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RequestDeduplicator, type RequestParams } from '~/services/requestDeduplicator.server';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
    // Stop the automatic cleanup timer for controlled testing
    deduplicator.stopCleanupTimer();
  });

  afterEach(() => {
    deduplicator.clear();
    deduplicator.stopCleanupTimer();
  });

  describe('generateRequestKey', () => {
    it('should generate consistent keys for identical parameters', () => {
      const params1: RequestParams = {
        checkoutToken: 'abc123',
        customerPhone: '+923001234567',
        orderName: 'ORDER-001'
      };

      const params2: RequestParams = {
        checkoutToken: 'abc123',
        customerPhone: '+923001234567',
        orderName: 'ORDER-001'
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should generate different keys for different parameters', () => {
      const params1: RequestParams = {
        checkoutToken: 'abc123',
        customerPhone: '+923001234567'
      };

      const params2: RequestParams = {
        checkoutToken: 'def456',
        customerPhone: '+923001234567'
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      expect(key1).not.toBe(key2);
    });

    it('should normalize phone numbers correctly', () => {
      const params1: RequestParams = {
        customerPhone: '+92 300 123 4567'
      };

      const params2: RequestParams = {
        customerPhone: '0300-123-4567'
      };

      const params3: RequestParams = {
        customerPhone: '3001234567'
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);
      const key3 = deduplicator.generateRequestKey(params3);

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('should handle case-insensitive checkout tokens', () => {
      const params1: RequestParams = {
        checkoutToken: 'ABC123def'
      };

      const params2: RequestParams = {
        checkoutToken: 'abc123DEF'
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      expect(key1).toBe(key2);
    });

    it('should handle empty and undefined parameters', () => {
      const params1: RequestParams = {};
      const params2: RequestParams = {
        checkoutToken: undefined,
        customerPhone: undefined
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      expect(key1).toBe(key2);
    });

    it('should generate consistent keys regardless of parameter order', () => {
      const params1: RequestParams = {
        checkoutToken: 'abc123',
        customerPhone: '3001234567',
        orderName: 'ORDER-001',
        orderId: '12345'
      };

      const params2: RequestParams = {
        orderId: '12345',
        orderName: 'ORDER-001',
        customerPhone: '3001234567',
        checkoutToken: 'abc123'
      };

      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      expect(key1).toBe(key2);
    });
  });

  describe('isDuplicateRequest', () => {
    it('should return false for non-existent keys', () => {
      const key = 'non-existent-key';
      expect(deduplicator.isDuplicateRequest(key)).toBe(false);
    });

    it('should return true for pending requests', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Register a request that takes some time
      const requestPromise = deduplicator.registerRequest(
        key,
        () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
      );

      expect(deduplicator.isDuplicateRequest(key)).toBe(true);

      // Wait for request to complete
      await requestPromise;

      // Should no longer be duplicate after completion
      expect(deduplicator.isDuplicateRequest(key)).toBe(false);
    });

    it('should return false for expired requests', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      // Register and complete a request
      await deduplicator.registerRequest(
        key,
        () => Promise.resolve('result')
      );

      // Advance time beyond TTL (5 minutes)
      mockTime += 6 * 60 * 1000;

      expect(deduplicator.isDuplicateRequest(key)).toBe(false);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('registerRequest', () => {
    it('should execute request function and return result', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);
      const expectedResult = { data: 'test-data' };

      const result = await deduplicator.registerRequest(
        key,
        () => Promise.resolve(expectedResult)
      );

      expect(result).toEqual(expectedResult);
    });

    it('should return same promise for duplicate requests', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);
      let callCount = 0;

      const requestFn = () => {
        callCount++;
        return Promise.resolve(`result-${callCount}`);
      };

      // Start two concurrent requests
      const promise1 = deduplicator.registerRequest(key, requestFn);
      const promise2 = deduplicator.registerRequest(key, requestFn);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      expect(result1).toBe(result2);
      expect(result1).toBe('result-1');
      expect(callCount).toBe(1); // Function should only be called once
    });

    it('should handle request failures correctly', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);
      const error = new Error('Request failed');

      const requestPromise = deduplicator.registerRequest(
        key,
        () => Promise.reject(error)
      );

      await expect(requestPromise).rejects.toThrow('Request failed');

      // After failure, key should be cleaned up
      expect(deduplicator.isDuplicateRequest(key)).toBe(false);
    });

    it('should handle concurrent requests with different keys', async () => {
      const params1: RequestParams = { checkoutToken: 'test123' };
      const params2: RequestParams = { checkoutToken: 'test456' };
      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      let callCount = 0;
      const requestFn = () => {
        callCount++;
        return Promise.resolve(`result-${callCount}`);
      };

      const [result1, result2] = await Promise.all([
        deduplicator.registerRequest(key1, requestFn),
        deduplicator.registerRequest(key2, requestFn)
      ]);

      expect(result1).toBe('result-1');
      expect(result2).toBe('result-2');
      expect(callCount).toBe(2); // Both functions should be called
    });
  });

  describe('cleanup', () => {
    it('should remove expired pending requests', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Mock Date.now to control time
      const originalNow = Date.now;
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      // Register a long-running request
      const requestPromise = deduplicator.registerRequest(
        key,
        () => new Promise(resolve => setTimeout(() => resolve('result'), 1000))
      );

      expect(deduplicator.getStats().pendingRequests).toBe(1);

      // Advance time beyond TTL
      mockTime += 6 * 60 * 1000;

      // Run cleanup
      deduplicator.cleanup();

      expect(deduplicator.getStats().pendingRequests).toBe(0);

      // Restore original Date.now
      Date.now = originalNow;

      // Wait for the original request to complete to avoid hanging
      await requestPromise.catch(() => {});
    });

    it('should remove expired timestamps', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Complete a request to create a timestamp
      await deduplicator.registerRequest(
        key,
        () => Promise.resolve('result')
      );

      expect(deduplicator.getStats().cachedTimestamps).toBe(1);

      // Mock time advancement
      const originalNow = Date.now;
      let mockTime = Date.now() + 6 * 60 * 1000; // 6 minutes later
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      deduplicator.cleanup();

      expect(deduplicator.getStats().cachedTimestamps).toBe(0);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const params1: RequestParams = { checkoutToken: 'test123' };
      const params2: RequestParams = { checkoutToken: 'test456' };
      const key1 = deduplicator.generateRequestKey(params1);
      const key2 = deduplicator.generateRequestKey(params2);

      // Register two pending requests
      const promise1 = deduplicator.registerRequest(
        key1,
        () => new Promise(resolve => setTimeout(() => resolve('result1'), 100))
      );
      const promise2 = deduplicator.registerRequest(
        key2,
        () => new Promise(resolve => setTimeout(() => resolve('result2'), 100))
      );

      const stats = deduplicator.getStats();
      expect(stats.pendingRequests).toBe(2);
      expect(stats.cachedTimestamps).toBe(0);
      expect(stats.oldestPendingRequest).toBeTypeOf('number');
      expect(stats.newestPendingRequest).toBeTypeOf('number');

      // Wait for requests to complete
      await Promise.all([promise1, promise2]);

      const finalStats = deduplicator.getStats();
      expect(finalStats.pendingRequests).toBe(0);
      expect(finalStats.cachedTimestamps).toBe(2);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return 0 for non-existent keys', () => {
      const ttl = deduplicator.getRemainingTTL('non-existent');
      expect(ttl).toBe(0);
    });

    it('should return correct remaining TTL', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Complete a request to create a timestamp
      await deduplicator.registerRequest(
        key,
        () => Promise.resolve('result')
      );

      const ttl = deduplicator.getRemainingTTL(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000); // Should be <= 5 minutes
    });
  });

  describe('clear', () => {
    it('should clear all pending requests and timestamps', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      // Register a request and let it complete
      await deduplicator.registerRequest(
        key,
        () => Promise.resolve('result')
      );

      expect(deduplicator.getStats().cachedTimestamps).toBe(1);

      deduplicator.clear();

      const stats = deduplicator.getStats();
      expect(stats.pendingRequests).toBe(0);
      expect(stats.cachedTimestamps).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle requests with special characters in parameters', () => {
      const params: RequestParams = {
        checkoutToken: 'abc-123_def.456',
        customerPhone: '+92 (300) 123-4567',
        orderName: 'ORDER/001#TEST',
        orderId: '12345-67890'
      };

      const key = deduplicator.generateRequestKey(params);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle very long parameter values', () => {
      const longString = 'a'.repeat(1000);
      const params: RequestParams = {
        checkoutToken: longString,
        customerPhone: '3001234567',
        orderName: longString
      };

      const key = deduplicator.generateRequestKey(params);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle requests that throw synchronous errors', async () => {
      const params: RequestParams = { checkoutToken: 'test123' };
      const key = deduplicator.generateRequestKey(params);

      const requestPromise = deduplicator.registerRequest(
        key,
        () => {
          throw new Error('Synchronous error');
        }
      );

      await expect(requestPromise).rejects.toThrow('Synchronous error');
    });

    it('should handle multiple cleanup calls safely', () => {
      expect(() => {
        deduplicator.cleanup();
        deduplicator.cleanup();
        deduplicator.cleanup();
      }).not.toThrow();
    });

    it('should handle timer operations safely', () => {
      expect(() => {
        deduplicator.stopCleanupTimer();
        deduplicator.stopCleanupTimer();
      }).not.toThrow();
    });
  });

  describe('concurrent request scenarios', () => {
    it('should handle high concurrency with same parameters', async () => {
      const params: RequestParams = { checkoutToken: 'concurrent-test' };
      const key = deduplicator.generateRequestKey(params);
      let callCount = 0;

      const requestFn = () => {
        callCount++;
        return new Promise(resolve => 
          setTimeout(() => resolve(`result-${callCount}`), 50)
        );
      };

      // Start 10 concurrent requests with same parameters
      const promises = Array.from({ length: 10 }, () =>
        deduplicator.registerRequest(key, requestFn)
      );

      const results = await Promise.all(promises);

      // All results should be identical
      expect(new Set(results).size).toBe(1);
      expect(callCount).toBe(1); // Function should only be called once
      expect(results[0]).toBe('result-1');
    });

    it('should handle mixed concurrent requests with different parameters', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => ({
        params: { checkoutToken: `test-${i % 5}` }, // 5 unique keys, 4 duplicates each
        expectedCallCount: i % 5 + 1
      }));

      let totalCallCount = 0;
      const callCounts = new Map<string, number>();

      const requestFn = (token: string) => () => {
        const count = (callCounts.get(token) || 0) + 1;
        callCounts.set(token, count);
        totalCallCount++;
        return Promise.resolve(`result-${token}-${count}`);
      };

      const promises = requests.map(({ params }) => {
        const key = deduplicator.generateRequestKey(params);
        return deduplicator.registerRequest(key, requestFn(params.checkoutToken!));
      });

      await Promise.all(promises);

      // Should only have 5 unique calls (one per unique token)
      expect(totalCallCount).toBe(5);
      expect(callCounts.size).toBe(5);
    });
  });
});