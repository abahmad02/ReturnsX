import { structuredLogger } from './structuredLogger.server';
import { performanceMetrics } from './performanceMetrics.server';
import { logAnalyzer } from './logAnalyzer.server';
import { monitoringDashboard } from './monitoringDashboard.server';

/**
 * Demonstration of the comprehensive logging and monitoring system
 * This shows how all components work together to provide detailed
 * API request logging, performance monitoring, and real-time analytics
 */
export class LoggingSystemDemo {
  
  /**
   * Simulate a complete API request lifecycle with logging and monitoring
   */
  async simulateApiRequest(
    endpoint: string,
    method: string = 'GET',
    simulateError: boolean = false,
    responseTime: number = 200
  ): Promise<void> {
    const requestId = structuredLogger.generateRequestId();
    const startTime = Date.now();

    try {
      // 1. Log API request start
      structuredLogger.logApiRequest(
        requestId,
        method,
        endpoint,
        { param1: 'value1', customerPhone: '+1234567890' },
        'Mozilla/5.0 Chrome/91.0',
        '192.168.1.100'
      );

      // 2. Simulate processing
      await new Promise(resolve => setTimeout(resolve, responseTime));

      // 3. Determine response status
      const status = simulateError ? 500 : 200;
      const actualResponseTime = Date.now() - startTime;
      const cacheHit = Math.random() > 0.3; // 70% cache hit rate

      // 4. Record performance metrics
      performanceMetrics.recordApiCall(
        endpoint,
        actualResponseTime,
        status,
        cacheHit,
        simulateError ? 'DATABASE_ERROR' : undefined
      );

      // 5. Log API response
      structuredLogger.logApiResponse(
        requestId,
        status,
        actualResponseTime,
        1024,
        cacheHit,
        simulateError ? 0 : 2,
        simulateError ? 'Database connection failed' : undefined
      );

      // 6. Log performance metrics
      structuredLogger.logPerformanceMetrics(requestId, {
        responseTime: actualResponseTime,
        queryTime: simulateError ? 0 : 50,
        cacheHit,
        memoryUsage: process.memoryUsage().used
      });

      if (simulateError) {
        structuredLogger.error('API request failed', {
          requestId,
          endpoint,
          errorMessage: 'Database connection failed',
          responseStatus: status
        });
      }

    } catch (error) {
      structuredLogger.error('Unexpected error during API request', {
        requestId,
        endpoint,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate sample traffic to demonstrate monitoring capabilities
   */
  async generateSampleTraffic(): Promise<void> {
    const endpoints = [
      '/api/get-order-data',
      '/api/risk-profile',
      '/api/customer-lookup'
    ];

    structuredLogger.info('Starting sample traffic generation');

    // Generate normal traffic
    for (let i = 0; i < 50; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const shouldError = Math.random() < 0.05; // 5% error rate
      const responseTime = 100 + Math.random() * 300; // 100-400ms

      await this.simulateApiRequest(endpoint, 'GET', shouldError, responseTime);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Generate some problematic traffic
    for (let i = 0; i < 10; i++) {
      await this.simulateApiRequest('/api/get-order-data', 'GET', true, 2000);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    structuredLogger.info('Sample traffic generation completed');
  }

  /**
   * Demonstrate log analysis and pattern detection
   */
  analyzeSystemBehavior(): void {
    structuredLogger.info('Analyzing system behavior patterns');

    // Trigger log pattern analysis
    logAnalyzer.analyzeLogPatterns();

    // Get system insights
    const insights = logAnalyzer.getSystemInsights();
    
    structuredLogger.info('System analysis completed', {
      healthScore: insights.healthScore,
      errorPatterns: insights.topErrorPatterns.length,
      anomalies: insights.recentAnomalies.length,
      recommendations: insights.recommendations.length
    });

    // Log key findings
    if (insights.topErrorPatterns.length > 0) {
      structuredLogger.warn('Critical error patterns detected', {
        patterns: insights.topErrorPatterns.map(p => ({
          pattern: p.pattern,
          count: p.count,
          severity: p.severity
        }))
      });
    }

    if (insights.recommendations.length > 0) {
      structuredLogger.info('System recommendations', {
        recommendations: insights.recommendations
      });
    }
  }

  /**
   * Generate monitoring dashboard data
   */
  generateDashboardReport(): any {
    const dashboardData = monitoringDashboard.getDashboardData();
    
    structuredLogger.info('Dashboard report generated', {
      timestamp: dashboardData.timestamp,
      systemStatus: dashboardData.systemHealth.status,
      healthScore: dashboardData.systemHealth.healthScore,
      totalRequests: dashboardData.systemHealth.totalRequests,
      errorRate: (dashboardData.systemHealth.errorRate * 100).toFixed(2) + '%',
      cacheHitRate: (dashboardData.systemHealth.cacheHitRate * 100).toFixed(2) + '%',
      apiEndpoints: dashboardData.apiMetrics.length,
      activeAlerts: dashboardData.alerts.filter(a => !a.acknowledged).length
    });

    return {
      systemHealth: dashboardData.systemHealth,
      metrics: dashboardData.apiMetrics,
      charts: {
        responseTime: monitoringDashboard.getResponseTimeChart(),
        errorRate: monitoringDashboard.getErrorRateChart(),
        cacheHitRate: monitoringDashboard.getCacheHitRateChart()
      },
      healthSummary: monitoringDashboard.getHealthSummary()
    };
  }

  /**
   * Demonstrate the complete logging and monitoring system
   */
  async demonstrateSystem(): Promise<void> {
    structuredLogger.info('=== Logging and Monitoring System Demonstration ===');

    // 1. Generate sample API traffic
    structuredLogger.info('Phase 1: Generating sample API traffic');
    await this.generateSampleTraffic();

    // 2. Analyze system behavior
    structuredLogger.info('Phase 2: Analyzing system behavior');
    this.analyzeSystemBehavior();

    // 3. Generate dashboard report
    structuredLogger.info('Phase 3: Generating monitoring dashboard');
    const report = this.generateDashboardReport();

    // 4. Show system capabilities
    structuredLogger.info('Phase 4: System capabilities summary');
    
    const systemHealth = performanceMetrics.getSystemHealth();
    const logPatterns = logAnalyzer.getLogPatterns();
    const apiUsagePatterns = logAnalyzer.getApiUsagePatterns();

    structuredLogger.info('System capabilities demonstrated', {
      features: {
        structuredLogging: 'Request/response logging with sanitization',
        performanceMetrics: 'Real-time API performance tracking',
        logAnalysis: 'Pattern detection and anomaly identification',
        monitoring: 'Dashboard with charts and alerts',
        healthChecking: 'System health scoring and recommendations'
      },
      currentStats: {
        uptime: Math.round(systemHealth.uptime / 1000) + 's',
        totalRequests: systemHealth.totalRequests,
        averageResponseTime: Math.round(systemHealth.averageResponseTime) + 'ms',
        errorRate: (systemHealth.errorRate * 100).toFixed(1) + '%',
        cacheHitRate: (systemHealth.cacheHitRate * 100).toFixed(1) + '%',
        logPatterns: logPatterns.length,
        apiEndpoints: apiUsagePatterns.length
      }
    });

    structuredLogger.info('=== Demonstration Complete ===');
  }

  /**
   * Reset all monitoring systems
   */
  reset(): void {
    structuredLogger.clearLogBuffer();
    performanceMetrics.reset();
    logAnalyzer.reset();
    monitoringDashboard.reset();
    
    structuredLogger.info('All monitoring systems reset');
  }
}

// Export singleton instance
export const loggingDemo = new LoggingSystemDemo();
export default loggingDemo;