import { structuredLogger } from './structuredLogger.server';

export interface ApiMetrics {
  endpoint: string;
  timeWindow: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  circuitBreakerTrips: number;
  lastUpdated: number;
}

export interface MetricDataPoint {
  timestamp: number;
  responseTime: number;
  status: number;
  cacheHit: boolean;
  endpoint: string;
  errorType?: string;
}

export interface PerformanceSnapshot {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
}

class PerformanceMetricsCollector {
  private metrics: Map<string, ApiMetrics> = new Map();
  private dataPoints: MetricDataPoint[] = [];
  private readonly MAX_DATA_POINTS = 10000;
  private readonly METRICS_WINDOW = 5 * 60 * 1000; // 5 minutes
  private performanceSnapshots: PerformanceSnapshot[] = [];
  private startTime: number = Date.now();

  constructor() {
    // Clean up old data points periodically
    setInterval(() => {
      this.cleanupOldDataPoints();
    }, 60000); // Every minute

    // Collect system performance snapshots
    setInterval(() => {
      this.collectPerformanceSnapshot();
    }, 30000); // Every 30 seconds
  }

  recordApiCall(
    endpoint: string,
    responseTime: number,
    status: number,
    cacheHit: boolean,
    errorType?: string
  ): void {
    const dataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      responseTime,
      status,
      cacheHit,
      endpoint,
      errorType
    };

    this.dataPoints.push(dataPoint);

    // Maintain data points limit
    if (this.dataPoints.length > this.MAX_DATA_POINTS) {
      this.dataPoints.shift();
    }

    // Update endpoint metrics
    this.updateEndpointMetrics(endpoint);

    structuredLogger.debug('API call recorded', {
      endpoint,
      responseTime,
      status,
      cacheHit,
      errorType
    });
  }

  private updateEndpointMetrics(endpoint: string): void {
    const now = Date.now();
    const windowStart = now - this.METRICS_WINDOW;
    
    // Filter data points for this endpoint within the time window
    const endpointData = this.dataPoints.filter(
      dp => dp.endpoint === endpoint && dp.timestamp >= windowStart
    );

    if (endpointData.length === 0) {
      return;
    }

    // Calculate metrics
    const totalRequests = endpointData.length;
    const successfulRequests = endpointData.filter(dp => dp.status < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const cacheHits = endpointData.filter(dp => dp.cacheHit).length;
    
    const responseTimes = endpointData.map(dp => dp.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // Count circuit breaker trips (errors with specific type)
    const circuitBreakerTrips = endpointData.filter(
      dp => dp.errorType === 'CIRCUIT_BREAKER_ERROR'
    ).length;

    const metrics: ApiMetrics = {
      endpoint,
      timeWindow: this.METRICS_WINDOW,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      cacheHitRate,
      errorRate,
      circuitBreakerTrips,
      lastUpdated: now
    };

    this.metrics.set(endpoint, metrics);
  }

  private cleanupOldDataPoints(): void {
    const cutoff = Date.now() - (this.METRICS_WINDOW * 2); // Keep 2x window for safety
    this.dataPoints = this.dataPoints.filter(dp => dp.timestamp >= cutoff);
    
    structuredLogger.debug('Cleaned up old data points', {
      remainingDataPoints: this.dataPoints.length
    });
  }

  private collectPerformanceSnapshot(): void {
    const now = Date.now();
    const recentRequests = this.dataPoints.filter(
      dp => dp.timestamp >= now - 60000 // Last minute
    );

    const requestsPerSecond = recentRequests.length / 60;
    const averageResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, dp) => sum + dp.responseTime, 0) / recentRequests.length
      : 0;
    
    const errors = recentRequests.filter(dp => dp.status >= 400);
    const errorRate = recentRequests.length > 0 ? errors.length / recentRequests.length : 0;

    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      memoryUsage: process.memoryUsage(),
      activeConnections: 0, // Would need to track this separately
      requestsPerSecond,
      averageResponseTime,
      errorRate
    };

    this.performanceSnapshots.push(snapshot);

    // Keep only last 100 snapshots (about 50 minutes)
    if (this.performanceSnapshots.length > 100) {
      this.performanceSnapshots.shift();
    }

    structuredLogger.debug('Performance snapshot collected', {
      requestsPerSecond,
      averageResponseTime,
      errorRate,
      memoryUsage: snapshot.memoryUsage.used
    });
  }

  getMetrics(endpoint?: string): ApiMetrics[] {
    if (endpoint) {
      const metric = this.metrics.get(endpoint);
      return metric ? [metric] : [];
    }
    
    return Array.from(this.metrics.values());
  }

  getPerformanceSnapshots(limit = 50): PerformanceSnapshot[] {
    return this.performanceSnapshots.slice(-limit);
  }

  getSystemHealth(): {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  } {
    const now = Date.now();
    const recentData = this.dataPoints.filter(
      dp => dp.timestamp >= now - this.METRICS_WINDOW
    );

    const totalRequests = recentData.length;
    const errors = recentData.filter(dp => dp.status >= 400);
    const cacheHits = recentData.filter(dp => dp.cacheHit);
    
    const averageResponseTime = totalRequests > 0
      ? recentData.reduce((sum, dp) => sum + dp.responseTime, 0) / totalRequests
      : 0;
    
    const errorRate = totalRequests > 0 ? errors.length / totalRequests : 0;
    const cacheHitRate = totalRequests > 0 ? cacheHits.length / totalRequests : 0;

    return {
      uptime: Math.max(1, now - this.startTime), // Ensure uptime is always > 0
      memoryUsage: process.memoryUsage(),
      totalRequests,
      averageResponseTime,
      errorRate,
      cacheHitRate
    };
  }

  getEndpointAnalysis(endpoint: string, timeRange = this.METRICS_WINDOW): {
    requestPattern: { hour: number; count: number }[];
    errorDistribution: { errorType: string; count: number }[];
    responseTimeDistribution: { range: string; count: number }[];
  } {
    const now = Date.now();
    const data = this.dataPoints.filter(
      dp => dp.endpoint === endpoint && dp.timestamp >= now - timeRange
    );

    // Request pattern by hour
    const hourlyRequests = new Map<number, number>();
    data.forEach(dp => {
      const hour = new Date(dp.timestamp).getHours();
      hourlyRequests.set(hour, (hourlyRequests.get(hour) || 0) + 1);
    });

    const requestPattern = Array.from(hourlyRequests.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    // Error distribution
    const errorCounts = new Map<string, number>();
    data.filter(dp => dp.status >= 400).forEach(dp => {
      const errorType = dp.errorType || `HTTP_${dp.status}`;
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    });

    const errorDistribution = Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count);

    // Response time distribution
    const timeRanges = [
      { range: '0-100ms', min: 0, max: 99.99 },
      { range: '100-200ms', min: 100, max: 199.99 },
      { range: '200-500ms', min: 200, max: 499.99 },
      { range: '500ms-1s', min: 500, max: 999.99 },
      { range: '1s+', min: 1000, max: Infinity }
    ];

    const responseTimeDistribution = timeRanges.map(range => ({
      range: range.range,
      count: data.filter(dp => 
        dp.responseTime >= range.min && dp.responseTime <= range.max
      ).length
    }));

    return {
      requestPattern,
      errorDistribution,
      responseTimeDistribution
    };
  }

  reset(): void {
    this.metrics.clear();
    this.dataPoints = [];
    this.performanceSnapshots = [];
    this.startTime = Date.now();
    
    structuredLogger.info('Performance metrics reset');
  }
}

// Singleton instance
export const performanceMetrics = new PerformanceMetricsCollector();
export default performanceMetrics;