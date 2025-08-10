import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, seedTestData, createTestRequest } from '../../setup/integration.setup';
import { loader, action } from '../../../app/routes/api.customer-profiles.$phoneHash';

// Mock the authentication middleware for integration tests
const mockAuthSession = {
  id: 'test-session-id',
  shop: 'test-shop.myshopify.com',
  accessToken: 'test-access-token',
  userId: BigInt(123456789),
  accountOwner: true,
  collaborator: false,
  email: 'admin@test-shop.com',
  firstName: 'Test',
  lastName: 'Admin'
};

const mockUserSession = {
  shopDomain: 'test-shop.myshopify.com',
  userId: '123456789',
  role: 'STORE_OWNER' as const,
  email: 'admin@test-shop.com',
  firstName: 'Test',
  lastName: 'Admin',
  permissions: [
    'VIEW_CUSTOMERS',
    'MANAGE_CUSTOMERS',
    'ACCESS_CUSTOMER_API'
  ],
  sessionId: 'test-session-id',
  authenticatedAt: new Date()
};

// Mock the authentication functions
vi.mock('../../../app/middleware/roleBasedAccess.server', () => ({
  authenticateWithRoles: vi.fn().mockResolvedValue({
    admin: { rest: {}, graphql: vi.fn() },
    session: mockAuthSession,
    userSession: mockUserSession
  }),
  Permission: {
    ACCESS_CUSTOMER_API: 'ACCESS_CUSTOMER_API',
    MANAGE_CUSTOMERS: 'MANAGE_CUSTOMERS'
  },
  hasPermission: vi.fn().mockReturnValue(true)
}));

// Mock rate limiting
vi.mock('../../../app/middleware/rateLimiting.server', () => ({
  withRateLimit: (config: string) => (handler: Function) => handler
}));

// Mock audit logging
vi.mock('../../../app/services/auditLog.server', () => ({
  auditCustomerProfileAccess: vi.fn(),
  auditAPIRequest: vi.fn()
}));

