/**
 * Performance Optimizations Tests
 * 
 * Tests for caching, performance monitoring, and optimization features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionCache, createCacheKey, extensionCache } from '../services/cacheService';
import { PerformanceMonitor, globalPerformanceMonitor } from '../services/performanceMonitor';
import { useOptimizedRiskProfile } from '../hooks/useOptimizedRiskProfile';

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

describe('SessionCache', () => {
  let cache: SessionCache;

  beforeEach(() => {
    cache = new SessionCache({
      maxSize: 5,
      defaultTtl: 1000, // 1 second for testing
      enableMetrics: true,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  it('should store and retrieve cached data', () => {
    const testData = { test: 'data' };
    cache.set('test-key', testData);
    
    const retrieved = cache.get('test-key');
    expect(retrieved).toEqual(testData);
  });

  it('should return null for expired data', () => {
    const testData = { test: 'data' };
    const shortTtl = 1; // 1ms TTL for immediate expiration
    cache.set('test-key', testData, shortTtl);
    
    // Mock Date.now to simulate time passage
    const originalNow = Date.now;
    Date.now = vi.fn(() => originalNow() + 100); // 100ms later
    
    const retrieved = cache.get('test-key');
    expect(retrieved).toBeNull();
    
    // Restore Date.now
    Date.now = originalNow;
  });

  it('should evict least recently used items when at capacity', () => {
    const originalNow = Date.now;
    let mockTime = 1000;
    Date.now = vi.fn(() => mockTime);

    // Fill cache to capacity
    for (let i = 0; i < 5; i++) {
      cache.set(`key-${i}`, `data-${i}`);
      mockTime += 10; // Increment time for each entry
    }

    // Access key-1 to make it recently used
    mockTime += 100;
    cache.get('key-1');

    // Add one more item to trigger eviction
    mockTime += 10;
    cache.set('key-new', 'new-data');

    // key-0 should be evicted (least recently used)
    expect(cache.get('key-0')).toBeNull();
    expect(cache.get('key-1')).toBe('data-1'); // Should still exist
    expect(cache.get('key-new')).toBe('new-data');
    
    // Restore Date.now
    Date.now = originalNow;
  });

  it('should track cache metrics correctly', () => {
    cache.set('key1', 'data1');
    cache.set('key2', 'data2');

    // Generate hits and misses
    cache.get('key1'); // hit
    cache.get('key2'); // hit
    cache.get('nonexistent'); // miss

    const metrics = cache.getMetrics();
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(1);
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.hitRate).toBeCloseTo(2/3);
  });

  it('should create consistent cache keys', () => {
    const params1 = { phone: '123', email: 'test@example.com', orderId: 'order1' };
    const params2 = { orderId: 'order1', phone: '123', email: 'test@example.com' }; // Different order

    const key1 = createCacheKey('test', params1);
    const key2 = createCacheKey('test', params2);

    expect(key1).toBe(key2); // Should be the same despite different parameter order
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor(true);
    mockPerformanceNow.mockReturnValue(1000);
  });

  afterEach(() => {
    monitor.clear();
    vi.clearAllMocks();
  });

  it('should record performance metrics', () => {
    monitor.recordMetric('test-metric', 100, { extra: 'data' });

    const metrics = monitor.getRecentMetrics(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test-metric');
    expect(metrics[0].value).toBe(100);
    expect(metrics[0].metadata).toEqual({ extra: 'data' });
  });

  it('should record component render times', () => {
    monitor.recordRender('TestComponent', 50, 1024);

    const componentMetrics = monitor.getComponentMetrics('TestComponent');
    expect(componentMetrics).toHaveLength(1);
    expect(componentMetrics[0].renderTime).toBe(50);
    expect(componentMetrics[0].propsSize).toBe(1024);
  });

  it('should record API call performance', () => {
    monitor.recordApiCall('/api/test', 'GET', 200, true, false);

    const apiMetrics = monitor.getApiMetrics('/api/test');
    expect(apiMetrics).toHaveLength(1);
    expect(apiMetrics[0].responseTime).toBe(200);
    expect(apiMetrics[0].success).toBe(true);
    expect(apiMetrics[0].cacheHit).toBe(false);
  });

  it('should calculate performance statistics correctly', () => {
    // Add some test data
    monitor.recordRender('Component1', 100);
    monitor.recordRender('Component2', 200);
    monitor.recordApiCall('/api/test1', 'GET', 150, true, false);
    monitor.recordApiCall('/api/test2', 'GET', 250, true, true);

    const stats = monitor.getStats();
    expect(stats.averageRenderTime).toBe(150); // (100 + 200) / 2
    expect(stats.averageApiResponseTime).toBe(200); // (150 + 250) / 2
    expect(stats.totalApiCalls).toBe(2);
    expect(stats.cacheHitRate).toBe(0.5); // 1 cache hit out of 2 calls
  });

  it('should time async operations', async () => {
    mockPerformanceNow
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1100); // End time

    const asyncOperation = async () => {
      return 'result';
    };

    const result = await monitor.timeAsync('test-operation', asyncOperation);
    
    expect(result).toBe('result');
    
    const metrics = monitor.getRecentMetrics(1);
    expect(metrics[0].name).toBe('test-operation');
    expect(metrics[0].value).toBe(100); // 1100 - 1000
    expect(metrics[0].metadata?.success).toBe(true);
  });

  it('should handle async operation errors', async () => {
    mockPerformanceNow
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1050); // End time

    const failingOperation = async () => {
      throw new Error('Test error');
    };

    await expect(monitor.timeAsync('failing-operation', failingOperation))
      .rejects.toThrow('Test error');
    
    const metrics = monitor.getRecentMetrics(1);
    expect(metrics[0].name).toBe('failing-operation');
    expect(metrics[0].value).toBe(50);
    expect(metrics[0].metadata?.success).toBe(false);
    expect(metrics[0].metadata?.error).toBe('Test error');
  });

  it('should not record metrics when disabled', () => {
    monitor.setEnabled(false);
    monitor.recordMetric('test-metric', 100);

    const metrics = monitor.getRecentMetrics();
    expect(metrics).toHaveLength(0);
  });
});

describe('useOptimizedRiskProfile', () => {
  it('should export the hook function', () => {
    expect(typeof useOptimizedRiskProfile).toBe('function');
  });

  it('should create cache keys correctly', () => {
    const customerData = {
      phone: '+1234567890',
      email: 'test@example.com',
      orderId: 'order-123',
      checkoutToken: 'checkout-token',
    };

    const cacheKey = createCacheKey('risk-profile', {
      phone: customerData.phone || '',
      email: customerData.email || '',
      orderId: customerData.orderId || '',
    });

    expect(typeof cacheKey).toBe('string');
    expect(cacheKey).toContain('risk-profile');
  });

  it('should handle cache operations', () => {
    const testData = { test: 'hook data' };
    const cacheKey = 'test-hook-key';
    
    extensionCache.set(cacheKey, testData);
    const retrieved = extensionCache.get(cacheKey);
    
    expect(retrieved).toEqual(testData);
    
    extensionCache.delete(cacheKey);
    const afterDelete = extensionCache.get(cacheKey);
    
    expect(afterDelete).toBeNull();
  });
});

describe('Global Performance Integration', () => {
  beforeEach(() => {
    globalPerformanceMonitor.clear();
    extensionCache.clear();
  });

  it('should integrate cache and performance monitoring', () => {
    const testData = { test: 'performance data' };
    
    // Enable performance monitoring for this test
    globalPerformanceMonitor.setEnabled(true);
    
    // Simulate cache miss
    extensionCache.get('test-key'); // miss
    
    // Simulate cache hit
    extensionCache.set('test-key', testData);
    extensionCache.get('test-key'); // hit

    // Record API performance
    globalPerformanceMonitor.recordApiCall('/api/test', 'GET', 100, true, false);
    globalPerformanceMonitor.recordApiCall('/api/test', 'GET', 5, true, true); // Cache hit

    const cacheMetrics = extensionCache.getMetrics();
    const perfStats = globalPerformanceMonitor.getStats();

    expect(cacheMetrics.hits).toBe(1);
    expect(cacheMetrics.misses).toBe(1);
    expect(perfStats.totalApiCalls).toBe(2);
    expect(perfStats.cacheHitRate).toBe(0.5);
    
    // Cleanup
    globalPerformanceMonitor.setEnabled(false);
  });
});