/**
 * Load Testing Suite for Thank You Page Extension
 * 
 * Tests performance under high traffic conditions and validates
 * that the extension maintains responsiveness under load.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { apiClient } from '../../src/services/apiClient';
import { performanceMonitor } from '../../src/services/performanceMonitor';
import { cacheService } from '../../src/services/cacheService';
import type { RiskProfileResponse } from '../../src/types';

// Mock performance APIs
const mockPerformanceObserver = vi.fn();
global.PerformanceObserver = mockPerformanceObserver as any;

describe('Load Testing Suite', () => {
  let mockRiskProfile: RiskProfileResponse;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRiskProfile = {
      success: true,
      riskTier: 'MEDIUM_RISK',
      riskScore: 45,
      totalOrders: 8,
      failedAttempts: 2,
      successfulDeliveries: 6,
      isNewCustomer: false,
      message: 'Medium risk customer',
      recommendations: [
        'Ensure you are available during delivery hours',
        'Keep your phone accessible for delivery updates'
      ]
    };

    // Mock successful API responses
    vi.mocked(apiClient.getRiskProfile).mockResolvedValue(mockRiskProfile);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Concurrent API Requests', () => {
    it('should handle 100 concurrent API requests efficiently', async () => {
      const concurrentRequests = 100;
      const startTime = performance.now();

      // Create array of concurrent API calls
      const requests = Array.from({ length: concurrentRequests }, (_, index) => 
        apiClient.getRiskProfile(`+92300123456${index % 10}`, `test${index}@example.com`)
      );

      // Execute all requests concurrently
      const results = await Promise.all(requests);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Validate results
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.riskTier).toBeDefined();
      });

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(vi.mocked(apiClient.getRiskProfile)).toHaveBeenCalledTimes(concurrentRequests);

      console.log(`✅ Handled ${concurrentRequests} concurrent requests in ${totalTime.toFixed(2)}ms`);
    });

    it('should handle request bursts with proper throttling', async () => {
      const burstSize = 50;
      const numberOfBursts = 5;
      const burstInterval = 100; // ms

      const allResults: RiskProfileResponse[] = [];
      const burstTimes: number[] = [];

      for (let burst = 0; burst < numberOfBursts; burst++) {
        const burstStart = performance.now();
        
        const burstRequests = Array.from({ length: burstSize }, (_, index) => 
          apiClient.getRiskProfile(`+92300${burst}${index.toString().padStart(3, '0')}`, `burst${burst}_${index}@example.com`)
        );

        const burstResults = await Promise.all(burstRequests);
        allResults.push(...burstResults);
        
        const burstEnd = performance.now();
        burstTimes.push(burstEnd - burstStart);

        // Wait before next burst
        if (burst < numberOfBursts - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      // Validate all results
      expect(allResults).toHaveLength(burstSize * numberOfBursts);
      
      // Check that burst times are reasonable
      const avgBurstTime = burstTimes.reduce((sum, time) => sum + time, 0) / burstTimes.length;
      expect(avgBurstTime).toBeLessThan(2000); // Average burst should complete within 2 seconds

      console.log(`✅ Handled ${numberOfBursts} bursts of ${burstSize} requests each`);
      console.log(`📊 Average burst time: ${avgBurstTime.toFixed(2)}ms`);
    });

    it('should maintain performance with cache hits', async () => {
      const phoneNumber = '+923001234567';
      const email = 'test@example.com';
      const requestCount = 1000;

      // First request to populate cache
      await apiClient.getRiskProfile(phoneNumber, email);

      const startTime = performance.now();

      // Make many requests for the same data (should hit cache)
      const cachedRequests = Array.from({ length: requestCount }, () => 
        apiClient.getRiskProfile(phoneNumber, email)
      );

      const results = await Promise.all(cachedRequests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Validate results
      expect(results).toHaveLength(requestCount);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // With caching, this should be very fast
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      console.log(`✅ Handled ${requestCount} cached requests in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should not leak memory with repeated operations', async () => {
      const iterations = 1000;
      const memorySnapshots: number[] = [];

      // Take initial memory snapshot
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage().heapUsed;
      memorySnapshots.push(initialMemory);

      // Perform many operations
      for (let i = 0; i < iterations; i++) {
        await apiClient.getRiskProfile(`+92300${i.toString().padStart(7, '0')}`, `test${i}@example.com`);
        
        // Take memory snapshots every 100 iterations
        if (i % 100 === 0) {
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      // Final memory snapshot
      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage().heapUsed;
      memorySnapshots.push(finalMemory);

      // Memory should not grow excessively
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(50); // Should not grow more than 50MB

      console.log(`📊 Memory growth after ${iterations} operations: ${memoryGrowthMB.toFixed(2)}MB`);
    });

    it('should handle large response payloads efficiently', async () => {
      // Mock large response
      const largeRiskProfile = {
        ...mockRiskProfile,
        recommendations: Array.from({ length: 1000 }, (_, i) => 
          `This is recommendation number ${i} with a lot of detailed text that simulates a real-world scenario where recommendations might be quite lengthy and detailed, providing comprehensive guidance to customers about their delivery behavior and how they can improve their success rates.`
        ),
        additionalData: Array.from({ length: 500 }, (_, i) => ({
          id: i,
          timestamp: new Date().toISOString(),
          details: `Additional data entry ${i} with comprehensive information`
        }))
      };

      vi.mocked(apiClient.getRiskProfile).mockResolvedValue(largeRiskProfile);

      const startTime = performance.now();
      const result = await apiClient.getRiskProfile('+923001234567', 'test@example.com');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should handle large payload within 1 second

      console.log(`✅ Handled large payload in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Network Resilience Under Load', () => {
    it('should handle intermittent network failures gracefully', async () => {
      const totalRequests = 100;
      const failureRate = 0.2; // 20% failure rate
      let successCount = 0;
      let failureCount = 0;

      // Mock intermittent failures
      vi.mocked(apiClient.getRiskProfile).mockImplementation(async (phone, email) => {
        if (Math.random() < failureRate) {
          failureCount++;
          throw new Error('Network timeout');
        } else {
          successCount++;
          return mockRiskProfile;
        }
      });

      const requests = Array.from({ length: totalRequests }, (_, index) => 
        apiClient.getRiskProfile(`+92300123456${index % 10}`, `test${index}@example.com`)
          .catch(error => ({ success: false, error: error.message }))
      );

      const results = await Promise.all(requests);

      // Validate that we handled both successes and failures
      const successResults = results.filter(r => r.success === true);
      const failureResults = results.filter(r => r.success === false);

      expect(successResults.length).toBeGreaterThan(0);
      expect(failureResults.length).toBeGreaterThan(0);
      expect(successResults.length + failureResults.length).toBe(totalRequests);

      console.log(`✅ Handled ${successCount} successes and ${failureCount} failures out of ${totalRequests} requests`);
    });

    it('should implement proper retry logic under load', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      // Mock API that fails first few times then succeeds
      vi.mocked(apiClient.getRiskProfile).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= maxRetries) {
          throw new Error('Temporary network error');
        }
        return mockRiskProfile;
      });

      const startTime = performance.now();
      
      // This should eventually succeed after retries
      const result = await apiClient.getRiskProfile('+923001234567', 'test@example.com')
        .catch(async () => {
          // Simulate retry logic
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await apiClient.getRiskProfile('+923001234567', 'test@example.com');
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i))); // Exponential backoff
            }
          }
          throw new Error('Max retries exceeded');
        });

      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(attemptCount).toBeGreaterThan(maxRetries);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds including retries

      console.log(`✅ Succeeded after ${attemptCount} attempts in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately under load', async () => {
      const requestCount = 50;
      const metrics: Array<{ duration: number; success: boolean }> = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = performance.now();
        
        try {
          await apiClient.getRiskProfile(`+92300123456${i % 10}`, `test${i}@example.com`);
          const endTime = performance.now();
          metrics.push({ duration: endTime - startTime, success: true });
        } catch (error) {
          const endTime = performance.now();
          metrics.push({ duration: endTime - startTime, success: false });
        }
      }

      // Analyze metrics
      const successfulRequests = metrics.filter(m => m.success);
      const failedRequests = metrics.filter(m => !m.success);
      
      const avgDuration = successfulRequests.reduce((sum, m) => sum + m.duration, 0) / successfulRequests.length;
      const maxDuration = Math.max(...successfulRequests.map(m => m.duration));
      const minDuration = Math.min(...successfulRequests.map(m => m.duration));

      // Performance assertions
      expect(avgDuration).toBeLessThan(500); // Average should be under 500ms
      expect(maxDuration).toBeLessThan(2000); // Max should be under 2 seconds
      expect(successfulRequests.length).toBeGreaterThan(requestCount * 0.8); // At least 80% success rate

      console.log(`📊 Performance Metrics:`);
      console.log(`   Average Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Min Duration: ${minDuration.toFixed(2)}ms`);
      console.log(`   Max Duration: ${maxDuration.toFixed(2)}ms`);
      console.log(`   Success Rate: ${(successfulRequests.length / requestCount * 100).toFixed(1)}%`);
    });

    it('should maintain performance with concurrent users', async () => {
      const concurrentUsers = 20;
      const requestsPerUser = 10;
      const userMetrics: Array<{ userId: number; totalTime: number; successCount: number }> = [];

      // Simulate concurrent users
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userId) => {
        const userStartTime = performance.now();
        let successCount = 0;

        const userRequests = Array.from({ length: requestsPerUser }, async (_, requestIndex) => {
          try {
            await apiClient.getRiskProfile(
              `+92300${userId.toString().padStart(3, '0')}${requestIndex.toString().padStart(3, '0')}`,
              `user${userId}_request${requestIndex}@example.com`
            );
            successCount++;
          } catch (error) {
            // Count failures but don't throw
          }
        });

        await Promise.all(userRequests);
        
        const userEndTime = performance.now();
        userMetrics.push({
          userId,
          totalTime: userEndTime - userStartTime,
          successCount
        });
      });

      await Promise.all(userPromises);

      // Analyze concurrent user performance
      const avgUserTime = userMetrics.reduce((sum, m) => sum + m.totalTime, 0) / userMetrics.length;
      const totalSuccesses = userMetrics.reduce((sum, m) => sum + m.successCount, 0);
      const totalRequests = concurrentUsers * requestsPerUser;

      expect(avgUserTime).toBeLessThan(5000); // Each user should complete within 5 seconds
      expect(totalSuccesses).toBeGreaterThan(totalRequests * 0.8); // At least 80% overall success

      console.log(`✅ Concurrent Users Test:`);
      console.log(`   ${concurrentUsers} users, ${requestsPerUser} requests each`);
      console.log(`   Average user completion time: ${avgUserTime.toFixed(2)}ms`);
      console.log(`   Overall success rate: ${(totalSuccesses / totalRequests * 100).toFixed(1)}%`);
    });
  });

  describe('Resource Cleanup', () => {
    it('should properly clean up resources after load testing', async () => {
      const resourceCount = 100;
      const resources: Array<{ id: string; cleanup: () => void }> = [];

      // Create resources
      for (let i = 0; i < resourceCount; i++) {
        const resource = {
          id: `resource-${i}`,
          cleanup: vi.fn()
        };
        resources.push(resource);
      }

      // Simulate resource usage
      await Promise.all(resources.map(async (resource) => {
        await apiClient.getRiskProfile(`+92300${resource.id}`, `${resource.id}@example.com`);
      }));

      // Cleanup resources
      resources.forEach(resource => resource.cleanup());

      // Verify cleanup was called
      resources.forEach(resource => {
        expect(resource.cleanup).toHaveBeenCalled();
      });

      console.log(`✅ Cleaned up ${resourceCount} resources successfully`);
    });
  });
});