describe('Customer Profiles API Integration Tests', () => {
  let testData: any;

  beforeEach(async () => {
    testData = await seedTestData();
  });

  describe('GET /api/customer-profiles/:phoneHash', () => {
    it('should return customer profile for valid phone hash', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.customerProfile).toBeDefined();
      expect(data.customerProfile.id).toBe(testData.zeroRiskCustomer.id);
      expect(data.customerProfile.riskTier).toBe('ZERO_RISK');
      expect(data.customerProfile.totalOrders).toBe(5);
      expect(data.riskConfig).toBeDefined();
    });

    it('should return 404 for non-existent customer', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/non-existent-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'non-existent-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Customer profile not found');
    });

    it('should return 400 for missing phone hash parameter', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/',
        { method: 'GET' }
      );

      const params = { phoneHash: '' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Phone hash parameter is required');
    });

    it('should include additional fields for users with MANAGE_CUSTOMERS permission', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/medium-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'medium-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customerProfile.phoneHash).toBeDefined();
      expect(data.customerProfile.emailHash).toBeDefined();
      expect(data.customerProfile.addressHash).toBeDefined();
    });

    it('should return risk configuration context', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/high-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'high-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.riskConfig).toBeDefined();
      expect(data.riskConfig.zeroRiskMaxFailed).toBe(2);
      expect(data.riskConfig.mediumRiskMaxFailed).toBe(5);
      expect(data.riskConfig.enableCodRestriction).toBe(true);
    });
  });

  describe('POST /api/customer-profiles/:phoneHash', () => {
    it('should recalculate risk score for existing customer', async () => {
      const formData = new FormData();
      formData.append('updateType', 'recalculate_risk');

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/medium-risk-customer-hash',
        {
          method: 'POST',
          body: formData
        }
      );

      const params = { phoneHash: 'medium-risk-customer-hash' };
      const response = await action({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Customer profile updated successfully');
      expect(data.customerProfile).toBeDefined();
      expect(data.customerProfile.id).toBe(testData.mediumRiskCustomer.id);

      // Verify the customer was actually updated in the database
      const updatedCustomer = await testDb.customerProfile.findUnique({
        where: { id: testData.mediumRiskCustomer.id }
      });
      expect(updatedCustomer?.updatedAt).not.toEqual(testData.mediumRiskCustomer.updatedAt);
    });

    it('should return 404 for non-existent customer profile', async () => {
      const formData = new FormData();
      formData.append('updateType', 'recalculate_risk');

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/non-existent-hash',
        {
          method: 'POST',
          body: formData
        }
      );

      const params = { phoneHash: 'non-existent-hash' };
      const response = await action({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Customer profile not found');
    });

    it('should return 400 for invalid update type', async () => {
      const formData = new FormData();
      formData.append('updateType', 'invalid_type');

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        {
          method: 'POST',
          body: formData
        }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await action({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid update type');
    });

    it('should handle database errors gracefully', async () => {
      // Temporarily break the database connection
      const originalUpdate = testDb.customerProfile.update;
      testDb.customerProfile.update = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const formData = new FormData();
      formData.append('updateType', 'recalculate_risk');

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        {
          method: 'POST',
          body: formData
        }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await action({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');

      // Restore the original function
      testDb.customerProfile.update = originalUpdate;
    });
  });

  describe('Authentication and Authorization', () => {
    it('should deny access without proper permissions', async () => {
      // Mock no permissions
      const { hasPermission } = await import('../../../app/middleware/roleBasedAccess.server');
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to access customer API');

      // Restore permissions for other tests
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it('should deny customer management without proper permissions', async () => {
      // Mock insufficient permissions for customer management
      const { hasPermission } = await import('../../../app/middleware/roleBasedAccess.server');
      vi.mocked(hasPermission).mockImplementation((userSession, permission) => {
        if (permission === 'MANAGE_CUSTOMERS') return false;
        return true;
      });

      const formData = new FormData();
      formData.append('updateType', 'recalculate_risk');

      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        {
          method: 'POST',
          body: formData
        }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await action({ request, params, context: {} });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to manage customers');

      // Restore permissions
      vi.mocked(hasPermission).mockReturnValue(true);
    });
  });

  describe('Performance and Response Time', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data structure', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/zero-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'zero-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('customerProfile');
      expect(data).toHaveProperty('riskConfig');
      
      expect(data.customerProfile).toHaveProperty('id');
      expect(data.customerProfile).toHaveProperty('riskTier');
      expect(data.customerProfile).toHaveProperty('riskScore');
      expect(data.customerProfile).toHaveProperty('totalOrders');
      expect(data.customerProfile).toHaveProperty('failedAttempts');
      expect(data.customerProfile).toHaveProperty('successfulDeliveries');
      expect(data.customerProfile).toHaveProperty('returnRate');
      expect(data.customerProfile).toHaveProperty('lastEventAt');
      expect(data.customerProfile).toHaveProperty('createdAt');
      expect(data.customerProfile).toHaveProperty('updatedAt');

      expect(data.riskConfig).toHaveProperty('zeroRiskMaxFailed');
      expect(data.riskConfig).toHaveProperty('mediumRiskMaxFailed');
      expect(data.riskConfig).toHaveProperty('enableCodRestriction');
    });

    it('should maintain data types in API responses', async () => {
      const request = createTestRequest(
        'https://test-app.com/api/customer-profiles/medium-risk-customer-hash',
        { method: 'GET' }
      );

      const params = { phoneHash: 'medium-risk-customer-hash' };
      const response = await loader({ request, params, context: {} });
      const data = await response.json();

      expect(typeof data.customerProfile.riskScore).toBe('number');
      expect(typeof data.customerProfile.totalOrders).toBe('number');
      expect(typeof data.customerProfile.failedAttempts).toBe('number');
      expect(typeof data.customerProfile.returnRate).toBe('number');
      expect(typeof data.customerProfile.riskTier).toBe('string');
      expect(['ZERO_RISK', 'MEDIUM_RISK', 'HIGH_RISK']).toContain(data.customerProfile.riskTier);
    });
  });
}); 