/**
 * Graceful Degradation Handler
 * 
 * Provides fallback responses and data when primary services are unavailable,
 * ensuring the system continues to function even during failures.
 */

import { ApiError, ApiErrorType } from './errorHandling.server';
import { RequestContext } from './errorRecovery.server';

export interface CustomerIdentifiers {
  phone?: string;
  email?: string;
  orderId?: string;
  checkoutToken?: string;
}

export interface CustomerProfile {
  id: string;
  riskTier: 'low' | 'medium' | 'high' | 'new';
  riskScore: number;
  orderCount: number;
  successfulDeliveries: number;
  returnRate: number;
  averageOrderValue: number;
  lastOrderDate?: string;
  createdAt: string;
  metadata: {
    source: 'database' | 'cache' | 'fallback';
    confidence: number;
    generatedAt: string;
    [key: string]: any;
  };
}

export interface OrderInfo {
  id: string;
  status: string;
  total: number;
  currency: string;
  customerRisk: 'low' | 'medium' | 'high' | 'new';
  metadata: {
    source: 'database' | 'cache' | 'fallback';
    generatedAt: string;
  };
}

export interface FallbackResponse {
  success: boolean;
  data: any;
  fallback: boolean;
  confidence: number;
  source: string;
  message?: string;
  metadata: Record<string, any>;
}

/**
 * Interface for fallback data providers
 */
export interface FallbackDataProvider {
  getCustomerFallback(identifiers: CustomerIdentifiers): CustomerProfile;
  getOrderFallback(orderId: string): OrderInfo;
  getNewCustomerProfile(): CustomerProfile;
  getDefaultRiskAssessment(): any;
}

/**
 * Default fallback data provider implementation
 */
export class DefaultFallbackDataProvider implements FallbackDataProvider {
  getCustomerFallback(identifiers: CustomerIdentifiers): CustomerProfile {
    // Generate a conservative fallback profile
    return {
      id: this.generateFallbackId(identifiers),
      riskTier: 'medium', // Conservative default
      riskScore: 50, // Neutral score
      orderCount: 0,
      successfulDeliveries: 0,
      returnRate: 0,
      averageOrderValue: 0,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'fallback',
        confidence: 0.3, // Low confidence for fallback data
        generatedAt: new Date().toISOString(),
        identifiers: this.sanitizeIdentifiers(identifiers),
        reason: 'primary_service_unavailable'
      }
    };
  }

  getOrderFallback(orderId: string): OrderInfo {
    return {
      id: orderId,
      status: 'unknown',
      total: 0,
      currency: 'PKR',
      customerRisk: 'medium',
      metadata: {
        source: 'fallback',
        generatedAt: new Date().toISOString()
      }
    };
  }

  getNewCustomerProfile(): CustomerProfile {
    return {
      id: `new_customer_${Date.now()}`,
      riskTier: 'new',
      riskScore: 30, // Lower risk for new customers
      orderCount: 0,
      successfulDeliveries: 0,
      returnRate: 0,
      averageOrderValue: 0,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'fallback',
        confidence: 0.5, // Medium confidence for new customer
        generatedAt: new Date().toISOString(),
        reason: 'new_customer_default'
      }
    };
  }

  getDefaultRiskAssessment(): any {
    return {
      riskLevel: 'medium',
      riskScore: 50,
      factors: [
        {
          factor: 'order_history',
          impact: 'neutral',
          description: 'No order history available'
        }
      ],
      recommendations: [
        {
          type: 'verification',
          message: 'Consider phone verification for new customers'
        }
      ],
      metadata: {
        source: 'fallback',
        confidence: 0.3,
        generatedAt: new Date().toISOString()
      }
    };
  }

  private generateFallbackId(identifiers: CustomerIdentifiers): string {
    // Generate a consistent ID based on available identifiers
    const parts = [];
    
    if (identifiers.phone) {
      parts.push(`phone_${identifiers.phone.slice(-4)}`);
    }
    if (identifiers.email) {
      parts.push(`email_${identifiers.email.split('@')[0].slice(-4)}`);
    }
    if (identifiers.orderId) {
      parts.push(`order_${identifiers.orderId.slice(-4)}`);
    }
    
    if (parts.length === 0) {
      parts.push(`unknown_${Date.now()}`);
    }
    
    return `fallback_${parts.join('_')}`;
  }

  private sanitizeIdentifiers(identifiers: CustomerIdentifiers): Record<string, any> {
    return {
      hasPhone: !!identifiers.phone,
      hasEmail: !!identifiers.email,
      hasOrderId: !!identifiers.orderId,
      hasCheckoutToken: !!identifiers.checkoutToken
    };
  }
}

