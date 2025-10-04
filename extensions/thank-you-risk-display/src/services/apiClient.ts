import { RiskProfileRequest, RiskProfileResponse, ErrorType, ErrorState } from '../types';
import { CircuitBreaker, CircuitState, createCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuitBreaker';
import { validateCustomerData, validateRiskProfileResponse } from '../utils/validation';
import { sanitizeDebugInfo, sanitizeErrorMessage } from '../utils/sanitization';
import { extensionCache, createCacheKey } from './cacheService';
import { globalPerformanceMonitor } from './performanceMonitor';
import { AuthenticationService, createAuthService, DEFAULT_AUTH_CONFIG } from './authService';

/**
 * Interface for optimized API response format
 */
interface OptimizedApiResponse<T = any> {
  data?: T;
  error?: {
    type: string;
    message: string;
    code: string;
    retryable: boolean;
    retryAfter?: number;
    timestamp: number;
    requestId: string;
    details?: any[];
  };
  metadata: {
    requestId: string;
    processingTime: number;
    cacheHit: boolean;
    dataSource: 'database' | 'cache' | 'fallback';
    queryCount: number;
    timestamp: number;
    version?: string;
    deduplicationHit?: boolean;
    circuitBreakerState?: string;
  };
  message?: string;
  debug?: any;
}

/**
 * Client-side request deduplication
 */
class ClientRequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();
  private requestTimestamps = new Map<string, number>();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Periodic cleanup of old requests
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  generateRequestKey(params: RiskProfileRequest): string {
    const keyParts: string[] = [];
    if (params.phone) keyParts.push(`ph:${params.phone}`);
    if (params.email) keyParts.push(`em:${params.email}`);
    if (params.orderId) keyParts.push(`oi:${params.orderId}`);
    if (params.checkoutToken) keyParts.push(`ct:${params.checkoutToken}`);
    return `risk-profile:${keyParts.join('|')}`;
  }

  async registerRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request
    const requestPromise = requestFn().finally(() => {
      // Clean up after completion
      this.pendingRequests.delete(key);
      this.requestTimestamps.delete(key);
    });

    // Store request and timestamp
    this.pendingRequests.set(key, requestPromise);
    this.requestTimestamps.set(key, Date.now());

    return requestPromise;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.requestTimestamps.entries()) {
      if (now - timestamp > this.CLEANUP_INTERVAL) {
        this.pendingRequests.delete(key);
        this.requestTimestamps.delete(key);
      }
    }
  }
}

