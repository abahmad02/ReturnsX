/**
 * ReturnsX Centralized Logging Service
 * 
 * Provides structured logging with different levels for monitoring,
 * debugging, and error tracking in production environments
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  shop?: string;
  customerId?: string;
  orderId?: string;
  webhookTopic?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  stack?: string;
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.minLevel = envLevel === 'DEBUG' ? LogLevel.DEBUG
      : envLevel === 'INFO' ? LogLevel.INFO
      : envLevel === 'WARN' ? LogLevel.WARN
      : envLevel === 'ERROR' ? LogLevel.ERROR
      : process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLogEntry(level: LogLevel, message: string, context: LogContext = {}, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        environment: process.env.NODE_ENV || 'development',
        service: 'returnsx',
      },
    };

    if (error) {
      entry.error = error;
      entry.stack = error.stack;
    }

    return entry;
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const levelName = LogLevel[entry.level];
    const output = {
      ...entry,
      level: levelName,
    };

    // In production, you might want to send logs to external service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with logging service (e.g., Winston, Datadog, CloudWatch)
      console.log(JSON.stringify(output));
    } else {
      // Development: pretty print
      console.log(`[${entry.timestamp}] ${levelName}: ${entry.message}`, 
        Object.keys(entry.context).length > 2 ? entry.context : '');
      if (entry.error) {
        console.error(entry.stack);
      }
    }
  }

  debug(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.DEBUG, message, context));
  }

  info(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.INFO, message, context));
  }

  warn(message: string, context: LogContext = {}, error?: Error): void {
    this.writeLog(this.formatLogEntry(LogLevel.WARN, message, context, error));
  }

  error(message: string, context: LogContext = {}, error?: Error): void {
    this.writeLog(this.formatLogEntry(LogLevel.ERROR, message, context, error));
  }

  // Specialized logging methods for ReturnsX events
  webhookReceived(topic: string, shop: string, orderId?: string): void {
    this.info('Webhook received', {
      webhookTopic: topic,
      shop,
      orderId,
      eventType: 'webhook_received',
    });
  }

  webhookProcessed(topic: string, shop: string, orderId?: string, processingTime?: number): void {
    this.info('Webhook processed successfully', {
      webhookTopic: topic,
      shop,
      orderId,
      processingTime,
      eventType: 'webhook_processed',
    });
  }

  webhookFailed(topic: string, shop: string, error: Error, orderId?: string): void {
    this.error('Webhook processing failed', {
      webhookTopic: topic,
      shop,
      orderId,
      eventType: 'webhook_failed',
    }, error);
  }

  customerProfileCreated(customerId: string, shop: string, riskTier: string): void {
    this.info('Customer profile created', {
      customerId,
      shop,
      riskTier,
      eventType: 'profile_created',
    });
  }

  customerProfileUpdated(customerId: string, shop: string, oldRiskTier: string, newRiskTier: string): void {
    this.info('Customer profile updated', {
      customerId,
      shop,
      oldRiskTier,
      newRiskTier,
      eventType: 'profile_updated',
    });
  }

  riskAssessmentPerformed(customerId: string, shop: string, riskScore: number, riskTier: string): void {
    this.info('Risk assessment performed', {
      customerId,
      shop,
      riskScore,
      riskTier,
      eventType: 'risk_assessment',
    });
  }

  historicalImportStarted(shop: string, totalOrders: number): void {
    this.info('Historical import started', {
      shop,
      totalOrders,
      eventType: 'import_started',
    });
  }

  historicalImportCompleted(shop: string, processedOrders: number, errors: number): void {
    this.info('Historical import completed', {
      shop,
      processedOrders,
      errors,
      eventType: 'import_completed',
    });
  }

  apiRequest(method: string, path: string, shop?: string, responseTime?: number, statusCode?: number): void {
    this.info('API request', {
      method,
      path,
      shop,
      responseTime,
      statusCode,
      eventType: 'api_request',
    });
  }

  securityEvent(eventType: string, shop: string, details: any): void {
    this.warn('Security event detected', {
      shop,
      securityEventType: eventType,
      details,
      eventType: 'security_event',
    });
  }
}

// Create singleton logger instance
export const logger = new Logger();

/**
 * Express/Remix middleware for request logging
 */
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Log request start
    logger.debug('Request started', {
      method: req.method,
      path: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - start;
      
      logger.apiRequest(
        req.method,
        req.url,
        req.headers['x-shopify-shop-domain'],
        responseTime,
        res.statusCode
      );

      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Error boundary for catching and logging unhandled errors
 */
export function logUnhandledError(error: Error, context: LogContext = {}): void {
  logger.error('Unhandled error occurred', {
    ...context,
    eventType: 'unhandled_error',
  }, error);
}

/**
 * Performance timing helper
 */
export class PerformanceTimer {
  private start: number;
  private operation: string;
  private context: LogContext;

  constructor(operation: string, context: LogContext = {}) {
    this.start = Date.now();
    this.operation = operation;
    this.context = context;
    
    logger.debug(`${operation} started`, context);
  }

  finish(additionalContext: LogContext = {}): number {
    const duration = Date.now() - this.start;
    
    logger.debug(`${this.operation} completed`, {
      ...this.context,
      ...additionalContext,
      duration,
    });

    return duration;
  }

  finishWithError(error: Error, additionalContext: LogContext = {}): number {
    const duration = Date.now() - this.start;
    
    logger.error(`${this.operation} failed`, {
      ...this.context,
      ...additionalContext,
      duration,
    }, error);

    return duration;
  }
}

// Export default logger
export default logger; 