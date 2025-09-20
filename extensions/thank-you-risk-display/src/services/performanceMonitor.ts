/**
 * Performance Monitor for ReturnsX Extension
 * 
 * Tracks rendering performance, API response times, and user interactions
 * to help identify performance bottlenecks and optimize user experience.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ComponentRenderMetric {
  componentName: string;
  renderTime: number;
  propsSize: number;
  timestamp: number;
}

interface ApiMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  success: boolean;
  cacheHit: boolean;
  timestamp: number;
}

interface PerformanceStats {
  averageRenderTime: number;
  averageApiResponseTime: number;
  totalApiCalls: number;
  cacheHitRate: number;
  slowestComponent: string;
  slowestApi: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private renderMetrics: ComponentRenderMetric[] = [];
  private apiMetrics: ApiMetric[] = [];
  private maxMetrics = 100;
  private enabled = false;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Record a generic performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);
    this.trimMetrics();
  }

  /**
   * Record component render time
   */
  recordRender(componentName: string, renderTime: number, propsSize = 0): void {
    if (!this.enabled) return;

    const metric: ComponentRenderMetric = {
      componentName,
      renderTime,
      propsSize,
      timestamp: Date.now(),
    };

    this.renderMetrics.push(metric);
    this.trimRenderMetrics();
  }

  /**
   * Record API call performance
   */
  recordApiCall(
    endpoint: string,
    method: string,
    responseTime: number,
    success: boolean,
    cacheHit = false
  ): void {
    if (!this.enabled) return;

    const metric: ApiMetric = {
      endpoint,
      method,
      responseTime,
      success,
      cacheHit,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(metric);
    this.trimApiMetrics();
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();
    
    return (metadata?: Record<string, any>) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric(name, duration, metadata);
    };
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const startTime = performance.now();
    try {
      const result = await operation();
      const endTime = performance.now();
      this.recordMetric(name, endTime - startTime, { success: true });
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordMetric(name, endTime - startTime, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const renderTimes = this.renderMetrics.map(m => m.renderTime);
    const apiTimes = this.apiMetrics.map(m => m.responseTime);
    const cacheHits = this.apiMetrics.filter(m => m.cacheHit).length;

    const averageRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
      : 0;

    const averageApiResponseTime = apiTimes.length > 0
      ? apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length
      : 0;

    const cacheHitRate = this.apiMetrics.length > 0
      ? cacheHits / this.apiMetrics.length
      : 0;

    // Find slowest component
    const slowestRender = this.renderMetrics.reduce((prev, current) => 
      prev.renderTime > current.renderTime ? prev : current, 
      { componentName: 'none', renderTime: 0 }
    );

    // Find slowest API
    const slowestApi = this.apiMetrics.reduce((prev, current) => 
      prev.responseTime > current.responseTime ? prev : current,
      { endpoint: 'none', responseTime: 0 }
    );

    return {
      averageRenderTime,
      averageApiResponseTime,
      totalApiCalls: this.apiMetrics.length,
      cacheHitRate,
      slowestComponent: slowestRender.componentName,
      slowestApi: slowestApi.endpoint,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get render metrics for specific component
   */
  getComponentMetrics(componentName: string): ComponentRenderMetric[] {
    return this.renderMetrics.filter(m => m.componentName === componentName);
  }

  /**
   * Get API metrics for specific endpoint
   */
  getApiMetrics(endpoint: string): ApiMetric[] {
    return this.apiMetrics.filter(m => m.endpoint === endpoint);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.renderMetrics = [];
    this.apiMetrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    general: PerformanceMetric[];
    renders: ComponentRenderMetric[];
    api: ApiMetric[];
    stats: PerformanceStats;
  } {
    return {
      general: [...this.metrics],
      renders: [...this.renderMetrics],
      api: [...this.apiMetrics],
      stats: this.getStats(),
    };
  }

  /**
   * Trim metrics to prevent memory leaks
   */
  private trimMetrics(): void {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private trimRenderMetrics(): void {
    if (this.renderMetrics.length > this.maxMetrics) {
      this.renderMetrics = this.renderMetrics.slice(-this.maxMetrics);
    }
  }

  private trimApiMetrics(): void {
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }
  }
}

/**
 * React hook for component performance monitoring
 */
export function usePerformanceMonitor(componentName: string, enabled = false) {
  const monitor = new PerformanceMonitor(enabled);

  const recordRender = (renderTime: number, propsSize = 0) => {
    monitor.recordRender(componentName, renderTime, propsSize);
  };

  const startTiming = (operationName: string) => {
    return monitor.startTiming(`${componentName}.${operationName}`);
  };

  const timeAsync = <T>(operationName: string, operation: () => Promise<T>) => {
    return monitor.timeAsync(`${componentName}.${operationName}`, operation);
  };

  return {
    recordRender,
    startTiming,
    timeAsync,
    getStats: () => monitor.getStats(),
    getMetrics: () => monitor.getComponentMetrics(componentName),
  };
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor(false);

/**
 * HOC for automatic component performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = (props: P) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      const propsSize = JSON.stringify(props).length;
      
      globalPerformanceMonitor.recordRender(displayName, renderTime, propsSize);
    });

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return WrappedComponent;
}