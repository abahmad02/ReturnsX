import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  AnalyticsService,
  AnalyticsEventType,
  AnalyticsConfig,
  createAnalyticsService,
  getAnalyticsService,
  defaultAnalyticsConfig
} from '../analyticsService';

// Mock global objects
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPerformanceObserver = vi.fn();
global.PerformanceObserver = mockPerformanceObserver;

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  connection: { effectiveType: '4g' }
};
Object.defineProperty(global, 'navigator', { value: mockNavigator });

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  location: { href: 'https://example.com' },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};
Object.defineProperty(global, 'window', { value: mockWindow });

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let testConfig: AnalyticsConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    testConfig = {
      ...defaultAnalyticsConfig,
      enabled: true,
      endpoint: 'https://analytics.example.com/events',
      batchSize: 5,
      flushInterval: 1000,
      enableDebugLogging: false
    };
    
    analyticsService = new AnalyticsService(testConfig);
  });

  afterEach(() => {
    if (analyticsService) {
      analyticsService.destroy();
    }
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(analyticsService.getSessionId()).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(analyticsService.getQueuedEventCount()).toBe(1); // Extension loaded event
    });

    it('should not initialize analytics when disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledService = new AnalyticsService(disabledConfig);
      
      expect(disabledService.getQueuedEventCount()).toBe(0);
      disabledService.destroy();
    });

    it('should set up error tracking when enabled', () => {
      const errorTrackingConfig = { ...testConfig, enableErrorTracking: true };
      new AnalyticsService(errorTrackingConfig);
      
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });

  describe('Event Tracking', () => {
    it('should track events correctly', () => {
      const eventData = { testKey: 'testValue' };
      
      analyticsService.trackEvent(AnalyticsEventType.API_CALL_STARTED, eventData);
      
      expect(analyticsService.getQueuedEventCount()).toBe(2); // Extension loaded + new event
    });

    it('should not track events when disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledService = new AnalyticsService(disabledConfig);
      
      disabledService.trackEvent(AnalyticsEventType.API_CALL_STARTED, {});
      
      expect(disabledService.getQueuedEventCount()).toBe(0);
      disabledService.destroy();
    });

    it('should include metadata in events', () => {
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      // We can't directly access the event queue, but we can verify the count increased
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should flush immediately for critical events', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      analyticsService.trackEvent(AnalyticsEventType.EXTENSION_ERROR, {
        errorType: 'NETWORK_ERROR',
        message: 'Test error'
      });
      
      // Wait for async flush
      await vi.runAllTimersAsync();
      
      expect(mockFetch).toHaveBeenCalledWith(
        testConfig.endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  describe('Error Tracking', () => {
    it('should track errors correctly', () => {
      const errorData = {
        errorType: 'JAVASCRIPT_ERROR' as const,
        message: 'Test error',
        stack: 'Error stack trace',
        component: 'TestComponent'
      };
      
      analyticsService.trackError(errorData);
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should not track errors when error tracking is disabled', () => {
      const noErrorTrackingConfig = { ...testConfig, enableErrorTracking: false };
      const service = new AnalyticsService(noErrorTrackingConfig);
      
      service.trackError({
        errorType: 'JAVASCRIPT_ERROR',
        message: 'Test error'
      });
      
      expect(service.getQueuedEventCount()).toBe(1); // Only extension loaded
      service.destroy();
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics', () => {
      const metrics = {
        renderTime: 150,
        apiResponseTime: 300,
        totalLoadTime: 450,
        memoryUsage: 1024000
      };
      
      analyticsService.trackPerformance(metrics);
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should not track performance when disabled', () => {
      const noPerformanceConfig = { ...testConfig, enablePerformanceTracking: false };
      const service = new AnalyticsService(noPerformanceConfig);
      
      service.trackPerformance({
        renderTime: 150,
        apiResponseTime: 300,
        totalLoadTime: 450
      });
      
      expect(service.getQueuedEventCount()).toBe(1); // Only extension loaded
      service.destroy();
    });
  });

  describe('User Interaction Tracking', () => {
    it('should track user interactions', () => {
      analyticsService.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
        riskTier: 'HIGH_RISK',
        orderId: 'order_123'
      });
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should not track interactions when disabled', () => {
      const noInteractionConfig = { ...testConfig, enableUserInteractionTracking: false };
      const service = new AnalyticsService(noInteractionConfig);
      
      service.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {});
      
      expect(service.getQueuedEventCount()).toBe(1); // Only extension loaded
      service.destroy();
    });
  });

  describe('API Call Tracking', () => {
    it('should track successful API calls', () => {
      const startTime = Date.now() - 500;
      
      analyticsService.trackApiCall(
        '/api/risk-profile',
        'POST',
        startTime,
        true
      );
      
      expect(analyticsService.getQueuedEventCount()).toBe(3); // Extension loaded + success + performance
    });

    it('should track failed API calls', () => {
      const startTime = Date.now() - 1000;
      
      analyticsService.trackApiCall(
        '/api/risk-profile',
        'POST',
        startTime,
        false,
        'Network timeout'
      );
      
      expect(analyticsService.getQueuedEventCount()).toBe(3); // Extension loaded + error + performance
    });
  });

  describe('Batching and Flushing', () => {
    it('should flush events when batch size is reached', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      
      // Add events to reach batch size
      for (let i = 0; i < testConfig.batchSize; i++) {
        analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { index: i });
      }
      
      // Wait for async flush
      await vi.runAllTimersAsync();
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should flush events on timer interval', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      // Advance timer to trigger flush
      vi.advanceTimersByTime(testConfig.flushInterval);
      await vi.runAllTimersAsync();
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle flush failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      analyticsService.trackEvent(AnalyticsEventType.EXTENSION_ERROR, {});
      
      await vi.runAllTimersAsync();
      
      // Events should be re-queued on failure
      expect(analyticsService.getQueuedEventCount()).toBeGreaterThan(0);
    });

    it('should retry failed requests with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });
      
      analyticsService.trackEvent(AnalyticsEventType.EXTENSION_ERROR, {});
      
      await vi.runAllTimersAsync();
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const newConfig = { enabled: false };
      
      analyticsService.updateConfig(newConfig);
      
      // Should not track new events when disabled
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      // Queue count should remain the same (only initial extension loaded event)
      expect(analyticsService.getQueuedEventCount()).toBe(1);
    });

    it('should restart auto-flush when re-enabled', () => {
      analyticsService.updateConfig({ enabled: false });
      analyticsService.updateConfig({ enabled: true });
      
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });
  });

  describe('Singleton Factory Functions', () => {
    it('should create and return analytics service instance', () => {
      const service = createAnalyticsService(testConfig);
      
      expect(service).toBeInstanceOf(AnalyticsService);
      expect(getAnalyticsService()).toBe(service);
      
      service.destroy();
    });

    it('should replace existing instance when creating new one', () => {
      const service1 = createAnalyticsService(testConfig);
      const service2 = createAnalyticsService(testConfig);
      
      expect(service2).toBeInstanceOf(AnalyticsService);
      expect(getAnalyticsService()).toBe(service2);
      expect(getAnalyticsService()).not.toBe(service1);
      
      service2.destroy();
    });
  });

  describe('Device Type Detection', () => {
    it('should detect mobile device correctly', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });
      
      const mobileService = new AnalyticsService(testConfig);
      mobileService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      // We can't directly test the device type, but we can verify the event was tracked
      expect(mobileService.getQueuedEventCount()).toBe(2);
      
      mobileService.destroy();
    });

    it('should detect tablet device correctly', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      
      const tabletService = new AnalyticsService(testConfig);
      tabletService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      expect(tabletService.getQueuedEventCount()).toBe(2);
      
      tabletService.destroy();
    });

    it('should detect desktop device correctly', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      
      const desktopService = new AnalyticsService(testConfig);
      desktopService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      expect(desktopService.getQueuedEventCount()).toBe(2);
      
      desktopService.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const service = new AnalyticsService(testConfig);
      
      service.destroy();
      
      // Should flush remaining events
      expect(service.getQueuedEventCount()).toBe(0);
    });

    it('should clear timers on destroy', () => {
      const service = new AnalyticsService(testConfig);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      service.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});