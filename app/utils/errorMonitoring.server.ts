import * as Sentry from '@sentry/node';
import { logger } from '../services/logger.server';

/**
 * Error monitoring and reporting service for ReturnsX
 * Integrates with Sentry for production error tracking
 */

export interface ErrorContext {
  userId?: string;
  shopDomain?: string;
  requestId?: string;
  component?: string;
  action?: string;
  customerProfile?: string;
  metadata?: Record<string, any>;
}

export interface CustomError extends Error {
  code?: string;
  statusCode?: number;
  context?: ErrorContext;
  isOperational?: boolean;
}

/**
 * Initialize error monitoring
 */
export function initializeErrorMonitoring() {
  // Only initialize Sentry in production
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      
      // Set tracing sample rate
      tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? 
        parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) : 0.1,
      
      // Configure error filtering
      beforeSend(event, hint) {
        // Filter out operational errors that don't need tracking
        const error = hint.originalException as CustomError;
        if (error?.isOperational) {
          return null; // Don't send operational errors
        }
        
        // Scrub sensitive data
        if (event.extra) {
          event.extra = scruSensitiveData(event.extra);
        }
        
        return event;
      },
      
      // Configure user context
      beforeBreadcrumb(breadcrumb) {
        // Don't track sensitive breadcrumbs
        if (breadcrumb.category === 'console' && 
            breadcrumb.message?.includes('password')) {
          return null;
        }
        return breadcrumb;
      },
      
      // Configure integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express(),
        new Sentry.Integrations.Postgres({ usePgNative: false }),
      ],
      
      // Tag all events with ReturnsX context
      initialScope: {
        tags: {
          application: 'returnsx',
          version: process.env.npm_package_version || 'unknown'
        }
      }
    });
    
    logger.info('Error monitoring initialized', {
      component: 'errorMonitoring',
      environment: process.env.NODE_ENV,
      dsn: process.env.SENTRY_DSN ? 'configured' : 'missing'
    });
  } else {
    logger.info('Error monitoring disabled', {
      component: 'errorMonitoring',
      reason: process.env.NODE_ENV === 'production' ? 'missing SENTRY_DSN' : 'development mode'
    });
  }
}

/**
 * Report error to monitoring service
 */
export function reportError(error: Error | CustomError, context?: ErrorContext): string | null {
  try {
    // Always log to our structured logger
    logger.error('Error reported', {
      component: context?.component || 'unknown',
      action: context?.action,
      error: error.message,
      stack: error.stack,
      userId: context?.userId,
      shopDomain: context?.shopDomain,
      metadata: context?.metadata
    });
    
    // Report to Sentry if available
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      return Sentry.withScope((scope) => {
        // Set context
        if (context) {
          if (context.userId) {
            scope.setUser({ id: context.userId });
          }
          
          if (context.shopDomain) {
            scope.setTag('shop_domain', context.shopDomain);
          }
          
          if (context.component) {
            scope.setTag('component', context.component);
          }
          
          if (context.action) {
            scope.setTag('action', context.action);
          }
          
          if (context.customerProfile) {
            scope.setTag('customer_profile', context.customerProfile);
          }
          
          if (context.requestId) {
            scope.setTag('request_id', context.requestId);
          }
          
          if (context.metadata) {
            scope.setContext('metadata', scruSensitiveData(context.metadata));
          }
        }
        
        // Set error fingerprint for grouping
        const customError = error as CustomError;
        if (customError.code) {
          scope.setFingerprint([customError.code, context?.component || 'unknown']);
        }
        
        // Set severity based on error type
        if (customError.statusCode && customError.statusCode >= 500) {
          scope.setLevel('error');
        } else if (customError.statusCode && customError.statusCode >= 400) {
          scope.setLevel('warning');
        } else {
          scope.setLevel('error');
        }
        
        return Sentry.captureException(error);
      });
    }
    
    return null;
  } catch (reportingError) {
    // If error reporting fails, log to console as fallback
    console.error('Failed to report error:', reportingError);
    console.error('Original error:', error);
    return null;
  }
}

/**
 * Report performance issue
 */
