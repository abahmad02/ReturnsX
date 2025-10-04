import { randomUUID } from 'crypto';

export interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface ApiRequestLog {
  requestId: string;
  timestamp: number;
  method: string;
  endpoint: string;
  parameters: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  processingTime?: number;
  responseStatus?: number;
  responseSize?: number;
  cacheHit: boolean;
  errorMessage?: string;
  queryCount: number;
  level: keyof LogLevel;
  message: string;
  context: LogContext;
}

export interface PerformanceMetrics {
  responseTime: number;
  queryTime: number;
  cacheHit: boolean;
  memoryUsage: number;
  cpuUsage?: number;
  activeConnections?: number;
}

class StructuredLogger {
  private debugMode: boolean;
  private logBuffer: ApiRequestLog[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  constructor(debugMode = false) {
    this.debugMode = debugMode || process.env.NODE_ENV === 'development';
  }

  generateRequestId(): string {
    return randomUUID();
  }

  private sanitizeParameters(params: Record<string, any>): Record<string, any> {
    const sanitized = { ...params };
    
    // Remove or mask sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
      
      // Mask phone numbers and emails partially
      if (lowerKey.includes('phone') && typeof sanitized[key] === 'string') {
        const phone = sanitized[key] as string;
        sanitized[key] = phone.length > 4 ? `***${phone.slice(-4)}` : '[MASKED]';
      }
      
      if (lowerKey.includes('email') && typeof sanitized[key] === 'string') {
        const email = sanitized[key] as string;
        const [local, domain] = email.split('@');
        if (local && domain) {
          sanitized[key] = `${local.slice(0, 2)}***@${domain}`;
        }
      }
    });
    
    return sanitized;
  }

  private formatLogEntry(
    level: keyof LogLevel,
    message: string,
    context: LogContext = {}
  ): ApiRequestLog {
    return {
      requestId: context.requestId || this.generateRequestId(),
      timestamp: Date.now(),
      method: context.method || 'UNKNOWN',
      endpoint: context.endpoint || 'UNKNOWN',
      parameters: this.sanitizeParameters(context.parameters || {}),
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      processingTime: context.processingTime,
      responseStatus: context.responseStatus,
      responseSize: context.responseSize,
      cacheHit: context.cacheHit || false,
      errorMessage: context.errorMessage,
      queryCount: context.queryCount || 0,
      level,
      message,
      context: {
        ...context,
        parameters: this.sanitizeParameters(context.parameters || {})
      }
    };
  }

  private writeLog(logEntry: ApiRequestLog): void {
    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }

    // Console output with structured format
    const output = {
      timestamp: new Date(logEntry.timestamp).toISOString(),
      level: logEntry.level.toUpperCase(),
      requestId: logEntry.requestId,
      message: logEntry.message,
      ...(this.debugMode && {
        context: logEntry.context,
        endpoint: logEntry.endpoint,
        method: logEntry.method,
        processingTime: logEntry.processingTime,
        responseStatus: logEntry.responseStatus
      })
    };

    switch (logEntry.level) {
      case LOG_LEVELS.ERROR:
        console.error(JSON.stringify(output, null, 2));
        break;
      case LOG_LEVELS.WARN:
        console.warn(JSON.stringify(output, null, 2));
        break;
      case LOG_LEVELS.DEBUG:
        if (this.debugMode) {
          console.debug(JSON.stringify(output, null, 2));
        }
        break;
      default:
        console.log(JSON.stringify(output, null, 2));
    }
  }

  debug(message: string, context: LogContext = {}): void {
    const logEntry = this.formatLogEntry(LOG_LEVELS.DEBUG, message, context);
    this.writeLog(logEntry);
  }

  info(message: string, context: LogContext = {}): void {
    const logEntry = this.formatLogEntry(LOG_LEVELS.INFO, message, context);
    this.writeLog(logEntry);
  }

  warn(message: string, context: LogContext = {}): void {
    const logEntry = this.formatLogEntry(LOG_LEVELS.WARN, message, context);
    this.writeLog(logEntry);
  }

  error(message: string, context: LogContext = {}): void {
    const logEntry = this.formatLogEntry(LOG_LEVELS.ERROR, message, context);
    this.writeLog(logEntry);
  }

  logApiRequest(
    requestId: string,
    method: string,
    endpoint: string,
    parameters: Record<string, any>,
    userAgent?: string,
    ipAddress?: string
  ): void {
    this.info('API Request Started', {
      requestId,
      method,
      endpoint,
      parameters,
      userAgent,
      ipAddress,
      timestamp: Date.now()
    });
  }

  logApiResponse(
    requestId: string,
    status: number,
    processingTime: number,
    responseSize: number,
    cacheHit: boolean,
    queryCount: number,
    errorMessage?: string
  ): void {
    const level = status >= 400 ? LOG_LEVELS.ERROR : LOG_LEVELS.INFO;
    const message = status >= 400 ? 'API Request Failed' : 'API Request Completed';
    
    this[level](message, {
      requestId,
      responseStatus: status,
      processingTime,
      responseSize,
      cacheHit,
      queryCount,
      errorMessage
    });
  }

  logPerformanceMetrics(
    requestId: string,
    metrics: PerformanceMetrics
  ): void {
    this.info('Performance Metrics', {
      requestId,
      ...metrics
    });
  }

  getLogBuffer(): ApiRequestLog[] {
    return [...this.logBuffer];
  }

  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }
}

// Singleton instance
export const structuredLogger = new StructuredLogger();
export default structuredLogger;