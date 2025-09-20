import { ErrorType } from '../types';

// Analytics event types
export enum AnalyticsEventType {
  // Extension lifecycle events
  EXTENSION_LOADED = 'extension_loaded',
  EXTENSION_ERROR = 'extension_error',
  EXTENSION_RENDERED = 'extension_rendered',
  
  // API interaction events
  API_CALL_STARTED = 'api_call_started',
  API_CALL_SUCCESS = 'api_call_success',
  API_CALL_ERROR = 'api_call_error',
  API_CALL_TIMEOUT = 'api_call_timeout',
  
  // User interaction events
  WHATSAPP_CLICKED = 'whatsapp_clicked',
  RECOMMENDATIONS_VIEWED = 'recommendations_viewed',
  RISK_CARD_VIEWED = 'risk_card_viewed',
  
  // Performance events
  RENDER_PERFORMANCE = 'render_performance',
  API_PERFORMANCE = 'api_performance',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  
  // Error events
  JAVASCRIPT_ERROR = 'javascript_error',
  NETWORK_ERROR = 'network_error',
  CONFIGURATION_ERROR = 'configuration_error'
}

// Analytics event data structure
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    connectionType?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
}

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushInterval: number;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserInteractionTracking: boolean;
  enableDebugLogging: boolean;
  maxRetries: number;
  retryDelay: number;
}

// Performance metrics
export interface PerformanceMetrics {
  renderTime: number;
  apiResponseTime: number;
  totalLoadTime: number;
  memoryUsage?: number;
  cacheHitRate?: number;
}

// Error tracking data
export interface ErrorTrackingData {
  errorType: ErrorType | 'JAVASCRIPT_ERROR';
  message: string;
  stack?: string;
  component?: string;
  userAgent?: string;
  url?: string;
}

class AnalyticsService {
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    
    if (this.config.enabled) {
      this.initializeAnalytics();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAnalytics(): void {
    // Set up automatic flushing
    this.setupAutoFlush();
    
    // Set up performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring();
    }
    
    // Set up error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }
    
    // Track initial load
    this.trackEvent(AnalyticsEventType.EXTENSION_LOADED, {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }

  private setupAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            this.trackEvent(AnalyticsEventType.RENDER_PERFORMANCE, {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
              entryType: entry.entryType
            });
          }
        });
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        errorType: 'JAVASCRIPT_ERROR',
        message: event.message,
        stack: event.error?.stack,
        component: 'global',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        errorType: 'JAVASCRIPT_ERROR',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        component: 'promise',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    });
  }

  public trackEvent(type: AnalyticsEventType, data: Record<string, any> = {}): void {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data,
      metadata: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        connectionType: (navigator as any).connection?.effectiveType || 'unknown',
        deviceType: this.getDeviceType()
      }
    };

    this.eventQueue.push(event);

    if (this.config.enableDebugLogging) {
      console.log('[Analytics]', type, data);
    }

    // Flush immediately for critical events
    if (this.isCriticalEvent(type) || this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  public trackError(errorData: ErrorTrackingData): void {
    if (!this.config.enabled || !this.config.enableErrorTracking) return;

    this.trackEvent(AnalyticsEventType.EXTENSION_ERROR, {
      errorType: errorData.errorType,
      message: errorData.message,
      stack: errorData.stack,
      component: errorData.component,
      userAgent: errorData.userAgent,
      url: errorData.url
    });
  }

  public trackPerformance(metrics: PerformanceMetrics): void {
    if (!this.config.enabled || !this.config.enablePerformanceTracking) return;

    this.trackEvent(AnalyticsEventType.RENDER_PERFORMANCE, {
      renderTime: metrics.renderTime,
      apiResponseTime: metrics.apiResponseTime,
      totalLoadTime: metrics.totalLoadTime,
      memoryUsage: metrics.memoryUsage,
      cacheHitRate: metrics.cacheHitRate
    });
  }

  public trackUserInteraction(interactionType: AnalyticsEventType, data: Record<string, any> = {}): void {
    if (!this.config.enabled || !this.config.enableUserInteractionTracking) return;

    this.trackEvent(interactionType, {
      ...data,
      interactionTime: Date.now()
    });
  }

  public trackApiCall(endpoint: string, method: string, startTime: number, success: boolean, error?: string): void {
    if (!this.config.enabled) return;

    const duration = Date.now() - startTime;
    const eventType = success ? AnalyticsEventType.API_CALL_SUCCESS : AnalyticsEventType.API_CALL_ERROR;

    this.trackEvent(eventType, {
      endpoint,
      method,
      duration,
      success,
      error
    });

    // Track performance metrics
    this.trackEvent(AnalyticsEventType.API_PERFORMANCE, {
      endpoint,
      responseTime: duration,
      success
    });
  }

  private isCriticalEvent(type: AnalyticsEventType): boolean {
    return [
      AnalyticsEventType.EXTENSION_ERROR,
      AnalyticsEventType.JAVASCRIPT_ERROR,
      AnalyticsEventType.API_CALL_ERROR,
      AnalyticsEventType.NETWORK_ERROR
    ].includes(type);
  }

  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.config.endpoint) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(events);
    } catch (error) {
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
      
      if (this.config.enableDebugLogging) {
        console.error('[Analytics] Failed to send events:', error);
      }
    }
  }

  private async sendEvents(events: AnalyticsEvent[], retryCount = 0): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          sessionId: this.sessionId,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }

      if (this.config.enableDebugLogging) {
        console.log(`[Analytics] Successfully sent ${events.length} events`);
      }
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        // Exponential backoff retry
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        setTimeout(() => {
          this.sendEvents(events, retryCount + 1);
        }, delay);
      } else {
        throw error;
      }
    }
  }

  public updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    } else if (this.config.enabled && !this.flushTimer) {
      this.setupAutoFlush();
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getQueuedEventCount(): number {
    return this.eventQueue.length;
  }

  public async forceFlush(): Promise<void> {
    await this.flush();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // Final flush before destroying
    this.flush();
  }
}

// Default analytics configuration
export const defaultAnalyticsConfig: AnalyticsConfig = {
  enabled: false,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  enableUserInteractionTracking: true,
  enableDebugLogging: false,
  maxRetries: 3,
  retryDelay: 1000
};

// Singleton instance
let analyticsInstance: AnalyticsService | null = null;

export const createAnalyticsService = (config: AnalyticsConfig): AnalyticsService => {
  if (analyticsInstance) {
    analyticsInstance.destroy();
  }
  analyticsInstance = new AnalyticsService(config);
  return analyticsInstance;
};

export const getAnalyticsService = (): AnalyticsService | null => {
  return analyticsInstance;
};

export { AnalyticsService };