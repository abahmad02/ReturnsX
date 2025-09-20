/**
 * Authentication Service Tests
 * 
 * Tests for the ReturnsX authentication service integration including:
 * - Session token validation
 * - Token exchange and refresh
 * - Secure credential storage
 * - Error handling
 * - Integration with existing ReturnsX auth system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthenticationService, createAuthService, DEFAULT_AUTH_CONFIG } from '../authService';
import { ErrorType } from '../../types';

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

// Mock fetch
const mockFetch = vi.fn();

// Setup global mocks
beforeEach(() => {
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
  
  global.fetch = mockFetch;
  global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));
  global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));
  global.Buffer = Buffer;
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  
  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  const mockConfig = {
    apiEndpoint: 'https://api.returnsx.com',
    enableDebug: false,
    tokenRefreshThreshold: 300,
    maxRetryAttempts: 3,
    retryDelay: 1000,
  };

  beforeEach(() => {
    authService = createAuthService(mockConfig);
  });

  describe('Session Token Validation', () => {
    it('should validate a valid session token', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

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

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.customerId).toBe('customer_123');
      expect(authState.shopDomain).toBe('test-shop.myshopify.com');
      expect(authState.credentials?.accessToken).toBe('test_access_token');
    });

    it('should reject expired session token', async () => {
      const expiredPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        iat: Math.floor(Date.now() / 1000) - 7200,
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });

    it('should reject malformed session token', async () => {
      const malformedToken = 'invalid.token';

      const authState = await authService.initializeWithSessionToken(malformedToken);

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });

    it('should handle anonymous customers', async () => {
      const anonymousPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'anonymous',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(anonymousPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      // Mock successful token exchange for anonymous user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'test_access_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
        }),
      });

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.customerId).toBeUndefined();
      expect(authState.shopDomain).toBe('test-shop.myshopify.com');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange session token for API credentials', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'exchanged_access_token',
          refreshToken: 'exchanged_refresh_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/auth/exchange-token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken,
          }),
          body: JSON.stringify({
            shopDomain: 'test-shop.myshopify.com',
            grantType: 'session_token',
          }),
        })
      );

      expect(authState.credentials?.accessToken).toBe('exchanged_access_token');
      expect(authState.credentials?.refreshToken).toBe('exchanged_refresh_token');
    });

    it('should handle token exchange failure', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBeDefined();
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh expiring tokens', async () => {
      // Setup initial authentication
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      // Mock initial token exchange
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

      await authService.initializeWithSessionToken(sessionToken);

      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'refreshed_access_token',
          refreshToken: 'refreshed_refresh_token',
          expiresAt: Date.now() + 3600000,
        }),
      });

      const isAuthenticated = await authService.ensureAuthenticated();

      expect(isAuthenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer initial_access_token',
          }),
        })
      );

      const authState = authService.getAuthState();
      expect(authState.credentials?.accessToken).toBe('refreshed_access_token');
    });

    it('should handle refresh token failure', async () => {
      // Setup initial authentication with expiring token
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

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

      await authService.initializeWithSessionToken(sessionToken);

      // Mock refresh failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const isAuthenticated = await authService.ensureAuthenticated();

      expect(isAuthenticated).toBe(false);
      const authState = authService.getAuthState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });
  });

  describe('Credential Storage', () => {
    it('should store and retrieve credentials securely', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      // Mock crypto operations for encryption
      mockCrypto.getRandomValues.mockImplementation((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      });
      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));

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

      await authService.initializeWithSessionToken(sessionToken);

      // Verify credentials were stored
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'returnsx_auth_test-shop.myshopify.com',
        expect.any(String)
      );
    });

    it('should load stored credentials on initialization', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      // Mock stored credentials
      const storedCredentials = {
        accessToken: 'stored_access_token',
        refreshToken: 'stored_refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        shopDomain: 'test-shop.myshopify.com',
        customerId: 'customer_123',
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedCredentials));

      // Mock crypto operations for decryption
      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(storedCredentials))
      );

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.credentials?.accessToken).toBe('stored_access_token');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not exchange token if stored credentials are valid
    });

    it('should clear expired stored credentials', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      // Mock expired stored credentials
      const expiredCredentials = {
        accessToken: 'expired_access_token',
        refreshToken: 'expired_refresh_token',
        expiresAt: Date.now() - 3600000, // Expired 1 hour ago
        tokenType: 'Bearer',
        shopDomain: 'test-shop.myshopify.com',
        customerId: 'customer_123',
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredCredentials));

      // Mock crypto operations for decryption
      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(expiredCredentials))
      );

      // Mock new token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          customerId: 'customer_123',
        }),
      });

      await authService.initializeWithSessionToken(sessionToken);

      // Should clear expired credentials
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('returnsx_auth_test-shop.myshopify.com');
      
      // Should exchange for new token
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.returnsx.com/auth/exchange-token',
        expect.any(Object)
      );
    });
  });

  describe('Authentication Headers', () => {
    it('should provide correct authentication headers', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

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

      await authService.initializeWithSessionToken(sessionToken);

      const headers = authService.getAuthHeaders();

      expect(headers).toEqual({
        'Authorization': 'Bearer test_access_token',
        'X-Shop-Domain': 'test-shop.myshopify.com',
        'X-Customer-ID': 'customer_123',
      });
    });

    it('should return empty headers when not authenticated', () => {
      const headers = authService.getAuthHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during token exchange', async () => {
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const authState = await authService.initializeWithSessionToken(sessionToken);

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBeDefined();
      expect(authState.error?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(authState.error?.retryable).toBe(true);
    });

    it('should handle authentication errors appropriately', () => {
      const networkError = new Error('network error');
      const errorState = authService.handleAuthError(networkError);

      expect(errorState.type).toBe(ErrorType.NETWORK_ERROR);
      expect(errorState.retryable).toBe(true);
    });

    it('should handle expired token errors', () => {
      const expiredError = new Error('Token expired');
      const errorState = authService.handleAuthError(expiredError);

      expect(errorState.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(errorState.retryable).toBe(true);
    });
  });

  describe('Authentication State Management', () => {
    it('should clear authentication state', async () => {
      // Setup authentication first
      const validPayload = {
        iss: 'https://test-shop.myshopify.com',
        dest: 'https://test-shop.myshopify.com',
        aud: 'returnsx',
        sub: 'customer_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'test_jwt_id',
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
      const signature = 'test_signature';
      const sessionToken = `${header}.${payload}.${signature}`;

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

      await authService.initializeWithSessionToken(sessionToken);
      expect(authService.getAuthState().isAuthenticated).toBe(true);

      // Clear authentication
      await authService.clearAuthentication();

      const authState = authService.getAuthState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.credentials).toBeUndefined();
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });
  });
});

describe('createAuthService', () => {
  it('should create authentication service with default config', () => {
    const authService = createAuthService({});
    expect(authService).toBeInstanceOf(AuthenticationService);
  });

  it('should create authentication service with custom config', () => {
    const customConfig = {
      apiEndpoint: 'https://custom.api.com',
      enableDebug: true,
      tokenRefreshThreshold: 600,
    };

    const authService = createAuthService(customConfig);
    expect(authService).toBeInstanceOf(AuthenticationService);
  });
});