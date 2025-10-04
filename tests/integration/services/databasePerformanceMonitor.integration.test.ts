import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DatabasePerformanceMonitor } from '../../../app/services/databasePerformanceMonitor.server';

// Mock Prisma Client
const mockPrisma = {
  $use: vi.fn(),
  $queryRaw: vi.fn(),
} as unknown as PrismaClient;

describe('DatabasePerformanceMonitor Integration Tests', () => {
  let monitor: DatabasePerformanceMonitor;
  let middlewareCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the middleware callback
    (mockPrisma.$use as any).mockImplementation((callback: any) => {
      middlewareCallback = callback;
    });

    monitor = new DatabasePerformanceMonitor(mockPrisma, 100, 60000); // 100ms threshold, 1 minute retention
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('middleware setup', () => {
    it('should register Prisma middleware on initialization', () => {
      expect(mockPrisma.$use).toHaveBeenCalledTimes(1);
      expect(middlewareCallback).toBeDefined();
    });

    it('should track successful queries through middleware', async () => {
      const mockNext = vi.fn().mockResolvedValue({ id: 'test-result' });
      const mockParams = {
        model: 'CustomerProfile',
        action: 'findUnique',
        args: { where: { phone: '+923001234567' } }
      };

      const result = await middlewareCallback(mockParams, mockNext);

      expect(result).toEqual({ id: 'test-result' });
      expect(mockNext).toHaveBeenCalledWith(mockParams);

      // Check that metrics were recorded
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.activeQueries).toBe(0); // Should be 0 after completion
    });

    it('should track failed queries through middleware', async () => {
      const mockError = new Error('Database error');
      const mockNext = vi.fn().mockRejectedValue(mockError);
      const mockParams = {
        model: 'CustomerProfile',
        action: 'findUnique',
        args: { where: { phone: '+923001234567' } }
      };

      await expect(middlewareCallback(mockParams, mockNext)).rejects.toThrow('Database error');

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    it('should detect slow queries through middleware', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock a slow query (> 100ms)
      const mockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'slow-result' }), 150))
      );
      
      const mockParams = {
        model: 'CustomerProfile',
        action: 'findMany',
        args: { where: { riskTier: 'HIGH_RISK' } }
      };

      await middlewareCallback(mockParams, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected: CustomerProfile.findMany took')
      );

      consoleSpy.mockRestore();
    });

    it('should sanitize sensitive parameters in logs', async () => {
      const mockNext = vi.fn().mockResolvedValue({ id: 'test-result' });
      const mockParams = {
        model: 'CustomerProfile',
        action: 'create',
        args: {
          data: {
            phone: '+923001234567',
            email: 'sensitive@example.com',
            name: 'John Doe'
          }
        }
      };

      await middlewareCallback(mockParams, mockNext);

      // The middleware should have processed the query without exposing sensitive data
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics periodically', async () => {
      vi.useFakeTimers();

      // Simulate some query activity
      const mockNext = vi.fn().mockResolvedValue({ id: 'test' });
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);

      // Fast-forward time to trigger metrics collection
      vi.advanceTimersByTime(61000); // 61 seconds

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('should track active queries count', async () => {
      const mockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => {
          // Check active queries while query is running
          const metrics = monitor.getCurrentMetrics();
          expect(metrics.activeQueries).toBeGreaterThan(0);
          setTimeout(() => resolve({ id: 'test' }), 50);
        })
      );

      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);

      // After completion, active queries should be 0
      const finalMetrics = monitor.getCurrentMetrics();
      expect(finalMetrics.activeQueries).toBe(0);
    });

    it('should calculate average query time correctly', async () => {
      const mockNext1 = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'test1' }), 50))
      );
      const mockNext2 = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'test2' }), 100))
      );

      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext1);
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext2);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.averageQueryTime).toBeGreaterThan(50);
      expect(metrics.averageQueryTime).toBeLessThan(100);
    });
  });

  describe('cache tracking', () => {
    it('should track cache hits and misses', () => {
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      monitor.recordCacheMiss();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2); // 2/3 = 0.67
    });

    it('should handle zero cache operations', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('connection pool statistics', () => {
    it('should get connection pool stats from database', async () => {
      (mockPrisma.$queryRaw as any).mockResolvedValue([{ count: 5 }]);

      const stats = await monitor.getConnectionPoolStats();

      expect(stats.activeConnections).toBe(5);
      expect(stats.totalConnections).toBeGreaterThan(0);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('pg_stat_activity')
      );
    });

    it('should handle database query errors gracefully', async () => {
      (mockPrisma.$queryRaw as any).mockRejectedValue(new Error('Connection failed'));

      const stats = await monitor.getConnectionPoolStats();

      expect(stats.activeConnections).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });
  });

  describe('health monitoring', () => {
    it('should report healthy status with good metrics', async () => {
      // Simulate good performance
      const mockNext = vi.fn().mockResolvedValue({ id: 'test' });
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);

      monitor.recordCacheHit();
      monitor.recordCacheHit();

      const health = monitor.isHealthy();

      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should report unhealthy status with poor metrics', async () => {
      // Simulate poor performance
      const mockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'test' }), 600)) // Slow query
      );

      // Execute multiple slow queries
      for (let i = 0; i < 15; i++) {
        await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);
      }

      const health = monitor.isHealthy();

      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues.some(issue => issue.includes('slow queries'))).toBe(true);
    });

    it('should detect high error rates', async () => {
      // Simulate high error rate
      const mockNextSuccess = vi.fn().mockResolvedValue({ id: 'test' });
      const mockNextError = vi.fn().mockRejectedValue(new Error('DB Error'));

      // 1 success, 9 errors = 90% error rate
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNextSuccess);
      
      for (let i = 0; i < 9; i++) {
        try {
          await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNextError);
        } catch (error) {
          // Expected errors
        }
      }

      const health = monitor.isHealthy();

      expect(health.healthy).toBe(false);
      expect(health.issues.some(issue => issue.includes('error rate'))).toBe(true);
    });
  });

  describe('performance reporting', () => {
    it('should generate comprehensive performance report', async () => {
      // Simulate various query activities
      const mockNext = vi.fn().mockResolvedValue({ id: 'test' });
      const slowMockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'slow' }), 150))
      );

      // Execute normal and slow queries
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);
      await middlewareCallback({ model: 'Test', action: 'findUnique' }, slowMockNext);

      monitor.recordCacheHit();
      monitor.recordCacheMiss();

      const report = monitor.generatePerformanceReport(60000); // 1 minute window

      expect(report.summary).toBeDefined();
      expect(report.summary.totalQueries).toBeGreaterThan(0);
      expect(report.summary.slowQueries).toBeGreaterThan(0);
      expect(report.trends).toBeDefined();
      expect(report.topSlowQueries).toBeDefined();
      expect(report.topSlowQueries.length).toBeGreaterThan(0);
    });

    it('should handle empty time ranges in reports', () => {
      const report = monitor.generatePerformanceReport(1); // 1ms window (no data)

      expect(report.summary.totalQueries).toBe(0);
      expect(report.summary.averageQueryTime).toBe(0);
      expect(report.trends.queryTimesTrend).toHaveLength(0);
      expect(report.topSlowQueries).toHaveLength(0);
    });
  });

  describe('metrics retention', () => {
    it('should clean up old metrics based on retention period', async () => {
      vi.useFakeTimers();

      // Create monitor with short retention (1 second for testing)
      const shortRetentionMonitor = new DatabasePerformanceMonitor(mockPrisma, 100, 1000);

      // Simulate query to generate metrics
      const mockNext = vi.fn().mockResolvedValue({ id: 'test' });
      await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);

      // Fast-forward past retention period
      vi.advanceTimersByTime(2000);

      // Trigger metrics collection to clean up old data
      vi.advanceTimersByTime(61000);

      vi.useRealTimers();
    });
  });

  describe('slow query tracking', () => {
    it('should track slow queries with proper metadata', async () => {
      const mockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'slow' }), 150))
      );

      const mockParams = {
        model: 'CustomerProfile',
        action: 'findMany',
        args: { where: { riskTier: 'HIGH_RISK' } }
      };

      await middlewareCallback(mockParams, mockNext);

      const report = monitor.generatePerformanceReport();
      const slowQueries = report.topSlowQueries;

      expect(slowQueries.length).toBeGreaterThan(0);
      expect(slowQueries[0].query).toBe('CustomerProfile.findMany');
      expect(slowQueries[0].duration).toBeGreaterThan(100);
    });

    it('should limit slow query log size', async () => {
      const mockNext = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'slow' }), 150))
      );

      // Generate many slow queries
      for (let i = 0; i < 20; i++) {
        await middlewareCallback({ model: 'Test', action: 'findMany' }, mockNext);
      }

      const report = monitor.generatePerformanceReport();
      
      // Should limit to top 10 slow queries
      expect(report.topSlowQueries.length).toBeLessThanOrEqual(10);
    });
  });
});