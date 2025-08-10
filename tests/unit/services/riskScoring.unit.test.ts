import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  calculateRiskScore,
  getRiskConfig,
  updateCustomerProfileRisk,
  getRiskDistributionStats
} from '../../../app/services/riskScoring.server';
import { 
  createMockCustomerProfile, 
  createMockRiskConfig, 
  createMockOrderEvent,
  resetAllMocks
} from '../../setup/unit.setup';

// Mock the database
const mockPrisma = {
  riskConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  customerProfile: {
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  }
};

vi.mock('../../../app/db.server', () => ({
  default: mockPrisma
}));

describe('Risk Scoring Service', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('calculateRiskScore', () => {
    it('should calculate zero risk for new customers', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        returnRate: 0.0
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('ZERO_RISK');
      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.recommendation).toContain('new customer');
    });

    it('should calculate zero risk for customers with good history', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 1,
        successfulDeliveries: 9,
        returnRate: 10.0
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('ZERO_RISK');
      expect(result.riskScore).toBeLessThan(20);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should calculate medium risk for customers with moderate issues', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 3,
        successfulDeliveries: 7,
        returnRate: 30.0
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('MEDIUM_RISK');
      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should calculate high risk for customers with poor history', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 8,
        successfulDeliveries: 2,
        returnRate: 80.0
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('HIGH_RISK');
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.recommendation).toContain('deposit');
    });

    it('should apply time decay for old events', async () => {
      const oldDate = new Date('2023-01-01');
      const recentDate = new Date();
      
      const oldFailureCustomer = createMockCustomerProfile({
        totalOrders: 5,
        failedAttempts: 3,
        successfulDeliveries: 2,
        returnRate: 60.0,
        lastEventAt: oldDate
      });

      const recentFailureCustomer = createMockCustomerProfile({
        totalOrders: 5,
        failedAttempts: 3,
        successfulDeliveries: 2,
        returnRate: 60.0,
        lastEventAt: recentDate
      });

      const oldResult = await calculateRiskScore(oldFailureCustomer, 'test-shop.myshopify.com', {});
      const recentResult = await calculateRiskScore(recentFailureCustomer, 'test-shop.myshopify.com', {});

      // Recent failures should have higher risk score
      expect(recentResult.riskScore).toBeGreaterThan(oldResult.riskScore);
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        createMockCustomerProfile({ totalOrders: 1, failedAttempts: 0 }),
        createMockCustomerProfile({ totalOrders: 0, failedAttempts: 0 }),
        createMockCustomerProfile({ totalOrders: 100, failedAttempts: 0 }),
        createMockCustomerProfile({ totalOrders: 1, failedAttempts: 1 })
      ];

      for (const customerProfile of edgeCases) {
        const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});
        
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(['ZERO_RISK', 'MEDIUM_RISK', 'HIGH_RISK']).toContain(result.riskTier);
      }
    });

    it('should consider order values in risk calculation', async () => {
      const lowValueCustomer = createMockCustomerProfile({
        totalOrders: 5,
        failedAttempts: 2,
        successfulDeliveries: 3,
        returnRate: 40.0
      });

      const highValueCustomer = createMockCustomerProfile({
        totalOrders: 5,
        failedAttempts: 2,
        successfulDeliveries: 3,
        returnRate: 40.0
      });

      const lowValueResult = await calculateRiskScore(
        lowValueCustomer, 
        'test-shop.myshopify.com', 
        { averageOrderValue: 500, highValueThreshold: 5000 }
      );

      const highValueResult = await calculateRiskScore(
        highValueCustomer, 
        'test-shop.myshopify.com', 
        { averageOrderValue: 10000, highValueThreshold: 5000 }
      );

      // High value orders with failures should have higher risk
      expect(highValueResult.riskScore).toBeGreaterThan(lowValueResult.riskScore);
    });
  });

  describe('getRiskConfig', () => {
    it('should return existing risk config', async () => {
      const mockConfig = createMockRiskConfig();
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await getRiskConfig('test-shop.myshopify.com');

      expect(result).toEqual(mockConfig);
      expect(mockPrisma.riskConfig.findUnique).toHaveBeenCalledWith({
        where: { shopDomain: 'test-shop.myshopify.com' }
      });
    });

    it('should create default config if none exists', async () => {
      mockPrisma.riskConfig.findUnique.mockResolvedValue(null);
      const defaultConfig = createMockRiskConfig();
      mockPrisma.riskConfig.upsert.mockResolvedValue(defaultConfig);

      const result = await getRiskConfig('new-shop.myshopify.com');

      expect(result).toEqual(defaultConfig);
      expect(mockPrisma.riskConfig.upsert).toHaveBeenCalledWith({
        where: { shopDomain: 'new-shop.myshopify.com' },
        create: expect.objectContaining({
          shopDomain: 'new-shop.myshopify.com',
          zeroRiskMaxFailed: 2,
          zeroRiskMaxReturnRate: 10.0
        }),
        update: {}
      });
    });
  });

  describe('updateCustomerProfileRisk', () => {
    it('should update customer profile with new risk data', async () => {
      const customerId = 'test-customer-id';
      const riskData = {
        riskScore: 75.5,
        riskTier: 'HIGH_RISK' as const,
        returnRate: 60.0
      };

      const updatedProfile = createMockCustomerProfile(riskData);
      mockPrisma.customerProfile.update.mockResolvedValue(updatedProfile);

      const result = await updateCustomerProfileRisk(customerId, riskData);

      expect(result).toEqual(updatedProfile);
      expect(mockPrisma.customerProfile.update).toHaveBeenCalledWith({
        where: { id: customerId },
        data: {
          ...riskData,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should handle update errors gracefully', async () => {
      const customerId = 'non-existent-customer';
      const riskData = {
        riskScore: 50.0,
        riskTier: 'MEDIUM_RISK' as const,
        returnRate: 25.0
      };

      mockPrisma.customerProfile.update.mockRejectedValue(new Error('Customer not found'));

      await expect(updateCustomerProfileRisk(customerId, riskData)).rejects.toThrow('Customer not found');
    });
  });

  describe('getRiskDistributionStats', () => {
    it('should calculate correct risk distribution', async () => {
      const mockCounts = [
        { riskTier: 'ZERO_RISK', _count: { id: 150 } },
        { riskTier: 'MEDIUM_RISK', _count: { id: 75 } },
        { riskTier: 'HIGH_RISK', _count: { id: 25 } }
      ];

      mockPrisma.customerProfile.findMany.mockResolvedValue(mockCounts);
      mockPrisma.customerProfile.count.mockResolvedValue(250);

      const result = await getRiskDistributionStats('test-shop.myshopify.com');

      expect(result.total).toBe(250);
      expect(result.distribution.zeroRisk).toBe(150);
      expect(result.distribution.mediumRisk).toBe(75);
      expect(result.distribution.highRisk).toBe(25);
      expect(result.percentages.zeroRisk).toBe(60.0);
      expect(result.percentages.mediumRisk).toBe(30.0);
      expect(result.percentages.highRisk).toBe(10.0);
    });

    it('should handle empty customer base', async () => {
      mockPrisma.customerProfile.findMany.mockResolvedValue([]);
      mockPrisma.customerProfile.count.mockResolvedValue(0);

      const result = await getRiskDistributionStats('empty-shop.myshopify.com');

      expect(result.total).toBe(0);
      expect(result.distribution.zeroRisk).toBe(0);
      expect(result.distribution.mediumRisk).toBe(0);
      expect(result.distribution.highRisk).toBe(0);
      expect(result.percentages.zeroRisk).toBe(0);
      expect(result.percentages.mediumRisk).toBe(0);
      expect(result.percentages.highRisk).toBe(0);
    });
  });

  describe('Risk Threshold Logic', () => {
    it('should properly apply zero risk thresholds', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 2, // At threshold
        successfulDeliveries: 8,
        returnRate: 10.0 // At threshold
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('ZERO_RISK');
    });

    it('should properly apply medium risk thresholds', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 3, // Above zero risk threshold
        successfulDeliveries: 7,
        returnRate: 15.0 // Above zero risk threshold
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('MEDIUM_RISK');
    });

    it('should properly apply high risk thresholds', async () => {
      const customerProfile = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 6, // Above medium risk threshold
        successfulDeliveries: 4,
        returnRate: 35.0 // Above medium risk threshold
      });

      const result = await calculateRiskScore(customerProfile, 'test-shop.myshopify.com', {});

      expect(result.riskTier).toBe('HIGH_RISK');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have higher confidence with more data points', async () => {
      const lowDataCustomer = createMockCustomerProfile({
        totalOrders: 2,
        failedAttempts: 1,
        successfulDeliveries: 1,
        returnRate: 50.0
      });

      const highDataCustomer = createMockCustomerProfile({
        totalOrders: 50,
        failedAttempts: 25,
        successfulDeliveries: 25,
        returnRate: 50.0
      });

      const lowDataResult = await calculateRiskScore(lowDataCustomer, 'test-shop.myshopify.com', {});
      const highDataResult = await calculateRiskScore(highDataCustomer, 'test-shop.myshopify.com', {});

      expect(highDataResult.confidence).toBeGreaterThan(lowDataResult.confidence);
    });

    it('should have lower confidence for new customers', async () => {
      const newCustomer = createMockCustomerProfile({
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        returnRate: 0.0
      });

      const result = await calculateRiskScore(newCustomer, 'test-shop.myshopify.com', {});

      expect(result.confidence).toBeLessThan(70);
    });
  });

  describe('Recommendation Generation', () => {
    it('should provide appropriate recommendations for each risk tier', async () => {
      const zeroRiskCustomer = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 0,
        successfulDeliveries: 10,
        returnRate: 0.0
      });

      const mediumRiskCustomer = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 3,
        successfulDeliveries: 7,
        returnRate: 30.0
      });

      const highRiskCustomer = createMockCustomerProfile({
        totalOrders: 10,
        failedAttempts: 8,
        successfulDeliveries: 2,
        returnRate: 80.0
      });

      const zeroResult = await calculateRiskScore(zeroRiskCustomer, 'test-shop.myshopify.com', {});
      const mediumResult = await calculateRiskScore(mediumRiskCustomer, 'test-shop.myshopify.com', {});
      const highResult = await calculateRiskScore(highRiskCustomer, 'test-shop.myshopify.com', {});

      expect(zeroResult.recommendation).toContain('proceed');
      expect(mediumResult.recommendation).toContain('verify');
      expect(highResult.recommendation).toContain('deposit');
    });
  });
}); 