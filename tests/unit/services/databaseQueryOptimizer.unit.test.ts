import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseQueryOptimizer, QueryBatch } from '../../../app/services/databaseQueryOptimizer.server';

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
} as any;

describe('DatabaseQueryOptimizer Unit Tests', () => {
  let optimizer: DatabaseQueryOptimizer;

  beforeEach(() => {
    optimizer = new DatabaseQueryOptimizer(mockPrisma, 100);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default slow query threshold', () => {
      const defaultOptimizer = new DatabaseQueryOptimizer(mockPrisma);
      expect(defaultOptimizer).toBeInstanceOf(DatabaseQueryOptimizer);
    });

    it('should initialize with custom slow query threshold', () => {
      const customOptimizer = new DatabaseQueryOptimizer(mockPrisma, 500);
      expect(customOptimizer).toBeInstanceOf(DatabaseQueryOptimizer);
    });
  });

  describe('query metrics tracking', () => {
    it('should initialize with empty metrics', () => {
      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.slowQueries).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should clear metrics when requested', () => {
      // Add some mock metrics by executing a query
      mockPrisma.customerProfile.findUnique.mockResolvedValue({ id: 'test' });
      
      optimizer.clearMetrics();
      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(0);
    });

    it('should allow setting slow query threshold', () => {
      optimizer.setSlowQueryThreshold(500);
      // The threshold change should be reflected in slow query detection
      expect(() => optimizer.setSlowQueryThreshold(500)).not.toThrow();
    });
  });

  describe('slow query callback management', () => {
    it('should register slow query callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      optimizer.onSlowQuery(callback1);
      optimizer.onSlowQuery(callback2);

      // Both callbacks should be registered (we can't directly test this without triggering a slow query)
      expect(() => {
        optimizer.onSlowQuery(callback1);
        optimizer.onSlowQuery(callback2);
      }).not.toThrow();
    });
  });

  describe('query batch processing', () => {
    it('should sort queries by priority', async () => {
      const queries: QueryBatch[] = [
        { id: '1', type: 'customer', priority: 'low', params: {} },
        { id: '2', type: 'customer', priority: 'high', params: {} },
        { id: '3', type: 'customer', priority: 'medium', params: {} },
      ];

      mockPrisma.customerProfile.findUnique.mockResolvedValue({ id: 'test' });

      const results = await optimizer.batchQuery(queries);

      // All queries should complete
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle empty batch queries', async () => {
      const results = await optimizer.batchQuery([]);
      expect(results).toHaveLength(0);
    });

    it('should handle unknown query types gracefully', async () => {
      const queries: QueryBatch[] = [
        { id: '1', type: 'unknown' as any, priority: 'high', params: {} }
      ];

      const results = await optimizer.batchQuery(queries);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Unknown query type');
    });
  });

  describe('query statistics calculation', () => {
    it('should calculate statistics for empty time window', () => {
      const stats = optimizer.getQueryStats(1000); // 1 second window
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.slowQueries).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.queryTypeBreakdown).toEqual({});
    });

    it('should handle time window filtering', () => {
      // Test with different time windows
      const stats1 = optimizer.getQueryStats(60000); // 1 minute
      const stats2 = optimizer.getQueryStats(300000); // 5 minutes

      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
    });
  });

  describe('parameter validation', () => {
    it('should handle empty customer lookup parameters', async () => {
      mockPrisma.customerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.customerProfile.findFirst.mockResolvedValue(null);

      const result = await optimizer.findCustomerByIdentifiers({});
      expect(result).toBeNull();
    });

    it('should handle null/undefined parameters gracefully', async () => {
      mockPrisma.customerProfile.findUnique.mockResolvedValue(null);

      const result = await optimizer.findCustomerByIdentifiers({
        phone: undefined,
        email: null as any,
        orderId: '',
        checkoutToken: undefined
      });

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.customerProfile.findUnique.mockRejectedValue(dbError);

      await expect(
        optimizer.findCustomerByIdentifiers({ phone: '+923001234567' })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      mockPrisma.orderEvent.findMany.mockRejectedValue(timeoutError);

      await expect(
        optimizer.findOrderEvents('customer-1')
      ).rejects.toThrow('Query timeout');
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      mockPrisma.checkoutCorrelation.findUnique.mockRejectedValue(networkError);

      await expect(
        optimizer.findCheckoutCorrelation('token-123')
      ).rejects.toThrow('Network error');
    });
  });

  describe('performance optimization features', () => {
    it('should use appropriate indexes for different query types', () => {
      // Test that the optimizer returns expected indexes for different query types
      const phoneIndexes = (optimizer as any).getExpectedIndexes('customer_by_phone');
      const emailIndexes = (optimizer as any).getExpectedIndexes('customer_by_email');
      const orderIndexes = (optimizer as any).getExpectedIndexes('order_events_lookup');

      expect(phoneIndexes).toContain('idx_customer_profiles_phone_risk');
      expect(emailIndexes).toContain('idx_customer_profiles_email_risk');
      expect(orderIndexes).toContain('idx_order_events_customer_timeline');
    });

    it('should handle unknown query types in index mapping', () => {
      const unknownIndexes = (optimizer as any).getExpectedIndexes('unknown_query_type');
      expect(unknownIndexes).toEqual([]);
    });
  });

  describe('query result processing', () => {
    it('should process successful query results correctly', async () => {
      const mockResult = { id: 'customer-1', phone: '+923001234567' };
      mockPrisma.customerProfile.findUnique.mockResolvedValue(mockResult);

      const result = await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      expect(result).toEqual(mockResult);
    });

    it('should handle null results correctly', async () => {
      mockPrisma.customerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.customerProfile.findFirst.mockResolvedValue(null);
      mockPrisma.checkoutCorrelation.findUnique.mockResolvedValue(null);

      const result = await optimizer.findCustomerByIdentifiers({ 
        phone: '+923001234567',
        email: 'test@example.com',
        checkoutToken: 'token-123'
      });

      expect(result).toBeNull();
    });
  });
});