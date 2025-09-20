import React, { useEffect, useRef, useCallback } from 'react';
import { 
  AnalyticsService, 
  AnalyticsEventType, 
  AnalyticsConfig,
  createAnalyticsService,
  getAnalyticsService,
  defaultAnalyticsConfig,
  PerformanceMetrics,
  ErrorTrackingData
} from '../services/analyticsService';
import { ExtensionConfig, ErrorType } from '../types';

interface UseAnalyticsOptions {
  config: ExtensionConfig;
  enabled?: boolean;
}

interface AnalyticsHook {
  trackEvent: (type: AnalyticsEventType, data?: Record<string, any>) => void;
  trackError: (error: ErrorTrackingData) => void;
  trackPerformance: (metrics: PerformanceMetrics) => void;
  trackUserInteraction: (type: AnalyticsEventType, data?: Record<string, any>) => void;
  trackApiCall: (endpoint: string, method: string, startTime: number, success: boolean, error?: string) => void;
  startPerformanceTimer: () => () => number;
  isEnabled: boolean;
  sessionId: string | null;
}

export const useAnalytics = ({ config, enabled = true }: UseAnalyticsOptions): AnalyticsHook => {
  const analyticsServiceRef = useRef<AnalyticsService | null>(null);
  const performanceTimersRef = useRef<Map<string, number>>(new Map());

  // Initialize analytics service
  useEffect(() => {
    if (!enabled || !config.analytics_enabled) {
      return;
    }

    const analyticsConfig: AnalyticsConfig = {
      ...defaultAnalyticsConfig,
      enabled: config.analytics_enabled,
      endpoint: config.analytics_endpoint,
      enablePerformanceTracking: config.performance_tracking_enabled,
      enableErrorTracking: config.error_reporting_enabled,
      enableUserInteractionTracking: config.user_interaction_tracking_enabled,
      enableDebugLogging: config.analytics_debug_mode
    };

    analyticsServiceRef.current = createAnalyticsService(analyticsConfig);

    // Cleanup on unmount
    return () => {
      if (analyticsServiceRef.current) {
        analyticsServiceRef.current.destroy();
        analyticsServiceRef.current = null;
      }
    };
  }, [
    config.analytics_enabled,
    config.analytics_endpoint,
    config.performance_tracking_enabled,
    config.error_reporting_enabled,
    config.user_interaction_tracking_enabled,
    config.analytics_debug_mode,
    enabled
  ]);

  // Track event function
  const trackEvent = useCallback((type: AnalyticsEventType, data: Record<string, any> = {}) => {
    const service = analyticsServiceRef.current || getAnalyticsService();
    if (service) {
      service.trackEvent(type, data);
    }
  }, []);

  // Track error function
  const trackError = useCallback((error: ErrorTrackingData) => {
    const service = analyticsServiceRef.current || getAnalyticsService();
    if (service) {
      service.trackError(error);
    }
  }, []);

  // Track performance function
  const trackPerformance = useCallback((metrics: PerformanceMetrics) => {
    const service = analyticsServiceRef.current || getAnalyticsService();
    if (service) {
      service.trackPerformance(metrics);
    }
  }, []);

  // Track user interaction function
  const trackUserInteraction = useCallback((type: AnalyticsEventType, data: Record<string, any> = {}) => {
    const service = analyticsServiceRef.current || getAnalyticsService();
    if (service) {
      service.trackUserInteraction(type, data);
    }
  }, []);

  // Track API call function
  const trackApiCall = useCallback((
    endpoint: string, 
    method: string, 
    startTime: number, 
    success: boolean, 
    error?: string
  ) => {
    const service = analyticsServiceRef.current || getAnalyticsService();
    if (service) {
      service.trackApiCall(endpoint, method, startTime, success, error);
    }
  }, []);

  // Performance timer utility
  const startPerformanceTimer = useCallback(() => {
    const startTime = performance.now();
    const timerId = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    performanceTimersRef.current.set(timerId, startTime);

    return () => {
      const endTime = performance.now();
      const start = performanceTimersRef.current.get(timerId);
      performanceTimersRef.current.delete(timerId);
      
      if (start !== undefined) {
        return endTime - start;
      }
      return 0;
    };
  }, []);

  // Get current state
  const service = analyticsServiceRef.current || getAnalyticsService();
  const isEnabled = Boolean(service && config.analytics_enabled && enabled);
  const sessionId = service?.getSessionId() || null;

  return {
    trackEvent,
    trackError,
    trackPerformance,
    trackUserInteraction,
    trackApiCall,
    startPerformanceTimer,
    isEnabled,
    sessionId
  };
};

// Higher-order component for automatic error tracking
// Commented out due to TypeScript JSX configuration issues
// export const withAnalyticsErrorTracking = <P extends object>(
//   Component: React.ComponentType<P>,
//   componentName: string
// ) => {
//   return React.forwardRef<any, P>((props, ref) => {
//     const config = (props as any).config || { analytics_enabled: false };
//     const { trackError } = useAnalytics({ config });

//     useEffect(() => {
//       const handleError = (error: Error, errorInfo: any) => {
//         trackError({
//           errorType: 'JAVASCRIPT_ERROR',
//           message: error.message,
//           stack: error.stack,
//           component: componentName,
//           userAgent: navigator.userAgent,
//           url: window.location.href
//         });
//       };

//       // This would typically be used with an error boundary
//       // For now, we'll just set up the error handler
//       return () => {
//         // Cleanup if needed
//       };
//     }, [trackError]);

//     return <Component {...props} ref={ref} />;
//   });
// };

// Custom hook for component-level performance tracking
export const useComponentPerformance = (componentName: string, config: ExtensionConfig) => {
  const { trackPerformance, startPerformanceTimer, isEnabled } = useAnalytics({ config });
  const renderStartRef = useRef<number>(0);

  useEffect(() => {
    if (!isEnabled) return;

    renderStartRef.current = performance.now();
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled || renderStartRef.current === 0) return;

    const renderTime = performance.now() - renderStartRef.current;
    
    trackPerformance({
      renderTime,
      apiResponseTime: 0, // Will be set by API calls
      totalLoadTime: renderTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize
    });

    // Reset for next render
    renderStartRef.current = 0;
  });

  const trackCustomMetric = useCallback((metricName: string, value: number, unit?: string) => {
    if (!isEnabled) return;

    trackPerformance({
      renderTime: 0,
      apiResponseTime: 0,
      totalLoadTime: 0,
      [metricName]: value
    });
  }, [trackPerformance, isEnabled]);

  return {
    trackCustomMetric,
    startTimer: startPerformanceTimer,
    isEnabled
  };
};