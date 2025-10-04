import { structuredLogger, ApiRequestLog, LogContext } from './structuredLogger.server';
import { performanceMetrics } from './performanceMetrics.server';

export interface LogPattern {
  pattern: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  examples: ApiRequestLog[];
}

export interface ApiUsagePattern {
  endpoint: string;
  peakHours: number[];
  averageRequestsPerHour: number;
  commonParameters: Record<string, number>;
  userAgentDistribution: Record<string, number>;
  errorPatterns: LogPattern[];
}

export interface AnomalyDetection {
  type: 'response_time_spike' | 'error_rate_increase' | 'unusual_traffic' | 'repeated_failures';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  affectedEndpoint?: string;
  metrics: Record<string, number>;
  recommendations: string[];
}

class LogAnalyzer {
  private patterns: Map<string, LogPattern> = new Map();
  private anomalies: AnomalyDetection[] = [];
  private readonly MAX_ANOMALIES = 100;

  constructor() {
    // Run analysis periodically
    setInterval(() => {
      this.analyzeLogPatterns();
      this.detectAnomalies();
    }, 60000); // Every minute
  }

  analyzeLogPatterns(): void {
    const logs = structuredLogger.getLogBuffer();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Analyze recent logs (last hour)
    const recentLogs = logs.filter(log => log.timestamp >= now - oneHour);
    
    // Group by error patterns
    const errorPatterns = new Map<string, ApiRequestLog[]>();
    
    recentLogs.filter(log => log.level === 'error').forEach(log => {
      const pattern = this.extractErrorPattern(log);
      if (!errorPatterns.has(pattern)) {
        errorPatterns.set(pattern, []);
      }
      errorPatterns.get(pattern)!.push(log);
    });

    // Update pattern tracking
    errorPatterns.forEach((logs, pattern) => {
      const existing = this.patterns.get(pattern);
      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];
      
      const logPattern: LogPattern = {
        pattern,
        count: existing ? existing.count + logs.length : logs.length,
        firstSeen: existing ? existing.firstSeen : firstLog.timestamp,
        lastSeen: lastLog.timestamp,
        severity: this.calculateSeverity(logs.length, pattern),
        examples: logs.slice(0, 3) // Keep first 3 examples
      };
      
      this.patterns.set(pattern, logPattern);
    });

