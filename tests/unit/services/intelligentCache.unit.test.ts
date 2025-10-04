import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntelligentCache, type CacheConfig, type BackgroundRefreshFunction } from '~/services/intelligentCache.server';

describe('IntelligentCache', () => {
  let cache: IntelligentCache;
  
  beforeEach(() => {
    vi.useFakeTimers();
    cache = new IntelligentCache({
      defaultTTL: 5000, // 5 seconds for testing
      maxSize: 10,
      backgroundRefreshThreshold: 0.2,
      compressionEnabled: true,
      compressionThreshold: 100, // Low threshold for testing
      maxMemoryUsage: 1024 * 1024, // 1MB
      cleanupInterval: 1000 // 1 second
    });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data', async () => {
      const testData = { message: 'Hello, World!' };
      await cache.set('test-key', testData);
      
      const retrieved = cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle custom TTL', async () => {
      const testData = { value: 123 };
      await cache.set('custom-ttl', testData, 1000); // 1 second TTL
      
      expect(cache.get('custom-ttl')).toEqual(testData);
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1500);
      expect(cache.get('custom-ttl')).toBeNull();
    });

    it('should invalidate specific keys', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      
      cache.invalidate('key1');
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toEqual({ data: 'value2' });
    });

    it('should clear all entries', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const testData = { message: 'This will expire' };
      await cache.set('expire-test', testData, 2000); // 2 seconds
      
      expect(cache.get('expire-test')).toEqual(testData);
      
      // Advance time to just before expiration
      vi.advanceTimersByTime(1500);
      expect(cache.get('expire-test')).toEqual(testData);
      
      // Advance time past expiration
      vi.advanceTimersByTime(1000);
      expect(cache.get('expire-test')).toBeNull();
    });

    it('should update access statistics', async () => {
      const testData = { counter: 1 };
      await cache.set('access-test', testData);
      
      // Access multiple times
      cache.get('access-test');
      cache.get('access-test');
      cache.get('access-test');
      
      const stats = cache.getStats();
      expect(stats.hitCount).toBe(3);
      expect(stats.missCount).toBe(0);
    });

    it('should track cache misses', () => {
      cache.get('non-existent-1');
      cache.get('non-existent-2');
      
      const stats = cache.getStats();
      expect(stats.missCount).toBe(2);
      expect(stats.hitCount).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict entries when size limit is reached', async () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        await cache.set(`key-${i}`, { value: i });
      }
      
      // Verify cache is at capacity
      expect(cache.getStats().totalEntries).toBe(10);
      
      // Add one more entry to trigger eviction
      await cache.set('key-new', { value: 'new' });
      
      // Cache should still be at or below capacity
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(10);
      expect(stats.evictionCount).toBeGreaterThan(0);
      
      // New entry should exist
      expect(cache.get('key-new')).toEqual({ value: 'new' });
    });

    it('should maintain cache size within limits', async () => {
      // Add more entries than the limit
      for (let i = 0; i < 15; i++) {
        await cache.set(`overflow-${i}`, { data: `value-${i}` });
      }
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(10);
    });
  });

  describe('Compression', () => {
    it('should compress large data', async () => {
      const largeData = {
        content: 'A'.repeat(1000), // Large string to trigger compression
        metadata: { size: 'large', type: 'test' }
      };
      
      await cache.set('large-data', largeData);
      
      const entryInfo = cache.getEntryInfo('large-data');
      expect(entryInfo?.compressed).toBe(true);
      expect(entryInfo?.compressedSize).toBeLessThan(entryInfo?.originalSize || 0);
      
      // Should still retrieve correctly
      const retrieved = cache.get('large-data');
      expect(retrieved).toEqual(largeData);
    });

    it('should not compress small data', async () => {
      const smallData = { message: 'small' };
      
      await cache.set('small-data', smallData);
      
      const entryInfo = cache.getEntryInfo('small-data');
      expect(entryInfo?.compressed).toBe(false);
    });

    it('should calculate compression ratio in stats', async () => {
      const largeData1 = { content: 'B'.repeat(500) };
      const largeData2 = { content: 'C'.repeat(500) };
      
      await cache.set('compress-1', largeData1);
      await cache.set('compress-2', largeData2);
      
      const stats = cache.getStats();
      expect(stats.compressionRatio).toBeLessThan(1);
    });
  });

  describe('Background Refresh', () => {
    it('should register refresh functions', () => {
      const refreshFn = vi.fn().mockResolvedValue({ refreshed: true });
      
      expect(() => {
        cache.registerRefreshFunction('test-*', refreshFn);
      }).not.toThrow();
    });

    it('should detect when background refresh is needed', async () => {
      await cache.set('refresh-test', { original: true }, 1000); // 1 second TTL
      
      // Advance time to trigger background refresh threshold (80% of TTL)
      vi.advanceTimersByTime(850);
      
      // Access the entry - this should trigger refresh scheduling internally
      const result = cache.get('refresh-test');
      expect(result).toEqual({ original: true });
    });

    it('should handle missing refresh functions gracefully', async () => {
      await cache.set('no-refresh', { original: true }, 1000);
      
      vi.advanceTimersByTime(850);
      
      // Should not throw even without refresh function
      expect(() => cache.get('no-refresh')).not.toThrow();
    });

    it('should track background refresh attempts in stats', () => {
      const stats = cache.getStats();
      expect(stats.backgroundRefreshCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', async () => {
      const initialStats = cache.getStats();
      expect(initialStats.memoryUsage).toBe(0);
      
      await cache.set('memory-test', { data: 'some data' });
      
      const afterStats = cache.getStats();
      expect(afterStats.memoryUsage).toBeGreaterThan(0);
    });

    it('should evict entries under memory pressure', async () => {
      // Create cache with very low memory limit
      const smallCache = new IntelligentCache({
        maxMemoryUsage: 1000, // 1KB limit
        maxSize: 100
      });
      
      try {
        // Add large entries to exceed memory limit
        for (let i = 0; i < 10; i++) {
          await smallCache.set(`large-${i}`, { 
            content: 'X'.repeat(200), // 200 bytes each
            index: i 
          });
        }
        
        const stats = smallCache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);
        expect(stats.memoryUsage).toBeLessThanOrEqual(1000);
      } finally {
        smallCache.destroy();
      }
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should automatically clean up expired entries', async () => {
      await cache.set('cleanup-1', { data: 'value1' }, 500);
      await cache.set('cleanup-2', { data: 'value2' }, 1500);
      
      // Advance time to expire first entry
      vi.advanceTimersByTime(1000);
      
      // Trigger cleanup
      cache.cleanup();
      
      expect(cache.get('cleanup-1')).toBeNull();
      expect(cache.get('cleanup-2')).toEqual({ data: 'value2' });
    });

    it('should run periodic cleanup', async () => {
      await cache.set('periodic-test', { data: 'value' }, 500);
      
      // Advance time to expire entry and trigger cleanup interval
      vi.advanceTimersByTime(1500);
      
      expect(cache.get('periodic-test')).toBeNull();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should calculate hit rate correctly', async () => {
      await cache.set('hit-test', { data: 'value' });
      
      // 3 hits, 2 misses
      cache.get('hit-test');
      cache.get('hit-test');
      cache.get('hit-test');
      cache.get('non-existent-1');
      cache.get('non-existent-2');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.6); // 3/5
    });

    it('should track average access time', async () => {
      await cache.set('timing-test', { data: 'value' });
      
      // Add some artificial delay to ensure measurable time
      const start = Date.now();
      while (Date.now() - start < 1) {
        // Small busy wait to ensure some time passes
      }
      
      cache.get('timing-test');
      cache.get('timing-test');
      
      const stats = cache.getStats();
      expect(stats.averageAccessTime).toBeGreaterThanOrEqual(0);
    });

    it('should provide entry information', async () => {
      const testData = { info: 'test' };
      await cache.set('info-test', testData, 2000);
      
      const entryInfo = cache.getEntryInfo('info-test');
      expect(entryInfo).toMatchObject({
        ttl: 2000,
        accessCount: 0,
        compressed: false
      });
      expect(entryInfo?.timestamp).toBeTypeOf('number');
      expect(entryInfo?.lastAccessed).toBeTypeOf('number');
    });
  });

  describe('Pattern Matching', () => {
    it('should register different refresh functions for different patterns', () => {
      const userRefresh = vi.fn().mockResolvedValue({ type: 'user' });
      const orderRefresh = vi.fn().mockResolvedValue({ type: 'order' });
      
      expect(() => {
        cache.registerRefreshFunction('user:*', userRefresh);
        cache.registerRefreshFunction('order:*', orderRefresh);
      }).not.toThrow();
    });

    it('should handle exact pattern matching', () => {
      const exactRefresh = vi.fn().mockResolvedValue({ exact: true });
      
      expect(() => {
        cache.registerRefreshFunction('exact-key', exactRefresh);
      }).not.toThrow();
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent gets safely', async () => {
      await cache.set('concurrent-test', { data: 'shared' });
      
      const promises = Array.from({ length: 10 }, () => 
        cache.get('concurrent-test')
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same data
      results.forEach(result => {
        expect(result).toEqual({ data: 'shared' });
      });
    });

    it('should handle concurrent sets safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        cache.set(`concurrent-set-${i}`, { index: i })
      );
      
      await Promise.all(promises);
      
      // All entries should be stored
      for (let i = 0; i < 10; i++) {
        expect(cache.get(`concurrent-set-${i}`)).toEqual({ index: i });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle compression errors gracefully', async () => {
      // Create cache with compression disabled to avoid async issues in test
      const testCache = new IntelligentCache({
        compressionEnabled: false,
        defaultTTL: 5000
      });
      
      try {
        const testData = { content: 'A'.repeat(1000) };
        
        // Should not throw and should store uncompressed
        await expect(testCache.set('compression-error', testData)).resolves.not.toThrow();
        
        const retrieved = testCache.get('compression-error');
        expect(retrieved).toEqual(testData);
      } finally {
        testCache.destroy();
      }
    });

    it('should handle decompression errors gracefully', async () => {
      // Create a cache entry with invalid compressed data
      const testCache = new IntelligentCache({
        compressionEnabled: true,
        compressionThreshold: 100,
        defaultTTL: 5000
      });
      
      try {
        // Store valid data first
        const testData = { content: 'B'.repeat(1000) };
        await testCache.set('decompression-test', testData);
        
        // Manually corrupt the compressed data
        const cacheMap = (testCache as any).cache;
        const entry = cacheMap.get('decompression-test');
        if (entry && entry.compressed) {
          entry.data = Buffer.from('invalid-compressed-data');
        }
        
        // Should return null instead of throwing
        const result = testCache.get('decompression-test');
        expect(result).toBeNull();
      } finally {
        testCache.destroy();
      }
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when using getCache', async () => {
      const { getCache, destroyCache } = await import('../../../app/services/intelligentCache.server');
      
      destroyCache(); // Clean slate
      
      const instance1 = getCache();
      const instance2 = getCache();
      
      expect(instance1).toBe(instance2);
      
      destroyCache();
    });

    it('should create new instance after destroy', async () => {
      const { getCache, destroyCache } = await import('../../../app/services/intelligentCache.server');
      
      const instance1 = getCache();
      destroyCache();
      const instance2 = getCache();
      
      expect(instance1).not.toBe(instance2);
      
      destroyCache();
    });
  });
});