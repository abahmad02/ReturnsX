# ReturnsX Testing Guide

This document provides comprehensive testing guidelines for the ReturnsX application, covering unit tests, integration tests, end-to-end tests, and CI/CD pipeline configuration.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Setup](#testing-setup)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [End-to-End Tests](#end-to-end-tests)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Coverage Requirements](#coverage-requirements)
8. [Best Practices](#best-practices)

## Testing Philosophy

ReturnsX follows a comprehensive testing strategy:

- **Unit Tests**: Test individual functions and modules in isolation
- **Integration Tests**: Test API endpoints and database operations
- **End-to-End Tests**: Test complete user workflows
- **Security Tests**: Validate security measures and compliance
- **Performance Tests**: Ensure acceptable response times

## Testing Setup

### Prerequisites

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up test database
createdb returnsx_test

# Set environment variables
export TEST_DATABASE_URL="postgresql://username:password@localhost:5432/returnsx_test"
export RETURNSX_HASH_SALT="test-salt-for-testing"
export RETURNSX_ENCRYPTION_KEY="test-encryption-key-32-characters-long"
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations on test database
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

## Unit Tests

Unit tests focus on testing individual functions and modules in isolation.

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific unit test file
npm run test:unit crypto.test.ts

# Run tests in watch mode
npm run test:watch
```

### Unit Test Structure

```typescript
// tests/unit/services/riskScoring.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateRiskScore } from '../../../app/services/riskScoring.server';

describe('Risk Scoring Service', () => {
  beforeEach(() => {
    // Setup for each test
  });

  describe('calculateRiskScore', () => {
    it('should calculate zero risk for new customers', () => {
      // Test implementation
    });
  });
});
```

### Critical Unit Tests

1. **Crypto Utilities** (`tests/unit/utils/crypto.test.ts`)
   - Phone number hashing consistency
   - Email normalization and hashing
   - Address formatting and hashing
   - Security properties (deterministic, avalanche effect)

2. **Risk Scoring Algorithm** (`tests/unit/services/riskScoring.test.ts`)
   - Risk calculation accuracy
   - Tier assignment logic
   - Confidence calculations
   - Time decay factors

3. **Customer Profile Management** (`tests/unit/services/customerProfile.test.ts`)
   - Profile creation and updates
   - Event recording
   - Manual overrides
   - Data validation

4. **WhatsApp Integration** (`tests/unit/services/whatsapp.test.ts`)
   - Message template generation
   - Phone number formatting
   - Configuration validation
   - Error handling

## Integration Tests

Integration tests validate API endpoints, database operations, and service interactions.

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run with database cleanup
npm run test:integration -- --run
```

### Integration Test Environment

Integration tests use a real PostgreSQL database with:
- Automatic schema migration
- Data seeding before each test
- Complete cleanup after each test
- Transaction rollback for isolation

### API Endpoint Tests

```typescript
// tests/integration/api/customerProfiles.integration.test.ts
describe('Customer Profiles API', () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it('should return customer profile for valid phone hash', async () => {
    const response = await request(app)
      .get('/api/customer-profiles/valid-hash')
      .expect(200);
      
    expect(response.body.success).toBe(true);
    expect(response.body.customerProfile).toBeDefined();
  });
});
```

### Database Integration Tests

- Customer profile CRUD operations
- Order event processing
- Risk configuration management
- Manual override recording
- Data consistency validation

## End-to-End Tests

E2E tests validate complete user workflows using Playwright.

### Running E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npx playwright test --headed

# Run specific test file
npx playwright test dashboard.spec.ts
```

### E2E Test Scenarios

1. **Dashboard Workflows**
   - Dashboard overview display
   - Navigation between pages
   - Quick actions functionality
   - Risk distribution visualization

2. **Settings Management**
   - Risk threshold configuration
   - WhatsApp settings setup
   - COD restriction toggles
   - Configuration persistence

3. **Customer Management**
   - Customer list viewing
   - Manual risk overrides
   - WhatsApp communication
   - Search and filtering

4. **Analytics & Reporting**
   - Metrics display
   - Date range filtering
   - Chart interactions
   - Data export

### E2E Test Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Test Stage**
   - Unit tests with coverage
   - Integration tests with real database
   - Linting and type checking
   - Security audit

2. **Build Stage**
   - Application build verification
   - Asset optimization
   - Build artifact validation

3. **E2E Stage**
   - Cross-browser testing
   - Mobile viewport testing
   - Screenshot comparisons

4. **Security Stage**
   - Dependency vulnerability scanning
   - License compliance checking
   - Security audit

5. **Deploy Stage**
   - Staging deployment (develop branch)
   - Production deployment (main branch)
   - Deployment notifications

### Pipeline Configuration

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
```

## Coverage Requirements

### Minimum Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Coverage Reporting

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/index.html
```

### Critical Code Coverage

- **Crypto utilities**: 100% coverage required
- **Risk scoring**: 95% coverage required
- **API endpoints**: 90% coverage required
- **Services**: 85% coverage required
- **UI components**: 80% coverage required

## Best Practices

### Test Organization

```
tests/
├── setup/                  # Test configuration
│   ├── vitest.setup.ts    # Global test setup
│   ├── unit.setup.ts      # Unit test helpers
│   └── integration.setup.ts # Integration test setup
├── unit/                   # Unit tests
│   ├── utils/             # Utility function tests
│   ├── services/          # Service layer tests
│   └── middleware/        # Middleware tests
├── integration/           # Integration tests
│   ├── api/              # API endpoint tests
│   ├── webhooks/         # Webhook handler tests
│   └── database/         # Database operation tests
└── e2e/                  # End-to-end tests
    ├── dashboard.spec.ts
    ├── settings.spec.ts
    └── customer.spec.ts
```

### Naming Conventions

- Test files: `*.test.ts` or `*.spec.ts`
- Unit tests: `*.unit.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts`

### Test Data Management

```typescript
// Use factories for test data
const createMockCustomerProfile = (overrides = {}) => ({
  id: 'test-customer-id',
  phoneHash: 'hashed-phone-number',
  riskTier: 'ZERO_RISK',
  ...overrides
});

// Use realistic test data
const testData = {
  phone: '+923001234567',
  email: 'customer@example.com',
  address: '123 Main Street, Karachi, Pakistan'
};
```

### Mocking Strategy

```typescript
// Mock external dependencies
vi.mock('../services/shopifyApi', () => ({
  createOrder: vi.fn().mockResolvedValue({ id: '12345' }),
  getCustomer: vi.fn().mockResolvedValue({ id: '67890' })
}));

// Mock environment variables
process.env.SHOPIFY_API_KEY = 'test_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
```

### Error Testing

```typescript
// Test error scenarios
it('should handle database connection errors', async () => {
  // Mock database failure
  mockPrisma.customerProfile.findUnique.mockRejectedValue(
    new Error('Database connection failed')
  );
  
  // Verify graceful error handling
  await expect(getCustomerProfile('test-id')).rejects.toThrow(
    'Database connection failed'
  );
});
```

### Performance Testing

```typescript
// Test response times
it('should respond within acceptable time limits', async () => {
  const startTime = Date.now();
  
  await calculateRiskScore(customerProfile);
  
  const responseTime = Date.now() - startTime;
  expect(responseTime).toBeLessThan(100); // 100ms threshold
});
```

### Security Testing

```typescript
// Test input validation
it('should reject invalid phone numbers', () => {
  expect(() => hashPhoneNumber('invalid')).toThrow();
  expect(() => hashPhoneNumber('')).toThrow();
  expect(() => hashPhoneNumber(null)).toThrow();
});

// Test authorization
it('should deny access without proper permissions', async () => {
  const response = await request(app)
    .get('/api/customer-profiles/test-hash')
    .set('Authorization', 'invalid-token')
    .expect(403);
});
```

## Debugging Tests

### Running Individual Tests

```bash
# Run specific test file
npm test crypto.test.ts

# Run specific test case
npm test -- --grep "should hash phone numbers"

# Run tests with debug output
DEBUG=* npm test
```

### Test Debugging Tools

- **Vitest UI**: Visual test runner and debugger
- **Playwright Inspector**: E2E test debugging
- **Coverage Reports**: Identify untested code
- **Test Profiling**: Performance analysis

### Common Issues

1. **Database Connection**: Ensure test database is running
2. **Environment Variables**: Check all required env vars are set
3. **Async Operations**: Use proper async/await patterns
4. **Test Isolation**: Ensure tests don't depend on each other
5. **Mocking**: Verify mocks are properly reset between tests

## Continuous Integration

### Local Testing

```bash
# Run full test suite (like CI)
npm run test:ci

# Check what CI will run
npm run lint && npm run typecheck && npm run test:coverage
```

### CI Environment Variables

Required environment variables for CI:

```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/returnsx_test
  RETURNSX_HASH_SALT: test-salt-for-ci
  RETURNSX_ENCRYPTION_KEY: test-encryption-key-32-characters-long
  SHOPIFY_API_KEY: test_api_key
  SHOPIFY_API_SECRET: test_api_secret
```

### Deployment Testing

Before deployment, the CI pipeline validates:

- All tests pass with 80%+ coverage
- Build completes successfully
- Security vulnerabilities are addressed
- Performance benchmarks are met
- E2E tests pass on multiple browsers

---

**Maintained by**: ReturnsX Development Team  
**Last Updated**: Phase 8 - Testing Implementation  
**Version**: 1.0 