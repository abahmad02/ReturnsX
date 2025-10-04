import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { monitoringDashboard } from '../../../app/services/monitoringDashboard.server';
import { performanceMetrics } from '../../../app/services/performanceMetrics.server';
import { logAnalyzer } from '../../../app/services/logAnalyzer.server';

describe('MonitoringDashboard', () => {
  beforeEach(() => {
    monitoringDashboard.reset();
    performanceMetrics.reset();
    logAnalyzer.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDashboardData', () => {
    it('should return comprehensive dashboard data', () => {
      // Mock some data
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 200,
        errorRate: 0.02,
        cacheHitRate: 0.8
      });

      vi.spyOn(performanceMetrics, 'getMetrics').mockReturnValue([
        {
          endpoint: '/api/test',
          timeWindow: 300000,
          totalRequests: 50,
          successfulRequests: 49,
          failedRequests: 1,
          averageResponseTime: 180,
          p95ResponseTime: 300,
          p99ResponseTime: 500,
          cacheHitRate: 0.8,
          errorRate: 0.02,
          circuitBreakerTrips: 0,
          lastUpdated: Date.now()
        }
      ]);

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 85,
        recommendations: ['Monitor cache performance']
      });

      const dashboardData = monitoringDashboard.getDashboardData();

      expect(dashboardData.timestamp).toBeDefined();
      expect(dashboardData.systemHealth).toBeDefined();
      expect(dashboardData.systemHealth.status).toBe('healthy');
      expect(dashboardData.systemHealth.healthScore).toBe(85);
      expect(dashboardData.apiMetrics).toHaveLength(1);
      expect(dashboardData.performanceSnapshots).toBeDefined();
      expect(dashboardData.errorPatterns).toBeDefined();
      expect(dashboardData.anomalies).toBeDefined();
      expect(dashboardData.alerts).toBeDefined();
    });

    it('should determine correct system status', () => {
      // Test critical status
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 200,
        errorRate: 0.15, // High error rate
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 40, // Low health score
        recommendations: []
      });

      const dashboardData = monitoringDashboard.getDashboardData();
      expect(dashboardData.systemHealth.status).toBe('critical');
    });
  });

  describe('chart generation', () => {
    it('should generate response time chart', () => {
      const mockSnapshots = [
        {
          timestamp: Date.now() - 120000,
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        },
        {
          timestamp: Date.now() - 60000,
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 12,
          averageResponseTime: 250,
          errorRate: 0.02
        },
        {
          timestamp: Date.now(),
          memoryUsage: process.memoryUsage(),
          activeConnections: 5,
          requestsPerSecond: 15,
          averageResponseTime: 180,
          errorRate: 0.01
        }
      ];

      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);

      const chart = monitoringDashboard.getResponseTimeChart();

      expect(chart.title).toBe('Average Response Time');
      expect(chart.type).toBe('line');
      expect(chart.unit).toBe('ms');
      expect(chart.data).toHaveLength(3);
      expect(chart.threshold).toBeDefined();
      expect(chart.threshold!.warning).toBe(500);
      expect(chart.threshold!.critical).toBe(1000);

      // Check data points
      expect(chart.data[0].value).toBe(200);
      expect(chart.data[1].value).toBe(250);
      expect(chart.data[2].value).toBe(180);
    });

    it('should generate error rate chart', () => {
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
          errorRate: 0.03
        }
      ];

      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);

      const chart = monitoringDashboard.getErrorRateChart();

      expect(chart.title).toBe('Error Rate');
      expect(chart.type).toBe('line');
      expect(chart.unit).toBe('%');
      expect(chart.data).toHaveLength(2);

      // Should convert to percentage
      expect(chart.data[0].value).toBe(1); // 0.01 * 100
      expect(chart.data[1].value).toBe(3); // 0.03 * 100
    });

    it('should generate cache hit rate chart', () => {
      const mockMetrics = [
        {
          endpoint: '/api/endpoint1',
          timeWindow: 300000,
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 200,
          p95ResponseTime: 400,
          p99ResponseTime: 600,
          cacheHitRate: 0.8,
          errorRate: 0.05,
          circuitBreakerTrips: 0,
          lastUpdated: Date.now()
        },
        {
          endpoint: '/api/endpoint2',
          timeWindow: 300000,
          totalRequests: 50,
          successfulRequests: 48,
          failedRequests: 2,
          averageResponseTime: 150,
          p95ResponseTime: 300,
          p99ResponseTime: 400,
          cacheHitRate: 0.6,
          errorRate: 0.04,
          circuitBreakerTrips: 0,
          lastUpdated: Date.now()
        }
      ];

      vi.spyOn(performanceMetrics, 'getMetrics').mockReturnValue(mockMetrics);

      const chart = monitoringDashboard.getCacheHitRateChart();

      expect(chart.title).toBe('Cache Hit Rate by Endpoint');
      expect(chart.type).toBe('bar');
      expect(chart.unit).toBe('%');
      expect(chart.data).toHaveLength(2);

      // Should convert to percentage
      expect(chart.data[0].value).toBe(80); // 0.8 * 100
      expect(chart.data[1].value).toBe(60); // 0.6 * 100
      expect(chart.data[0].label).toBe('/api/endpoint1');
      expect(chart.data[1].label).toBe('/api/endpoint2');
    });

    it('should generate memory usage chart', () => {
      const mockSnapshots = [
        {
          timestamp: Date.now() - 60000,
          memoryUsage: { used: 100 * 1024 * 1024, total: 1024 * 1024 * 1024 } as NodeJS.MemoryUsage,
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        },
        {
          timestamp: Date.now(),
          memoryUsage: { used: 150 * 1024 * 1024, total: 1024 * 1024 * 1024 } as NodeJS.MemoryUsage,
          activeConnections: 5,
          requestsPerSecond: 10,
          averageResponseTime: 200,
          errorRate: 0.01
        }
      ];

      vi.spyOn(performanceMetrics, 'getPerformanceSnapshots').mockReturnValue(mockSnapshots);

      const chart = monitoringDashboard.getMemoryUsageChart();

      expect(chart.title).toBe('Memory Usage');
      expect(chart.type).toBe('line');
      expect(chart.unit).toBe('MB');
      expect(chart.data).toHaveLength(2);

      // Should convert bytes to MB
      expect(chart.data[0].value).toBe(100);
      expect(chart.data[1].value).toBe(150);
    });
  });

  describe('alert management', () => {
    it('should create alerts for critical system health', () => {
      // Mock critical system health
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 200,
        errorRate: 0.15, // High error rate
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 30, // Critical health score
        recommendations: []
      });

      // Trigger alert check (normally done by interval)
      const dashboardData = monitoringDashboard.getDashboardData();

      // Should create alerts for critical conditions
      const alerts = monitoringDashboard.getAlerts({ acknowledged: false });
      expect(alerts.length).toBeGreaterThan(0);

      const criticalAlert = alerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });

    it('should acknowledge alerts', () => {
      // Create an alert first
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 3000, // Very slow
        errorRate: 0.02,
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 70,
        recommendations: []
      });

      monitoringDashboard.getDashboardData();

      const alerts = monitoringDashboard.getAlerts({ acknowledged: false });
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      const acknowledged = monitoringDashboard.acknowledgeAlert(alertId);

      expect(acknowledged).toBe(true);

      const acknowledgedAlerts = monitoringDashboard.getAlerts({ acknowledged: true });
      expect(acknowledgedAlerts.some(a => a.id === alertId)).toBe(true);
    });

    it('should resolve alerts', () => {
      // Create an alert first
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 3000,
        errorRate: 0.02,
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 70,
        recommendations: []
      });

      monitoringDashboard.getDashboardData();

      const alerts = monitoringDashboard.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      const resolved = monitoringDashboard.resolveAlert(alertId);

      expect(resolved).toBe(true);

      const resolvedAlerts = monitoringDashboard.getAlerts({ resolved: true });
      expect(resolvedAlerts.some(a => a.id === alertId)).toBe(true);
    });

    it('should filter alerts by criteria', () => {
      // Create different types of alerts
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 3000, // Slow (performance alert)
        errorRate: 0.15, // High (error alert)
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 30, // Critical (system alert)
        recommendations: []
      });

      monitoringDashboard.getDashboardData();

      const allAlerts = monitoringDashboard.getAlerts();
      const performanceAlerts = monitoringDashboard.getAlerts({ type: 'performance' });
      const errorAlerts = monitoringDashboard.getAlerts({ type: 'error' });
      const systemAlerts = monitoringDashboard.getAlerts({ type: 'system' });
      const criticalAlerts = monitoringDashboard.getAlerts({ severity: 'critical' });

      expect(allAlerts.length).toBeGreaterThan(0);
      expect(performanceAlerts.length).toBeGreaterThan(0);
      expect(errorAlerts.length).toBeGreaterThan(0);
      expect(systemAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.length).toBeGreaterThan(0);

      // Filtered results should be subsets
      expect(performanceAlerts.length).toBeLessThanOrEqual(allAlerts.length);
      expect(errorAlerts.length).toBeLessThanOrEqual(allAlerts.length);
      expect(systemAlerts.length).toBeLessThanOrEqual(allAlerts.length);
      expect(criticalAlerts.length).toBeLessThanOrEqual(allAlerts.length);
    });
  });

  describe('getHealthSummary', () => {
    it('should provide comprehensive health summary', () => {
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 1200, // Slow
        errorRate: 0.08, // High
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 65,
        recommendations: ['Optimize database queries', 'Review error handling']
      });

      const summary = monitoringDashboard.getHealthSummary();

      expect(summary.status).toBe('warning');
      expect(summary.score).toBe(65);
      expect(summary.issues.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBe(2);

      // Should identify specific issues
      const issuesText = summary.issues.join(' ');
      expect(issuesText).toContain('error rate');
      expect(issuesText).toContain('response times');
    });

    it('should show healthy status for good metrics', () => {
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 150, // Fast
        errorRate: 0.01, // Low
        cacheHitRate: 0.9
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 95,
        recommendations: []
      });

      const summary = monitoringDashboard.getHealthSummary();

      expect(summary.status).toBe('healthy');
      expect(summary.score).toBe(95);
      expect(summary.issues.length).toBe(0);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics in JSON format', () => {
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 200,
        errorRate: 0.02,
        cacheHitRate: 0.8
      });

      const exported = monitoringDashboard.exportMetrics('json');
      
      expect(() => JSON.parse(exported)).not.toThrow();
      
      const data = JSON.parse(exported);
      expect(data.timestamp).toBeDefined();
      expect(data.systemHealth).toBeDefined();
      expect(data.apiMetrics).toBeDefined();
    });

    it('should export metrics in CSV format', () => {
      vi.spyOn(performanceMetrics, 'getMetrics').mockReturnValue([
        {
          endpoint: '/api/test',
          timeWindow: 300000,
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 200.5,
          p95ResponseTime: 400,
          p99ResponseTime: 600,
          cacheHitRate: 0.8,
          errorRate: 0.05,
          circuitBreakerTrips: 0,
          lastUpdated: Date.now()
        }
      ]);

      const exported = monitoringDashboard.exportMetrics('csv');
      
      const lines = exported.split('\n');
      expect(lines[0]).toContain('timestamp,endpoint,totalRequests');
      expect(lines[1]).toContain('/api/test,100,95,5,200.50,5.00,80.00');
    });
  });

  describe('reset', () => {
    it('should reset dashboard state', () => {
      // Create some alerts
      vi.spyOn(performanceMetrics, 'getSystemHealth').mockReturnValue({
        uptime: 3600000,
        memoryUsage: process.memoryUsage(),
        totalRequests: 100,
        averageResponseTime: 3000,
        errorRate: 0.15,
        cacheHitRate: 0.8
      });

      vi.spyOn(logAnalyzer, 'getSystemInsights').mockReturnValue({
        topErrorPatterns: [],
        recentAnomalies: [],
        healthScore: 30,
        recommendations: []
      });

      monitoringDashboard.getDashboardData();
      
      expect(monitoringDashboard.getAlerts().length).toBeGreaterThan(0);

      monitoringDashboard.reset();

      expect(monitoringDashboard.getAlerts().length).toBe(0);
    });
  });
});