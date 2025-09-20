/**
 * API Client Authentication Integration Tests
 * 
 * Tests the integration between the API client and authentication service including:
 * - Session token initialization
 * - Authenticated API requests
 * - Token refresh during API calls
 * - Authentication error handling
 * - Fallback behavior when authentication fails
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReturnsXApiClient, createApiClient, createAuthenticatedApiClient } from '../apiClient';
import { ErrorType } from '../../types';

// Mock fetch
const mockFetch = vi.fn();

// Mock Web Crypto API
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

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

beforeEach(() => {
  global.fetch = mockFetch;
  
  // Mock crypto API
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true,
  });
  
  // Mock localStorage
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API Client Authentication Integration', () => {
  const mockConfig = {
    baseUrl: 'https://api.returnsx.com',
    enableDebug: false,
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
  };

  const createValidSessionToken = (customerId = 'customer_123') => {
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
  };

  describe('Authenticated API Client Creation', () => {
    it('should create authenticated API client with valid session token', async () => {
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

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      expect(client).toBeInstanceOf(ReturnsXApiClient);
      
      const authState = client.getAuthenticationState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.customerId).toBe('customer_123');
    });

    it('should handle authentication failure during client creation', async () => {
      const sessionToken = createValidSessionToken();

      // Mock failed token exchange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      const authState = client.getAuthenticationState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });
  });

  describe('Authenticated API Requests', () => {
    it('should make authenticated risk profile request', async () => {
      const sessionToken = createValidSessionToken();

      // Mock token exchange
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

      // Mock successful risk profile request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          riskTier: 'MEDIUM_RISK',
          riskScore: 65,
          totalOrders: 10,
          failedAttempts: 3,
          successfulDeliveries: 7,
          isNewCustomer: false,
          message: 'Moderate risk customer',
        }),
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);
      
      const riskProfile = await client.getRiskProfile({
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: 'order_123',
      });

      expect(riskProfile.success).toBe(true);
      expect(riskProfile.riskTier).toBe('MEDIUM_RISK');

      // Verify authentication headers were sent
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.returnsx.com/api/risk-profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_access_token',
            'X-Shop-Domain': 'test-shop.myshopify.com',
            'X-Customer-ID': 'customer_123',
          }),
        })
      );
    });

    it('should handle authentication error during API request', async () => {
      const sessionToken = createValidSessionToken();

      // Mock token exchange
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

      // Mock authentication error in API request
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);
      
      const riskProfile = await client.getRiskProfile({
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: 'order_123',
      });

      expect(riskProfile.success).toBe(false);
      expect(riskProfile.isNewCustomer).toBe(true); // Fallback behavior
      expect(riskProfile.error).toContain('Authentication failed');
    });
  });

  describe('Token Refresh During API Calls', () => {
    it('should refresh token when it expires during API call', async () => {
      const sessionToken = createValidSessionToken();

      // Mock initial token exchange with short-lived token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'initial_access_token',
          refreshToken: 'initial_refresh_token',
          expiresAt: Date.now() + 200000, // Expires soon (within refresh threshold)
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'refreshed_access_token',
          refreshToken: 'refreshed_refresh_token',
          expiresAt: Date.now() + 3600000,
        }),
      });

      // Mock successful API request with refreshed token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          riskTier: 'ZERO_RISK',
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          isNewCustomer: true,
          message: 'New customer',
        }),
      });

      const riskProfile = await client.getRiskProfile({
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: 'order_123',
      });

      expect(riskProfile.success).toBe(true);

      // Verify token refresh was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer initial_access_token',
          }),
        })
      );

      // Verify API request used refreshed token
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.returnsx.com/api/risk-profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer refreshed_access_token',
          }),
        })
      );
    });

    it('should handle token refresh failure', async () => {
      const sessionToken = createValidSessionToken();

      // Mock initial token exchange with short-lived token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'initial_access_token',
          refreshToken: 'initial_refresh_token',
          expiresAt: Date.now() + 200000, // Expires soon
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      // Mock token refresh failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const riskProfile = await client.getRiskProfile({
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: 'order_123',
      });

      expect(riskProfile.success).toBe(false);
      expect(riskProfile.error).toContain('Authentication required but not available');
    });
  });

  describe('Fallback to Legacy Authentication', () => {
    it('should use legacy auth token when no session token provided', async () => {
      const client = createApiClient({
        ...mockConfig,
        authToken: 'legacy_auth_token',
      });

      // Mock successful API request with legacy auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          riskTier: 'HIGH_RISK',
          riskScore: 85,
          totalOrders: 20,
          failedAttempts: 10,
          successfulDeliveries: 10,
          isNewCustomer: false,
          message: 'High risk customer',
        }),
      });

      const riskProfile = await client.getRiskProfile({
        phone: '+923001234567',
        email: 'test@example.com',
        orderId: 'order_123',
      });

      expect(riskProfile.success).toBe(true);
      expect(riskProfile.riskTier).toBe('HIGH_RISK');

      // Verify legacy auth header was used
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/api/risk-profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer legacy_auth_token',
          }),
        })
      );
    });
  });

  describe('Authentication State Management', () => {
    it('should provide current authentication state', async () => {
      const sessionToken = createValidSessionToken();

      // Mock token exchange
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

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);
      
      const authState = client.getAuthenticationState();
      
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.customerId).toBe('customer_123');
      expect(authState.shopDomain).toBe('test-shop.myshopify.com');
      expect(authState.credentials?.accessToken).toBe('test_access_token');
    });

    it('should update session token', async () => {
      const initialSessionToken = createValidSessionToken('customer_123');
      const newSessionToken = createValidSessionToken('customer_456');

      // Mock initial token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'initial_access_token',
          refreshToken: 'initial_refresh_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      const client = await createAuthenticatedApiClient(mockConfig, initialSessionToken);
      
      // Mock new token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          customerId: 'customer_456',
        }),
      });

      const updateSuccess = await client.updateSessionToken(newSessionToken);
      
      expect(updateSuccess).toBe(true);
      
      const authState = client.getAuthenticationState();
      expect(authState.customerId).toBe('customer_456');
      expect(authState.credentials?.accessToken).toBe('new_access_token');
    });

    it('should clear authentication', async () => {
      const sessionToken = createValidSessionToken();

      // Mock token exchange
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

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);
      
      expect(client.getAuthenticationState().isAuthenticated).toBe(true);
      
      await client.clearAuthentication();
      
      const authState = client.getAuthenticationState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.credentials).toBeUndefined();
    });
  });

  describe('Health Check with Authentication', () => {
    it('should perform authenticated health check', async () => {
      const sessionToken = createValidSessionToken();

      // Mock token exchange
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

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);
      
      const isHealthy = await client.healthCheck();
      
      expect(isHealthy).toBe(true);
      
      // Verify health check used authentication headers
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.returnsx.com/api/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_access_token',
            'X-Shop-Domain': 'test-shop.myshopify.com',
            'X-Customer-ID': 'customer_123',
          }),
        })
      );
    });
  });

  describe('Error Recovery', () => {
    it('should attempt authentication recovery on auth errors', async () => {
      const sessionToken = createValidSessionToken();

      // Mock initial token exchange
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

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      // Mock authentication error
      const authError = new Error('HTTP 401: Unauthorized');
      
      // Mock successful recovery (new token exchange)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'recovered_access_token',
          refreshToken: 'recovered_refresh_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      const recoverySuccess = await client.handleAuthenticationError(authError);
      
      expect(recoverySuccess).toBe(true);
      
      const authState = client.getAuthenticationState();
      expect(authState.credentials?.accessToken).toBe('recovered_access_token');
    });

    it('should handle authentication recovery failure', async () => {
      const sessionToken = createValidSessionToken();

      // Mock initial token exchange
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

      const client = await createAuthenticatedApiClient(mockConfig, sessionToken);

      // Mock authentication error
      const authError = new Error('HTTP 401: Unauthorized');
      
      // Mock failed recovery
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const recoverySuccess = await client.handleAuthenticationError(authError);
      
      expect(recoverySuccess).toBe(false);
    });
  });
});