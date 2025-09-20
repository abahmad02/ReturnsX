import { RiskProfileRequest, RiskProfileResponse, ErrorType, ErrorState } from '../types';
import { CircuitBreaker, CircuitState, createCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuitBreaker';
import { validateCustomerData, validateRiskProfileResponse } from '../utils/validation';
import { sanitizeDebugInfo, sanitizeErrorMessage } from '../utils/sanitization';
import { extensionCache, createCacheKey } from './cacheService';
import { globalPerformanceMonitor } from './performanceMonitor';
import { AuthenticationService, createAuthService, DEFAULT_AUTH_CONFIG } from './authService';

/**
 * API Client for ReturnsX Risk Assessment Integration
 * 
 * Provides secure communication with ReturnsX backend API including:
 * - Customer data hashing for privacy protection
 * - Authentication token handling
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * - Comprehensive error handling
 * - Circuit breaker pattern to prevent repeated failures
 */

interface ApiClientConfig {
  baseUrl: string;
  authToken?: string;
  sessionToken?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enableDebug: boolean;
}

interface RetryConfig {
  attempt: number;
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class ReturnsXApiClient {
  private config: ApiClientConfig;
  private abortController: AbortController | null = null;
  private circuitBreaker: CircuitBreaker;
  private authService: AuthenticationService;

  constructor(config: Partial<ApiClientConfig>) {
    this.config = {
      baseUrl: config.baseUrl || '',
      authToken: config.authToken,
      sessionToken: config.sessionToken,
      timeout: config.timeout || 5000, // 5 second timeout as specified
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second initial delay
      enableDebug: config.enableDebug || false,
    };

    // Initialize circuit breaker with default configuration
    this.circuitBreaker = createCircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

    // Initialize authentication service
    this.authService = createAuthService({
      apiEndpoint: this.config.baseUrl,
      enableDebug: this.config.enableDebug,
      ...DEFAULT_AUTH_CONFIG,
    });

    this.validateConfig();
  }

  /**
   * Initialize authentication with session token
   */
  public async initializeAuthentication(sessionToken?: string): Promise<boolean> {
    try {
      const tokenToUse = sessionToken || this.config.sessionToken;
      
      if (!tokenToUse) {
        this.debugLog('No session token provided for authentication');
        return false;
      }

      const authState = await this.authService.initializeWithSessionToken(tokenToUse);
      
      if (authState.isAuthenticated) {
        this.debugLog('Authentication initialized successfully', {
          shopDomain: authState.shopDomain,
          hasCustomerId: !!authState.customerId,
        });
        return true;
      } else {
        this.debugLog('Authentication initialization failed', {
          error: authState.error?.message,
        });
        return false;
      }
    } catch (error) {
      this.debugLog('Authentication initialization error', { error });
      return false;
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthenticationState() {
    return this.authService.getAuthState();
  }

  /**
   * Get customer risk profile with comprehensive error handling, caching, and circuit breaker protection
   */
  public async getRiskProfile(request: RiskProfileRequest, bypassCache = false): Promise<RiskProfileResponse> {
    const startTime = performance.now();
    
    try {
      // Validate input data first
      const validation = validateCustomerData(request);
      if (!validation.isValid) {
        throw new Error(`Invalid customer data: ${validation.errors.join(', ')}`);
      }

      const validatedRequest = validation.sanitized!;
      
      // Generate cache key
      const cacheKey = createCacheKey('risk-profile', {
        phone: validatedRequest.phone || '',
        email: validatedRequest.email || '',
        orderId: validatedRequest.orderId || '',
      });

      // Check cache first (unless bypassing)
      if (!bypassCache) {
        const cached = extensionCache.get<RiskProfileResponse>(cacheKey);
        if (cached) {
          this.debugLog('Cache hit for risk profile', { cacheKey });
          
          // Record cache hit performance
          globalPerformanceMonitor.recordApiCall(
            '/api/risk-profile',
            'POST',
            performance.now() - startTime,
            true,
            true // Cache hit
          );
          
          return cached;
        }
      }
      
      this.debugLog('Starting risk profile request', { 
        request: sanitizeDebugInfo(validatedRequest), 
        circuitState: this.circuitBreaker.getState(),
        cacheKey,
        bypassCache
      });

      // Check circuit breaker state before making request
      if (this.circuitBreaker.getState() === CircuitState.OPEN) {
        const timeUntilRetry = this.circuitBreaker.getTimeUntilRetry();
        this.debugLog('Circuit breaker is OPEN', { timeUntilRetry });
        
        throw new Error(`Service temporarily unavailable. Try again in ${Math.ceil(timeUntilRetry / 1000)} seconds.`);
      }

      // Execute request through circuit breaker
      const response = await this.circuitBreaker.execute(async () => {
        // Hash customer data before transmission
        const hashedRequest = await this.hashCustomerData(validatedRequest);
        
        // Ensure authentication is valid before making request
        const isAuthenticated = await this.authService.ensureAuthenticated();
        if (!isAuthenticated) {
          throw new Error('Authentication required but not available');
        }

        // Get authentication headers
        const authHeaders = this.authService.getAuthHeaders();

        // Make API request with retry logic
        const apiResponse = await this.makeRequestWithRetry<RiskProfileResponse>(
          '/api/risk-profile',
          {
            method: 'POST',
            body: JSON.stringify(hashedRequest),
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
              // Fallback to legacy auth token if no auth service headers
              ...(Object.keys(authHeaders).length === 0 && this.config.authToken && { 
                'Authorization': `Bearer ${this.config.authToken}` 
              }),
            },
          }
        );

        if (!apiResponse.success || !apiResponse.data) {
          throw new Error(apiResponse.error || 'Failed to get risk profile');
        }

        // Validate response structure using validation utility
        const responseValidation = validateRiskProfileResponse(apiResponse.data);
        if (!responseValidation.isValid) {
          throw new Error(`Invalid API response: ${responseValidation.errors.join(', ')}`);
        }

        return responseValidation.sanitized as RiskProfileResponse;
      });

      // Cache successful responses
      if (response.success) {
        extensionCache.set(cacheKey, response, 3 * 60 * 1000); // 3 minutes TTL
        this.debugLog('Response cached', { cacheKey });
      }
      
      // Record API performance
      globalPerformanceMonitor.recordApiCall(
        '/api/risk-profile',
        'POST',
        performance.now() - startTime,
        response.success,
        false // Not a cache hit
      );
      
      this.debugLog('Risk profile request successful', { 
        response: sanitizeDebugInfo(response), 
        circuitStats: this.circuitBreaker.getStats(),
        responseTime: performance.now() - startTime
      });
      
      return response;

    } catch (error) {
      // Record failed API call
      globalPerformanceMonitor.recordApiCall(
        '/api/risk-profile',
        'POST',
        performance.now() - startTime,
        false,
        false
      );
      
      this.debugLog('Risk profile request failed', { 
        error: sanitizeDebugInfo(error), 
        circuitStats: this.circuitBreaker.getStats(),
        responseTime: performance.now() - startTime
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Hash customer data for privacy protection using SHA-256
   */
  private async hashCustomerData(request: RiskProfileRequest): Promise<RiskProfileRequest> {
    const hashedRequest: RiskProfileRequest = {
      ...request,
    };

    // Hash phone number if provided
    if (request.phone) {
      hashedRequest.phone = await this.createCustomerHash(request.phone);
    }

    // Hash email if provided
    if (request.email) {
      hashedRequest.email = await this.createCustomerHash(request.email);
    }

    // Keep orderId and checkoutToken as-is (they're not PII)
    return hashedRequest;
  }

  /**
   * Create SHA-256 hash of customer data (matching backend implementation)
   */
  private async createCustomerHash(data: string): Promise<string> {
    if (!data) return '';

    try {
      // Normalize the data (remove spaces, convert to lowercase)
      const normalized = data.toLowerCase().trim().replace(/\s+/g, '');
      
      // Use Web Crypto API for hashing (available in Shopify extensions)
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(normalized);
      
      // Add salt (using a consistent salt for client-side hashing)
      // Note: In production, this should match the backend salt
      const salt = 'returnsx_client_salt';
      const saltBuffer = encoder.encode(salt);
      
      // Combine data and salt
      const combined = new Uint8Array(dataBuffer.length + saltBuffer.length);
      combined.set(dataBuffer);
      combined.set(saltBuffer, dataBuffer.length);
      
      // Create SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      this.debugLog('Hashing failed', { error, data: data.substring(0, 5) + '...' });
      throw new Error('Failed to hash customer data');
    }
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   */
  private async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    retryConfig?: Partial<RetryConfig>
  ): Promise<ApiResponse<T>> {
    const retry: RetryConfig = {
      attempt: 1,
      maxAttempts: this.config.maxRetries,
      delay: this.config.retryDelay,
      backoffMultiplier: 2,
      ...retryConfig,
    };

    while (retry.attempt <= retry.maxAttempts) {
      try {
        this.debugLog(`API request attempt ${retry.attempt}`, { endpoint, attempt: retry.attempt });

        const response = await this.makeRequest<T>(endpoint, options);
        
        if (response.success) {
          return response;
        }

        // Don't retry on authentication errors or client errors (4xx)
        if (response.statusCode && response.statusCode >= 400 && response.statusCode < 500) {
          return response;
        }

        // Retry on server errors (5xx) or network errors
        if (retry.attempt < retry.maxAttempts) {
          await this.delay(retry.delay);
          retry.delay *= retry.backoffMultiplier;
          retry.attempt++;
          continue;
        }

        return response;

      } catch (error) {
        this.debugLog(`API request attempt ${retry.attempt} failed`, { error, endpoint });

        // Don't retry on timeout or abort errors if it's the last attempt
        if (retry.attempt >= retry.maxAttempts) {
          throw error;
        }

        // Wait before retrying
        await this.delay(retry.delay);
        retry.delay *= retry.backoffMultiplier;
        retry.attempt++;
      }
    }

    throw new Error('Maximum retry attempts exceeded');
  }

  /**
   * Make single HTTP request with timeout handling
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>> {
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (this.abortController) {
        this.abortController.abort();
      }
    }, this.config.timeout);

    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP error status codes
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          statusCode: response.status,
        };
      }

      // Parse JSON response
      const data = await response.json();
      
      return {
        success: true,
        data,
        statusCode: response.status,
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        // Handle specific error types
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        
        if (error.message.includes('fetch')) {
          throw new Error('Network error');
        }
      }

      throw error;
    } finally {
      this.abortController = null;
    }
  }

  // Removed validateRiskProfileResponse method - now using validation utility

  /**
   * Handle API errors and convert to appropriate error states
   */
  private handleApiError(error: unknown): RiskProfileResponse {
    let errorState: ErrorState;
    let rawErrorMessage = 'Unknown error';

    if (error instanceof Error) {
      rawErrorMessage = error.message;
      
      if (error.message.includes('Invalid customer data')) {
        errorState = {
          type: ErrorType.CONFIGURATION_ERROR,
          message: 'Invalid customer information provided.',
          retryable: false,
        };
      } else if (error.message.includes('timeout')) {
        errorState = {
          type: ErrorType.TIMEOUT_ERROR,
          message: 'Request timed out. Please try again.',
          retryable: true,
        };
      } else if (error.message.includes('Network error')) {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: 'Network connection failed. Please check your internet connection.',
          retryable: true,
        };
      } else if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403') || error.message.includes('Authentication required')) {
        errorState = {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication failed. Please refresh the page.',
          retryable: true,
        };
        
        // Attempt to handle authentication error (don't await in sync context)
        this.handleAuthenticationError(error).catch(() => {
          // Ignore recovery errors in this context
        });
      } else if (error.message.includes('Invalid response') || error.message.includes('Invalid API response')) {
        errorState = {
          type: ErrorType.INVALID_RESPONSE,
          message: 'Received invalid response from server.',
          retryable: false,
        };
      } else {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: 'An unexpected error occurred. Please try again.',
          retryable: true,
        };
      }
    } else {
      errorState = {
        type: ErrorType.NETWORK_ERROR,
        message: 'An unknown error occurred.',
        retryable: true,
      };
    }

    // Sanitize error message for user display
    const sanitizedErrorMessage = sanitizeErrorMessage(rawErrorMessage);

    // Return fallback response for new customers
    return {
      success: false,
      riskTier: 'ZERO_RISK',
      riskScore: 0,
      totalOrders: 0,
      failedAttempts: 0,
      successfulDeliveries: 0,
      isNewCustomer: true,
      message: 'Welcome! We\'re excited to serve you.',
      error: errorState.message,
    };
  }

  /**
   * Validate API client configuration
   */
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new Error('API base URL is required');
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error('Invalid API base URL format');
    }

    if (this.config.timeout <= 0) {
      throw new Error('Timeout must be greater than 0');
    }

    if (this.config.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }

    if (this.config.retryDelay <= 0) {
      throw new Error('Retry delay must be greater than 0');
    }
  }

  /**
   * Utility function to create delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Debug logging (only when debug mode is enabled)
   */
  private debugLog(message: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(`[ReturnsX API Client] ${message}`, sanitizeDebugInfo(data));
    }
  }

  /**
   * Cancel any ongoing requests
   */
  public cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Update configuration (useful for dynamic config changes)
   */
  public updateConfig(newConfig: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Get current configuration (for debugging)
   */
  public getConfig(): Readonly<ApiClientConfig> {
    return { ...this.config };
  }

  /**
   * Health check endpoint with circuit breaker bypass
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Get authentication headers (but don't require authentication for health check)
      const authHeaders = this.authService.getAuthHeaders();
      
      // Bypass circuit breaker for health checks
      const response = await this.makeRequest<{ status: string }>('/api/health', {
        method: 'GET',
        headers: {
          ...authHeaders,
          // Fallback to legacy auth token if no auth service headers
          ...(Object.keys(authHeaders).length === 0 && this.config.authToken && { 
            'Authorization': `Bearer ${this.config.authToken}` 
          }),
        },
      });

      const isHealthy = response.success && response.data?.status === 'ok';
      
      // If health check succeeds and circuit is open, consider resetting it
      if (isHealthy && this.circuitBreaker.getState() === CircuitState.OPEN) {
        this.debugLog('Health check passed while circuit is open, considering reset');
      }

      return isHealthy;
    } catch {
      return false;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  public getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    this.debugLog('Circuit breaker manually reset');
  }

  /**
   * Check if circuit breaker is healthy
   */
  public isCircuitBreakerHealthy(): boolean {
    return this.circuitBreaker.isHealthy();
  }

  /**
   * Handle authentication errors and attempt recovery
   */
  public async handleAuthenticationError(error: unknown): Promise<boolean> {
    this.debugLog('Handling authentication error', { error });
    
    const authError = this.authService.handleAuthError(error);
    
    // If error is retryable, attempt to re-initialize authentication
    if (authError.retryable && this.config.sessionToken) {
      this.debugLog('Attempting authentication recovery');
      return await this.initializeAuthentication(this.config.sessionToken);
    }
    
    return false;
  }

  /**
   * Clear authentication state (useful for logout or auth errors)
   */
  public async clearAuthentication(): Promise<void> {
    await this.authService.clearAuthentication();
    this.debugLog('Authentication cleared');
  }

  /**
   * Update session token (useful when extension context changes)
   */
  public async updateSessionToken(sessionToken: string): Promise<boolean> {
    this.config.sessionToken = sessionToken;
    return await this.initializeAuthentication(sessionToken);
  }
}

/**
 * Factory function to create API client instance
 */
export function createApiClient(config: Partial<ApiClientConfig>): ReturnsXApiClient {
  return new ReturnsXApiClient(config);
}

/**
 * Default API client configuration
 */
export const DEFAULT_API_CONFIG: Partial<ApiClientConfig> = {
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  enableDebug: false,
};

/**
 * Create API client with session token authentication
 */
export async function createAuthenticatedApiClient(
  config: Partial<ApiClientConfig>, 
  sessionToken: string
): Promise<ReturnsXApiClient> {
  const client = createApiClient({
    ...config,
    sessionToken,
  });
  
  // Initialize authentication
  await client.initializeAuthentication(sessionToken);
  
  return client;
}