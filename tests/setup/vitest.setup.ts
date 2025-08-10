import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/returnsx_test';
process.env.RETURNSX_HASH_SALT = 'test-salt-for-testing';
process.env.RETURNSX_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

console.log('✅ Vitest setup completed'); 