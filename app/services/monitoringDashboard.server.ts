import { performanceMetrics, ApiMetrics, PerformanceSnapshot } from './performanceMetrics.server';
import { logAnalyzer, LogPattern, AnomalyDetection } from './logAnalyzer.server';
import { structuredLogger } from './structuredLogger.server';

export interface DashboardData {
  timestamp: number;
  systemHealth: SystemHealthData;
  apiMetrics: ApiMetrics[];
  performanceSnapshots: PerformanceSnapshot[];
  errorPatterns: LogPattern[];
  anomalies: AnomalyDetection[];
  alerts: AlertData[];
}

export interface SystemHealthData {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AlertData {
  id: string;
  type: 'performance' | 'error' | 'security' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricChart {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'gauge';
  data: ChartDataPoint[];
  unit: string;
  threshold?: {
    warning: number;
    critical: number;
  };
}

class MonitoringDashboard {
  private alerts: Map<string, AlertData> = new Map();
  private alertIdCounter = 0;
  private readonly MAX_ALERTS = 100;

  constructor() {
    // Check for alerts periodically
    setInterval(() => {
      this.checkAlerts();
    }, 30000); // Every 30 seconds
  }

  getDashboardData(): DashboardData {
    const systemHealth = this.getSystemHealthData();
    const apiMetrics = performanceMetrics.getMetrics();
    const performanceSnapshots = performanceMetrics.getPerformanceSnapshots(50);
    const errorPatterns = logAnalyzer.getLogPatterns().slice(0, 10);
    const anomalies = logAnalyzer.getAnomalies(10);
    const alerts = Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    return {
      timestamp: Date.now(),
      systemHealth,
      apiMetrics,
      performanceSnapshots,
      errorPatterns,
      anomalies,
      alerts
    };
  }

  private getSystemHealthData(): SystemHealthData {
    const health = performanceMetrics.getSystemHealth();
    const insights = logAnalyzer.getSystemInsights();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (insights.healthScore < 50 || health.errorRate > 0.1) {
      status = 'critical';
    } else if (insights.healthScore < 80 || health.errorRate > 0.05 || health.averageResponseTime > 1000) {
      status = 'warning';
    }

    return {
      ...health,
      healthScore: insights.healthScore,
      status
    };
  }

  getResponseTimeChart(timeRange = 3600000): MetricChart {
    const snapshots = performanceMetrics.getPerformanceSnapshots(100);
    const now = Date.now();
    const filteredSnapshots = snapshots.filter(s => s.timestamp >= now - timeRange);

    const data: ChartDataPoint[] = filteredSnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: snapshot.averageResponseTime
    }));

