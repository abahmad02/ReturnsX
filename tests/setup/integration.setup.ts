import '@testing-library/jest-dom';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Use a separate test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/returnsx_test';
process.env.RETURNSX_HASH_SALT = 'test-salt-for-integration-tests';
process.env.RETURNSX_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';
process.env.TWILIO_ACCOUNT_SID = 'test_twilio_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_twilio_token';
process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+15551234567';

// Global test database instance
let testDb: PrismaClient;

beforeAll(async () => {
  // Initialize test database
  try {
    // Reset the test database schema
    execSync('npx prisma migrate reset --force --skip-seed', {
      env: process.env,
      stdio: 'inherit'
    });
    
    // Run migrations
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'inherit'
    });
    
    // Generate Prisma client
    execSync('npx prisma generate', {
      env: process.env,
      stdio: 'inherit'
    });

    // Initialize Prisma client for tests
    testDb = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    await testDb.$connect();
    console.log('✅ Test database initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    process.exit(1);
  }
});

afterAll(async () => {
  // Clean up database connection
  if (testDb) {
    await testDb.$disconnect();
  }
});

beforeEach(async () => {
  // Clean up all tables before each test for isolation
  const tablenames = await testDb.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  // Clean up tables in the correct order to avoid foreign key constraints
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      await testDb.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
    }
  }
});

// Export test database for use in integration tests
export { testDb };

// Helper function to seed test data
export const seedTestData = async () => {
  // Create a test shop configuration
  const testRiskConfig = await testDb.riskConfig.create({
    data: {
      shopDomain: 'test-shop.myshopify.com',
      zeroRiskMaxFailed: 2,
      zeroRiskMaxReturnRate: 10.0,
      mediumRiskMaxFailed: 5,
      mediumRiskMaxReturnRate: 30.0,
      highRiskThreshold: 30.0,
      enableCodRestriction: true,
      depositPercentage: 50.0,
      notificationEmail: 'admin@test-shop.com'
    }
  });

  // Create test customer profiles
  const zeroRiskCustomer = await testDb.customerProfile.create({
    data: {
      phoneHash: 'zero-risk-customer-hash',
      emailHash: 'zero-risk-email-hash',
      addressHash: 'zero-risk-address-hash',
      totalOrders: 5,
      failedAttempts: 0,
      successfulDeliveries: 5,
      returnRate: 0.0,
      riskScore: 5.0,
      riskTier: 'ZERO_RISK'
    }
  });

  const mediumRiskCustomer = await testDb.customerProfile.create({
    data: {
      phoneHash: 'medium-risk-customer-hash',
      emailHash: 'medium-risk-email-hash',
      addressHash: 'medium-risk-address-hash',
      totalOrders: 10,
      failedAttempts: 3,
      successfulDeliveries: 7,
      returnRate: 30.0,
      riskScore: 25.0,
      riskTier: 'MEDIUM_RISK'
    }
  });

  const highRiskCustomer = await testDb.customerProfile.create({
    data: {
      phoneHash: 'high-risk-customer-hash',
      emailHash: 'high-risk-email-hash',
      addressHash: 'high-risk-address-hash',
      totalOrders: 8,
      failedAttempts: 6,
      successfulDeliveries: 2,
      returnRate: 75.0,
      riskScore: 85.0,
      riskTier: 'HIGH_RISK'
    }
  });

  // Create some order events
  await testDb.orderEvent.createMany({
    data: [
      {
        customerProfileId: zeroRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100001',
        eventType: 'ORDER_CREATED',
        orderValue: 1000.00,
        currency: 'PKR',
        eventData: { orderNumber: '1001' }
      },
      {
        customerProfileId: zeroRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100001',
        eventType: 'ORDER_FULFILLED',
        orderValue: 1000.00,
        currency: 'PKR',
        eventData: { orderNumber: '1001' }
      },
      {
        customerProfileId: mediumRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100002',
        eventType: 'ORDER_CREATED',
        orderValue: 1500.00,
        currency: 'PKR',
        eventData: { orderNumber: '1002' }
      },
      {
        customerProfileId: mediumRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100002',
        eventType: 'ORDER_CANCELLED',
        orderValue: 1500.00,
        currency: 'PKR',
        cancelReason: 'customer_changed_mind',
        eventData: { orderNumber: '1002' }
      },
      {
        customerProfileId: highRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100003',
        eventType: 'ORDER_CREATED',
        orderValue: 2000.00,
        currency: 'PKR',
        eventData: { orderNumber: '1003' }
      },
      {
        customerProfileId: highRiskCustomer.id,
        shopDomain: 'test-shop.myshopify.com',
        shopifyOrderId: '100003',
        eventType: 'ORDER_REFUNDED',
        orderValue: 2000.00,
        currency: 'PKR',
        refundAmount: 2000.00,
        eventData: { orderNumber: '1003' }
      }
    ]
  });

  return {
    testRiskConfig,
    zeroRiskCustomer,
    mediumRiskCustomer,
    highRiskCustomer
  };
};

// Helper function to create test request context
export const createTestRequest = (url: string, options: RequestInit = {}) => {
  return new Request(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
      'X-Shopify-Hmac-Sha256': 'test-hmac',
      ...options.headers
    },
    ...options
  });
};

// Helper function to create mock Shopify session for integration tests
export const createTestSession = (overrides = {}) => ({
  id: 'test-session-id',
  shop: 'test-shop.myshopify.com',
  accessToken: 'test-access-token',
  userId: BigInt(123456789),
  accountOwner: true,
  collaborator: false,
  email: 'admin@test-shop.com',
  firstName: 'Test',
  lastName: 'Admin',
  isOnline: true,
  scope: 'read_orders,read_customers,read_fulfillments,read_refunds',
  expires: new Date(Date.now() + 3600000), // 1 hour from now
  state: 'test-state',
  emailVerified: true,
  locale: 'en',
  ...overrides
});

console.log('✅ Integration test setup completed'); 