import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DatabaseQueryOptimizer, CustomerLookupParams, QueryBatch } from '../../../app/services/databaseQueryOptimizer.server';

// Mock Prisma Client for testing
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
} as unknown as PrismaClient;

describe('DatabaseQueryOptimizer Integration Tests', () => {
  let optimizer: DatabaseQueryOptimizer;

  beforeEach(() => {
    optimizer = new DatabaseQueryOptimizer(mockPrisma, 100); // 100ms threshold for testing
    vi.clearAllMocks();
  });

  afterEach(() => {
    optimizer.clearMetrics();
  });

  describe('findCustomerByIdentifiers', () => {
    it('should find customer by phone number efficiently', async () => {
      const mockCustomer = {
        id: 'customer-1',
        phone: '+923001234567',
        email: 'test@example.com',
        riskTier: 'ZERO_RISK',
        orderEvents: []
      };

      (mockPrisma.customerProfile.findUnique as any).mockResolvedValue(mockCustomer);

      const params: CustomerLookupParams = {
        phone: '+923001234567',
        shopDomain: 'test-shop.myshopify.com'
      };

      const result = await optimizer.findCustomerByIdentifiers(params);

      expect(result).toEqual(mockCustomer);
      expect(mockPrisma.customerProfile.findUnique).toHaveBeenCalledWith({
        where: { phone: '+923001234567' },
        include: {
          orderEvents: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            where: { shopDomain: 'test-shop.myshopify.com' }
          }
        }
      });

      // Check metrics were recorded
      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.successRate).toBe(1);
    });

    it('should fallback to email lookup when phone not found', async () => {
      const mockCustomer = {
        id: 'customer-2',
        phone: '+923001234568',
        email: 'test2@example.com',
        riskTier: 'MEDIUM_RISK',
        orderEvents: []
      };

      (mockPrisma.customerProfile.findUnique as any).mockResolvedValue(null);
      (mockPrisma.customerProfile.findFirst as any).mockResolvedValue(mockCustomer);

      const params: CustomerLookupParams = {
        phone: '+923001234567',
        email: 'test2@example.com',
        shopDomain: 'test-shop.myshopify.com'
      };

      const result = await optimizer.findCustomerByIdentifiers(params);

      expect(result).toEqual(mockCustomer);
      expect(mockPrisma.customerProfile.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.customerProfile.findFirst).toHaveBeenCalledWith({
        where: { email: 'test2@example.com' },
        include: {
          orderEvents: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            where: { shopDomain: 'test-shop.myshopify.com' }
          }
        }
      });
    });

    it('should use checkout correlation for lookup', async () => {
      const mockCorrelation = {
        id: 'correlation-1',
        checkoutToken: 'checkout-token-123',
        customerPhone: '+923001234567',
        shopDomain: 'test-shop.myshopify.com'
      };

      const mockCustomer = {
        id: 'customer-3',
        phone: '+923001234567',
        email: 'test3@example.com',
        riskTier: 'HIGH_RISK',
        orderEvents: []
      };

      (mockPrisma.customerProfile.findUnique as any)
        .mockResolvedValueOnce(null) // Phone lookup fails
        .mockResolvedValueOnce(mockCustomer); // Correlation phone lookup succeeds
      
      (mockPrisma.customerProfile.findFirst as any).mockResolvedValue(null);
      (mockPrisma.checkoutCorrelation.findUnique as any).mockResolvedValue(mockCorrelation);

      const params: CustomerLookupParams = {
        phone: '+923001234568', // Different phone
        checkoutToken: 'checkout-token-123'
      };

      const result = await optimizer.findCustomerByIdentifiers(params);

      expect(result).toEqual(mockCustomer);
      expect(mockPrisma.checkoutCorrelation.findUnique).toHaveBeenCalledWith({
        where: { checkoutToken: 'checkout-token-123' }
      });
    });

    it('should handle errors gracefully', async () => {
      (mockPrisma.customerProfile.findUnique as any).mockRejectedValue(new Error('Database error'));

      const params: CustomerLookupParams = {
        phone: '+923001234567'
      };

      await expect(optimizer.findCustomerByIdentifiers(params)).rejects.toThrow('Database error');

      const stats = optimizer.getQueryStats();
      expect(stats.successRate).toBe(0);
    });

    it('should detect slow queries', async () => {
      const slowQueryCallback = vi.fn();
      optimizer.onSlowQuery(slowQueryCallback);

      // Mock a slow response
      (mockPrisma.customerProfile.findUnique as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 150))
      );

      const params: CustomerLookupParams = {
        phone: '+923001234567'
      };

      await optimizer.findCustomerByIdentifiers(params);

      expect(slowQueryCallback).toHaveBeenCalled();
      const alertCall = slowQueryCallback.mock.calls[0][0];
      expect(alertCall.executionTime).toBeGreaterThan(100);
    });
  });

  describe('findOrderEvents', () => {
    it('should find order events with proper filtering', async () => {
      const mockOrderEvents = [
        {
          id: 'event-1',
          customerProfileId: 'customer-1',
          eventType: 'ORDER_CREATED',
          createdAt: new Date(),
          shopDomain: 'test-shop.myshopify.com'
        },
        {
          id: 'event-2',
          customerProfileId: 'customer-1',
          eventType: 'ORDER_PAID',
          createdAt: new Date(),
          shopDomain: 'test-shop.myshopify.com'
        }
      ];

      (mockPrisma.orderEvent.findMany as any).mockResolvedValue(mockOrderEvents);

      const result = await optimizer.findOrderEvents('customer-1', {
        limit: 10,
        eventTypes: ['ORDER_CREATED', 'ORDER_PAID'],
        shopDomain: 'test-shop.myshopify.com'
      });

      expect(result).toEqual(mockOrderEvents);
      expect(mockPrisma.orderEvent.findMany).toHaveBeenCalledWith({
        where: {
          customerProfileId: 'customer-1',
          eventType: { in: ['ORDER_CREATED', 'ORDER_PAID'] },
          shopDomain: 'test-shop.myshopify.com'
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      });
    });

    it('should handle date range filtering', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (mockPrisma.orderEvent.findMany as any).mockResolvedValue([]);

      await optimizer.findOrderEvents('customer-1', {
        dateRange: { start: startDate, end: endDate }
      });

      expect(mockPrisma.orderEvent.findMany).toHaveBeenCalledWith({
        where: {
          customerProfileId: 'customer-1',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      });
    });
  });

  describe('batchQuery', () => {
    it('should execute queries in priority order', async () => {
      const mockCustomer = { id: 'customer-1', phone: '+923001234567' };
      const mockOrderEvents = [{ id: 'event-1', customerProfileId: 'customer-1' }];
      const mockCorrelation = { id: 'correlation-1', checkoutToken: 'token-123' };

      (mockPrisma.customerProfile.findUnique as any).mockResolvedValue(mockCustomer);
      (mockPrisma.orderEvent.findMany as any).mockResolvedValue(mockOrderEvents);
      (mockPrisma.checkoutCorrelation.findUnique as any).mockResolvedValue(mockCorrelation);

      const queries: QueryBatch[] = [
        {
          id: 'query-1',
          type: 'customer',
          priority: 'low',
          params: { phone: '+923001234567' }
        },
        {
          id: 'query-2',
          type: 'order',
          priority: 'high',
          params: { customerProfileId: 'customer-1', options: {} }
        },
        {
          id: 'query-3',
          type: 'correlation',
          priority: 'medium',
          params: { checkoutToken: 'token-123' }
        }
      ];

      const results = await optimizer.batchQuery(queries);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Verify all queries were executed
      expect(mockPrisma.customerProfile.findUnique).toHaveBeenCalled();
      expect(mockPrisma.orderEvent.findMany).toHaveBeenCalled();
      expect(mockPrisma.checkoutCorrelation.findUnique).toHaveBeenCalled();
    });

    it('should handle partial failures in batch queries', async () => {
      (mockPrisma.customerProfile.findUnique as any).mockResolvedValue({ id: 'customer-1' });
      (mockPrisma.orderEvent.findMany as any).mockRejectedValue(new Error('Order query failed'));

      const queries: QueryBatch[] = [
        {
          id: 'query-1',
          type: 'customer',
          priority: 'high',
          params: { phone: '+923001234567' }
        },
        {
          id: 'query-2',
          type: 'order',
          priority: 'high',
          params: { customerProfileId: 'customer-1', options: {} }
        }
      ];

      const results = await optimizer.batchQuery(queries);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Order query failed');
    });
  });

  describe('performance metrics', () => {
    it('should track query statistics correctly', async () => {
      (mockPrisma.customerProfile.findUnique as any).mockResolvedValue({ id: 'customer-1' });

      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        await optimizer.findCustomerByIdentifiers({ phone: `+92300123456${i}` });
      }

      const stats = optimizer.getQueryStats();
      expect(stats.totalQueries).toBe(5);
      expect(stats.successRate).toBe(1);
      expect(stats.queryTypeBreakdown['customer_by_phone']).toBe(5);
    });

    it('should calculate average execution time', async () => {
      // Mock queries with different execution times
      (mockPrisma.customerProfile.findUnique as any)
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ id: 'customer-1' }), 50)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ id: 'customer-2' }), 100)));

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });
      await optimizer.findCustomerByIdentifiers({ phone: '+923001234568' });

      const stats = optimizer.getQueryStats();
      expect(stats.averageExecutionTime).toBeGreaterThan(50);
      expect(stats.totalQueries).toBe(2);
    });
  });

  describe('slow query detection', () => {
    it('should detect and alert on slow queries', async () => {
      const slowQueryAlerts: any[] = [];
      optimizer.onSlowQuery((alert) => slowQueryAlerts.push(alert));

      // Mock a slow query (> 100ms threshold)
      (mockPrisma.customerProfile.findUnique as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'customer-1' }), 150))
      );

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });

      expect(slowQueryAlerts).toHaveLength(1);
      expect(slowQueryAlerts[0].executionTime).toBeGreaterThan(100);
      expect(slowQueryAlerts[0].query).toBe('customer_by_phone');
    });

    it('should allow configurable slow query threshold', async () => {
      optimizer.setSlowQueryThreshold(200);

      const slowQueryAlerts: any[] = [];
      optimizer.onSlowQuery((alert) => slowQueryAlerts.push(alert));

      // Mock a query that's slow by old threshold but not new one
      (mockPrisma.customerProfile.findUnique as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'customer-1' }), 150))
      );

      await optimizer.findCustomerByIdentifiers({ phone: '+923001234567' });

      expect(slowQueryAlerts).toHaveLength(0);
    });
  });
});