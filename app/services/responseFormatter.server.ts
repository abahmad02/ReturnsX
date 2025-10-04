import { json } from "@remix-run/node";
import { ApiError } from "./apiError.server";

/**
 * Interface for response metadata
 */
export interface ResponseMetadata {
  requestId: string;
  processingTime: number;
  cacheHit: boolean;
  dataSource: 'database' | 'cache' | 'fallback';
  queryCount: number;
  timestamp: number;
  version?: string;
  deduplicationHit?: boolean;
  circuitBreakerState?: string;
}

/**
 * Interface for API response structure
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: any;
  metadata: ResponseMetadata;
  message?: string;
  debug?: any;
}

/**
 * Response formatter for consistent API responses
 * Implements requirements 1.2, 3.1, 3.2, 3.3, 3.4, 3.5
 */
export class ResponseFormatter {
  private readonly version = '1.0.0';

  /**
   * Format successful response
   */
  success<T>(
    data: T,
    metadata: ResponseMetadata,
    message?: string,
    debug?: any
  ): Response {
    const response: ApiResponse<T> = {
      data,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        version: this.version
      },
      message,
      debug
    };

    return json(response, {
      status: 200,
      headers: this.getCorsHeaders(metadata)
    });
  }

  /**
   * Format error response
   */
  error(
    error: ApiError,
    metadata: Partial<ResponseMetadata>,
    debug?: any
  ): Response {
    const baseMetadata = {
      requestId: metadata.requestId || 'unknown',
      processingTime: metadata.processingTime || 0,
      cacheHit: false,
      timestamp: Date.now(),
      version: this.version,
      ...metadata
    };

    // Only include sensitive information in development/test environments
    const responseMetadata = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') 
      ? { ...baseMetadata, dataSource: 'fallback' as any, queryCount: 0 }
      : { ...baseMetadata, dataSource: 'api' as any, queryCount: 0 };

    const response: ApiResponse = {
      error: error.toJSON().error,
      metadata: responseMetadata,
      debug
    };

    const headers = this.getCorsHeaders(responseMetadata as ResponseMetadata);
    
    // Add retry-after header for retryable errors
    if (error.retryable && error.retryAfter) {
      headers['Retry-After'] = Math.ceil(error.retryAfter / 1000).toString();
    }

    return json(response, {
      status: error.statusCode,
      headers
    });
  }

  /**
   * Format not found response
   */
  notFound(
    message: string,
    metadata: ResponseMetadata,
    debug?: any
  ): Response {
    const response: ApiResponse = {
      error: {
        type: 'NOT_FOUND_ERROR',
        message,
        code: 'NOT_FOUND',
        retryable: false,
        timestamp: Date.now(),
        requestId: metadata.requestId
      },
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        version: this.version
      },
      debug
    };

    return json(response, {
      status: 404,
      headers: this.getCorsHeaders(metadata)
    });
  }

  /**
   * Format validation error response
   */
  validationError(
    errors: Array<{ field: string; message: string; code: string }>,
    metadata: Partial<ResponseMetadata>,
    debug?: any
  ): Response {
    const baseMetadata = {
      requestId: metadata.requestId || 'unknown',
      processingTime: metadata.processingTime || 0,
      cacheHit: false,
      timestamp: Date.now(),
      version: this.version,
      ...metadata
    };

    // Only include sensitive information in development/test environments
    const responseMetadata = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') 
      ? { ...baseMetadata, dataSource: 'fallback' as any, queryCount: 0 }
      : { ...baseMetadata, dataSource: 'api' as any, queryCount: 0 };

    const response: ApiResponse = {
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        retryable: false,
        timestamp: Date.now(),
        requestId: metadata.requestId || 'unknown',
        details: errors
      },
      metadata: responseMetadata,
      debug
    };

    return json(response, {
      status: 400,
      headers: this.getCorsHeaders(responseMetadata as ResponseMetadata)
    });
  }

  /**
   * Format circuit breaker response
   */
  circuitBreakerOpen(
    metadata: Partial<ResponseMetadata>,
    retryAfter: number = 60000,
    debug?: any
  ): Response {
    const response: ApiResponse = {
      error: {
        type: 'CIRCUIT_BREAKER_ERROR',
        message: 'Service temporarily unavailable due to circuit breaker',
        code: 'CIRCUIT_BREAKER_OPEN',
        retryable: true,
        retryAfter: Math.ceil(retryAfter / 1000),
        timestamp: Date.now(),
        requestId: metadata.requestId || 'unknown'
      },
      metadata: {
        requestId: metadata.requestId || 'unknown',
        processingTime: metadata.processingTime || 0,
        cacheHit: false,
        dataSource: 'fallback',
        queryCount: 0,
        timestamp: Date.now(),
        version: this.version,
        circuitBreakerState: 'OPEN',
        ...metadata
      },
      debug
    };

    const headers = this.getCorsHeaders(metadata as ResponseMetadata);
    headers['Retry-After'] = Math.ceil(retryAfter / 1000).toString();

    return json(response, {
      status: 503,
      headers
    });
  }

  /**
   * Format rate limit response
   */
  rateLimitExceeded(
    metadata: Partial<ResponseMetadata>,
    retryAfter: number = 60000,
    debug?: any
  ): Response {
    const response: ApiResponse = {
      error: {
        type: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryable: true,
        retryAfter: Math.ceil(retryAfter / 1000),
        timestamp: Date.now(),
        requestId: metadata.requestId || 'unknown'
      },
      metadata: {
        requestId: metadata.requestId || 'unknown',
        processingTime: metadata.processingTime || 0,
        cacheHit: false,
        dataSource: 'fallback',
        queryCount: 0,
        timestamp: Date.now(),
        version: this.version,
        ...metadata
      },
      debug
    };

    const headers = this.getCorsHeaders(metadata as ResponseMetadata);
    headers['Retry-After'] = Math.ceil(retryAfter / 1000).toString();

    return json(response, {
      status: 429,
      headers
    });
  }

  /**
   * Format internal server error response
   */
  internalError(
    metadata: Partial<ResponseMetadata>,
    message: string = 'Internal server error',
    debug?: any
  ): Response {
    const response: ApiResponse = {
      error: {
        type: 'INTERNAL_SERVER_ERROR',
        message,
        code: 'INTERNAL_ERROR',
        retryable: false,
        timestamp: Date.now(),
        requestId: metadata.requestId || 'unknown'
      },
      metadata: {
        requestId: metadata.requestId || 'unknown',
        processingTime: metadata.processingTime || 0,
        cacheHit: false,
        dataSource: 'fallback',
        queryCount: 0,
        timestamp: Date.now(),
        version: this.version,
        ...metadata
      },
      debug
    };

    return json(response, {
      status: 500,
      headers: this.getCorsHeaders(metadata as ResponseMetadata)
    });
  }

  /**
   * Get CORS headers for Shopify extensions
   */
  private getCorsHeaders(metadata?: ResponseMetadata): Record<string, string> {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    // Add performance headers (exclude sensitive info in production)
    if (metadata) {
      headers['X-Request-ID'] = metadata.requestId;
      headers['X-Processing-Time'] = metadata.processingTime.toString();
      headers['X-Cache-Hit'] = metadata.cacheHit.toString();
      
      // Only expose data source in development/test environments
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        headers['X-Data-Source'] = metadata.dataSource;
        headers['X-Query-Count'] = metadata.queryCount.toString();
        
        if (metadata.deduplicationHit !== undefined) {
          headers['X-Deduplication-Hit'] = metadata.deduplicationHit.toString();
        }
        
        if (metadata.circuitBreakerState) {
          headers['X-Circuit-Breaker-State'] = metadata.circuitBreakerState;
        }
      }
    }

    return headers;
  }

  /**
   * Handle OPTIONS request for CORS preflight
   */
  options(): Response {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  /**
   * Create metadata object with default values
   */
  createMetadata(
    requestId: string,
    startTime: number,
    overrides: Partial<ResponseMetadata> = {}
  ): ResponseMetadata {
    const baseMetadata = {
      requestId,
      processingTime: Date.now() - startTime,
      cacheHit: false,
      timestamp: Date.now(),
      version: this.version,
      ...overrides
    };

    // Only include sensitive information in development/test environments
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return {
        ...baseMetadata,
        dataSource: overrides.dataSource || 'database',
        queryCount: overrides.queryCount || 0
      };
    }

    // Production metadata excludes sensitive information
    return {
      ...baseMetadata,
      dataSource: 'api' as any, // Generic data source for production
      queryCount: 0 // Don't expose query count in production
    };
  }

  /**
   * Add cache headers for caching optimization
   */
  addCacheHeaders(
    response: Response,
    ttl: number,
    cacheHit: boolean = false
  ): Response {
    const headers = new Headers(response.headers);
    
    if (cacheHit) {
      headers.set('X-Cache', 'HIT');
    } else {
      headers.set('X-Cache', 'MISS');
    }
    
    // Set cache control headers
    if (ttl > 0) {
      headers.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
      headers.set('Expires', new Date(Date.now() + ttl).toUTCString());
    } else {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Compress response if beneficial
   */
  compressResponse(data: any): any {
    // Simple compression logic - in production, you might use actual compression
    if (typeof data === 'object' && data !== null) {
      // Remove null/undefined values to reduce payload size
      return this.removeEmptyValues(data);
    }
    return data;
  }

  /**
   * Remove empty values from object to reduce payload size
   */
  private removeEmptyValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeEmptyValues(item)).filter(item => item !== null && item !== undefined);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key] = this.removeEmptyValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}

// Singleton instance for application-wide use
export const responseFormatter = new ResponseFormatter();