import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { structuredLogger } from '../../../app/services/structuredLogger.server';
import { performanceMetrics } from '../../../app/services/performanceMetrics.server';
import { logAnalyzer } from '../../../app/services/logAnalyzer.server';
import { monitoringDashboard } from '../../../app/services/monitoringDashboard.server';

describe('Logging and Monitoring Integration', () => {
  beforeEach(() => {
    // Reset all services
    structuredLogger.clearLogBuffer();
    structuredLogger.setDebugMode(true);
    performanceMetrics.reset();
    logAnalyzer.reset();
    monitoringDashboard.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('end-to-end API request logging and monitoring', () => {
    it('should track complete API request lifecycle', async () => {
      const requestId = structuredLogger.generateRequestId();
      const endpoint = '/api/get-order-data';
      const method = 'GET';
      const parameters = {
        checkoutToken: 'test-token-123',
        customerPhone: '+1234567890'
      };

      // 1. Log API request start
      structuredLogger.logApiRequest(
        requestId,
        method,
        endpoint,
        parameters,
        'Mozilla/5.0 Chrome/91.0',
        '192.168.1.100'
      );

      // 2. Simulate processing time and record metrics
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 150)); // Simulate 150ms processing
      const processingTime = Date.now() - startTime;

      // 3. Record performance metrics
      performanceMetrics.recordApiCall(endpoint, processingTime, 200, true);

      // 4. Log API response
      structuredLogger.logApiResponse(
        requestId,
        200,
        processingTime,
        1024, // 1KB response
        true, // cache hit
        2 // query count
      );

      // 5. Log performance metrics
      structuredLogger.logPerformanceMetrics(requestId, {
        responseTime: processingTime,
        queryTime: 50,
        cacheHit: true,
        memoryUsage: process.memoryUsage().used
      });

      // Verify logging
      const logs = structuredLogger.getLogBuffer();
      expect(logs.length).toBe(3); // Request start, response, performance metrics

      const requestLog = logs.find(log => log.message === 'API Request Started');
      const responseLog = logs.find(log => log.message === 'API Request Completed');
      const metricsLog = logs.find(log => log.message === 'Performance Metrics');

      expect(requestLog).toBeDefined();
      expect(requestLog!.requestId).toBe(requestId);
      expect(requestLog!.endpoint).toBe(endpoint);
      expect(requestLog!.parameters.customerPhone).toBe('***7890'); // Should be masked

      expect(responseLog).toBeDefined();
      expect(responseLog!.responseStatus).toBe(200);
      expect(responseLog!.cacheHit).toBe(true);

      expect(metricsLog).toBeDefined();
      expect(metricsLog!.context.cacheHit).toBe(true);

      // Verify performance metrics
      const apiMetrics = performanceMetrics.getMetrics(endpoint);
      expect(apiMetrics).toHaveLength(1);
      expect(apiMetrics[0].totalRequests).toBe(1);
      expect(apiMetrics[0].successfulRequests).toBe(1);
      expect(apiMetrics[0].cacheHitRate).toBe(1);
    });

    it('should handle error scenarios with proper logging and analysis', async () => {
      const requestId = structuredLogger.generateRequestId();
      const endpoint = '/api/get-order-data';
      const errorMessage = 'Database connection timeout';

      // Log error scenario
      structuredLogger.error('API request failed', {
        requestId,
        endpoint,
        errorMessage,
        responseStatus: 500
      });

      // Record failed API call
      performanceMetrics.recordApiCall(endpoint, 5000, 500, false, 'DATABASE_ERROR');

      // Log API response for failed request
      structuredLogger.logApiResponse(
        requestId,
        500,
        5000,
        256,
        false,
        1,
        errorMessage
      );

      // Trigger log analysis
      logAnalyzer.analyzeLogPatterns();

      // Verify error logging
      const logs = structuredLogger.getLogBuffer();
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);

      const apiErrorLog = errorLogs.find(log => log.message === 'API Request Failed');
      expect(apiErrorLog).toBeDefined();
      expect(apiErrorLog!.errorMessage).toBe(errorMessage);

      // Verify performance metrics recorded failure
      const metrics = performanceMetrics.getMetrics(endpoint);
      expect(metrics[0].failedRequests).toBe(1);
      expect(metrics[0].errorRate).toBe(1);

      // Verify log analysis detected error pattern
      const patterns = logAnalyzer.getLogPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      
      const databaseErrorPattern = patterns.find(p => 
        p.pattern.includes('Database') || p.pattern.includes('timeout')
      );
      expect(databaseErrorPattern).toBeDefined();
    });

    it('should detect anomalies and create alerts', async () => {
      const endpoint = '/api/get-order-data';

      // Simulate normal traffic
      for (let i = 0; i < 10; i++) {
        performanceMetrics.recordApiCall(endpoint, 200, 200, true);
      }

      // Simulate performance degradation
      for (let i = 0; i < 5; i++) {
        performanceMetrics.recordApiCall(endpoint, 3000, 200, false); // Slow responses
        structuredLogger.error('Slow response detected', {
          endpoint,
          responseTime: 3000,
          errorMessage: 'Query timeout'
        });
      }

      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        performanceMetrics.recordApiCall(endpoint, 1000, 500, false, 'DATABASE_ERROR');
        structuredLogger.error('Database error', {
          endpoint,
          errorMessage: 'Connection pool exhausted'
        });
      }

      // Trigger analysis
      logAnalyzer.analyzeLogPatterns();
      logAnalyzer.detectAnomalies();

      // Get dashboard data (which triggers alert checking)
      const dashboardData = monitoringDashboard.getDashboardData();

      // Verify system health reflects issues
      expect(dashboardData.systemHealth.status).not.toBe('healthy');
      expect(dashboardData.systemHealth.errorRate).toBeGreaterThan(0.1);

      // Verify error patterns were detected
      expect(dashboardData.errorPatterns.length).toBeGreaterThan(0);
      const databasePattern = dashboardData.errorPatterns.find(p => 
        p.pattern.includes('Database') || p.pattern.includes('Connection')
      );
      expect(databasePattern).toBeDefined();

      // Verify anomalies were detected
      expect(dashboardData.anomalies.length).toBeGreaterThan(0);

      // Verify alerts were created
      const alerts = monitoringDashboard.getAlerts({ acknowledged: false });
      expect(alerts.length).toBeGreaterThan(0);
      
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive monitoring dashboard', async () => {
      const endpoints = ['/api/get-order-data', '/api/risk-profile', '/api/customer-lookup'];

      // Simulate varied API traffic
      for (const endpoint of endpoints) {
        // Normal requests
        for (let i = 0; i < 20; i++) {
          const responseTime = 100 + Math.random() * 200; // 100-300ms
          const status = Math.random() > 0.05 ? 200 : 500; // 5% error rate
          const cacheHit = Math.random() > 0.3; // 70% cache hit rate

          performanceMetrics.recordApiCall(endpoint, responseTime, status, cacheHit);
          
          const requestId = structuredLogger.generateRequestId();
          structuredLogger.logApiRequest(requestId, 'GET', endpoint, {});
          structuredLogger.logApiResponse(requestId, status, responseTime, 1024, cacheHit, 1);
        }
      }

      // Get comprehensive dashboard data
      const dashboardData = monitoringDashboard.getDashboardData();

      // Verify all components are populated
      expect(dashboardData.timestamp).toBeDefined();
      expect(dashboardData.systemHealth).toBeDefined();
      expect(dashboardData.apiMetrics.length).toBe(3); // All 3 endpoints
      expect(dashboardData.performanceSnapshots).toBeDefined();

      // Verify system health calculation
      expect(dashboardData.systemHealth.totalRequests).toBe(60); // 20 * 3 endpoints
      expect(dashboardData.systemHealth.errorRate).toBeCloseTo(0.05, 1);
      expect(dashboardData.systemHealth.cacheHitRate).toBeCloseTo(0.7, 1);

      // Test chart generation
      const responseTimeChart = monitoringDashboard.getResponseTimeChart();
      expect(responseTimeChart.title).toBe('Average Response Time');
      expect(responseTimeChart.data).toBeDefined();

      const errorRateChart = monitoringDashboard.getErrorRateChart();
      expect(errorRateChart.title).toBe('Error Rate');
      expect(errorRateChart.unit).toBe('%');

      const cacheChart = monitoringDashboard.getCacheHitRateChart();
      expect(cacheChart.data.length).toBe(3); // One per endpoint

      // Test health summary
      const healthSummary = monitoringDashboard.getHealthSummary();
      expect(healthSummary.status).toBeDefined();
      expect(healthSummary.score).toBeGreaterThanOrEqual(0);
      expect(healthSummary.score).toBeLessThanOrEqual(100);

      // Test metrics export
      const jsonExport = monitoringDashboard.exportMetrics('json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const csvExport = monitoringDashboard.exportMetrics('csv');
      expect(csvExport).toContain('timestamp,endpoint,totalRequests');
      expect(csvExport.split('\n').length).toBeGreaterThan(1);
    });

    it('should handle high-volume logging efficiently', async () => {
      const startTime = Date.now();
      const requestCount = 1000;

      // Generate high volume of logs
      for (let i = 0; i < requestCount; i++) {
        const requestId = `req-${i}`;
        const endpoint = `/api/endpoint-${i % 5}`; // 5 different endpoints
        const responseTime = 50 + Math.random() * 200;
        const status = Math.random() > 0.02 ? 200 : 500; // 2% error rate

        structuredLogger.logApiRequest(requestId, 'GET', endpoint, { param: i });
        performanceMetrics.recordApiCall(endpoint, responseTime, status, Math.random() > 0.5);
        structuredLogger.logApiResponse(requestId, status, responseTime, 1024, false, 1);
      }

      const processingTime = Date.now() - startTime;

      // Should handle high volume efficiently (under 1 second for 1000 requests)
      expect(processingTime).toBeLessThan(1000);

      // Verify log buffer management
      const logs = structuredLogger.getLogBuffer();
      expect(logs.length).toBeLessThanOrEqual(1000); // Buffer limit

      // Verify metrics aggregation
      const metrics = performanceMetrics.getMetrics();
      expect(metrics.length).toBe(5); // 5 different endpoints

      // Verify system health calculation with high volume
      const systemHealth = performanceMetrics.getSystemHealth();
      expect(systemHealth.totalRequests).toBeGreaterThan(0);
      expect(systemHealth.errorRate).toBeCloseTo(0.02, 1);
    });

    it('should maintain data consistency across service restarts', async () => {
      const endpoint = '/api/test';
      
      // Record some initial data
      for (let i = 0; i < 10; i++) {
        performanceMetrics.recordApiCall(endpoint, 200, 200, true);
        structuredLogger.info('Test request', { endpoint, requestId: `req-${i}` });
      }

      // Get initial state
      const initialMetrics = performanceMetrics.getMetrics(endpoint);
      const initialLogs = structuredLogger.getLogBuffer();

      expect(initialMetrics[0].totalRequests).toBe(10);
      expect(initialLogs.length).toBe(10);

      // Simulate service restart by resetting
      performanceMetrics.reset();
      structuredLogger.clearLogBuffer();
      logAnalyzer.reset();
      monitoringDashboard.reset();

      // Verify clean state after reset
      expect(performanceMetrics.getMetrics().length).toBe(0);
      expect(structuredLogger.getLogBuffer().length).toBe(0);
      expect(logAnalyzer.getLogPatterns().length).toBe(0);
      expect(monitoringDashboard.getAlerts().length).toBe(0);

      // Record new data after restart
      for (let i = 0; i < 5; i++) {
        performanceMetrics.recordApiCall(endpoint, 150, 200, false);
        structuredLogger.info('Post-restart request', { endpoint, requestId: `new-req-${i}` });
      }

      // Verify new data is tracked correctly
      const newMetrics = performanceMetrics.getMetrics(endpoint);
      const newLogs = structuredLogger.getLogBuffer();

      expect(newMetrics[0].totalRequests).toBe(5);
      expect(newLogs.length).toBe(5);
      expect(newMetrics[0].cacheHitRate).toBe(0); // All new requests were cache misses
    });
  });

  describe('debug mode integration', () => {
    it('should provide detailed logging in debug mode', () => {
      structuredLogger.setDebugMode(true);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const requestId = structuredLogger.generateRequestId();
      structuredLogger.info('Debug test', {
        requestId,
        endpoint: '/api/test',
        method: 'GET',
        processingTime: 150,
        parameters: { test: 'value' }
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logOutput);

      // Should include detailed context in debug mode
      expect(logData.endpoint).toBe('/api/test');
      expect(logData.method).toBe('GET');
      expect(logData.processingTime).toBe(150);
    });

    it('should limit output in production mode', () => {
      structuredLogger.setDebugMode(false);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.info('Production test', {
        endpoint: '/api/test',
        method: 'GET',
        processingTime: 150
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logOutput);

      // Should not include detailed context in production mode
      expect(logData.endpoint).toBeUndefined();
      expect(logData.method).toBeUndefined();
      expect(logData.processingTime).toBeUndefined();
    });
  });
});