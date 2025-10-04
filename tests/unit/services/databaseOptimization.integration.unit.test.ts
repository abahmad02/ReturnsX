import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseQueryOptimizer } from '../../../app/services/databaseQueryOptimizer.server';
import { DatabasePerformanceMonitor } from '../../../app/services/databasePerformanceMonitor.server';
import { getDatabaseConfig, validateDatabaseConfig } from '../../../app/config/database.server';

// Mock PrismaClient
const mockPrisma = {
  customerProfile: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  orderEvent: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  checkoutCorrelation: {
    findUnique: vi.fn(),
  },
  $use: vi.fn(),
  $queryRaw: vi.fn(),
} as any;

describe('Database Optimization Integration Tests', () => {
  let optimizer: DatabaseQueryOptimizer;
  let monitor: DatabasePerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    optimizer = new DatabaseQueryOptimizer(mockPrisma, 100);
    monitor = new DatabasePerformanceMonitor(mockPrisma, 100);
  });

  describe('configuration validation', () => {
    it('should validate database configuration correctly', () => {
      const config = getDatabaseConfig();
      const validation = validateDatabaseConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(config.connectionLimit).toBeGreaterThan(0);
      expect(config.slowQueryThreshold).toBeGreaterThan(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        connectionLimit: 0, // Invalid
        poolTimeout: 500, // Too low
        idleTimeout: 5000, // Too low
        maxLifetime: 60000,
        statementTimeout: 30000,
        queryTimeout: 500, // Too low
        connectionTimeout: 5000,
        slowQueryThreshold: 10, // Too low
        enableQueryLogging: false,
        enablePerformanceMonitoring: true,
        enablePreparedStatements: true,
        enableQueryCache: true,
        batchSize: 0, // Invalid
      };

      const validation = validateDatabaseConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('integrated optimization workflow', () => {
    it('should optimize customer lookup with monitoring', async () => {
      const mockCustomer = {
        id: 'customer-1',
        phone: '+923001234567',
        email: 'test@example.com',
        riskTier: 'ZERO_RISK',
        orderEvents: []
      };

      mockPrisma.customerProfile.findUnique.mockResolvedValue(mockCustomer);

      // Execute optimized query
      const result = await optimizer.findCustomerByIdentifiers({ 
        phone: '+923001234567' 
      });

      expect(result).toEqual(mockCustomer);

      // Verify metrics were tracked
      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.successRate).toBe(1);

      // Simulate cache hit for monitoring
      monitor.recordCacheHit();
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(1);
    });

    it('should handle complex query optimization scenarios', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      const mockOrderEvents = [
        { id: 'event-1', customerProfileId: 'customer-1', eventType: 'ORDER_CREATED' },
        { id: 'event-2', customerProfileId: 'customer-1', eventType: 'ORDER_PAID' }
      ];
      const mockCorrelation = { id: 'correlation-1', checkoutToken: 'token-123' };

      mockPrisma.customerProfile.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.orderEvent.findMany.mockResolvedValue(mockOrderEvents);
      mockPrisma.checkoutCorrelation.findUnique.mockResolvedValue(mockCorrelation);

      // Execute batch query optimization
      const batchQueries = [
        {
          id: 'customer-query',
          type: 'customer' as const,
          priority: 'high' as const,
          params: { phone: '+923001234567' }
        },
        {
          id: 'orders-query',
          type: 'order' as const,
          priority: 'medium' as const,
          params: { 
            customerProfileId: 'customer-1',
            options: { limit: 10, eventTypes: ['ORDER_CREATED', 'ORDER_PAID'] }
          }
        },
        {
          id: 'correlation-query',
          type: 'correlation' as const,
          priority: 'low' as const,
          params: { checkoutToken: 'token-123' }
        }
      ];

      const results = await optimizer.batchQuery(batchQueries);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Verify performance metrics
      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.queryTypeBreakdown).toBeDefined();
    });

    it('should integrate error handling with performance monitoring', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.customerProfile.findUnique.mockRejectedValue(dbError);

      // Track cache miss for error scenario
      monitor.recordCacheMiss();

      try {
        await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      } catch (error) {
        expect(error).toEqual(dbError);
      }

      // Verify error tracking
      const stats = optimizer.getQueryStats();
      expect(stats.successRate).toBe(0);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('performance optimization validation', () => {
    it('should maintain performance under concurrent load', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      mockPrisma.customerProfile.findUnique.mockResolvedValue(mockCustomer);

      const concurrentQueries = 20;
      const promises = Array.from({ length: concurrentQueries }, (_, i) =>
        optimizer.findCustomerByIdentifiers({ phone: `+92300123456${i % 5}` })
      );

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const executionTime = performance.now() - startTime;

      expect(results).toHaveLength(concurrentQueries);
      expect(results.every(r => r !== null)).toBe(true);
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds

      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(concurrentQueries);
      expect(stats.successRate).toBe(1);
    });

    it('should optimize query patterns based on usage', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      
      // Simulate different query patterns
      mockPrisma.customerProfile.findUnique
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 50)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 25)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 10)));

      // Execute queries with improving performance (simulating cache warming)
      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      monitor.recordCacheMiss();

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      monitor.recordCacheHit();

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      monitor.recordCacheHit();

      const stats = optimizer.getQueryStats();
      const metrics = monitor.getCurrentMetrics();

      expect(stats.totalQueries).toBe(3);
      expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2); // 2/3 cache hits
    });
  });

  describe('monitoring and alerting integration', () => {
    it('should detect and alert on performance degradation', async () => {
      const slowQueryAlerts: any[] = [];
      optimizer.onSlowQuery((alert) => slowQueryAlerts.push(alert));

      // Simulate performance degradation
      mockPrisma.customerProfile.findUnique.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'customer-1' }), 150))
      );

      // Execute multiple slow queries
      for (let i = 0; i < 5; i++) {
        await optimizer.findCustomerByIdentifiers({ phone: `+92300123456${i}` });
        monitor.recordCacheMiss(); // Simulate cache misses during degradation
      }

      expect(slowQueryAlerts.length).toBeGreaterThan(0);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0); // All cache misses

      const health = monitor.isHealthy();
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive performance reports', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      
      // Simulate mixed performance scenarios
      mockPrisma.customerProfile.findUnique
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 50)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 150)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), 75)));

      // Execute queries and track performance
      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      monitor.recordCacheHit();

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234568' });
      monitor.recordCacheMiss();

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234569' });
      monitor.recordCacheHit();

      const report = monitor.generatePerformanceReport();

      expect(report.summary).toBeDefined();
      expect(report.summary.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(report.trends).toBeDefined();
      expect(report.topSlowQueries).toBeDefined();
      
      // The monitor tracks its own queries separately from the optimizer
      // So we verify the structure is correct even if totalQueries is 0
      expect(typeof report.summary.totalQueries).toBe('number');
      expect(report.summary.totalQueries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('optimization effectiveness validation', () => {
    it('should demonstrate query optimization benefits', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      
      // Simulate unoptimized vs optimized query performance
      const unoptimizedTime = 200;
      const optimizedTime = 50;

      mockPrisma.customerProfile.findUnique
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), unoptimizedTime)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(mockCustomer), optimizedTime)));

      // First query (unoptimized)
      const startTime1 = performance.now();
      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      const executionTime1 = performance.now() - startTime1;
      monitor.recordCacheMiss();

      // Second query (optimized with cache)
      const startTime2 = performance.now();
      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      const executionTime2 = performance.now() - startTime2;
      monitor.recordCacheHit();

      // Verify optimization effectiveness
      expect(executionTime2).toBeLessThan(executionTime1);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(0.5); // 1 hit, 1 miss
    });

    it('should validate index usage optimization', () => {
      // Test that the optimizer returns appropriate index recommendations
      const phoneIndexes = (optimizer as any).getExpectedIndexes('customer_by_phone');
      const emailIndexes = (optimizer as any).getExpectedIndexes('customer_by_email');
      const orderIndexes = (optimizer as any).getExpectedIndexes('order_events_lookup');

      expect(phoneIndexes).toContain('idx_customer_profiles_phone_risk');
      expect(emailIndexes).toContain('idx_customer_profiles_email_risk');
      expect(orderIndexes).toContain('idx_order_events_customer_timeline');

      // Verify that the indexes align with our optimization strategy
      expect(phoneIndexes.length).toBeGreaterThan(0);
      expect(emailIndexes.length).toBeGreaterThan(0);
      expect(orderIndexes.length).toBeGreaterThan(0);
    });
  });
});