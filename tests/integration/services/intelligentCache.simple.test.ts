import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntelligentCache } from '../../../app/services/intelligentCache.server';

describe('IntelligentCache Simple Integration Tests', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache({
      defaultTTL: 10000, // 10 seconds
      maxSize: 100,
      backgroundRefreshThreshold: 0.3,
      compressionEnabled: true,
      compressionThreshold: 500,
      maxMemoryUsage: 5 * 1024 * 1024, // 5MB
      cleanupInterval: 2000 // 2 seconds
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle customer profile caching scenario', async () => {
      // Simulate customer profile data
      const customerProfiles = Array.from({ length: 50 }, (_, i) => ({
        id: `customer-${i}`,
        profile: {
          phone: `+92300000${i.toString().padStart(4, '0')}`,
          email: `customer${i}@example.com`,
          riskScore: Math.random() * 100,
          orderHistory: Array.from({ length: 10 }, (_, j) => ({
            orderId: `order-${i}-${j}`,
            amount: Math.random() * 1000,
            status: ['completed', 'returned', 'cancelled'][Math.floor(Math.random() * 3)]
          })),
          metadata: {
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            tags: ['customer', 'profile', 'risk-assessment']
          }
        }
      }));

      // Store all profiles
      for (const customer of customerProfiles) {
        await cache.set(`customer:${customer.id}`, customer.profile);
      }

      // Simulate access patterns - some customers accessed more frequently
      const frequentCustomers = customerProfiles.slice(0, 10);
      for (let round = 0; round < 5; round++) {
        for (const customer of frequentCustomers) {
          const retrieved = cache.get(`customer:${customer.id}`);
          expect(retrieved).toEqual(customer.profile);
        }
      }

      // Check cache statistics
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(50);
      expect(stats.hitCount).toBe(50); // 10 customers × 5 rounds
      expect(stats.hitRate).toBe(1.0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle order data caching with compression', async () => {
      // Create large order objects that should trigger compression
      const largeOrders = Array.from({ length: 20 }, (_, i) => ({
        orderId: `order-${i}`,
        customerInfo: {
          name: `Customer ${i}`,
          address: `Address line 1 for customer ${i}, Address line 2 with more details, City, Province, Country`,
          phone: `+92300000${i.toString().padStart(4, '0')}`,
          email: `customer${i}@example.com`
        },
        items: Array.from({ length: 15 }, (_, j) => ({
          productId: `product-${j}`,
          name: `Product ${j} with a very long descriptive name that includes many details about the product`,
          description: `This is a detailed description of product ${j} that contains a lot of text to make the object larger and trigger compression. It includes features, specifications, and other relevant information.`,
          price: Math.random() * 500,
          quantity: Math.floor(Math.random() * 5) + 1,
          category: `Category ${j % 5}`,
          tags: [`tag-${j}`, `category-${j % 5}`, 'product', 'item']
        })),
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'shopify',
          notes: 'This order contains additional metadata and notes that add to the overall size of the object for compression testing purposes.'
        }
      }));

      // Store all orders
      for (const order of largeOrders) {
        await cache.set(`order:${order.orderId}`, order);
      }

      // Verify compression was applied to large objects
      let compressedCount = 0;
      for (const order of largeOrders) {
        const entryInfo = cache.getEntryInfo(`order:${order.orderId}`);
        if (entryInfo?.compressed) {
          compressedCount++;
          expect(entryInfo.compressedSize).toBeLessThan(entryInfo.originalSize || 0);
        }
      }

      expect(compressedCount).toBeGreaterThan(0);

      // Verify all data can be retrieved correctly
      for (const order of largeOrders) {
        const retrieved = cache.get(`order:${order.orderId}`);
        expect(retrieved).toEqual(order);
      }

      const stats = cache.getStats();
      expect(stats.compressionRatio).toBeLessThan(1);
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle memory pressure with intelligent eviction', async () => {
      // Create cache with very limited memory and size
      const limitedCache = new IntelligentCache({
        maxMemoryUsage: 50 * 1024, // 50KB
        maxSize: 50, // Small size limit
        compressionEnabled: true,
        compressionThreshold: 100
      });

      try {
        // Create objects of varying sizes and access patterns
        const smallObjects = Array.from({ length: 50 }, (_, i) => ({
          key: `small:${i}`,
          data: { id: i, type: 'small', content: 'x'.repeat(50) }
        }));

        const mediumObjects = Array.from({ length: 20 }, (_, i) => ({
          key: `medium:${i}`,
          data: { id: i, type: 'medium', content: 'y'.repeat(500) }
        }));

        const largeObjects = Array.from({ length: 10 }, (_, i) => ({
          key: `large:${i}`,
          data: { id: i, type: 'large', content: 'z'.repeat(2000) }
        }));

        // Store all objects
        for (const obj of [...smallObjects, ...mediumObjects, ...largeObjects]) {
          await limitedCache.set(obj.key, obj.data);
        }

        // Access small objects frequently to make them "hot"
        for (let round = 0; round < 5; round++) {
          for (const obj of smallObjects.slice(0, 10)) {
            limitedCache.get(obj.key);
          }
        }

        // Add more large objects to trigger memory pressure
        for (let i = 10; i < 20; i++) {
          await limitedCache.set(`large:${i}`, {
            id: i,
            type: 'large',
            content: 'z'.repeat(2000)
          });
        }

        const stats = limitedCache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);
        expect(stats.memoryUsage).toBeLessThanOrEqual(50 * 1024);

        // Check that some objects are still present (cache is working)
        let objectsStillPresent = 0;
        for (const obj of [...smallObjects, ...mediumObjects, ...largeObjects]) {
          if (limitedCache.get(obj.key)) {
            objectsStillPresent++;
          }
        }
        expect(objectsStillPresent).toBeGreaterThan(0); // At least some objects should remain

      } finally {
        limitedCache.destroy();
      }
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentOperations = 100;
      const dataSize = 1000;

      // Prepare test data
      const testData = Array.from({ length: dataSize }, (_, i) => ({
        key: `concurrent:${i}`,
        value: {
          id: i,
          timestamp: Date.now(),
          payload: `data-${i}`.repeat(10)
        }
      }));

      // Concurrent writes
      const writePromises = testData.map(({ key, value }) =>
        cache.set(key, value)
      );

      const writeStart = Date.now();
      await Promise.all(writePromises);
      const writeTime = Date.now() - writeStart;

      // Concurrent reads
      const readPromises = Array.from({ length: concurrentOperations }, () => {
        const randomKey = `concurrent:${Math.floor(Math.random() * dataSize)}`;
        return cache.get(randomKey);
      });

      const readStart = Date.now();
      const readResults = await Promise.all(readPromises);
      const readTime = Date.now() - readStart;

      // Verify results
      const successfulReads = readResults.filter(result => result !== null).length;
      expect(successfulReads).toBeGreaterThan(concurrentOperations * 0.8); // At least 80% success

      // Performance expectations (adjust based on system capabilities)
      expect(writeTime).toBeLessThan(5000); // 5 seconds for 1000 writes
      expect(readTime).toBeLessThan(1000);  // 1 second for 100 reads

      const stats = cache.getStats();
      expect(stats.averageAccessTime).toBeLessThan(50); // Less than 50ms average
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for typical operations', async () => {
      const iterations = 1000;
      const testData = { benchmark: true, data: 'x'.repeat(100) };

      // Benchmark set operations
      const setStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await cache.set(`benchmark:set:${i}`, { ...testData, id: i });
      }
      const setTime = Date.now() - setStart;
      const setOpsPerSecond = (iterations / setTime) * 1000;

      // Benchmark get operations
      const getStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        cache.get(`benchmark:set:${i}`);
      }
      const getTime = Date.now() - getStart;
      const getOpsPerSecond = (iterations / getTime) * 1000;

      // Performance expectations (adjust based on system capabilities)
      expect(setOpsPerSecond).toBeGreaterThan(100); // At least 100 sets per second
      expect(getOpsPerSecond).toBeGreaterThan(1000); // At least 1000 gets per second

      console.log(`Cache Performance: ${setOpsPerSecond.toFixed(0)} sets/sec, ${getOpsPerSecond.toFixed(0)} gets/sec`);
    });

    it('should maintain performance with large cache sizes', async () => {
      const largeSize = 5000;
      const testData = { performance: 'test', size: 'large' };

      // Fill cache with large number of entries
      for (let i = 0; i < largeSize; i++) {
        await cache.set(`large-cache:${i}`, { ...testData, id: i });
      }

      // Measure access time for random entries
      const accessTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const randomKey = `large-cache:${Math.floor(Math.random() * largeSize)}`;
        const start = Date.now();
        cache.get(randomKey);
        accessTimes.push(Date.now() - start);
      }

      const averageAccessTime = accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length;
      const maxAccessTime = Math.max(...accessTimes);

      // Performance should not degrade significantly with size
      expect(averageAccessTime).toBeLessThan(10); // Less than 10ms average
      expect(maxAccessTime).toBeLessThan(50);     // Less than 50ms maximum
    });
  });
});