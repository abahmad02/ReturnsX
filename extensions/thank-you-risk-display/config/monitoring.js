/**
 * Production Monitoring Configuration
 * Sets up error monitoring, performance tracking, and alerting
 */

const config = require('./production.json');

class MonitoringService {
  constructor() {
    this.config = config.monitoring;
    this.errorBuffer = [];
    this.performanceBuffer = [];
    this.analyticsBuffer = [];
    this.isInitialized = false;
  }

  /**
   * Initialize monitoring service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Setup error monitoring
      if (this.config.errorReporting.enabled) {
        this.setupErrorReporting();
      }

      // Setup performance monitoring
      if (this.config.performance.enabled) {
        this.setupPerformanceMonitoring();
      }

      // Setup analytics
      if (this.config.analytics.enabled) {
        this.setupAnalytics();
      }

      // Setup periodic flushing
      this.setupPeriodicFlush();

      this.isInitialized = true;
      console.log('Monitoring service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error);
    }
  }

  /**
   * Setup error reporting
   */
  setupErrorReporting() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.reportError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    console.log('Error reporting initialized');
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor API response times
    this.originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0];
      
      try {
        const response = await this.originalFetch(...args);
        const endTime = performance.now();
        
        this.reportPerformance({
          type: 'api_request',
          url: url,
          method: args[1]?.method || 'GET',
          status: response.status,
          duration: endTime - startTime,
          timestamp: new Date().toISOString()
        });
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        
        this.reportPerformance({
          type: 'api_request_failed',
          url: url,
          method: args[1]?.method || 'GET',
          duration: endTime - startTime,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };

    // Monitor component render times
    if (window.React && window.React.Profiler) {
      this.setupReactProfiler();
    }

    console.log('Performance monitoring initialized');
  }

  /**
   * Setup React Profiler for component performance
   */
  setupReactProfiler() {
    const originalProfiler = window.React.Profiler;
    
    window.React.Profiler = (props) => {
      const onRender = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        if (Math.random() <= this.config.performance.sampleRate) {
          this.reportPerformance({
            type: 'react_render',
            componentId: id,
            phase: phase,
            actualDuration: actualDuration,
            baseDuration: baseDuration,
            startTime: startTime,
            commitTime: commitTime,
            timestamp: new Date().toISOString()
          });
        }
        
        // Call original onRender if provided
        if (props.onRender) {
          props.onRender(id, phase, actualDuration, baseDuration, startTime, commitTime);
        }
      };

      return originalProfiler({
        ...props,
        onRender
      });
    };
  }

  /**
   * Setup analytics tracking
   */
  setupAnalytics() {
    // Track user interactions
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target.dataset.analytics) {
        this.reportAnalytics({
          type: 'user_interaction',
          action: 'click',
          element: target.tagName.toLowerCase(),
          elementId: target.id,
          elementClass: target.className,
          analyticsId: target.dataset.analytics,
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      }
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.reportAnalytics({
        type: 'page_visibility',
        visible: !document.hidden,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    });

    console.log('Analytics tracking initialized');
  }

  /**
   * Setup periodic buffer flushing
   */
  setupPeriodicFlush() {
    setInterval(() => {
      this.flushBuffers();
    }, this.config.analytics.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushBuffers(true);
    });
  }

  /**
   * Report an error
   */
  reportError(errorData) {
    if (!this.config.errorReporting.enabled) return;

    // Sample errors based on sample rate
    if (Math.random() > this.config.errorReporting.sampleRate) return;

    // Add to buffer
    this.errorBuffer.push({
      ...errorData,
      service: 'thank-you-extension',
      environment: 'production',
      version: process.env.npm_package_version || '1.0.0'
    });

    // Flush immediately for critical errors
    if (this.isCriticalError(errorData)) {
      this.flushErrorBuffer();
    }
  }

  /**
   * Report performance data
   */
  reportPerformance(performanceData) {
    if (!this.config.performance.enabled) return;

    // Sample performance data
    if (Math.random() > this.config.performance.sampleRate) return;

    this.performanceBuffer.push({
      ...performanceData,
      service: 'thank-you-extension',
      environment: 'production',
      version: process.env.npm_package_version || '1.0.0'
    });
  }

  /**
   * Report analytics data
   */
  reportAnalytics(analyticsData) {
    if (!this.config.analytics.enabled) return;

    this.analyticsBuffer.push({
      ...analyticsData,
      service: 'thank-you-extension',
      environment: 'production',
      version: process.env.npm_package_version || '1.0.0',
      sessionId: this.getSessionId()
    });
  }

  /**
   * Check if error is critical
   */
  isCriticalError(errorData) {
    const criticalPatterns = [
      /authentication/i,
      /authorization/i,
      /network/i,
      /timeout/i,
      /cors/i
    ];

    return criticalPatterns.some(pattern => 
      pattern.test(errorData.message) || pattern.test(errorData.type)
    );
  }

  /**
   * Get or create session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('returnsx_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('returnsx_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Flush all buffers
   */
  async flushBuffers(synchronous = false) {
    const promises = [];

    if (this.errorBuffer.length > 0) {
      promises.push(this.flushErrorBuffer());
    }

    if (this.performanceBuffer.length > 0) {
      promises.push(this.flushPerformanceBuffer());
    }

    if (this.analyticsBuffer.length > 0) {
      promises.push(this.flushAnalyticsBuffer());
    }

    if (synchronous) {
      // Use sendBeacon for synchronous sending on page unload
      this.sendBeaconData();
    } else {
      await Promise.all(promises);
    }
  }

  /**
   * Flush error buffer
   */
  async flushErrorBuffer() {
    if (this.errorBuffer.length === 0) return;

    const errors = this.errorBuffer.splice(0);
    
    try {
      await fetch(this.config.errorReporting.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RETURNSX_API_TOKEN}`
        },
        body: JSON.stringify({ errors })
      });
    } catch (error) {
      console.error('Failed to send error reports:', error);
      // Put errors back in buffer for retry
      this.errorBuffer.unshift(...errors);
    }
  }

  /**
   * Flush performance buffer
   */
  async flushPerformanceBuffer() {
    if (this.performanceBuffer.length === 0) return;

    const metrics = this.performanceBuffer.splice(0);
    
    try {
      await fetch(this.config.performance.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RETURNSX_API_TOKEN}`
        },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
    }
  }

  /**
   * Flush analytics buffer
   */
  async flushAnalyticsBuffer() {
    if (this.analyticsBuffer.length === 0) return;

    const events = this.analyticsBuffer.splice(0, this.config.analytics.batchSize);
    
    try {
      await fetch(this.config.analytics.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RETURNSX_API_TOKEN}`
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      console.error('Failed to send analytics events:', error);
    }
  }

  /**
   * Send data using sendBeacon for page unload
   */
  sendBeaconData() {
    if (navigator.sendBeacon) {
      // Send critical data using sendBeacon
      if (this.errorBuffer.length > 0) {
        const data = JSON.stringify({ errors: this.errorBuffer });
        navigator.sendBeacon(this.config.errorReporting.endpoint, data);
      }
    }
  }

  /**
   * Create custom error report
   */
  createErrorReport(error, context = {}) {
    this.reportError({
      type: 'custom_error',
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Create custom performance report
   */
  createPerformanceReport(name, duration, metadata = {}) {
    this.reportPerformance({
      type: 'custom_performance',
      name: name,
      duration: duration,
      metadata: metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create custom analytics event
   */
  createAnalyticsEvent(eventName, properties = {}) {
    this.reportAnalytics({
      type: 'custom_event',
      eventName: eventName,
      properties: properties,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }
}

// Create global monitoring instance
const monitoring = new MonitoringService();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => monitoring.initialize());
} else {
  monitoring.initialize();
}

// Export for use in extension
window.ReturnsXMonitoring = monitoring;

module.exports = MonitoringService;