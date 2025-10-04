import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loader as getOrderDataLoader } from '~/routes/api.get-order-data';
import { PerformanceMetrics } from '~/services/performanceMetrics.server';
import { IntelligentCache } from '~/services/intelligentCache.server';
import { DatabaseQueryOptimizer } from '~/services/databaseQueryOptimizer.server';

/**
 * Performance Benchmark Test Suite
 * 
 * Validates that the API optimization meets performance targets:
 * - 95% of requests complete under 200ms
 * - System handles concurrent load effectively
 * - Cache hit rates meet expectations
 * - Database query optimization is effective
 */

describe('Performance Benchmark Tests', () => {
  let metrics: PerformanceMetrics;
  let cache: IntelligentCache;
  let queryOptimizer: DatabaseQueryOptimizer;

  beforeAll(async () => {
    metrics = new PerformanceMetrics();
    cache = new IntelligentCache({
      defaultTTL: 300000,
      maxSize: 1000,
      backgroundRefreshThreshold: 0.8,
      compressionEnabled: true
    });
    queryOptimizer = new DatabaseQueryOptimizer();
  });

  afterAll(async () => {
    await cache.clear();
  });

  describe('Response Time Performance', () => {
    it('should meet 95% response time target under 200ms', async () => {
      const testCount = 100;
      const responseTimes: number[] = [];
      
      console.log(`Running ${testCount} requests to measure response times...`);
      
      for (let i = 0; i < testCount; i++) {
        const request = new Request(
          `http://localhost:3000/api/get-order-data?phone=%2B92300${i.toString().padStart(7, '0')}&orderName=PERF${i}`
        );
        
        const startTime = performance.now();
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);
        
        // Validate response is successful
        expect([200, 404]).toContain(response.status);
      }
      
      // Calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(testCount * 0.5)];
      const p95 = responseTimes[Math.floor(testCount * 0.95)];
      const p99 = responseTimes[Math.floor(testCount * 0.99)];
      const avg = responseTimes.reduce((sum, time) => sum + time, 0) / testCount;
      const max = Math.max(...responseTimes);
      const min = Math.min(...responseTimes);
      
      console.log(`Performance Results:
        - Average: ${avg.toFixed(2)}ms
        - 50th percentile: ${p50.toFixed(2)}ms
        - 95th percentile: ${p95.toFixed(2)}ms
        - 99th percentile: ${p99.toFixed(2)}ms
        - Min: ${min.toFixed(2)}ms
        - Max: ${max.toFixed(2)}ms
      `);
      
      // Validate 95% target
      expect(p95).toBeLessThan(200);
      
      // Additional performance expectations
      expect(avg).toBeLessThan(150); // Average should be well under target
      expect(p50).toBeLessThan(100); // Median should be very fast
    });

    it('should maintain performance with cache warming', async () => {
      const testPhone = '+923001234567';
      const testOrder = 'CACHE_WARM_001';
      
      // First request (cache miss)
      const coldRequest = new Request(
        `http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=${testOrder}`
      );
      
      const coldStart = performance.now();
      const coldResponse = await getOrderDataLoader({ request: coldRequest, params: {}, context: {} });
      const coldTime = performance.now() - coldStart;
      
      // Second request (cache hit)
      const warmRequest = new Request(
        `http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=${testOrder}`
      );
      
      const warmStart = performance.now();
      const warmResponse = await getOrderDataLoader({ request: warmRequest, params: {}, context: {} });
      const warmTime = performance.now() - warmStart;
      
      console.log(`Cache Performance:
        - Cold request: ${coldTime.toFixed(2)}ms
        - Warm request: ${warmTime.toFixed(2)}ms
        - Improvement: ${((coldTime - warmTime) / coldTime * 100).toFixed(1)}%
      `);
      
      // Cache hit should be significantly faster
      expect(warmTime).toBeLessThan(coldTime * 0.5);
      expect(warmTime).toBeLessThan(50); // Cache hits should be very fast
      
      // Both responses should be identical
      expect(coldResponse.status).toBe(warmResponse.status);
    });
  });

  describe('Concurrent Load Performance', () => {
    it('should handle moderate concurrent load (50 users)', async () => {
      const concurrentUsers = 50;
      const requestsPerUser = 3;
      
      console.log(`Testing concurrent load: ${concurrentUsers} users, ${requestsPerUser} requests each`);
      
      const startTime = performance.now();
      
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userId) => {
        const userResponseTimes: number[] = [];
        
        for (let reqId = 0; reqId < requestsPerUser; reqId++) {
          const request = new Request(
            `http://localhost:3000/api/get-order-data?phone=%2B92300${userId.toString().padStart(7, '0')}&orderName=LOAD${reqId}`
          );
          
          const reqStart = performance.now();
          const response = await getOrderDataLoader({ request, params: {}, context: {} });
          const reqTime = performance.now() - reqStart;
          
          userResponseTimes.push(reqTime);
          
          expect([200, 404]).toContain(response.status);
        }
        
        return userResponseTimes;
      });
      
      const allResponseTimes = (await Promise.all(userPromises)).flat();
      const totalTime = performance.now() - startTime;
      
      // Calculate metrics
      const totalRequests = concurrentUsers * requestsPerUser;
      const avgResponseTime = allResponseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
      const throughput = (totalRequests / totalTime) * 1000; // requests per second
      
      allResponseTimes.sort((a, b) => a - b);
      const p95ResponseTime = allResponseTimes[Math.floor(totalRequests * 0.95)];
      
      console.log(`Concurrent Load Results:
        - Total Requests: ${totalRequests}
        - Total Time: ${totalTime.toFixed(2)}ms
        - Throughput: ${throughput.toFixed(2)} req/sec
        - Average Response Time: ${avgResponseTime.toFixed(2)}ms
        - 95th Percentile: ${p95ResponseTime.toFixed(2)}ms
      `);
      
      // Performance expectations under load
      expect(p95ResponseTime).toBeLessThan(500); // Allow higher latency under load
      expect(throughput).toBeGreaterThan(20); // Minimum throughput
      expect(avgResponseTime).toBeLessThan(300);
    });

    it('should handle burst traffic patterns', async () => {
      const burstSize = 20;
      const burstCount = 3;
      const burstInterval = 1000; // 1 second between bursts
      
      console.log(`Testing burst pattern: ${burstCount} bursts of ${burstSize} requests`);
      
      const allBurstTimes: number[] = [];
      
      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = performance.now();
        
        const burstPromises = Array.from({ length: burstSize }, (_, reqId) => {
          const request = new Request(
            `http://localhost:3000/api/get-order-data?phone=%2B92300${(burst * burstSize + reqId).toString().padStart(7, '0')}&orderName=BURST${burst}_${reqId}`
          );
          
          return getOrderDataLoader({ request, params: {}, context: {} });
        });
        
        const responses = await Promise.all(burstPromises);
        const burstTime = performance.now() - burstStart;
        allBurstTimes.push(burstTime);
        
        // Validate all responses
        responses.forEach(response => {
          expect([200, 404]).toContain(response.status);
        });
        
        console.log(`Burst ${burst + 1}: ${burstTime.toFixed(2)}ms for ${burstSize} requests`);
        
        // Wait between bursts
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }
      
      const avgBurstTime = allBurstTimes.reduce((sum, time) => sum + time, 0) / burstCount;
      const maxBurstTime = Math.max(...allBurstTimes);
      
      console.log(`Burst Test Summary:
        - Average Burst Time: ${avgBurstTime.toFixed(2)}ms
        - Max Burst Time: ${maxBurstTime.toFixed(2)}ms
        - Requests per Burst: ${burstSize}
      `);
      
      // Burst handling expectations
      expect(maxBurstTime).toBeLessThan(2000); // Max 2 seconds for burst
      expect(avgBurstTime).toBeLessThan(1500); // Average under 1.5 seconds
    });
  });

  describe('Database Query Performance', () => {
    it('should optimize customer lookup queries', async () => {
      const testCases = [
        { phone: '+923001234567' },
        { email: 'test@example.com' },
        { phone: '+923001234567', email: 'test@example.com' }
      ];
      
      for (const testCase of testCases) {
        const queryStart = performance.now();
        
        const result = await queryOptimizer.findCustomerByIdentifiers(testCase);
        
        const queryTime = performance.now() - queryStart;
        
        console.log(`Query time for ${JSON.stringify(testCase)}: ${queryTime.toFixed(2)}ms`);
        
        // Database queries should be fast
        expect(queryTime).toBeLessThan(50);
      }
      
      // Validate query optimizer metrics
      const queryMetrics = queryOptimizer.getMetrics();
      expect(queryMetrics.averageQueryTime).toBeLessThan(100);
    });

    it('should handle batch queries efficiently', async () => {
      const batchSize = 10;
      const queries = Array.from({ length: batchSize }, (_, i) => ({
        type: 'customer' as const,
        params: { phone: `+92300123456${i}` },
        priority: 'medium' as const
      }));
      
      const batchStart = performance.now();
      const results = await queryOptimizer.batchQuery(queries);
      const batchTime = performance.now() - batchStart;
      
      console.log(`Batch query time for ${batchSize} queries: ${batchTime.toFixed(2)}ms`);
      
      expect(results).toHaveLength(batchSize);
      expect(batchTime).toBeLessThan(200); // Batch should be efficient
      
      // Average time per query in batch should be better than individual queries
      const avgTimePerQuery = batchTime / batchSize;
      expect(avgTimePerQuery).toBeLessThan(30);
    });
  });

  describe('Cache Performance', () => {
    it('should achieve target cache hit rates', async () => {
      const testRequests = 50;
      const uniqueKeys = 10; // This will create repeated requests
      
      // Generate requests with repeated patterns to test cache effectiveness
      for (let i = 0; i < testRequests; i++) {
        const keyIndex = i % uniqueKeys;
        const request = new Request(
          `http://localhost:3000/api/get-order-data?phone=%2B92300123456${keyIndex}&orderName=CACHE${keyIndex}`
        );
        
        await getOrderDataLoader({ request, params: {}, context: {} });
      }
      
      const cacheStats = cache.getStats();
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      
      console.log(`Cache Performance:
        - Total Requests: ${testRequests}
        - Cache Hits: ${cacheStats.hits}
        - Cache Misses: ${cacheStats.misses}
        - Hit Rate: ${(hitRate * 100).toFixed(1)}%
        - Cache Size: ${cacheStats.size}
      `);
      
      // Cache hit rate should be high for repeated requests
      expect(hitRate).toBeGreaterThan(0.7); // At least 70% hit rate
    });

    it('should handle cache eviction gracefully', async () => {
      // Fill cache beyond capacity
      const cacheCapacity = cache.getConfig().maxSize;
      const overflowRequests = cacheCapacity + 50;
      
      for (let i = 0; i < overflowRequests; i++) {
        const request = new Request(
          `http://localhost:3000/api/get-order-data?phone=%2B92300${i.toString().padStart(7, '0')}&orderName=EVICT${i}`
        );
        
        await getOrderDataLoader({ request, params: {}, context: {} });
      }
      
      const cacheStats = cache.getStats();
      
      console.log(`Cache Eviction Test:
        - Requests Made: ${overflowRequests}
        - Cache Capacity: ${cacheCapacity}
        - Final Cache Size: ${cacheStats.size}
        - Evictions: ${cacheStats.evictions}
      `);
      
      // Cache should not exceed capacity
      expect(cacheStats.size).toBeLessThanOrEqual(cacheCapacity);
      
      // Should have performed evictions
      expect(cacheStats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate sustained load
      const loadRequests = 200;
      for (let i = 0; i < loadRequests; i++) {
        const request = new Request(
          `http://localhost:3000/api/get-order-data?phone=%2B92300${i.toString().padStart(7, '0')}&orderName=MEM${i}`
        );
        
        await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Periodic garbage collection hint
        if (i % 50 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
      };
      
      console.log(`Memory Usage:
        - RSS Increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB
        - Heap Used Increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Heap Total Increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB
      `);
      
      // Memory increase should be reasonable
      expect(memoryIncrease.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });
});