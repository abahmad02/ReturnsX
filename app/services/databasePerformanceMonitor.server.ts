import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

export interface DatabaseMetrics {
  connectionCount: number;
  activeQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
  timestamp: number;
}

export interface SlowQueryLog {
  query: string;
  duration: number;
  timestamp: number;
  params?: any;
  stackTrace?: string;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  connectionErrors: number;
}

export class DatabasePerformanceMonitor {
  private prisma: PrismaClient;
  private metrics: DatabaseMetrics[] = [];
  private slowQueries: SlowQueryLog[] = [];
  private slowQueryThreshold: number;
  private metricsRetentionPeriod: number;
  private activeQueries: Set<string> = new Set();
  private queryStartTimes: Map<string, number> = new Map();
  private totalQueries: number = 0;
  private totalQueryTime: number = 0;
  private errorCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(
    prisma: PrismaClient,
    slowQueryThreshold: number = 1000,
    metricsRetentionPeriod: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {
    this.prisma = prisma;
    this.slowQueryThreshold = slowQueryThreshold;
    this.metricsRetentionPeriod = metricsRetentionPeriod;
    
    this.setupPrismaMiddleware();
    this.startMetricsCollection();
  }

  /**
   * Setup Prisma middleware for query monitoring
   */
  private setupPrismaMiddleware(): void {
    this.prisma.$use(async (params, next) => {
      const queryId = this.generateQueryId();
      const startTime = performance.now();
      
      this.activeQueries.add(queryId);
      this.queryStartTimes.set(queryId, startTime);
      
      try {
        const result = await next(params);
        const duration = performance.now() - startTime;
        
        this.recordQueryCompletion(queryId, duration, params, true);
        
        // Check for slow queries
        if (duration > this.slowQueryThreshold) {
          this.recordSlowQuery({
            query: `${params.model}.${params.action}`,
            duration,
            timestamp: Date.now(),
            params: this.sanitizeParams(params),
            stackTrace: new Error().stack
          });
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.recordQueryCompletion(queryId, duration, params, false);
        throw error;
      }
    });
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record query completion
   */
  private recordQueryCompletion(
    queryId: string,
    duration: number,
    params: any,
    success: boolean
  ): void {
    this.activeQueries.delete(queryId);
    this.queryStartTimes.delete(queryId);
    
    this.totalQueries++;
    this.totalQueryTime += duration;
    
    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * Record slow query
   */
  private recordSlowQuery(slowQuery: SlowQueryLog): void {
    this.slowQueries.push(slowQuery);
    
    // Keep only recent slow queries
    const cutoffTime = Date.now() - this.metricsRetentionPeriod;
    this.slowQueries = this.slowQueries.filter(q => q.timestamp > cutoffTime);
    
    console.warn(`Slow query detected: ${slowQuery.query} took ${slowQuery.duration}ms`);
  }

  /**
   * Sanitize query parameters for logging
   */
  private sanitizeParams(params: any): any {
    const sanitized = { ...params };
    
    // Remove sensitive data
    if (sanitized.args) {
      const args = { ...sanitized.args };
      
      // Remove or hash sensitive fields
      if (args.data) {
        const data = { ...args.data };
        if (data.phone) data.phone = '[REDACTED]';
        if (data.email) data.email = '[REDACTED]';
        args.data = data;
      }
      
      if (args.where) {
        const where = { ...args.where };
        if (where.phone) where.phone = '[REDACTED]';
        if (where.email) where.email = '[REDACTED]';
        args.where = where;
      }
      
      sanitized.args = args;
    }
    
    return sanitized;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect metrics every minute
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    const recentSlowQueries = this.slowQueries.filter(q => q.timestamp > now - recentWindow);
    
    const metrics: DatabaseMetrics = {
      connectionCount: this.getEstimatedConnectionCount(),
      activeQueries: this.activeQueries.size,
      averageQueryTime: this.totalQueries > 0 ? this.totalQueryTime / this.totalQueries : 0,
      slowQueries: recentSlowQueries.length,
      errorRate: this.totalQueries > 0 ? this.errorCount / this.totalQueries : 0,
      cacheHitRate: this.getCacheHitRate(),
      timestamp: now
    };
    
    this.metrics.push(metrics);
    
    // Clean up old metrics
    const cutoffTime = now - this.metricsRetentionPeriod;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Estimate connection count (Prisma doesn't expose this directly)
   */
  private getEstimatedConnectionCount(): number {
    // This is an approximation based on active queries
    // In a real implementation, you might use database-specific queries
    return Math.max(1, this.activeQueries.size);
  }

  /**
   * Calculate cache hit rate
   */
  private getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): DatabaseMetrics {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) {
      this.collectMetrics();
      return this.metrics[this.metrics.length - 1];
    }
    return latest;
  }

  /**
   * Get metrics for a time range
   */
  getMetricsInRange(startTime: number, endTime: number): DatabaseMetrics[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Get slow queries in time range
   */
  getSlowQueriesInRange(startTime: number, endTime: number): SlowQueryLog[] {
    return this.slowQueries.filter(q => q.timestamp >= startTime && q.timestamp <= endTime);
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionPoolStats(): Promise<ConnectionPoolStats> {
    try {
      // This would need to be implemented with database-specific queries
      // For PostgreSQL, you could query pg_stat_activity
      const result = await this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM pg_stat_activity 
        WHERE datname = current_database() AND state = 'active'
      `;
      
      const activeConnections = result[0]?.count || 0;
      
      return {
        totalConnections: activeConnections + 5, // Estimate
        activeConnections,
        idleConnections: 5, // Estimate
        waitingConnections: 0,
        maxConnections: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '20'),
        connectionErrors: this.errorCount
      };
    } catch (error) {
      console.error('Error getting connection pool stats:', error);
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
        maxConnections: 20,
        connectionErrors: this.errorCount
      };
    }
  }

  /**
   * Check if database performance is healthy
   */
  isHealthy(): {
    healthy: boolean;
    issues: string[];
    metrics: DatabaseMetrics;
  } {
    const current = this.getCurrentMetrics();
    const issues: string[] = [];
    
    // Check various health indicators
    if (current.averageQueryTime > 500) {
      issues.push(`High average query time: ${current.averageQueryTime}ms`);
    }
    
    if (current.slowQueries > 10) {
      issues.push(`Too many slow queries: ${current.slowQueries} in last 5 minutes`);
    }
    
    if (current.errorRate > 0.05) {
      issues.push(`High error rate: ${(current.errorRate * 100).toFixed(2)}%`);
    }
    
    if (current.activeQueries > 50) {
      issues.push(`Too many active queries: ${current.activeQueries}`);
    }
    
    if (current.cacheHitRate < 0.8) {
      issues.push(`Low cache hit rate: ${(current.cacheHitRate * 100).toFixed(2)}%`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics: current
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(timeRange: number = 60 * 60 * 1000): {
    summary: {
      totalQueries: number;
      averageQueryTime: number;
      slowQueries: number;
      errorRate: number;
      cacheHitRate: number;
    };
    trends: {
      queryTimesTrend: number[];
      errorRatesTrend: number[];
      activeQueriesTrend: number[];
    };
    topSlowQueries: SlowQueryLog[];
  } {
    const endTime = Date.now();
    const startTime = endTime - timeRange;
    
    const metricsInRange = this.getMetricsInRange(startTime, endTime);
    const slowQueriesInRange = this.getSlowQueriesInRange(startTime, endTime);
    
    // Calculate summary
    const summary = {
      totalQueries: this.totalQueries,
      averageQueryTime: metricsInRange.length > 0 
        ? metricsInRange.reduce((sum, m) => sum + m.averageQueryTime, 0) / metricsInRange.length 
        : 0,
      slowQueries: slowQueriesInRange.length,
      errorRate: metricsInRange.length > 0 
        ? metricsInRange.reduce((sum, m) => sum + m.errorRate, 0) / metricsInRange.length 
        : 0,
      cacheHitRate: metricsInRange.length > 0 
        ? metricsInRange.reduce((sum, m) => sum + m.cacheHitRate, 0) / metricsInRange.length 
        : 0
    };
    
    // Calculate trends
    const trends = {
      queryTimesTrend: metricsInRange.map(m => m.averageQueryTime),
      errorRatesTrend: metricsInRange.map(m => m.errorRate),
      activeQueriesTrend: metricsInRange.map(m => m.activeQueries)
    };
    
    // Get top slow queries
    const topSlowQueries = slowQueriesInRange
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    return {
      summary,
      trends,
      topSlowQueries
    };
  }

  /**
   * Reset metrics and counters
   */
  reset(): void {
    this.metrics = [];
    this.slowQueries = [];
    this.totalQueries = 0;
    this.totalQueryTime = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }
}