/**
 * Graceful Degradation Handler
 */
export class GracefulDegradationHandler {
  private fallbackProvider: FallbackDataProvider;
  private cacheService?: any;

  constructor(fallbackProvider?: FallbackDataProvider, cacheService?: any) {
    this.fallbackProvider = fallbackProvider || new DefaultFallbackDataProvider();
    this.cacheService = cacheService;
  }

  /**
   * Handle degradation for API requests
   */
  async handleDegradation(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    const degradationStrategy = this.selectDegradationStrategy(error, context);
    
    try {
      switch (degradationStrategy) {
        case 'cache_fallback':
          return await this.handleCacheFallback(error, context);
        
        case 'data_fallback':
          return await this.handleDataFallback(error, context);
        
        case 'service_fallback':
          return await this.handleServiceFallback(error, context);
        
        case 'minimal_response':
          return await this.handleMinimalResponse(error, context);
        
        default:
          return await this.handleDefaultFallback(error, context);
      }
    } catch (degradationError) {
      // If degradation itself fails, provide absolute minimal response
      return this.createMinimalFallbackResponse(error, context, degradationError);
    }
  }

  /**
   * Select appropriate degradation strategy based on error and context
   */
  private selectDegradationStrategy(error: ApiError, context: RequestContext): string {
    // Circuit breaker errors - try cache first
    if (error.type === ApiErrorType.CIRCUIT_BREAKER_ERROR) {
      return 'cache_fallback';
    }

    // Database errors - try cache, then fallback data
    if (error.type === ApiErrorType.DATABASE_ERROR) {
      return 'cache_fallback';
    }

    // Timeout errors - provide quick fallback
    if (error.type === ApiErrorType.TIMEOUT_ERROR) {
      return 'data_fallback';
    }

    // Network errors - try cached data
    if (error.type === ApiErrorType.NETWORK_ERROR) {
      return 'cache_fallback';
    }

    // Validation errors - provide minimal response
    if (error.type === ApiErrorType.VALIDATION_ERROR) {
      return 'minimal_response';
    }

    // Default strategy
    return 'service_fallback';
  }

