/**
 * Unit tests for Error Handling System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiError,
  ApiErrorType,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  TimeoutError,
  DatabaseError,
  CircuitBreakerError,
  RateLimitError,
  NetworkError,
  InternalServerError,
  ErrorFactory
} from '../../../app/services/errorHandling.server';

describe('ApiError', () => {
  it('should create ApiError with all properties', () => {
    const context = {
      requestId: 'test-123',
      endpoint: '/api/test',
      method: 'GET'
    };

    const error = new ApiError(
      ApiErrorType.VALIDATION_ERROR,
      'Test error message',
      'TEST_ERROR',
      400,
      true,
      context,
      5000
    );

    expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR);
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(5000);
    expect(error.context.requestId).toBe('test-123');
    expect(error.timestamp).toBeTypeOf('number');
  });

  it('should sanitize sensitive information in toJSON', () => {
    const context = {
      requestId: 'test-123',
      password: 'secret123',
      token: 'bearer-token',
      parameters: {
        phone: '+1234567890',
        email: 'test@example.com',
        normalField: 'value'
      }
    };

    const error = new ApiError(
      ApiErrorType.VALIDATION_ERROR,
      'Test error',
      'TEST_ERROR',
      400,
      false,
      context
    );

    const json = error.toJSON();
    
    expect(json.context.password).toBeUndefined();
    expect(json.context.token).toBeUndefined();
    expect(json.context.parameters.phone).toBe('[REDACTED]');
    expect(json.context.parameters.email).toBe('[REDACTED]');
    expect(json.context.parameters.normalField).toBe('value');
  });

  it('should maintain proper stack trace', () => {
    const error = new ApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      'Test error',
      'TEST_ERROR',
      500
    );

    expect(error.stack).toBeDefined();
    expect(error.name).toBe('ApiError');
  });
});

describe('Specific Error Classes', () => {
  it('should create ValidationError with correct properties', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('ValidationError');
  });

  it('should create AuthenticationError with correct properties', () => {
    const error = new AuthenticationError('Invalid credentials');
    
    expect(error.type).toBe(ApiErrorType.AUTHENTICATION_ERROR);
    expect(error.statusCode).toBe(401);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('AuthenticationError');
  });

  it('should create AuthorizationError with correct properties', () => {
    const error = new AuthorizationError('Access denied');
    
    expect(error.type).toBe(ApiErrorType.AUTHORIZATION_ERROR);
    expect(error.statusCode).toBe(403);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('AuthorizationError');
  });

  it('should create NotFoundError with correct properties', () => {
    const error = new NotFoundError('Resource not found');
    
    expect(error.type).toBe(ApiErrorType.NOT_FOUND_ERROR);
    expect(error.statusCode).toBe(404);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('NotFoundError');
  });

  it('should create TimeoutError with correct properties', () => {
    const error = new TimeoutError('Request timeout');
    
    expect(error.type).toBe(ApiErrorType.TIMEOUT_ERROR);
    expect(error.statusCode).toBe(408);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(1000);
    expect(error.name).toBe('TimeoutError');
  });

  it('should create DatabaseError with correct properties', () => {
    const error = new DatabaseError('Connection failed');
    
    expect(error.type).toBe(ApiErrorType.DATABASE_ERROR);
    expect(error.statusCode).toBe(503);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(5000);
    expect(error.name).toBe('DatabaseError');
  });

  it('should create CircuitBreakerError with correct properties', () => {
    const error = new CircuitBreakerError('Circuit breaker open');
    
    expect(error.type).toBe(ApiErrorType.CIRCUIT_BREAKER_ERROR);
    expect(error.statusCode).toBe(503);
    expect(error.retryable).toBe(false);
    expect(error.retryAfter).toBe(30000);
    expect(error.name).toBe('CircuitBreakerError');
  });

  it('should create RateLimitError with correct properties', () => {
    const error = new RateLimitError('Rate limit exceeded', 60000);
    
    expect(error.type).toBe(ApiErrorType.RATE_LIMIT_ERROR);
    expect(error.statusCode).toBe(429);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(60000);
    expect(error.name).toBe('RateLimitError');
  });

  it('should create NetworkError with correct properties', () => {
    const error = new NetworkError('Network unreachable');
    
    expect(error.type).toBe(ApiErrorType.NETWORK_ERROR);
    expect(error.statusCode).toBe(502);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(2000);
    expect(error.name).toBe('NetworkError');
  });

  it('should create InternalServerError with correct properties', () => {
    const error = new InternalServerError('Internal error');
    
    expect(error.type).toBe(ApiErrorType.INTERNAL_SERVER_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('InternalServerError');
  });
});

describe('ErrorFactory', () => {
  it('should create appropriate error from existing ApiError', () => {
    const originalError = new ValidationError('Original error', { field: 'test' });
    const newContext = { requestId: 'new-123' };
    
    const error = ErrorFactory.createFromError(originalError, newContext);
    
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Original error');
    expect(error.context.field).toBe('test');
    expect(error.context.requestId).toBe('new-123');
  });

  it('should create TimeoutError from timeout message', () => {
    const originalError = new Error('Request timeout occurred');
    const error = ErrorFactory.createFromError(originalError);
    
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.type).toBe(ApiErrorType.TIMEOUT_ERROR);
    expect(error.context.originalError).toBe(originalError);
  });

  it('should create DatabaseError from database message', () => {
    const originalError = new Error('Database connection failed');
    const error = ErrorFactory.createFromError(originalError);
    
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.type).toBe(ApiErrorType.DATABASE_ERROR);
  });

  it('should create NetworkError from network message', () => {
    const originalError = new Error('ECONNREFUSED connection refused');
    const error = ErrorFactory.createFromError(originalError);
    
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.type).toBe(ApiErrorType.NETWORK_ERROR);
  });

  it('should create ValidationError from validation message', () => {
    const originalError = new Error('Validation failed for field');
    const error = ErrorFactory.createFromError(originalError);
    
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR);
  });

  it('should create InternalServerError for unknown errors', () => {
    const originalError = new Error('Unknown error occurred');
    const error = ErrorFactory.createFromError(originalError);
    
    expect(error).toBeInstanceOf(InternalServerError);
    expect(error.type).toBe(ApiErrorType.INTERNAL_SERVER_ERROR);
  });

  it('should create NotFoundError with identifier', () => {
    const error = ErrorFactory.createNotFound('Customer', 'cust-123');
    
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Customer with identifier 'cust-123' not found");
  });

  it('should create NotFoundError without identifier', () => {
    const error = ErrorFactory.createNotFound('Order');
    
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Order not found');
  });

  it('should create ValidationError with field details', () => {
    const error = ErrorFactory.createValidation('email', 'invalid-email', 'Invalid format');
    
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe("Validation failed for field 'email': Invalid format");
    expect(error.context.field).toBe('email');
    expect(error.context.value).toBe('invalid-email');
    expect(error.context.reason).toBe('Invalid format');
  });

  it('should create TimeoutError with operation details', () => {
    const error = ErrorFactory.createTimeout('database_query', 5000);
    
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe("Operation 'database_query' timed out after 5000ms");
    expect(error.context.operation).toBe('database_query');
    expect(error.context.timeoutMs).toBe(5000);
  });

  it('should create DatabaseError with operation details', () => {
    const error = ErrorFactory.createDatabase('SELECT', 'Connection lost');
    
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe("Database operation 'SELECT' failed: Connection lost");
    expect(error.context.operation).toBe('SELECT');
    expect(error.context.details).toBe('Connection lost');
  });

  it('should create CircuitBreakerError with service details', () => {
    const error = ErrorFactory.createCircuitBreaker('payment-service', 'OPEN');
    
    expect(error).toBeInstanceOf(CircuitBreakerError);
    expect(error.message).toBe("Service 'payment-service' is unavailable (circuit breaker OPEN)");
    expect(error.context.service).toBe('payment-service');
    expect(error.context.circuitState).toBe('OPEN');
  });

  it('should create RateLimitError with limit details', () => {
    const error = ErrorFactory.createRateLimit(100, 60000, 30000);
    
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe('Rate limit exceeded: 100 requests per 60000ms');
    expect(error.retryAfter).toBe(30000);
    expect(error.context.limit).toBe(100);
    expect(error.context.window).toBe(60000);
  });
});

describe('Error Serialization', () => {
  it('should serialize error to JSON correctly', () => {
    const error = new ValidationError('Test validation error', {
      requestId: 'test-123',
      field: 'email'
    });

    const json = error.toJSON();

    expect(json).toEqual({
      type: ApiErrorType.VALIDATION_ERROR,
      message: 'Test validation error',
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      retryable: false,
      retryAfter: undefined,
      timestamp: expect.any(Number),
      context: {
        requestId: 'test-123',
        field: 'email',
        timestamp: expect.any(Number)
      }
    });
  });

  it('should handle errors without context', () => {
    const error = new InternalServerError('Server error');
    const json = error.toJSON();

    expect(json.context).toEqual({
      timestamp: expect.any(Number)
    });
  });
});