import { randomUUID } from 'crypto';
import { securityValidator } from './securityValidator.server';

/**
 * Interface for API request log entry
 */
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
  deduplicationHit?: boolean;
  circuitBreakerState?: string;
  validationErrors?: Array<{ field: string; message: string; code: string }>;
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  responseTime: number;
  queryTime?: number;
  cacheTime?: number;
  validationTime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

/**
 * API Logger for comprehensive request/response logging
 * Implements requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class ApiLogger {
  private requestLogs: Map<string, ApiRequestLog> = new Map();
  private readonly maxLogRetention = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Log incoming API request
   */
  logRequest(
    requestId: string,
    method: string,
    endpoint: string,
    parameters: Record<string, any>,
    userAgent?: string,
    ipAddress?: string
  ): void {
    const sanitizedParams = securityValidator.sanitizeForLogging(parameters);
    
    const logEntry: ApiRequestLog = {
      requestId,
      timestamp: Date.now(),
      method,
      endpoint,
      parameters: sanitizedParams,
      userAgent,
      ipAddress: this.maskIpAddress(ipAddress),
      cacheHit: false,
      queryCount: 0
    };

    this.requestLogs.set(requestId, logEntry);

    console.log('[API Request]', {
      requestId,
      method,
      endpoint,
      parameters: sanitizedParams,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log API response
   */
  logResponse(
    requestId: string,
    status: number,
    processingTime: number,
    responseSize?: number,
    cacheHit: boolean = false,
    queryCount: number = 0,
    errorMessage?: string,
    deduplicationHit?: boolean,
    circuitBreakerState?: string
  ): void {
    const logEntry = this.requestLogs.get(requestId);
    if (logEntry) {
      logEntry.responseStatus = status;
      logEntry.processingTime = processingTime;
      logEntry.responseSize = responseSize;
      logEntry.cacheHit = cacheHit;
      logEntry.queryCount = queryCount;
      logEntry.errorMessage = errorMessage;
      logEntry.deduplicationHit = deduplicationHit;
      logEntry.circuitBreakerState = circuitBreakerState;
    }

    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    console[logLevel]('[API Response]', {
      requestId,
      status,
      processingTime,
      responseSize,
      cacheHit,
      queryCount,
      deduplicationHit,
      circuitBreakerState,
      errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log validation errors
   */
  logValidationErrors(
    requestId: string,
    errors: Array<{ field: string; message: string; code: string; severity: string }>
  ): void {
    const logEntry = this.requestLogs.get(requestId);
    if (logEntry) {
      logEntry.validationErrors = errors.map(({ field, message, code }) => ({ field, message, code }));
    }

    console.warn('[API Validation Error]', {
      requestId,
      errors: errors.map(error => ({
        field: error.field,
        message: error.message,
        code: error.code,
        severity: error.severity
      })),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    requestId: string,
    metrics: PerformanceMetrics
  ): void {
    console.info('[API Performance]', {
      requestId,
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error with context
   */
  logError(
    requestId: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const sanitizedContext = context ? securityValidator.sanitizeForLogging(context) : {};
    
    console.error('[API Error]', {
      requestId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: sanitizedContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log warning with context
   */
  logWarning(
    requestId: string,
    message: string,
    context?: Record<string, any>
  ): void {
    const sanitizedContext = context ? securityValidator.sanitizeForLogging(context) : {};
    
    console.warn('[API Warning]', {
      requestId,
      message,
      context: sanitizedContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log info message with context
   */
  logInfo(
    requestId: string,
    message: string,
    context?: Record<string, any>
  ): void {
    const sanitizedContext = context ? securityValidator.sanitizeForLogging(context) : {};
    
    console.info('[API Info]', {
      requestId,
      message,
      context: sanitizedContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log debug information (only in debug mode)
   */
  logDebug(
    requestId: string,
    message: string,
    data?: any,
    debugMode: boolean = false
  ): void {
    if (!debugMode) return;

    const sanitizedData = data ? securityValidator.sanitizeForLogging(data) : {};
    
    console.debug('[API Debug]', {
      requestId,
      message,
      data: sanitizedData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log cache operations
   */
  logCacheOperation(
    requestId: string,
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    key: string,
    ttl?: number,
    size?: number
  ): void {
    console.info('[API Cache]', {
      requestId,
      operation,
      key: this.maskCacheKey(key),
      ttl,
      size,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log circuit breaker events
   */
  logCircuitBreakerEvent(
    requestId: string,
    event: 'open' | 'close' | 'half_open' | 'trip' | 'success' | 'failure',
    state: string,
    metrics?: Record<string, any>
  ): void {
    console.info('[API Circuit Breaker]', {
      requestId,
      event,
      state,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log deduplication events
   */
  logDeduplicationEvent(
    requestId: string,
    event: 'duplicate_detected' | 'new_request' | 'request_completed',
    key: string,
    pendingCount?: number
  ): void {
    console.info('[API Deduplication]', {
      requestId,
      event,
      key: this.maskCacheKey(key),
      pendingCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get request log by ID
   */
  getRequestLog(requestId: string): ApiRequestLog | undefined {
    return this.requestLogs.get(requestId);
  }

  /**
   * Get all request logs (for debugging/monitoring)
   */
  getAllRequestLogs(): ApiRequestLog[] {
    return Array.from(this.requestLogs.values());
  }

  /**
   * Get request logs within time range
   */
  getRequestLogsByTimeRange(startTime: number, endTime: number): ApiRequestLog[] {
    return Array.from(this.requestLogs.values())
      .filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindow: number = 60 * 60 * 1000): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  } {
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const recentLogs = Array.from(this.requestLogs.values())
      .filter(log => log.timestamp > cutoff && log.processingTime !== undefined);

    if (recentLogs.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      };
    }

    const responseTimes = recentLogs
      .map(log => log.processingTime!)
      .sort((a, b) => a - b);

    const totalRequests = recentLogs.length;
    const errorCount = recentLogs.filter(log => log.responseStatus && log.responseStatus >= 400).length;
    const cacheHits = recentLogs.filter(log => log.cacheHit).length;
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      totalRequests,
      averageResponseTime,
      errorRate: errorCount / totalRequests,
      cacheHitRate: cacheHits / totalRequests,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0
    };
  }

  /**
   * Clear old logs
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.maxLogRetention;
    
    let cleanedCount = 0;
    for (const [requestId, log] of Array.from(this.requestLogs.entries())) {
      if (log.timestamp < cutoff) {
        this.requestLogs.delete(requestId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.info('[API Logger] Cleaned up old logs', {
        cleanedCount,
        remainingLogs: this.requestLogs.size,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Destroy logger and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.requestLogs.clear();
  }

  /**
   * Mask IP address for privacy
   */
  private maskIpAddress(ip?: string): string | undefined {
    if (!ip) return undefined;
    
    // IPv4: mask last octet
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
      }
    }
    
    // IPv6: mask last 4 groups
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return parts.slice(0, 4).join(':') + ':***';
      }
    }
    
    return '***';
  }

  /**
   * Mask cache key for logging
   */
  private maskCacheKey(key: string): string {
    if (key.length <= 16) return '***';
    return key.substring(0, 8) + '***' + key.substring(key.length - 4);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}

// Singleton instance for application-wide use
export const apiLogger = new ApiLogger();