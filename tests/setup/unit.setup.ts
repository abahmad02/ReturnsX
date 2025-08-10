import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/returnsx_test';
process.env.RETURNSX_HASH_SALT = 'test-salt-for-unit-tests';
process.env.RETURNSX_ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock Shopify authentication
vi.mock('../app/shopify.server', () => ({
  authenticate: {
    admin: vi.fn().mockResolvedValue({
      admin: {
        rest: {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          delete: vi.fn()
        },
        graphql: vi.fn()
      },
      session: {
        id: 'test-session-id',
        shop: 'test-shop.myshopify.com',
        accessToken: 'test-access-token',
        userId: '123456789',
        accountOwner: true,
        collaborator: false,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }
    }),
    webhook: vi.fn()
  }
}));

// Mock Prisma client
vi.mock('../app/db.server', () => ({
  default: {
    customerProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    orderEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    riskConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn()
    },
    manualOverride: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

// Mock logger to prevent noise in tests
vi.mock('../app/services/logger.server', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    customerProfileCreated: vi.fn(),
    customerProfileUpdated: vi.fn(),
    riskCalculated: vi.fn(),
    orderEventRecorded: vi.fn(),
    createRequestLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }))
  },
  PerformanceTimer: vi.fn(() => ({
    start: vi.fn(),
    finish: vi.fn(),
    finishWithError: vi.fn()
  }))
}));

// Helper function to create mock customer profile
export const createMockCustomerProfile = (overrides = {}) => ({
  id: 'test-customer-id',
  phoneHash: 'hashed-phone-number',
  emailHash: 'hashed-email',
  addressHash: 'hashed-address',
  totalOrders: 5,
  failedAttempts: 1,
  successfulDeliveries: 4,
  returnRate: 20.0,
  riskScore: 15.5,
  riskTier: 'ZERO_RISK',
  lastEventAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  orderEvents: [],
  manualOverrides: [],
  ...overrides
});

// Helper function to create mock order event
export const createMockOrderEvent = (overrides = {}) => ({
  id: 'test-event-id',
  customerProfileId: 'test-customer-id',
  shopDomain: 'test-shop.myshopify.com',
  shopifyOrderId: '123456789',
  eventType: 'ORDER_CREATED',
  orderValue: 1000.00,
  currency: 'PKR',
  cancelReason: null,
  fulfillmentStatus: null,
  refundAmount: null,
  eventData: {},
  createdAt: new Date('2024-01-15'),
  ...overrides
});

// Helper function to create mock risk config
export const createMockRiskConfig = (overrides = {}) => ({
  id: 'test-config-id',
  shopDomain: 'test-shop.myshopify.com',
  zeroRiskMaxFailed: 2,
  zeroRiskMaxReturnRate: 10.0,
  mediumRiskMaxFailed: 5,
  mediumRiskMaxReturnRate: 30.0,
  highRiskThreshold: 30.0,
  enableCodRestriction: true,
  depositPercentage: 50.0,
  notificationEmail: 'admin@test-shop.com',
  enableCheckoutEnforcement: false,
  whatsappNumber: null,
  zeroRiskMessage: null,
  mediumRiskMessage: null,
  highRiskMessage: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
});

// Helper function to create mock Shopify order
export const createMockShopifyOrder = (overrides = {}) => ({
  id: 123456789,
  order_number: 1001,
  email: 'customer@example.com',
  phone: '+923001234567',
  total_price: '1000.00',
  currency: 'PKR',
  financial_status: 'pending',
  fulfillment_status: null,
  cancelled_at: null,
  cancel_reason: null,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  customer: {
    id: 987654321,
    email: 'customer@example.com',
    phone: '+923001234567'
  },
  billing_address: {
    phone: '+923001234567',
    address1: '123 Test Street',
    city: 'Karachi',
    province: 'Sindh',
    country: 'Pakistan'
  },
  shipping_address: {
    phone: '+923001234567',
    address1: '123 Test Street',
    city: 'Karachi',
    province: 'Sindh',
    country: 'Pakistan'
  },
  line_items: [
    {
      id: 111222333,
      title: 'Test Product',
      quantity: 1,
      price: '1000.00'
    }
  ],
  payment_gateway_names: ['cash_on_delivery'],
  tags: '',
  ...overrides
});

// Helper to reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
}; 