    return {
      title: 'Average Response Time',
      type: 'line',
      data,
      unit: 'ms',
      threshold: {
        warning: 500,
        critical: 1000
      }
    };
  }

  getErrorRateChart(timeRange = 3600000): MetricChart {
    const snapshots = performanceMetrics.getPerformanceSnapshots(100);
    const now = Date.now();
    const filteredSnapshots = snapshots.filter(s => s.timestamp >= now - timeRange);

    const data: ChartDataPoint[] = filteredSnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: snapshot.errorRate * 100 // Convert to percentage
    }));

    return {
      title: 'Error Rate',
      type: 'line',
      data,
      unit: '%',
      threshold: {
        warning: 5,
        critical: 10
      }
    };
  }

  getRequestVolumeChart(timeRange = 3600000): MetricChart {
    const snapshots = performanceMetrics.getPerformanceSnapshots(100);
    const now = Date.now();
    const filteredSnapshots = snapshots.filter(s => s.timestamp >= now - timeRange);

    const data: ChartDataPoint[] = filteredSnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: snapshot.requestsPerSecond
    }));

    return {
      title: 'Requests per Second',
      type: 'line',
      data,
      unit: 'req/s'
    };
  }

  getCacheHitRateChart(): MetricChart {
    const metrics = performanceMetrics.getMetrics();
    
    const data: ChartDataPoint[] = metrics.map((metric, index) => ({
      timestamp: Date.now() - (metrics.length - index) * 60000,
      value: metric.cacheHitRate * 100,
      label: metric.endpoint
    }));

    return {
      title: 'Cache Hit Rate by Endpoint',
      type: 'bar',
      data,
      unit: '%',
      threshold: {
        warning: 70,
        critical: 50
      }
    };
  }

  getMemoryUsageChart(timeRange = 3600000): MetricChart {
    const snapshots = performanceMetrics.getPerformanceSnapshots(100);
    const now = Date.now();
    const filteredSnapshots = snapshots.filter(s => s.timestamp >= now - timeRange);

    const data: ChartDataPoint[] = filteredSnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: snapshot.memoryUsage.used / 1024 / 1024 // Convert to MB
    }));

    return {
      title: 'Memory Usage',
      type: 'line',
      data,
      unit: 'MB'
    };
  }

  getEndpointPerformanceChart(): MetricChart {
    const metrics = performanceMetrics.getMetrics();
    
    const data: ChartDataPoint[] = metrics.map(metric => ({
      timestamp: metric.lastUpdated,
      value: metric.averageResponseTime,
      label: metric.endpoint
    }));

    return {
      title: 'Average Response Time by Endpoint',
      type: 'bar',
      data,
      unit: 'ms',
      threshold: {
        warning: 500,
        critical: 1000
      }
    };
  }

  getErrorDistributionChart(): MetricChart {
    const patterns = logAnalyzer.getLogPatterns();
    
    const data: ChartDataPoint[] = patterns
      .slice(0, 10)
      .map((pattern, index) => ({
        timestamp: Date.now(),
        value: pattern.count,
        label: pattern.pattern.substring(0, 30) + (pattern.pattern.length > 30 ? '...' : '')
      }));

    return {
      title: 'Error Pattern Distribution',
      type: 'pie',
      data,
      unit: 'count'
    };
  }

  private checkAlerts(): void {
    const systemHealth = this.getSystemHealthData();
    const anomalies = logAnalyzer.getAnomalies(5);
    
    // Check system health alerts
    if (systemHealth.status === 'critical') {
      this.createAlert({
        type: 'system',
        severity: 'critical',
        title: 'System Health Critical',
        description: `System health score: ${systemHealth.healthScore}%, Error rate: ${(systemHealth.errorRate * 100).toFixed(1)}%`,
        metadata: {
          healthScore: systemHealth.healthScore,
          errorRate: systemHealth.errorRate,
          averageResponseTime: systemHealth.averageResponseTime
        }
      });
    } else if (systemHealth.status === 'warning') {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'Performance Warning',
        description: `System performance degraded. Health score: ${systemHealth.healthScore}%`,
        metadata: {
          healthScore: systemHealth.healthScore,
          averageResponseTime: systemHealth.averageResponseTime
        }
      });
    }

    // Check for high error rates
    if (systemHealth.errorRate > 0.1) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'High Error Rate',
        description: `Error rate is ${(systemHealth.errorRate * 100).toFixed(1)}%`,
        metadata: {
          errorRate: systemHealth.errorRate,
          totalRequests: systemHealth.totalRequests
        }
      });
    }

    // Check for slow response times
    if (systemHealth.averageResponseTime > 2000) {
      this.createAlert({
        type: 'performance',
        severity: 'high',
        title: 'Slow Response Times',
        description: `Average response time is ${systemHealth.averageResponseTime.toFixed(0)}ms`,
        metadata: {
          averageResponseTime: systemHealth.averageResponseTime
        }
      });
    }

    // Check for memory issues
    const memoryUsagePercent = (systemHealth.memoryUsage.used / systemHealth.memoryUsage.total) * 100;
    if (memoryUsagePercent > 90) {
      this.createAlert({
        type: 'system',
        severity: 'critical',
        title: 'High Memory Usage',
        description: `Memory usage is ${memoryUsagePercent.toFixed(1)}%`,
        metadata: {
          memoryUsage: systemHealth.memoryUsage,
          memoryUsagePercent
        }
      });
    }

    // Check for critical anomalies
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      criticalAnomalies.forEach(anomaly => {
        this.createAlert({
          type: 'system',
          severity: 'critical',
          title: `Critical Anomaly: ${anomaly.type}`,
          description: anomaly.description,
          metadata: {
            anomalyType: anomaly.type,
            affectedEndpoint: anomaly.affectedEndpoint,
            metrics: anomaly.metrics
          }
        });
      });
    }
  }

  private createAlert(alertData: Omit<AlertData, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alertId = `alert_${++this.alertIdCounter}_${Date.now()}`;
    
    // Check if similar alert already exists (avoid spam)
    const existingSimilar = Array.from(this.alerts.values()).find(alert => 
      alert.type === alertData.type &&
      alert.title === alertData.title &&
      !alert.acknowledged &&
      Date.now() - alert.timestamp < 300000 // Within 5 minutes
    );

    if (existingSimilar) {
      return; // Don't create duplicate alert
    }

    const alert: AlertData = {
      id: alertId,
      timestamp: Date.now(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.set(alertId, alert);

    // Maintain alerts limit
    if (this.alerts.size > this.MAX_ALERTS) {
      const oldestAlert = Array.from(this.alerts.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      this.alerts.delete(oldestAlert.id);
    }

    // Log the alert
    structuredLogger.warn('Alert created', {
      alertId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description
    });
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      structuredLogger.info('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      structuredLogger.info('Alert resolved', { alertId });
      return true;
    }
    return false;
  }

  getAlerts(filter?: {
    type?: AlertData['type'];
    severity?: AlertData['severity'];
    acknowledged?: boolean;
    resolved?: boolean;
  }): AlertData[] {
    let alerts = Array.from(this.alerts.values());

    if (filter) {
      if (filter.type) {
        alerts = alerts.filter(a => a.type === filter.type);
      }
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity);
      }
      if (filter.acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === filter.acknowledged);
      }
      if (filter.resolved !== undefined) {
        const resolved = filter.resolved;
        alerts = alerts.filter(a => resolved ? !!a.resolvedAt : !a.resolvedAt);
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const systemHealth = this.getSystemHealthData();
    const insights = logAnalyzer.getSystemInsights();
    const activeAlerts = this.getAlerts({ acknowledged: false, resolved: false });

    const issues: string[] = [];
    
    if (systemHealth.errorRate > 0.05) {
      issues.push(`High error rate: ${(systemHealth.errorRate * 100).toFixed(1)}%`);
    }
    
    if (systemHealth.averageResponseTime > 1000) {
      issues.push(`Slow response times: ${systemHealth.averageResponseTime.toFixed(0)}ms`);
    }
    
    if (activeAlerts.filter(a => a.severity === 'critical').length > 0) {
      issues.push(`${activeAlerts.filter(a => a.severity === 'critical').length} critical alerts`);
    }

    return {
      status: systemHealth.status,
      score: systemHealth.healthScore,
      issues,
      recommendations: insights.recommendations
    };
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = this.getDashboardData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    // CSV format for basic metrics
    const csvLines = [
      'timestamp,endpoint,totalRequests,successfulRequests,failedRequests,averageResponseTime,errorRate,cacheHitRate'
    ];
    
    data.apiMetrics.forEach(metric => {
      csvLines.push([
        new Date(metric.lastUpdated).toISOString(),
        metric.endpoint,
        metric.totalRequests,
        metric.successfulRequests,
        metric.failedRequests,
        metric.averageResponseTime.toFixed(2),
        (metric.errorRate * 100).toFixed(2),
        (metric.cacheHitRate * 100).toFixed(2)
      ].join(','));
    });
    
    return csvLines.join('\n');
  }

  reset(): void {
    this.alerts.clear();
    this.alertIdCounter = 0;
    structuredLogger.info('Monitoring dashboard reset');
  }
}

// Singleton instance
export const monitoringDashboard = new MonitoringDashboard();
export default monitoringDashboard;