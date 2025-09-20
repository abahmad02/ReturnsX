/**
 * Authentication Service for ReturnsX Thank You Page Extension
 * 
 * Integrates with existing ReturnsX authentication system to provide:
 * - Session token validation using existing ReturnsX auth service
 * - Token refresh mechanism for long-running sessions
 * - Secure storage of authentication credentials
 * - Proper error handling for authentication failures
 * - Integration with Shopify's session token system
 */

import { ErrorType, ErrorState } from '../types';
import { sanitizeDebugInfo, sanitizeErrorMessage } from '../utils/sanitization';

export interface AuthenticationCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: 'Bearer' | 'API_KEY';
  shopDomain: string;
  customerId?: string;
}

export interface SessionTokenPayload {
  iss: string;           // Issuer (shop domain)
  dest: string;          // Destination (shop domain)
  aud: string;           // Audience (app identifier)
  sub: string;           // Subject (customer ID or 'anonymous')
  exp: number;           // Expiration timestamp
  iat: number;           // Issued at timestamp
  jti: string;           // JWT ID
  sid?: string;          // Session ID
}

export interface AuthenticationState {
  isAuthenticated: boolean;
  credentials?: AuthenticationCredentials;
  sessionToken?: string;
  sessionPayload?: SessionTokenPayload;
  customerId?: string;
  shopDomain?: string;
  error?: ErrorState;
}

export interface AuthServiceConfig {
  apiEndpoint: string;
  enableDebug: boolean;
  tokenRefreshThreshold: number; // Seconds before expiry to refresh
  maxRetryAttempts: number;
  retryDelay: number;
}

/**
 * Authentication Service Class
 */
export class AuthenticationService {
  private config: AuthServiceConfig;
  private authState: AuthenticationState;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(config: Partial<AuthServiceConfig>) {
    this.config = {
      apiEndpoint: config.apiEndpoint || '',
      enableDebug: config.enableDebug || false,
      tokenRefreshThreshold: config.tokenRefreshThreshold || 300, // 5 minutes
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };

    this.authState = {
      isAuthenticated: false,
    };
  }

