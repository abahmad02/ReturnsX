import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { performanceMetrics } from '../../../app/services/performanceMetrics.server';

describe('PerformanceMetricsCollector', () => {
  beforeEach(() => {
    performanceMetrics.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordApiCall', () => {
    it('should record API call metrics', () => {
      const endpoint = '/api/test';
      const responseTime = 150;
      const status = 200;
      const cacheHit = true;
      
      performanceMetrics.recordApiCall(endpoint, responseTime, status, cacheHit);
      
      const metrics = performanceMetrics.getMetrics(endpoint);
      expect(metrics).toHaveLength(1);
      
      const metric = metrics[0];
      expect(metric.endpoint).toBe(endpoint);
      expect(metric.totalRequests).toBe(1);
      expect(metric.successfulRequests).toBe(1);
      expect(metric.failedRequests).toBe(0);
      expect(metric.averageResponseTime).toBe(responseTime);
      expect(metric.cacheHitRate).toBe(1);
      expect(metric.errorRate).toBe(0);
    });

    it('should record failed API calls', () => {
      const endpoint = '/api/test';
      const responseTime = 5000;
      const status = 500;
      const cacheHit = false;
      const errorType = 'DATABASE_ERROR';
      
      performanceMetrics.recordApiCall(endpoint, responseTime, status, cacheHit, errorType);
      
      const metrics = performanceMetrics.getMetrics(endpoint);
      expect(metrics).toHaveLength(1);
      
      const metric = metrics[0];
      expect(metric.totalRequests).toBe(1);
      expect(metric.successfulRequests).toBe(0);
      expect(metric.failedRequests).toBe(1);
      expect(metric.errorRate).toBe(1);
      expect(metric.cacheHitRate).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      const endpoint = '/api/test';
      const responseTimes = [100, 150, 200, 250, 300, 400, 500, 600, 700, 1000];
      
      // Record multiple calls with different response times
      responseTimes.forEach(time => {
        performanceMetrics.recordApiCall(endpoint, time, 200, false);
      });
      
      const metrics = performanceMetrics.getMetrics(endpoint);
      const metric = metrics[0];
      
      expect(metric.totalRequests).toBe(10);
      expect(metric.averageResponseTime).toBe(420); // Average of response times
      expect(metric.p95ResponseTime).toBeGreaterThan(metric.averageResponseTime);
      expect(metric.p99ResponseTime).toBeGreaterThanOrEqual(metric.p95ResponseTime);
    });

    it('should track circuit breaker trips', () => {
      const endpoint = '/api/test';
      
      // Record some circuit breaker errors
      performanceMetrics.recordApiCall(endpoint, 0, 503, false, 'CIRCUIT_BREAKER_ERROR');
      performanceMetrics.recordApiCall(endpoint, 0, 503, false, 'CIRCUIT_BREAKER_ERROR');
      performanceMetrics.recordApiCall(endpoint, 200, 200, false);
      
      const metrics = performanceMetrics.getMetrics(endpoint);
      const metric = metrics[0];
      
      expect(metric.circuitBreakerTrips).toBe(2);
      expect(metric.totalRequests).toBe(3);
      expect(metric.failedRequests).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for specific endpoint', () => {
      performanceMetrics.recordApiCall('/api/endpoint1', 100, 200, true);
      performanceMetrics.recordApiCall('/api/endpoint2', 200, 200, false);
      
      const endpoint1Metrics = performanceMetrics.getMetrics('/api/endpoint1');
      expect(endpoint1Metrics).toHaveLength(1);
      expect(endpoint1Metrics[0].endpoint).toBe('/api/endpoint1');
      
      const endpoint2Metrics = performanceMetrics.getMetrics('/api/endpoint2');
      expect(endpoint2Metrics).toHaveLength(1);
      expect(endpoint2Metrics[0].endpoint).toBe('/api/endpoint2');
    });

    it('should return all metrics when no endpoint specified', () => {
      performanceMetrics.recordApiCall('/api/endpoint1', 100, 200, true);
      performanceMetrics.recordApiCall('/api/endpoint2', 200, 200, false);
      
      const allMetrics = performanceMetrics.getMetrics();
      expect(allMetrics).toHaveLength(2);
      
      const endpoints = allMetrics.map(m => m.endpoint);
      expect(endpoints).toContain('/api/endpoint1');
      expect(endpoints).toContain('/api/endpoint2');
    });

    it('should return empty array for non-existent endpoint', () => {
      const metrics = performanceMetrics.getMetrics('/api/nonexistent');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health metrics', () => {
      // Record some API calls
      performanceMetrics.recordApiCall('/api/test', 100, 200, true);
      performanceMetrics.recordApiCall('/api/test', 200, 200, false);
      performanceMetrics.recordApiCall('/api/test', 300, 500, false);
      
      const health = performanceMetrics.getSystemHealth();
      
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeDefined();
      expect(health.totalRequests).toBe(3);
      expect(health.averageResponseTime).toBe(200); // (100 + 200 + 300) / 3
      expect(health.errorRate).toBe(1/3); // 1 error out of 3 requests
      expect(health.cacheHitRate).toBe(1/3); // 1 cache hit out of 3 requests
    });

    it('should handle empty metrics gracefully', () => {
      const health = performanceMetrics.getSystemHealth();
      
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeDefined();
      expect(health.totalRequests).toBe(0);
      expect(health.averageResponseTime).toBe(0);
      expect(health.errorRate).toBe(0);
      expect(health.cacheHitRate).toBe(0);
    });
  });

  describe('getEndpointAnalysis', () => {
    it('should analyze endpoint request patterns', () => {
      const endpoint = '/api/test';
      
      // Create some test data with different timestamps
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      // Record calls at different hours
      performanceMetrics.recordApiCall(endpoint, 100, 200, true);
      performanceMetrics.recordApiCall(endpoint, 200, 200, false);
      performanceMetrics.recordApiCall(endpoint, 500, 500, false, 'TIMEOUT_ERROR');
      
      const analysis = performanceMetrics.getEndpointAnalysis(endpoint);
      
      expect(analysis.requestPattern).toBeDefined();
      expect(analysis.errorDistribution).toBeDefined();
      expect(analysis.responseTimeDistribution).toBeDefined();
      
      // Check error distribution
      expect(analysis.errorDistribution).toHaveLength(1);
      expect(analysis.errorDistribution[0].errorType).toBe('TIMEOUT_ERROR');
      expect(analysis.errorDistribution[0].count).toBe(1);
      
      // Check response time distribution
      expect(analysis.responseTimeDistribution).toBeDefined();
      const fastRequests = analysis.responseTimeDistribution.find(d => d.range === '0-100ms');
      const mediumRequests = analysis.responseTimeDistribution.find(d => d.range === '100-200ms');
      const slowRequests = analysis.responseTimeDistribution.find(d => d.range === '500ms-1s');
      
      expect(fastRequests?.count).toBe(0); // No requests < 100ms
      expect(mediumRequests?.count).toBe(1); // 100ms only (200ms goes to 200-500ms range)
      expect(slowRequests?.count).toBe(1); // 500ms
    });

    it('should handle endpoints with no data', () => {
      const analysis = performanceMetrics.getEndpointAnalysis('/api/nonexistent');
      
      expect(analysis.requestPattern).toHaveLength(0);
      expect(analysis.errorDistribution).toHaveLength(0);
      expect(analysis.responseTimeDistribution.every(d => d.count === 0)).toBe(true);
    });
  });

  describe('getPerformanceSnapshots', () => {
    it('should return performance snapshots', () => {
      // Record some data to generate snapshots
      performanceMetrics.recordApiCall('/api/test', 100, 200, true);
      
      // Wait a bit for snapshot collection (mocked)
      const snapshots = performanceMetrics.getPerformanceSnapshots(10);
      
      expect(Array.isArray(snapshots)).toBe(true);
      // Snapshots are collected periodically, so might be empty in tests
    });

    it('should limit snapshots to requested count', () => {
      const snapshots = performanceMetrics.getPerformanceSnapshots(5);
      expect(snapshots.length).toBeLessThanOrEqual(5);
    });
  });

  describe('time window filtering', () => {
    it('should only include recent data in metrics', () => {
      const endpoint = '/api/test';
      const now = Date.now();
      const oldTime = now - (10 * 60 * 1000); // 10 minutes ago
      
      // Mock Date.now to simulate old requests
      vi.spyOn(Date, 'now').mockReturnValueOnce(oldTime);
      performanceMetrics.recordApiCall(endpoint, 100, 200, true);
      
      // Reset to current time
      vi.spyOn(Date, 'now').mockReturnValue(now);
      performanceMetrics.recordApiCall(endpoint, 200, 200, false);
      
      const metrics = performanceMetrics.getMetrics(endpoint);
      
      // Should only include recent request (within 5-minute window)
      expect(metrics[0].totalRequests).toBe(1);
      expect(metrics[0].averageResponseTime).toBe(200);
    });
  });

  describe('reset', () => {
    it('should reset all metrics and data', () => {
      // Record some data
      performanceMetrics.recordApiCall('/api/test', 100, 200, true);
      
      expect(performanceMetrics.getMetrics()).toHaveLength(1);
      
      performanceMetrics.reset();
      
      expect(performanceMetrics.getMetrics()).toHaveLength(0);
      
      const health = performanceMetrics.getSystemHealth();
      expect(health.totalRequests).toBe(0);
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent API call recording', () => {
      const endpoint = '/api/test';
      const promises = [];
      
      // Simulate concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            performanceMetrics.recordApiCall(endpoint, 100 + i * 10, 200, i % 2 === 0);
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        const metrics = performanceMetrics.getMetrics(endpoint);
        expect(metrics[0].totalRequests).toBe(10);
        expect(metrics[0].cacheHitRate).toBe(0.5); // Every other request was a cache hit
      });
    });
  });
});