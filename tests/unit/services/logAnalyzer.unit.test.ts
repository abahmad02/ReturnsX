import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logAnalyzer } from '../../../app/services/logAnalyzer.server';
import { structuredLogger } from '../../../app/services/structuredLogger.server';
import { performanceMetrics } from '../../../app/services/performanceMetrics.server';

describe('LogAnalyzer', () => {
  beforeEach(() => {
    logAnalyzer.reset();
    structuredLogger.clearLogBuffer();
    performanceMetrics.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeLogPatterns', () => {
    it('should identify error patterns from logs', () => {
      // Create some error logs
      structuredLogger.error('Database connection failed', {
        endpoint: '/api/test',
        errorMessage: 'Connection timeout after 5000ms'
      });
      
      structuredLogger.error('Database connection failed', {
        endpoint: '/api/test',
        errorMessage: 'Connection timeout after 3000ms'
      });
      
      structuredLogger.error('Validation error', {
        endpoint: '/api/validate',
        errorMessage: 'Invalid phone number format'
      });
      
      // Trigger analysis
      logAnalyzer.analyzeLogPatterns();
      
      const patterns = logAnalyzer.getLogPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      
      // Should group similar errors
      const timeoutPattern = patterns.find(p => p.pattern.includes('timeout'));
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern!.count).toBe(2);
    });

    it('should calculate severity based on error frequency and type', () => {
      // Create multiple circuit breaker errors (should be high severity)
      for (let i = 0; i < 10; i++) {
        structuredLogger.error('Circuit breaker open', {
          endpoint: '/api/test',
          errorMessage: 'Circuit breaker is open'
        });
      }
      
      logAnalyzer.analyzeLogPatterns();
      
      const patterns = logAnalyzer.getLogPatterns();
      const circuitBreakerPattern = patterns.find(p => p.pattern.includes('CIRCUIT_BREAKER'));
      
      expect(circuitBreakerPattern).toBeDefined();
      expect(circuitBreakerPattern!.severity).toBe('critical');
    });

    it('should sanitize error patterns', () => {
      structuredLogger.error('User not found', {
        endpoint: '/api/users',
        errorMessage: 'User with ID 12345 not found'
      });
      
      structuredLogger.error('User not found', {
        endpoint: '/api/users',
        errorMessage: 'User with ID 67890 not found'
      });
      
      logAnalyzer.analyzeLogPatterns();
      
      const patterns = logAnalyzer.getLogPatterns();
      const userPattern = patterns.find(p => p.pattern.includes('User with ID N not found'));
      
      expect(userPattern).toBeDefined();
      expect(userPattern!.count).toBe(2);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect response time spikes', () => {
      // Mock performance snapshots with response time spike
      const mockSnapshots = [
        {
          timestamp: Date.now() - 60000,
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        },
        {
          timestamp: Date.now(),
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 2000, // Spike!
          errorRate: 0.01
        }
      ];
      
      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);
      
      logAnalyzer.detectAnomalies();
      
      const anomalies = logAnalyzer.getAnomalies();
      const responseTimeAnomaly = anomalies.find(a => a.type === 'response_time_spike');
      
      expect(responseTimeAnomaly).toBeDefined();
      expect(responseTimeAnomaly!.severity).toBe('high');
      expect(responseTimeAnomaly!.description).toContain('2000ms');
    });

    it('should detect error rate increases', () => {
      const mockSnapshots = [
        {
          timestamp: Date.now() - 60000,
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        },
        {
          timestamp: Date.now(),
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.15 // High error rate
        }
      ];
      
      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);
      
      logAnalyzer.detectAnomalies();
      
      const anomalies = logAnalyzer.getAnomalies();
      const errorRateAnomaly = anomalies.find(a => a.type === 'error_rate_increase');
      
      expect(errorRateAnomaly).toBeDefined();
      expect(errorRateAnomaly!.severity).toBe('high');
      expect(errorRateAnomaly!.description).toContain('15.0%');
    });

    it('should detect unusual traffic patterns', () => {
      const mockSnapshots = [
        {
          timestamp: Date.now() - 60000,
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        },
        {
          timestamp: Date.now(),
          memoryUsage: process.memoryUsage(),
          activeConnections: 50,
          requestsPerSecond: 150, // Traffic spike
          averageResponseTime: 200,
          errorRate: 0.01
        }
      ];
      
      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);
      
      logAnalyzer.detectAnomalies();
      
      const anomalies = logAnalyzer.getAnomalies();
      const trafficAnomaly = anomalies.find(a => a.type === 'unusual_traffic');
      
      expect(trafficAnomaly).toBeDefined();
      expect(trafficAnomaly!.severity).toBe('high');
      expect(trafficAnomaly!.description).toContain('150.0 req/s');
    });

    it('should detect repeated failures for specific endpoints', () => {
      const mockMetrics = [
        {
          endpoint: '/api/failing-endpoint',
          timeWindow: 300000,
          totalRequests: 20,
          successfulRequests: 2,
          failedRequests: 18,
          averageResponseTime: 1000,
          p95ResponseTime: 2000,
          p99ResponseTime: 3000,
          cacheHitRate: 0.1,
          errorRate: 0.9, // 90% error rate
          circuitBreakerTrips: 5,
          lastUpdated: Date.now()
        }
      ];
      
      vi.spyOn(performanceMetrics, 'getMetrics').mockReturnValue(mockMetrics);
      
      logAnalyzer.detectAnomalies();
      
      const anomalies = logAnalyzer.getAnomalies();
      const failureAnomaly = anomalies.find(a => a.type === 'repeated_failures');
      
      expect(failureAnomaly).toBeDefined();
      expect(failureAnomaly!.severity).toBe('critical');
      expect(failureAnomaly!.affectedEndpoint).toBe('/api/failing-endpoint');
      expect(failureAnomaly!.description).toContain('90.0%');
    });
  });

  describe('getApiUsagePatterns', () => {
    it('should analyze API usage patterns for endpoints', () => {
      // Create logs with different timestamps and parameters
      const now = Date.now();
      
      // Mock different hours
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = now - (24 - hour) * 60 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValueOnce(timestamp);
        
        structuredLogger.info('API Request', {
          endpoint: '/api/test',
          method: 'GET',
          parameters: { param1: 'value1', param2: hour % 3 === 0 ? 'special' : 'normal' },
          userAgent: hour % 2 === 0 ? 'Chrome/91.0' : 'Firefox/89.0'
        });
      }
      
      const patterns = logAnalyzer.getApiUsagePatterns('/api/test');
      expect(patterns).toHaveLength(1);
      
      const pattern = patterns[0];
      expect(pattern.endpoint).toBe('/api/test');
      expect(pattern.peakHours).toBeDefined();
      expect(pattern.peakHours.length).toBeLessThanOrEqual(3);
      expect(pattern.averageRequestsPerHour).toBeGreaterThan(0);
      expect(pattern.commonParameters).toBeDefined();
      expect(pattern.userAgentDistribution).toBeDefined();
    });

    it('should analyze all endpoints when no specific endpoint provided', () => {
      structuredLogger.info('API Request', { endpoint: '/api/endpoint1' });
      structuredLogger.info('API Request', { endpoint: '/api/endpoint2' });
      
      const patterns = logAnalyzer.getApiUsagePatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(2);
      
      const endpoints = patterns.map(p => p.endpoint);
      expect(endpoints).toContain('/api/endpoint1');
      expect(endpoints).toContain('/api/endpoint2');
    });

    it('should simplify user agents correctly', () => {
      structuredLogger.info('API Request', {
        endpoint: '/api/test',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      structuredLogger.info('API Request', {
        endpoint: '/api/test',
        userAgent: 'curl/7.68.0'
      });
      
      const patterns = logAnalyzer.getApiUsagePatterns('/api/test');
      const pattern = patterns[0];
      
      expect(pattern.userAgentDistribution.Chrome).toBe(1);
      expect(pattern.userAgentDistribution.curl).toBe(1);
    });
  });

  describe('getSystemInsights', () => {
    it('should provide comprehensive system insights', () => {
      // Create some error patterns
      structuredLogger.error('Critical error', {
        endpoint: '/api/test',
        errorMessage: 'Database connection failed'
      });
      
      // Mock system health
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 800,
        errorRate: 0.08,
        cacheHitRate: 0.4
      });
      
      logAnalyzer.analyzeLogPatterns();
      
      const insights = logAnalyzer.getSystemInsights();
      
      expect(insights.topErrorPatterns).toBeDefined();
      expect(insights.recentAnomalies).toBeDefined();
      expect(insights.healthScore).toBeGreaterThanOrEqual(0);
      expect(insights.healthScore).toBeLessThanOrEqual(100);
      expect(insights.recommendations).toBeDefined();
      expect(insights.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate health score based on system metrics', () => {
      // Mock poor system health
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 3000, // Very slow
        errorRate: 0.2, // High error rate
        cacheHitRate: 0.1 // Low cache hit rate
      });
      
      const insights = logAnalyzer.getSystemInsights();
      
      // Health score should be low due to poor metrics
      expect(insights.healthScore).toBeLessThan(70);
      expect(insights.recommendations.length).toBeGreaterThan(2);
    });

    it('should provide relevant recommendations', () => {
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 1500, // Slow
        errorRate: 0.08, // High error rate
        cacheHitRate: 0.3 // Low cache hit rate
      });
      
      const insights = logAnalyzer.getSystemInsights();
      
      const recommendations = insights.recommendations.join(' ');
      expect(recommendations).toContain('error rate');
      expect(recommendations).toContain('response times');
      expect(recommendations).toContain('caching');
    });
  });

  describe('getLogPatterns', () => {
    it('should filter patterns by severity', () => {
      // Create patterns with different severities
      for (let i = 0; i < 3; i++) {
        structuredLogger.error('Low severity error', {
          endpoint: '/api/test',
          errorMessage: 'Minor validation error'
        });
      }
      
      for (let i = 0; i < 15; i++) {
        structuredLogger.error('High severity error', {
          endpoint: '/api/test',
          errorMessage: 'Database connection failed'
        });
      }
      
      logAnalyzer.analyzeLogPatterns();
      
      const allPatterns = logAnalyzer.getLogPatterns();
      const highSeverityPatterns = logAnalyzer.getLogPatterns('high');
      const criticalPatterns = logAnalyzer.getLogPatterns('critical');
      
      expect(allPatterns.length).toBeGreaterThan(0);
      expect(highSeverityPatterns.length).toBeGreaterThan(0);
      expect(criticalPatterns.length).toBeGreaterThan(0);
      
      // High severity patterns should be subset of all patterns
      expect(highSeverityPatterns.length).toBeLessThanOrEqual(allPatterns.length);
    });

    it('should sort patterns by count', () => {
      // Create patterns with different frequencies
      for (let i = 0; i < 5; i++) {
        structuredLogger.error('Less frequent error', {
          endpoint: '/api/test1',
          errorMessage: 'Error type A'
        });
      }
      
      for (let i = 0; i < 10; i++) {
        structuredLogger.error('More frequent error', {
          endpoint: '/api/test2',
          errorMessage: 'Error type B'
        });
      }
      
      logAnalyzer.analyzeLogPatterns();
      
      const patterns = logAnalyzer.getLogPatterns();
      
      // Should be sorted by count (descending)
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i - 1].count).toBeGreaterThanOrEqual(patterns[i].count);
      }
    });
  });

  describe('reset', () => {
    it('should reset all analyzer state', () => {
      // Create some data
      structuredLogger.error('Test error', { endpoint: '/api/test' });
      logAnalyzer.analyzeLogPatterns();
      
      expect(logAnalyzer.getLogPatterns().length).toBeGreaterThan(0);
      
      logAnalyzer.reset();
      
      expect(logAnalyzer.getLogPatterns().length).toBe(0);
      expect(logAnalyzer.getAnomalies().length).toBe(0);
    });
  });
});