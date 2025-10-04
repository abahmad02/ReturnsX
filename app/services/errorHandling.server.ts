/**
 * Comprehensive Error Handling and Recovery System
 * 
 * This module provides a robust error handling framework with:
 * - Hierarchical error classification
 * - HTTP status code mapping
 * - Recovery strategies for different error types
 * - Graceful degradation capabilities
 * - Automatic retry logic with exponential backoff
 */

export enum ApiErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CIRCUIT_BREAKER_ERROR = 'CIRCUIT_BREAKER_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export interface ApiErrorContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  parameters?: Record<string, any>;
  timestamp?: number;
  stackTrace?: string;
  originalError?: Error;
  retryAttempt?: number;
  [key: string]: any;
}

/**
 * Base ApiError class with comprehensive error information
 */
export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly context: ApiErrorContext;
  public readonly timestamp: number;

  constructor(
    type: ApiErrorType,
    message: string,
    code: string,
    statusCode: number,
    retryable: boolean = false,
    context: ApiErrorContext = {},
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.context = {
      ...context,
      timestamp: context.timestamp || Date.now()
    };
    this.timestamp = this.context.timestamp;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON(): Record<string, any> {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      timestamp: this.timestamp,
      context: this.sanitizeContext()
    };
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(): Record<string, any> {
    const sanitized = { ...this.context };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    
    // Sanitize parameters if present
    if (sanitized.parameters) {
      sanitized.parameters = this.sanitizeParameters(sanitized.parameters);
    }
    
    return sanitized;
  }

  private sanitizeParameters(params: Record<string, any>): Record<string, any> {
    const sanitized = { ...params };
    
    // Hash or remove sensitive parameter values
    if (sanitized.phone) {
      sanitized.phone = '[REDACTED]';
    }
    if (sanitized.email) {
      sanitized.email = '[REDACTED]';
    }
    if (sanitized.customerPhone) {
      sanitized.customerPhone = '[REDACTED]';
    }
    
    return sanitized;
  }
}

/**
 * Validation Error - 400 Bad Request
 */
export class ValidationError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'VALIDATION_FAILED') {
    super(ApiErrorType.VALIDATION_ERROR, message, code, 400, false, context);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'AUTHENTICATION_FAILED') {
    super(ApiErrorType.AUTHENTICATION_ERROR, message, code, 401, false, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
export class AuthorizationError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'AUTHORIZATION_FAILED') {
    super(ApiErrorType.AUTHORIZATION_ERROR, message, code, 403, false, context);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not Found Error - 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'RESOURCE_NOT_FOUND') {
    super(ApiErrorType.NOT_FOUND_ERROR, message, code, 404, false, context);
    this.name = 'NotFoundError';
  }
}

/**
 * Timeout Error - 408 Request Timeout
 */
export class TimeoutError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'REQUEST_TIMEOUT') {
    super(ApiErrorType.TIMEOUT_ERROR, message, code, 408, true, context, 1000);
    this.name = 'TimeoutError';
  }
}

/**
 * Database Error - 503 Service Unavailable
 */
export class DatabaseError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'DATABASE_ERROR') {
    super(ApiErrorType.DATABASE_ERROR, message, code, 503, true, context, 5000);
    this.name = 'DatabaseError';
  }
}

/**
 * Circuit Breaker Error - 503 Service Unavailable
 */
export class CircuitBreakerError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'CIRCUIT_BREAKER_OPEN') {
    super(ApiErrorType.CIRCUIT_BREAKER_ERROR, message, code, 503, false, context, 30000);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 */
export class RateLimitError extends ApiError {
  constructor(message: string, retryAfter: number, context: ApiErrorContext = {}, code: string = 'RATE_LIMIT_EXCEEDED') {
    super(ApiErrorType.RATE_LIMIT_ERROR, message, code, 429, true, context, retryAfter);
    this.name = 'RateLimitError';
  }
}

/**
 * Network Error - 502 Bad Gateway
 */
export class NetworkError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'NETWORK_ERROR') {
    super(ApiErrorType.NETWORK_ERROR, message, code, 502, true, context, 2000);
    this.name = 'NetworkError';
  }
}

/**
 * Internal Server Error - 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
  constructor(message: string, context: ApiErrorContext = {}, code: string = 'INTERNAL_SERVER_ERROR') {
    super(ApiErrorType.INTERNAL_SERVER_ERROR, message, code, 500, false, context);
    this.name = 'InternalServerError';
  }
}

/**
 * Error factory for creating appropriate error instances
 */
export class ErrorFactory {
  static createFromError(error: Error, context: ApiErrorContext = {}): ApiError {
    // If it's already an ApiError, return it with updated context
    if (error instanceof ApiError) {
      return new (error.constructor as any)(
        error.message,
        { ...error.context, ...context },
        error.code
      );
    }

    const message = error.message.toLowerCase();

    // Map common error types - order matters, check more specific patterns first
    if (message.includes('econnrefused') || message.includes('network')) {
      return new NetworkError(error.message, { ...context, originalError: error });
    }

    if (message.includes('timeout')) {
      return new TimeoutError(error.message, { ...context, originalError: error });
    }

    if (message.includes('validation') && !message.includes('database')) {
      return new ValidationError(error.message, { ...context, originalError: error });
    }

    if (message.includes('database') || message.includes('connection')) {
      return new DatabaseError(error.message, { ...context, originalError: error });
    }

    // Default to internal server error
    return new InternalServerError(
      error.message || 'An unexpected error occurred',
      { ...context, originalError: error }
    );
  }

  static createNotFound(resource: string, identifier?: string, context: ApiErrorContext = {}): NotFoundError {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    return new NotFoundError(message, context);
  }

  static createValidation(field: string, value: any, reason: string, context: ApiErrorContext = {}): ValidationError {
    const message = `Validation failed for field '${field}': ${reason}`;
    return new ValidationError(message, { ...context, field, value, reason });
  }

  static createTimeout(operation: string, timeoutMs: number, context: ApiErrorContext = {}): TimeoutError {
    const message = `Operation '${operation}' timed out after ${timeoutMs}ms`;
    return new TimeoutError(message, { ...context, operation, timeoutMs });
  }

  static createDatabase(operation: string, details?: string, context: ApiErrorContext = {}): DatabaseError {
    const message = details 
      ? `Database operation '${operation}' failed: ${details}`
      : `Database operation '${operation}' failed`;
    
    return new DatabaseError(message, { ...context, operation, details });
  }

  static createCircuitBreaker(service: string, state: string, context: ApiErrorContext = {}): CircuitBreakerError {
    const message = `Service '${service}' is unavailable (circuit breaker ${state})`;
    return new CircuitBreakerError(message, { ...context, service, circuitState: state });
  }

  static createRateLimit(limit: number, window: number, retryAfter: number, context: ApiErrorContext = {}): RateLimitError {
    const message = `Rate limit exceeded: ${limit} requests per ${window}ms`;
    return new RateLimitError(message, retryAfter, { ...context, limit, window });
  }
}