// Global client-side deduplicator
const clientDeduplicator = new ClientRequestDeduplicator();

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
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enableDebug: boolean;
  sessionToken?: string;
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
      timeout: config.timeout || 5000, // 5 second timeout as specified
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second initial delay
      enableDebug: config.enableDebug || false,
      sessionToken: config.sessionToken,
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
   * Updated to work with optimized API endpoint and response format
   */
  public async getRiskProfile(request: RiskProfileRequest, bypassCache = false): Promise<RiskProfileResponse> {
    const startTime = performance.now();
    
    try {
      // Validate input data first (but allow empty requests for testing)
      const validation = validateCustomerData(request);
      if (!validation.isValid && Object.keys(request).length > 0) {
        throw new Error(`Invalid customer data: ${validation.errors.join(', ')}`);
      }

      const validatedRequest = validation.sanitized || request;
      
      // Generate deduplication key for client-side deduplication
      const deduplicationKey = clientDeduplicator.generateRequestKey(validatedRequest);
      
      // Use client-side deduplication to complement server-side optimization
      return await clientDeduplicator.registerRequest(deduplicationKey, async () => {
        return await this.executeRiskProfileRequest(validatedRequest, bypassCache, startTime);
      });

    } catch (error) {
      // Record failed API call
      globalPerformanceMonitor.recordApiCall(
        '/api/get-order-data',
        'GET',
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
   * Execute the actual risk profile request with optimized API integration
   */
  private async executeRiskProfileRequest(
    validatedRequest: RiskProfileRequest,
    bypassCache: boolean,
    startTime: number
  ): Promise<RiskProfileResponse> {
    this.debugLog('executeRiskProfileRequest called', { validatedRequest, bypassCache });
    // Generate cache key
    const cacheKey = createCacheKey('risk-profile', {
      phone: validatedRequest.phone || '',
      email: validatedRequest.email || '',
      orderId: validatedRequest.orderId || '',
      checkoutToken: validatedRequest.checkoutToken || '',
    });

    // Check cache first (unless bypassing)
    if (!bypassCache) {
      const cached = extensionCache.get<RiskProfileResponse>(cacheKey);
      if (cached) {
        this.debugLog('Cache hit for risk profile', { cacheKey });
        
        // Record cache hit performance
        globalPerformanceMonitor.recordApiCall(
          '/api/get-order-data',
          'GET',
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
    let optimizedResponse: OptimizedApiResponse;
    try {
      optimizedResponse = await this.circuitBreaker.execute(async () => {
      // Use the optimized API endpoint with GET method and query parameters
      const queryParams = new URLSearchParams();
      
      // Add parameters to query string (no hashing needed as server handles it)
      if (validatedRequest.checkoutToken) {
        queryParams.set('checkoutToken', validatedRequest.checkoutToken);
      }
      if (validatedRequest.phone) {
        queryParams.set('customerPhone', validatedRequest.phone);
      }
      if (validatedRequest.email) {
        queryParams.set('customerEmail', validatedRequest.email);
      }
      if (validatedRequest.orderId) {
        queryParams.set('orderId', validatedRequest.orderId);
      }

      // Make API request to optimized endpoint
      const apiResponse = await this.makeRequestWithRetry<OptimizedApiResponse>(
        `/api/get-order-data?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'Failed to get order data');
      }

        return apiResponse.data as OptimizedApiResponse;
      });
    } catch (circuitBreakerError) {
      // If circuit breaker fails, create a fallback response
      this.debugLog('Circuit breaker execution failed', { error: circuitBreakerError });
      
      optimizedResponse = {
        error: {
          type: 'CIRCUIT_BREAKER_ERROR',
          message: 'Service temporarily unavailable',
          code: 'CIRCUIT_BREAKER_OPEN',
          retryable: true,
          timestamp: Date.now(),
          requestId: 'fallback',
        },
        metadata: {
          requestId: 'fallback',
          processingTime: 0,
          cacheHit: false,
          dataSource: 'fallback',
          queryCount: 0,
          timestamp: Date.now(),
        },
      };
    }

    // Transform optimized API response to legacy format
    const riskProfileResponse = this.transformOptimizedResponse(optimizedResponse);

    // Handle server cache headers for client-side caching integration
    this.handleServerCacheHeaders(optimizedResponse, cacheKey);

    // Cache successful responses
    if (riskProfileResponse.success) {
      const ttl = this.getCacheTTLFromHeaders(optimizedResponse) || 3 * 60 * 1000; // Default 3 minutes
      extensionCache.set(cacheKey, riskProfileResponse, ttl);
      this.debugLog('Response cached', { cacheKey, ttl });
    }
    
    // Record API performance
    globalPerformanceMonitor.recordApiCall(
      '/api/get-order-data',
      'GET',
      performance.now() - startTime,
      riskProfileResponse.success,
      optimizedResponse.metadata?.cacheHit || false
    );
    
    this.debugLog('Risk profile request successful', { 
      response: sanitizeDebugInfo(riskProfileResponse), 
      circuitStats: this.circuitBreaker.getStats(),
      responseTime: performance.now() - startTime,
      serverCacheHit: optimizedResponse.metadata?.cacheHit,
      deduplicationHit: optimizedResponse.metadata?.deduplicationHit
    });
    
    return riskProfileResponse;
  }

  /**
   * Transform optimized API response to legacy RiskProfileResponse format
   */
  private transformOptimizedResponse(optimizedResponse: OptimizedApiResponse): RiskProfileResponse {
    // Handle error responses
    if (optimizedResponse.error) {
      return {
        success: false,
        riskTier: 'ZERO_RISK',
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        isNewCustomer: true,
        message: 'Welcome! We\'re excited to serve you.',
        error: optimizedResponse.error.message,
      };
    }

    // Handle successful responses with data
    if (optimizedResponse.data) {
      const { orderInfo, customer } = optimizedResponse.data;
      
      // Determine if customer is new
      const isNewCustomer = !customer || customer.orderCount === 0;
      
      // Calculate risk tier based on customer data
      let riskTier: 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' = 'ZERO_RISK';
      let riskScore = 0;
      
      if (customer && !isNewCustomer) {
        riskScore = customer.riskScore || 0;
        
        if (customer.riskLevel === 'high' || riskScore >= 70) {
          riskTier = 'HIGH_RISK';
        } else if (customer.riskLevel === 'medium' || riskScore >= 30) {
          riskTier = 'MEDIUM_RISK';
        } else {
          riskTier = 'ZERO_RISK';
        }
      }

      // Generate appropriate message
      let message = 'Welcome! We\'re excited to serve you.';
      if (!isNewCustomer) {
        if (riskTier === 'HIGH_RISK') {
          message = 'Please ensure your contact information is accurate for delivery.';
        } else if (riskTier === 'MEDIUM_RISK') {
          message = 'Thank you for your continued business!';
        } else {
          message = 'Thank you for being a valued customer!';
        }
      }

      return {
        success: true,
        riskTier,
        riskScore,
        totalOrders: customer?.orderCount || 0,
        failedAttempts: customer?.fraudReports || 0,
        successfulDeliveries: Math.max(0, (customer?.orderCount || 0) - (customer?.fraudReports || 0)),
        isNewCustomer,
        message: optimizedResponse.message || message,
        recommendations: this.generateRecommendations(riskTier, isNewCustomer),
      };
    }

    // Handle no data found (404 case) or empty data
    // Even when no customer data is found, we return success: false to indicate new customer
    return {
      success: false,
      riskTier: 'ZERO_RISK',
      riskScore: 0,
      totalOrders: 0,
      failedAttempts: 0,
      successfulDeliveries: 0,
      isNewCustomer: true,
      message: optimizedResponse.message || 'Welcome! We\'re excited to serve you.',
    };
  }

  /**
   * Generate recommendations based on risk tier and customer status
   */
  private generateRecommendations(riskTier: string, isNewCustomer: boolean): string[] {
    if (isNewCustomer) {
      return [
        'Ensure your phone number is correct for delivery updates',
        'Consider prepayment for faster processing',
        'Check our return policy for peace of mind'
      ];
    }

    switch (riskTier) {
      case 'HIGH_RISK':
        return [
          'Please verify your contact information',
          'Consider prepayment to avoid delivery issues',
          'Ensure someone is available to receive the order'
        ];
      case 'MEDIUM_RISK':
        return [
          'Thank you for your loyalty',
          'Consider prepayment for priority processing',
          'Update your delivery preferences if needed'
        ];
      default:
        return [
          'Thank you for being a trusted customer',
          'Enjoy exclusive offers for loyal customers',
          'Consider our premium delivery options'
        ];
    }
  }

  /**
   * Handle server cache headers for client-side caching integration
   */
  private handleServerCacheHeaders(optimizedResponse: OptimizedApiResponse, cacheKey: string): void {
    if (optimizedResponse.metadata) {
      const { cacheHit, dataSource, processingTime } = optimizedResponse.metadata;
      
      // Log cache performance metrics
      this.debugLog('Server cache metrics', {
        cacheKey,
        serverCacheHit: cacheHit,
        dataSource,
        processingTime,
        deduplicationHit: optimizedResponse.metadata.deduplicationHit
      });

      // If server had a cache hit, we can extend our client cache TTL
      if (cacheHit && dataSource === 'cache') {
        // Server cache hit indicates fresh data, extend client cache
        const extendedTTL = 5 * 60 * 1000; // 5 minutes for server cache hits
        this.debugLog('Extending client cache TTL due to server cache hit', { 
          cacheKey, 
          extendedTTL 
        });
      }
    }
  }

  /**
   * Extract cache TTL from server response headers
   */
  private getCacheTTLFromHeaders(optimizedResponse: OptimizedApiResponse): number | null {
    // In a real implementation, this would parse Cache-Control headers
    // For now, use metadata to determine appropriate TTL
    if (optimizedResponse.metadata?.cacheHit) {
      return 5 * 60 * 1000; // 5 minutes for cache hits
    }
    return 3 * 60 * 1000; // 3 minutes for fresh data
  }

  /**
   * Hash customer data for privacy protection using SHA-256
   * Note: This is now handled server-side, but kept for backward compatibility
   */
  private async hashCustomerData(request: RiskProfileRequest): Promise<RiskProfileRequest> {
    // Server now handles hashing, so we pass data as-is
    return request;
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
   * Updated to handle optimized API response format
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

      // Parse JSON response first to get structured error information
      let responseData: any;
      try {
        responseData = await response.json();
      } catch {
        // If JSON parsing fails, treat as network error
        return {
          success: false,
          error: `HTTP ${response.status}: Failed to parse response`,
          statusCode: response.status,
        };
      }

      // Handle HTTP error status codes with structured error information
      if (!response.ok) {
        // For optimized API, error information is in the response body
        if (responseData.error) {
          return {
            success: false,
            error: JSON.stringify(responseData),
            statusCode: response.status,
          };
        } else {
          return {
            success: false,
            error: `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
            statusCode: response.status,
          };
        }
      }

      // For successful responses, return the structured data
      return {
        success: true,
        data: responseData,
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
   * Updated to handle new consistent error response format
   */
  private handleApiError(error: unknown): RiskProfileResponse {
    let errorState: ErrorState;
    let rawErrorMessage = 'Unknown error';
    let retryAfter: number | undefined;

    if (error instanceof Error) {
      rawErrorMessage = error.message;
      
      // Try to parse structured error from optimized API response
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.error && errorData.error.type) {
          const apiError = errorData.error;
          
          // Map API error types to client error types
          switch (apiError.type) {
            case 'VALIDATION_ERROR':
              errorState = {
                type: ErrorType.CONFIGURATION_ERROR,
                message: apiError.message || 'Invalid request parameters.',
                retryable: false,
              };
              break;
              
            case 'AUTHENTICATION_ERROR':
              errorState = {
                type: ErrorType.AUTHENTICATION_ERROR,
                message: apiError.message || 'Authentication failed. Please refresh the page.',
                retryable: apiError.retryable !== false,
              };
              break;
              
            case 'NOT_FOUND_ERROR':
              // Not found is not really an error for new customers
              return {
                success: false,
                riskTier: 'ZERO_RISK',
                riskScore: 0,
                totalOrders: 0,
                failedAttempts: 0,
                successfulDeliveries: 0,
                isNewCustomer: true,
                message: apiError.message || 'Welcome! We\'re excited to serve you.',
              };
              
            case 'TIMEOUT_ERROR':
              errorState = {
                type: ErrorType.TIMEOUT_ERROR,
                message: apiError.message || 'Request timed out. Please try again.',
                retryable: true,
              };
              break;
              
            case 'CIRCUIT_BREAKER_ERROR':
              errorState = {
                type: ErrorType.NETWORK_ERROR,
                message: apiError.message || 'Service temporarily unavailable. Please try again later.',
                retryable: true,
              };
              retryAfter = apiError.retryAfter;
              break;
              
            case 'RATE_LIMIT_ERROR':
              errorState = {
                type: ErrorType.NETWORK_ERROR,
                message: apiError.message || 'Too many requests. Please wait before trying again.',
                retryable: true,
              };
              retryAfter = apiError.retryAfter;
              break;
              
            case 'INTERNAL_SERVER_ERROR':
            default:
              errorState = {
                type: ErrorType.NETWORK_ERROR,
                message: apiError.message || 'An unexpected error occurred. Please try again.',
                retryable: apiError.retryable !== false,
              };
              break;
          }
          
          rawErrorMessage = apiError.message || rawErrorMessage;
        } else {
          throw new Error('Not a structured error');
        }
      } catch {
        // Fallback to legacy error handling for non-structured errors
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
        } else if (error.message.includes('Service temporarily unavailable')) {
          errorState = {
            type: ErrorType.NETWORK_ERROR,
            message: error.message,
            retryable: true,
          };
        } else {
          errorState = {
            type: ErrorType.NETWORK_ERROR,
            message: 'An unexpected error occurred. Please try again.',
            retryable: true,
          };
        }
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

    // Log retry information if available
    if (retryAfter) {
      this.debugLog('Error with retry-after', { retryAfter, errorType: errorState.type });
    }

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
   * Updated to use optimized API endpoint
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Use a simple request to the optimized API endpoint to check health
      // We'll make a minimal request that should return quickly
      const response = await this.makeRequest<OptimizedApiResponse>('/api/get-order-data?healthCheck=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Consider it healthy if we get any structured response (even errors are better than no response)
      const isHealthy = response.success || (response.statusCode && response.statusCode < 500);
      
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
  sessionToken: undefined,
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