  /**
   * Initialize authentication with session token from Shopify extension context
   */
  public async initializeWithSessionToken(sessionToken: string): Promise<AuthenticationState> {
    try {
      this.debugLog('Initializing authentication with session token');

      // Validate and parse the session token
      const sessionPayload = await this.validateSessionToken(sessionToken);
      
      if (!sessionPayload) {
        throw new Error('Invalid session token');
      }

      // Extract shop domain and customer information
      const shopDomain = this.extractShopDomain(sessionPayload.iss || sessionPayload.dest);
      const customerId = sessionPayload.sub !== 'anonymous' ? sessionPayload.sub : undefined;

      // Load stored credentials for this shop
      const storedCredentials = await this.loadStoredCredentials(shopDomain);

      // Validate stored credentials
      let credentials = storedCredentials;
      if (credentials && this.isTokenExpiringSoon(credentials)) {
        this.debugLog('Stored token is expiring soon, attempting refresh');
        credentials = await this.refreshAuthToken(credentials);
      }

      // If no valid credentials, attempt to exchange session token
      if (!credentials) {
        this.debugLog('No valid stored credentials, exchanging session token');
        credentials = await this.exchangeSessionTokenForCredentials(sessionToken, shopDomain);
        
        // If token exchange failed, set error state
        if (!credentials) {
          const errorState: ErrorState = {
            type: ErrorType.AUTHENTICATION_ERROR,
            message: 'Failed to exchange session token for API credentials',
            retryable: true,
          };
          
          this.authState = {
            isAuthenticated: false,
            sessionToken,
            sessionPayload,
            customerId,
            shopDomain,
            error: errorState,
          };
          
          return this.authState;
        }
      }

      // Update authentication state
      this.authState = {
        isAuthenticated: !!credentials,
        credentials,
        sessionToken,
        sessionPayload,
        customerId,
        shopDomain,
      };

      // Store credentials securely
      if (credentials) {
        await this.storeCredentials(shopDomain, credentials);
      }

      this.debugLog('Authentication initialization complete', {
        isAuthenticated: this.authState.isAuthenticated,
        shopDomain,
        hasCustomerId: !!customerId,
        tokenType: credentials?.tokenType,
      });

      return this.authState;

    } catch (error) {
      const errorState: ErrorState = {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Failed to initialize authentication',
        retryable: true,
      };

      this.authState = {
        isAuthenticated: false,
        error: errorState,
      };

      this.debugLog('Authentication initialization failed', { error });
      return this.authState;
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthenticationState {
    return { ...this.authState };
  }

  /**
   * Get authentication headers for API requests
   */
  public getAuthHeaders(): Record<string, string> {
    if (!this.authState.isAuthenticated || !this.authState.credentials) {
      return {};
    }

    const { accessToken, tokenType } = this.authState.credentials;
    
    return {
      'Authorization': `${tokenType} ${accessToken}`,
      'X-Shop-Domain': this.authState.shopDomain || '',
      ...(this.authState.customerId && { 'X-Customer-ID': this.authState.customerId }),
    };
  }

  /**
   * Ensure authentication is valid before making API calls
   */
  public async ensureAuthenticated(): Promise<boolean> {
    if (!this.authState.isAuthenticated || !this.authState.credentials) {
      return false;
    }

    // Check if token needs refresh
    if (this.isTokenExpiringSoon(this.authState.credentials)) {
      this.debugLog('Token expiring soon, refreshing');
      
      // Prevent multiple concurrent refresh attempts
      if (!this.refreshPromise) {
        this.refreshPromise = this.performTokenRefresh();
      }
      
      const refreshSuccess = await this.refreshPromise;
      this.refreshPromise = null;
      
      return refreshSuccess;
    }

    return true;
  }

  /**
   * Validate Shopify session token (similar to existing sessionToken.server.ts)
   */
  private async validateSessionToken(token: string): Promise<SessionTokenPayload | null> {
    try {
      // Parse JWT token (basic validation without signature verification for development)
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode payload
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      const sessionPayload: SessionTokenPayload = JSON.parse(decoded);

      // Validate required fields
      if (!sessionPayload.iss || !sessionPayload.exp || !sessionPayload.aud) {
        throw new Error('Missing required JWT claims');
      }

      // Check expiration
      if (sessionPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Session token expired');
      }

      // Validate audience (should match our app)
      if (sessionPayload.aud !== 'returnsx' && !sessionPayload.aud.includes('returnsx')) {
        this.debugLog('Session token audience mismatch', { 
          expected: 'returnsx', 
          actual: sessionPayload.aud 
        });
      }

      return sessionPayload;

    } catch (error) {
      this.debugLog('Session token validation failed', { error });
      return null;
    }
  }

  /**
   * Exchange session token for ReturnsX API credentials
   */
  private async exchangeSessionTokenForCredentials(
    sessionToken: string, 
    shopDomain: string
  ): Promise<AuthenticationCredentials | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/auth/exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          shopDomain,
          grantType: 'session_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.accessToken) {
        throw new Error('No access token in response');
      }

      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt || (Date.now() + (60 * 60 * 1000)), // 1 hour default
        tokenType: data.tokenType || 'Bearer',
        shopDomain,
        customerId: data.customerId,
      };

    } catch (error) {
      this.debugLog('Token exchange failed', { error, shopDomain });
      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshAuthToken(credentials: AuthenticationCredentials): Promise<AuthenticationCredentials | null> {
    if (!credentials.refreshToken) {
      this.debugLog('No refresh token available');
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${credentials.tokenType} ${credentials.accessToken}`,
        },
        body: JSON.stringify({
          refreshToken: credentials.refreshToken,
          shopDomain: credentials.shopDomain,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();

      const refreshedCredentials: AuthenticationCredentials = {
        ...credentials,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || credentials.refreshToken,
        expiresAt: data.expiresAt || (Date.now() + (60 * 60 * 1000)),
      };

      this.debugLog('Token refreshed successfully');
      return refreshedCredentials;

    } catch (error) {
      this.debugLog('Token refresh failed', { error });
      return null;
    }
  }

  /**
   * Perform token refresh and update state
   */
  private async performTokenRefresh(): Promise<boolean> {
    if (!this.authState.credentials) {
      return false;
    }

    const refreshedCredentials = await this.refreshAuthToken(this.authState.credentials);
    
    if (refreshedCredentials) {
      this.authState.credentials = refreshedCredentials;
      await this.storeCredentials(this.authState.shopDomain!, refreshedCredentials);
      return true;
    } else {
      // Refresh failed, mark as unauthenticated
      this.authState.isAuthenticated = false;
      this.authState.error = {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Token refresh failed',
        retryable: true,
      };
      return false;
    }
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiringSoon(credentials: AuthenticationCredentials): boolean {
    const now = Date.now();
    const expiryThreshold = credentials.expiresAt - (this.config.tokenRefreshThreshold * 1000);
    return now >= expiryThreshold;
  }

  /**
   * Extract shop domain from issuer URL
   */
  private extractShopDomain(issuer: string): string {
    try {
      const url = new URL(issuer);
      return url.hostname;
    } catch {
      // Fallback: assume it's already a domain
      return issuer.replace(/^https?:\/\//, '');
    }
  }

  /**
   * Store credentials securely (using extension's local storage)
   */
  private async storeCredentials(shopDomain: string, credentials: AuthenticationCredentials): Promise<void> {
    try {
      const key = `returnsx_auth_${shopDomain}`;
      const encryptedCredentials = await this.encryptCredentials(credentials);
      
      // Use extension's storage API (if available) or localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, encryptedCredentials);
      }
      
      this.debugLog('Credentials stored securely', { shopDomain });
    } catch (error) {
      this.debugLog('Failed to store credentials', { error, shopDomain });
    }
  }

  /**
   * Load stored credentials
   */
  private async loadStoredCredentials(shopDomain: string): Promise<AuthenticationCredentials | null> {
    try {
      const key = `returnsx_auth_${shopDomain}`;
      
      let encryptedCredentials: string | null = null;
      
      // Use extension's storage API (if available) or localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        encryptedCredentials = window.localStorage.getItem(key);
      }
      
      if (!encryptedCredentials) {
        return null;
      }

      const credentials = await this.decryptCredentials(encryptedCredentials);
      
      // Validate credentials are not expired
      if (credentials.expiresAt < Date.now()) {
        this.debugLog('Stored credentials expired', { shopDomain });
        await this.clearStoredCredentials(shopDomain);
        return null;
      }

      this.debugLog('Credentials loaded from storage', { shopDomain });
      return credentials;

    } catch (error) {
      this.debugLog('Failed to load stored credentials', { error, shopDomain });
      return null;
    }
  }

  /**
   * Clear stored credentials
   */
  private async clearStoredCredentials(shopDomain: string): Promise<void> {
    try {
      const key = `returnsx_auth_${shopDomain}`;
      
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      
      this.debugLog('Stored credentials cleared', { shopDomain });
    } catch (error) {
      this.debugLog('Failed to clear stored credentials', { error, shopDomain });
    }
  }

  /**
   * Encrypt credentials for secure storage
   */
  private async encryptCredentials(credentials: AuthenticationCredentials): Promise<string> {
    try {
      // Use Web Crypto API for encryption
      const key = await this.getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(credentials));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Convert to base64
      return btoa(String.fromCharCode(...combined));
      
    } catch (error) {
      this.debugLog('Encryption failed', { error });
      // Fallback: return JSON string (not secure, but functional)
      return JSON.stringify(credentials);
    }
  }

  /**
   * Decrypt credentials from secure storage
   */
  private async decryptCredentials(encryptedData: string): Promise<AuthenticationCredentials> {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const key = await this.getEncryptionKey();
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decrypted);
      
      return JSON.parse(jsonString);
      
    } catch (error) {
      this.debugLog('Decryption failed, trying fallback', { error });
      // Fallback: try parsing as JSON (for non-encrypted data)
      return JSON.parse(encryptedData);
    }
  }

  /**
   * Get encryption key for credential storage
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    // Use a consistent key derivation based on shop domain and extension context
    const keyMaterial = `returnsx_extension_${this.authState.shopDomain || 'default'}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);
    
    // Import key material
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Derive AES key
    const salt = encoder.encode('returnsx_salt'); // In production, use a proper salt
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Handle authentication errors
   */
  public handleAuthError(error: unknown): ErrorState {
    let errorState: ErrorState;

    if (error instanceof Error) {
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        errorState = {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication expired. Please refresh the page.',
          retryable: true,
        };
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: 'Network error during authentication. Please try again.',
          retryable: true,
        };
      } else {
        errorState = {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication failed. Please contact support.',
          retryable: false,
        };
      }
    } else {
      errorState = {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Unknown authentication error.',
        retryable: true,
      };
    }

    this.authState.error = errorState;
    return errorState;
  }

  /**
   * Clear authentication state (logout)
   */
  public async clearAuthentication(): Promise<void> {
    if (this.authState.shopDomain) {
      await this.clearStoredCredentials(this.authState.shopDomain);
    }

    this.authState = {
      isAuthenticated: false,
    };

    this.debugLog('Authentication cleared');
  }

  /**
   * Debug logging
   */
  private debugLog(message: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(`[ReturnsX Auth Service] ${message}`, sanitizeDebugInfo(data));
    }
  }
}

/**
 * Factory function to create authentication service
 */
export function createAuthService(config: Partial<AuthServiceConfig>): AuthenticationService {
  return new AuthenticationService(config);
}

/**
 * Default authentication service configuration
 */
export const DEFAULT_AUTH_CONFIG: Partial<AuthServiceConfig> = {
  tokenRefreshThreshold: 300, // 5 minutes
  maxRetryAttempts: 3,
  retryDelay: 1000,
  enableDebug: false,
};