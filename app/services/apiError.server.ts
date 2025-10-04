/**
 * API Error Types and Classes
 * Implements comprehensive error handling as specified in requirements 3.1-3.5
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
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export interface ApiErrorContext {
  requestId?: string;
  timestamp?: number;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  parameters?: Record<string, any>;
  stackTrace?: string;
  correlationId?: string;
  orderId?: string;
  originalError?: string;
  originalStack?: string;
  operation?: string;
}

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
    retryAfter?: number,
    context: ApiErrorContext = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.context = {
      timestamp: Date.now(),
      ...context
    };
    this.timestamp = Date.now();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        type: this.type,
        message: this.message,
        code: this.code,
        retryable: this.retryable,
        retryAfter: this.retryAfter,
        timestamp: this.timestamp,
        requestId: this.context.requestId
      }
    };
  }

  /**
   * Get sanitized error for logging
   */
  toLogFormat(): Record<string, any> {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    code: string = 'VALIDATION_FAILED',
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.VALIDATION_ERROR,
      message,
      code,
      400,
      false,
      undefined,
      context
    );
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
export class AuthenticationError extends ApiError {
  constructor(
    message: string = 'Authentication required',
    code: string = 'AUTHENTICATION_REQUIRED',
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.AUTHENTICATION_ERROR,
      message,
      code,
      401,
      false,
      undefined,
      context
    );
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
export class AuthorizationError extends ApiError {
  constructor(
    message: string = 'Access denied',
    code: string = 'ACCESS_DENIED',
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.AUTHORIZATION_ERROR,
      message,
      code,
      403,
      false,
      undefined,
      context
    );
  }
}

/**
 * Not Found Error - 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(
    message: string = 'Resource not found',
    code: string = 'NOT_FOUND',
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.NOT_FOUND_ERROR,
      message,
      code,
      404,
      false,
      undefined,
      context
    );
  }
}

/**
 * Timeout Error - 408 Request Timeout
 */
export class TimeoutError extends ApiError {
  constructor(
    message: string = 'Request timeout',
    code: string = 'REQUEST_TIMEOUT',
    retryAfter: number = 5000,
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.TIMEOUT_ERROR,
      message,
      code,
      408,
      true,
      retryAfter,
      context
    );
  }
}

/**
 * Database Error - 500 Internal Server Error
 */
export class DatabaseError extends ApiError {
  constructor(
    message: string = 'Database operation failed',
    code: string = 'DATABASE_ERROR',
    retryable: boolean = true,
    retryAfter: number = 1000,
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.DATABASE_ERROR,
      message,
      code,
      500,
      retryable,
      retryAfter,
      context
    );
  }
}

/**
 * Circuit Breaker Error - 503 Service Unavailable
 */
export class CircuitBreakerError extends ApiError {
  constructor(
    message: string = 'Service temporarily unavailable',
    code: string = 'CIRCUIT_BREAKER_OPEN',
    retryAfter: number = 60000,
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.CIRCUIT_BREAKER_ERROR,
      message,
      code,
      503,
      true,
      retryAfter,
      context
    );
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 */
export class RateLimitError extends ApiError {
  constructor(
    message: string = 'Rate limit exceeded',
    code: string = 'RATE_LIMIT_EXCEEDED',
    retryAfter: number = 60000,
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.RATE_LIMIT_ERROR,
      message,
      code,
      429,
      true,
      retryAfter,
      context
    );
  }
}

/**
 * Internal Server Error - 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
  constructor(
    message: string = 'Internal server error',
    code: string = 'INTERNAL_ERROR',
    context: ApiErrorContext = {}
  ) {
    super(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      message,
      code,
      500,
      false,
      undefined,
      context
    );
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  static fromError(
    error: Error,
    context: ApiErrorContext = {}
  ): ApiError {
    // If it's already an ApiError, return it with updated context
    if (error instanceof ApiError) {
      return new ApiError(
        error.type,
        error.message,
        error.code,
        error.statusCode,
        error.retryable,
        error.retryAfter,
        { ...error.context, ...context }
      );
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return new ValidationError(error.message, 'VALIDATION_FAILED', context);
    }

    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return new TimeoutError(error.message, 'REQUEST_TIMEOUT', 5000, context);
    }

    if (error.name === 'DatabaseError' || error.message.includes('database')) {
      return new DatabaseError(error.message, 'DATABASE_ERROR', true, 1000, context);
    }

    if (error.name === 'CircuitBreakerError') {
      return new CircuitBreakerError(error.message, 'CIRCUIT_BREAKER_OPEN', 60000, context);
    }

    // Default to internal server error
    return new InternalServerError(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      {
        ...context,
        originalError: error.message,
        originalStack: error.stack
      }
    );
  }

  static validation(
    message: string,
    code?: string,
    context?: ApiErrorContext
  ): ValidationError {
    return new ValidationError(message, code, context);
  }

  static notFound(
    message?: string,
    code?: string,
    context?: ApiErrorContext
  ): NotFoundError {
    return new NotFoundError(message, code, context);
  }

  static timeout(
    message?: string,
    retryAfter?: number,
    context?: ApiErrorContext
  ): TimeoutError {
    return new TimeoutError(message, 'REQUEST_TIMEOUT', retryAfter, context);
  }

  static database(
    message?: string,
    retryable?: boolean,
    context?: ApiErrorContext
  ): DatabaseError {
    return new DatabaseError(message, 'DATABASE_ERROR', retryable, 1000, context);
  }

  static circuitBreaker(
    message?: string,
    retryAfter?: number,
    context?: ApiErrorContext
  ): CircuitBreakerError {
    return new CircuitBreakerError(message, 'CIRCUIT_BREAKER_OPEN', retryAfter, context);
  }

  static internal(
    message?: string,
    context?: ApiErrorContext
  ): InternalServerError {
    return new InternalServerError(message, 'INTERNAL_ERROR', context);
  }
}