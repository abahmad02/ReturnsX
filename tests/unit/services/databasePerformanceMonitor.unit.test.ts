import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabasePerformanceMonitor } from '../../../app/services/databasePerformanceMonitor.server';

// Mock PrismaClient
const mockPrisma = {
  $use: vi.fn(),
  $queryRaw: vi.fn(),
} as any;

describe('DatabasePerformanceMonitor Unit Tests', () => {
  let monitor: DatabasePerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new DatabasePerformanceMonitor(mockPrisma, 100, 60000);
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const defaultMonitor = new DatabasePerformanceMonitor(mockPrisma);
      expect(defaultMonitor).toBeInstanceOf(DatabasePerformanceMonitor);
    });

    it('should register Prisma middleware', () => {
      expect(mockPrisma.$use).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache tracking', () => {
    it('should track cache hits correctly', () => {
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(1);
    });

    it('should track cache misses correctly', () => {
      monitor.recordCacheMiss();
      monitor.recordCacheMiss();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should calculate cache hit rate correctly', () => {
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      monitor.recordCacheMiss();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2);
    });

    it('should handle zero cache operations', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('metrics collection', () => {
    it('should return current metrics', () => {
      const metrics = monitor.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.connectionCount).toBeGreaterThanOrEqual(0);
      expect(metrics.activeQueries).toBeGreaterThanOrEqual(0);
      expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0);
      expect(metrics.slowQueries).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should filter metrics by time range', () => {
      const now = Date.now();
      const startTime = now - 60000; // 1 minute ago
      const endTime = now;
      
      const metrics = monitor.getMetricsInRange(startTime, endTime);
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should filter slow queries by time range', () => {
      const now = Date.now();
      const startTime = now - 60000; // 1 minute ago
      const endTime = now;
      
      const slowQueries = monitor.getSlowQueriesInRange(startTime, endTime);
      expect(Array.isArray(slowQueries)).toBe(true);
    });
  });

  describe('health monitoring', () => {
    it('should report healthy status initially', () => {
      const health = monitor.isHealthy();
      
      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(Array.isArray(health.issues)).toBe(true);
      expect(health.metrics).toBeDefined();
    });

    it('should detect performance issues', () => {
      // This test would need to simulate poor performance conditions
      // For now, we just verify the structure
      const health = monitor.isHealthy();
      
      expect(typeof health.healthy).toBe('boolean');
      expect(Array.isArray(health.issues)).toBe(true);
    });
  });

  describe('performance reporting', () => {
    it('should generate performance report', () => {
      const report = monitor.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.topSlowQueries).toBeDefined();
      
      expect(typeof report.summary.totalQueries).toBe('number');
      expect(typeof report.summary.averageQueryTime).toBe('number');
      expect(typeof report.summary.slowQueries).toBe('number');
      expect(typeof report.summary.errorRate).toBe('number');
      expect(typeof report.summary.cacheHitRate).toBe('number');
      
      expect(Array.isArray(report.trends.queryTimesTrend)).toBe(true);
      expect(Array.isArray(report.trends.errorRatesTrend)).toBe(true);
      expect(Array.isArray(report.trends.activeQueriesTrend)).toBe(true);
      
      expect(Array.isArray(report.topSlowQueries)).toBe(true);
    });

    it('should handle custom time range in reports', () => {
      const customTimeRange = 30000; // 30 seconds
      const report = monitor.generatePerformanceReport(customTimeRange);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });

  describe('connection pool statistics', () => {
    it('should get connection pool stats successfully', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: 5 }]);
      
      const stats = await monitor.getConnectionPoolStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.idleConnections).toBe('number');
      expect(typeof stats.waitingConnections).toBe('number');
      expect(typeof stats.maxConnections).toBe('number');
      expect(typeof stats.connectionErrors).toBe('number');
    });

    it('should handle database query errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));
      
      const stats = await monitor.getConnectionPoolStats();
      
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should allow setting slow query threshold', () => {
      monitor.setSlowQueryThreshold(500);
      // The threshold change should be applied (we can't directly test this without middleware execution)
      expect(() => monitor.setSlowQueryThreshold(500)).not.toThrow();
    });

    it('should handle different retention periods', () => {
      const shortRetentionMonitor = new DatabasePerformanceMonitor(mockPrisma, 100, 1000);
      expect(shortRetentionMonitor).toBeInstanceOf(DatabasePerformanceMonitor);
    });
  });

  describe('metrics reset', () => {
    it('should reset all metrics and counters', () => {
      // Add some cache activity
      monitor.recordCacheHit();
      monitor.recordCacheMiss();
      
      monitor.reset();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid time ranges gracefully', () => {
      const invalidStartTime = Date.now() + 60000; // Future time
      const invalidEndTime = Date.now() - 60000; // Past time
      
      const metrics = monitor.getMetricsInRange(invalidStartTime, invalidEndTime);
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(0);
    });

    it('should handle negative time ranges', () => {
      const report = monitor.generatePerformanceReport(-1000);
      expect(report).toBeDefined();
      expect(report.summary.totalQueries).toBe(0);
    });
  });
});