  /**
   * Try to serve from cache
   */
  private async handleCacheFallback(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    if (!this.cacheService) {
      return await this.handleDataFallback(error, context);
    }

    try {
      const cacheKey = this.generateCacheKey(context);
      const cachedData = await this.cacheService.get(cacheKey);
      
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          fallback: true,
          confidence: 0.8, // High confidence in cached data
          source: 'cache',
          message: 'Serving cached data due to service unavailability',
          metadata: {
            cacheKey,
            originalError: error.type,
            strategy: 'cache_fallback',
            timestamp: new Date().toISOString()
          }
        };
      }
    } catch (cacheError) {
      // Cache failed, fall back to data fallback
    }

    return await this.handleDataFallback(error, context);
  }

  /**
   * Provide fallback data
   */
  private async handleDataFallback(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    const fallbackData = this.generateFallbackData(context);
    
    return {
      success: true,
      data: fallbackData,
      fallback: true,
      confidence: 0.4, // Medium-low confidence in fallback data
      source: 'fallback_generator',
      message: 'Serving generated fallback data',
      metadata: {
        originalError: error.type,
        strategy: 'data_fallback',
        timestamp: new Date().toISOString(),
        endpoint: context.endpoint
      }
    };
  }

  /**
   * Handle service-level fallback
   */
  private async handleServiceFallback(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    // Try alternative service endpoints or methods
    const fallbackData = this.generateFallbackData(context);
    
    return {
      success: true,
      data: fallbackData,
      fallback: true,
      confidence: 0.3,
      source: 'service_fallback',
      message: 'Primary service unavailable, using fallback service',
      metadata: {
        originalError: error.type,
        strategy: 'service_fallback',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Provide minimal response for validation errors
   */
  private async handleMinimalResponse(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    return {
      success: false,
      data: null,
      fallback: true,
      confidence: 0,
      source: 'minimal_response',
      message: error.message,
      metadata: {
        originalError: error.type,
        strategy: 'minimal_response',
        timestamp: new Date().toISOString(),
        validationErrors: error.context
      }
    };
  }

  /**
   * Default fallback when all else fails
   */
  private async handleDefaultFallback(error: ApiError, context: RequestContext): Promise<FallbackResponse> {
    const fallbackData = this.generateFallbackData(context);
    
    return {
      success: true,
      data: fallbackData,
      fallback: true,
      confidence: 0.2, // Low confidence
      source: 'default_fallback',
      message: 'Using default fallback due to service unavailability',
      metadata: {
        originalError: error.type,
        strategy: 'default_fallback',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate appropriate fallback data based on context
   */
  private generateFallbackData(context: RequestContext): any {
    const endpoint = context.endpoint;
    const params = context.parameters;

    // Handle different endpoints
    if (endpoint.includes('get-order-data') || endpoint.includes('risk-profile')) {
      const identifiers: CustomerIdentifiers = {
        phone: params.customerPhone,
        email: params.customerEmail,
        orderId: params.orderId,
        checkoutToken: params.checkoutToken
      };

      if (this.hasCustomerIdentifiers(identifiers)) {
        return this.fallbackProvider.getCustomerFallback(identifiers);
      } else {
        return this.fallbackProvider.getNewCustomerProfile();
      }
    }

    if (endpoint.includes('order')) {
      return this.fallbackProvider.getOrderFallback(params.orderId || 'unknown');
    }

    // Default risk assessment
    return this.fallbackProvider.getDefaultRiskAssessment();
  }

  /**
   * Create minimal fallback response when degradation itself fails
   */
  private createMinimalFallbackResponse(
    originalError: ApiError, 
    context: RequestContext, 
    degradationError: Error
  ): FallbackResponse {
    return {
      success: false,
      data: null,
      fallback: true,
      confidence: 0,
      source: 'emergency_fallback',
      message: 'Service temporarily unavailable',
      metadata: {
        originalError: originalError.type,
        degradationError: degradationError.message,
        strategy: 'emergency_fallback',
        timestamp: new Date().toISOString(),
        requestId: context.requestId
      }
    };
  }

  /**
   * Generate cache key for the request
   */
  private generateCacheKey(context: RequestContext): string {
    const params = JSON.stringify(context.parameters);
    return `fallback:${context.endpoint}:${Buffer.from(params).toString('base64')}`;
  }

  /**
   * Check if we have any customer identifiers
   */
  private hasCustomerIdentifiers(identifiers: CustomerIdentifiers): boolean {
    return !!(identifiers.phone || identifiers.email || identifiers.orderId || identifiers.checkoutToken);
  }

  /**
   * Set custom fallback provider
   */
  setFallbackProvider(provider: FallbackDataProvider): void {
    this.fallbackProvider = provider;
  }

  /**
   * Set cache service
   */
  setCacheService(cacheService: any): void {
    this.cacheService = cacheService;
  }
}