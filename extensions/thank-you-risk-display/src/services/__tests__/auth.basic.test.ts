/**
 * Basic Authentication Integration Test
 * 
 * Simple test to verify the authentication system works with the API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuthService } from '../authService';
import { createApiClient } from '../apiClient';

// Mock fetch
const mockFetch = vi.fn();

// Mock crypto and localStorage
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
  },
  getRandomValues: vi.fn(),
};

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

beforeEach(() => {
  global.fetch = mockFetch;
  
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true,
  });
  
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  
  global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));
  global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));
  global.Buffer = Buffer;
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  
  vi.clearAllMocks();
});

describe('Basic Authentication Integration', () => {
  it('should create authentication service', () => {
    const authService = createAuthService({
      apiEndpoint: 'https://api.returnsx.com',
      enableDebug: false,
    });
    
    expect(authService).toBeDefined();
    expect(authService.getAuthState().isAuthenticated).toBe(false);
  });

  it('should create API client', () => {
    const apiClient = createApiClient({
      baseUrl: 'https://api.returnsx.com',
      enableDebug: false,
    });
    
    expect(apiClient).toBeDefined();
  });

  it('should handle authentication state in API client', () => {
    const apiClient = createApiClient({
      baseUrl: 'https://api.returnsx.com',
      enableDebug: false,
    });
    
    const authState = apiClient.getAuthenticationState();
    expect(authState.isAuthenticated).toBe(false);
  });

  it('should provide authentication headers when authenticated', async () => {
    const sessionToken = createValidSessionToken();
    
    // Mock successful token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        customerId: 'customer_123',
      }),
    });

    const apiClient = createApiClient({
      baseUrl: 'https://api.returnsx.com',
      sessionToken,
      enableDebug: false,
    });

    // Initialize authentication
    const initSuccess = await apiClient.initializeAuthentication(sessionToken);
    expect(initSuccess).toBe(true);

    const authState = apiClient.getAuthenticationState();
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.customerId).toBe('customer_123');
  });
});

function createValidSessionToken(customerId = 'customer_123') {
  const payload = {
    iss: 'https://test-shop.myshopify.com',
    dest: 'https://test-shop.myshopify.com',
    aud: 'returnsx',
    sub: customerId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'test_jwt_id',
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'test_signature';
  
  return `${header}.${payloadEncoded}.${signature}`;
}