    structuredLogger.debug('Log patterns analyzed', {
      totalPatterns: this.patterns.size,
      recentLogs: recentLogs.length
    });
  }

  private extractErrorPattern(log: ApiRequestLog): string {
    // Extract meaningful error patterns
    if (log.errorMessage) {
      // Remove specific values and keep the pattern
      return log.errorMessage
        .replace(/\d+/g, 'N') // Replace numbers
        .replace(/[a-f0-9-]{36}/g, 'UUID') // Replace UUIDs
        .replace(/\b\w+@\w+\.\w+/g, 'EMAIL') // Replace emails
        .replace(/\+?\d{10,}/g, 'PHONE') // Replace phone numbers
        .substring(0, 100); // Limit length
    }
    
    if (log.responseStatus) {
      return `HTTP_${log.responseStatus}_${log.endpoint}`;
    }
    
    return `UNKNOWN_ERROR_${log.endpoint}`;
  }

  private calculateSeverity(count: number, pattern: string): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on frequency and pattern type
    if (pattern.includes('CIRCUIT_BREAKER') || pattern.includes('DATABASE')) {
      return count > 5 ? 'critical' : 'high';
    }
    
    if (pattern.includes('TIMEOUT') || pattern.includes('500')) {
      return count > 10 ? 'high' : 'medium';
    }
    
    if (count > 50) return 'critical';
    if (count > 20) return 'high';
    if (count > 5) return 'medium';
    return 'low';
  }

  detectAnomalies(): void {
    const metrics = performanceMetrics.getMetrics();
    const snapshots = performanceMetrics.getPerformanceSnapshots(10);
    
    if (snapshots.length < 2) return;

    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    // Detect response time spikes
    if (latest.averageResponseTime > previous.averageResponseTime * 2 && 
        latest.averageResponseTime > 1000) {
      this.addAnomaly({
        type: 'response_time_spike',
        severity: latest.averageResponseTime > 5000 ? 'critical' : 'high',
        description: `Response time spiked to ${latest.averageResponseTime.toFixed(0)}ms`,
        timestamp: latest.timestamp,
        metrics: {
          currentResponseTime: latest.averageResponseTime,
          previousResponseTime: previous.averageResponseTime,
          increase: ((latest.averageResponseTime / previous.averageResponseTime - 1) * 100)
        },
        recommendations: [
          'Check database connection pool',
          'Review recent deployments',
          'Monitor circuit breaker status',
          'Check system resources'
        ]
      });
    }

    // Detect error rate increases
    if (latest.errorRate > previous.errorRate * 2 && latest.errorRate > 0.05) {
      this.addAnomaly({
        type: 'error_rate_increase',
        severity: latest.errorRate > 0.2 ? 'critical' : 'high',
        description: `Error rate increased to ${(latest.errorRate * 100).toFixed(1)}%`,
        timestamp: latest.timestamp,
        metrics: {
          currentErrorRate: latest.errorRate,
          previousErrorRate: previous.errorRate,
          increase: ((latest.errorRate / previous.errorRate - 1) * 100)
        },
        recommendations: [
          'Check error logs for patterns',
          'Verify external service availability',
          'Review input validation',
          'Check authentication systems'
        ]
      });
    }

    // Detect unusual traffic patterns
    if (latest.requestsPerSecond > previous.requestsPerSecond * 3 && 
        latest.requestsPerSecond > 10) {
      this.addAnomaly({
        type: 'unusual_traffic',
        severity: latest.requestsPerSecond > 100 ? 'high' : 'medium',
        description: `Traffic spike detected: ${latest.requestsPerSecond.toFixed(1)} req/s`,
        timestamp: latest.timestamp,
        metrics: {
          currentRPS: latest.requestsPerSecond,
          previousRPS: previous.requestsPerSecond,
          increase: ((latest.requestsPerSecond / previous.requestsPerSecond - 1) * 100)
        },
        recommendations: [
          'Check for DDoS attacks',
          'Review rate limiting configuration',
          'Monitor system resources',
          'Consider scaling if legitimate traffic'
        ]
      });
    }

    // Detect repeated failures for specific endpoints
    metrics.forEach(metric => {
      if (metric.errorRate > 0.5 && metric.totalRequests > 10) {
        this.addAnomaly({
          type: 'repeated_failures',
          severity: metric.errorRate > 0.8 ? 'critical' : 'high',
          description: `High failure rate for ${metric.endpoint}: ${(metric.errorRate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
          affectedEndpoint: metric.endpoint,
          metrics: {
            errorRate: metric.errorRate,
            totalRequests: metric.totalRequests,
            failedRequests: metric.failedRequests,
            circuitBreakerTrips: metric.circuitBreakerTrips
          },
          recommendations: [
            'Check endpoint-specific logs',
            'Verify database queries',
            'Review input validation for this endpoint',
            'Consider circuit breaker configuration'
          ]
        });
      }
    });
  }

  private addAnomaly(anomaly: AnomalyDetection): void {
    this.anomalies.push(anomaly);
    
    // Maintain anomalies limit
    if (this.anomalies.length > this.MAX_ANOMALIES) {
      this.anomalies.shift();
    }

    // Log the anomaly
    structuredLogger.warn('Anomaly detected', {
      type: anomaly.type,
      severity: anomaly.severity,
      description: anomaly.description,
      affectedEndpoint: anomaly.affectedEndpoint,
      metrics: anomaly.metrics
    });
  }

  getApiUsagePatterns(endpoint?: string): ApiUsagePattern[] {
    const logs = structuredLogger.getLogBuffer();
    const endpointsToAnalyze = endpoint ? [endpoint] : 
      [...new Set(logs.map(log => log.endpoint))];

    return endpointsToAnalyze.map(ep => this.analyzeEndpointUsage(ep, logs));
  }

  private analyzeEndpointUsage(endpoint: string, logs: ApiRequestLog[]): ApiUsagePattern {
    const endpointLogs = logs.filter(log => log.endpoint === endpoint);
    
    // Analyze peak hours
    const hourlyRequests = new Map<number, number>();
    endpointLogs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyRequests.set(hour, (hourlyRequests.get(hour) || 0) + 1);
    });

    const peakHours = Array.from(hourlyRequests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    const averageRequestsPerHour = endpointLogs.length / 24;

    // Analyze common parameters
    const parameterCounts = new Map<string, number>();
    endpointLogs.forEach(log => {
      Object.keys(log.parameters).forEach(param => {
        parameterCounts.set(param, (parameterCounts.get(param) || 0) + 1);
      });
    });

    const commonParameters = Object.fromEntries(
      Array.from(parameterCounts.entries()).slice(0, 10)
    );

    // Analyze user agents
    const userAgentCounts = new Map<string, number>();
    endpointLogs.forEach(log => {
      if (log.userAgent) {
        const simplified = this.simplifyUserAgent(log.userAgent);
        userAgentCounts.set(simplified, (userAgentCounts.get(simplified) || 0) + 1);
      }
    });

    const userAgentDistribution = Object.fromEntries(
      Array.from(userAgentCounts.entries()).slice(0, 5)
    );

    // Get error patterns for this endpoint
    const errorPatterns = Array.from(this.patterns.values())
      .filter(pattern => pattern.pattern.includes(endpoint))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      endpoint,
      peakHours,
      averageRequestsPerHour,
      commonParameters,
      userAgentDistribution,
      errorPatterns
    };
  }

  private simplifyUserAgent(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('curl')) return 'curl';
    if (userAgent.includes('Postman')) return 'Postman';
    return 'Other';
  }

  getLogPatterns(severity?: 'low' | 'medium' | 'high' | 'critical'): LogPattern[] {
    const patterns = Array.from(this.patterns.values());
    
    if (severity) {
      return patterns.filter(p => p.severity === severity);
    }
    
    return patterns.sort((a, b) => b.count - a.count);
  }

  getAnomalies(limit = 20): AnomalyDetection[] {
    return this.anomalies
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getSystemInsights(): {
    topErrorPatterns: LogPattern[];
    recentAnomalies: AnomalyDetection[];
    healthScore: number;
    recommendations: string[];
  } {
    const topErrorPatterns = this.getLogPatterns()
      .filter(p => p.severity === 'high' || p.severity === 'critical')
      .slice(0, 5);

    const recentAnomalies = this.getAnomalies(5);
    
    // Calculate health score (0-100)
    const systemHealth = performanceMetrics.getSystemHealth();
    let healthScore = 100;
    
    // Deduct points for issues
    healthScore -= Math.min(systemHealth.errorRate * 100, 30); // Max 30 points for errors
    healthScore -= Math.min((systemHealth.averageResponseTime / 1000) * 10, 20); // Max 20 points for slow responses
    healthScore -= topErrorPatterns.length * 5; // 5 points per critical error pattern
    healthScore -= recentAnomalies.filter(a => a.severity === 'critical').length * 10; // 10 points per critical anomaly

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (systemHealth.errorRate > 0.05) {
      recommendations.push('High error rate detected - review error logs and fix critical issues');
    }
    
    if (systemHealth.averageResponseTime > 1000) {
      recommendations.push('Slow response times - optimize database queries and consider caching');
    }
    
    if (topErrorPatterns.length > 0) {
      recommendations.push('Critical error patterns found - address recurring issues');
    }
    
    if (systemHealth.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate - review caching strategy');
    }

    return {
      topErrorPatterns,
      recentAnomalies,
      healthScore,
      recommendations
    };
  }

  reset(): void {
    this.patterns.clear();
    this.anomalies = [];
    structuredLogger.info('Log analyzer reset');
  }
}

// Singleton instance
export const logAnalyzer = new LogAnalyzer();
export default logAnalyzer;