export function reportPerformanceIssue(
  operation: string,
  duration: number,
  context?: ErrorContext
) {
  const performanceThresholds = {
    database_query: 1000,    // 1 second
    api_request: 5000,       // 5 seconds
    risk_calculation: 500,   // 500ms
    webhook_processing: 2000, // 2 seconds
    default: 3000            // 3 seconds
  };
  
  const threshold = performanceThresholds[operation as keyof typeof performanceThresholds] || 
                   performanceThresholds.default;
  
  if (duration > threshold) {
    logger.warn('Performance issue detected', {
      component: 'performance',
      operation,
      duration,
      threshold,
      userId: context?.userId,
      shopDomain: context?.shopDomain,
      metadata: context?.metadata
    });
    
    // Report to Sentry as a performance issue
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('performance_issue', operation);
        scope.setTag('duration', duration.toString());
        scope.setTag('threshold', threshold.toString());
        
        if (context) {
          if (context.shopDomain) scope.setTag('shop_domain', context.shopDomain);
          if (context.component) scope.setTag('component', context.component);
          if (context.userId) scope.setUser({ id: context.userId });
        }
        
        scope.setLevel('warning');
        
        Sentry.captureMessage(`Performance issue: ${operation} took ${duration}ms`, 'warning');
      });
    }
  }
}

/**
 * Create a custom error with context
 */
export function createError(
  message: string,
  code?: string,
  statusCode?: number,
  context?: ErrorContext,
  isOperational: boolean = true
): CustomError {
  const error = new Error(message) as CustomError;
  error.code = code;
  error.statusCode = statusCode;
  error.context = context;
  error.isOperational = isOperational;
  
  // Add stack trace context
  Error.captureStackTrace?.(error, createError);
  
  return error;
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const enhancedContext: ErrorContext = {
        component: context?.component || fn.name || 'unknown',
        action: context?.action,
        ...context
      };
      
      reportError(error as Error, enhancedContext);
      throw error;
    }
  }) as T;
}

/**
 * Express error handler middleware
 */
export function errorHandlerMiddleware(
  error: Error | CustomError,
  req: any,
  res: any,
  next: any
) {
  const customError = error as CustomError;
  
  // Determine status code
  const statusCode = customError.statusCode || 
                    (customError.name === 'ValidationError' ? 400 : 500);
  
  // Create context from request
  const context: ErrorContext = {
    requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
    userId: req.user?.id,
    shopDomain: req.headers['x-shopify-shop-domain'] || req.query.shop,
    component: 'api',
    action: `${req.method} ${req.path}`,
    metadata: {
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    }
  };
  
  // Report error
  const errorId = reportError(error, context);
  
  // Send error response
  const response = {
    success: false,
    error: customError.isOperational ? error.message : 'Internal server error',
    code: customError.code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    }),
    ...(errorId && { errorId })
  };
  
  res.status(statusCode).json(response);
}

/**
 * Scrub sensitive data from objects
 */
function scruSensitiveData(data: any): any {
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'phone', 'email', 'address', 'credit_card', 'ssn',
    'phoneHash', 'emailHash', 'addressHash'
  ];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => scruSensitiveData(item));
  }
  
  const scrubbed: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      scrubbed[key] = scruSensitiveData(value);
    } else {
      scrubbed[key] = value;
    }
  }
  
  return scrubbed;
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'action',
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
) {
  logger.debug('Breadcrumb added', {
    component: 'breadcrumb',
    message,
    category,
    level,
    data: data ? scruSensitiveData(data) : undefined
  });
  
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: data ? scruSensitiveData(data) : undefined,
      timestamp: Date.now() / 1000
    });
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, shopDomain?: string, metadata?: Record<string, any>) {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      ...(shopDomain && { shopDomain }),
      ...(metadata && scruSensitiveData(metadata))
    });
  }
}

/**
 * Clear user context
 */
export function clearUserContext() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

/**
 * Common error types for ReturnsX
 */
export class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  isOperational = true;
  
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    if (field) {
      this.message = `${field}: ${message}`;
    }
  }
}

export class AuthenticationError extends Error {
  code = 'AUTHENTICATION_ERROR';
  statusCode = 401;
  isOperational = true;
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  code = 'AUTHORIZATION_ERROR';
  statusCode = 403;
  isOperational = true;
  
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  code = 'NOT_FOUND_ERROR';
  statusCode = 404;
  isOperational = true;
  
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  code = 'RATE_LIMIT_ERROR';
  statusCode = 429;
  isOperational = true;
  
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends Error {
  code = 'EXTERNAL_SERVICE_ERROR';
  statusCode = 502;
  isOperational = true;
  
  constructor(service: string, message?: string) {
    super(message || `External service error: ${service}`);
    this.name = 'ExternalServiceError';
  }
} 