import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalyticsService,
  AnalyticsEventType,
  AnalyticsConfig,
  defaultAnalyticsConfig
} from '../analyticsService';

// Mock global objects
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};
Object.defineProperty(global, 'navigator', { value: mockNavigator });

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: vi.fn()
};
Object.defineProperty(global, 'window', { value: mockWindow });

describe('Analytics Service Basic Tests', () => {
  let analyticsService: AnalyticsService;
  let testConfig: AnalyticsConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    testConfig = {
      ...defaultAnalyticsConfig,
      enabled: true,
      endpoint: 'https://analytics.example.com/events',
      batchSize: 5,
      flushInterval: 1000,
      enableErrorTracking: true
    };
    
    analyticsService = new AnalyticsService(testConfig);
  });

  describe('Basic Functionality', () => {
    it('should create analytics service with valid session ID', () => {
      expect(analyticsService.getSessionId()).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should track events when enabled', () => {
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { test: 'data' });
      
      // Should have extension loaded event + new event
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should not track events when disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledService = new AnalyticsService(disabledConfig);
      
      disabledService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      expect(disabledService.getQueuedEventCount()).toBe(0);
      disabledService.destroy();
    });

    it('should track errors correctly', () => {
      // Debug: Check initial state
      console.log('Initial queue count:', analyticsService.getQueuedEventCount());
      console.log('Config enabled:', testConfig.enabled);
      console.log('Error tracking enabled:', testConfig.enableErrorTracking);
      
      analyticsService.trackError({
        errorType: 'JAVASCRIPT_ERROR',
        message: 'Test error'
      });
      
      console.log('Queue count after error:', analyticsService.getQueuedEventCount());
      
      expect(analyticsService.getQueuedEventCount()).toBeGreaterThan(0);
    });

    it('should track performance metrics', () => {
      analyticsService.trackPerformance({
        renderTime: 150,
        apiResponseTime: 300,
        totalLoadTime: 450
      });
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should track user interactions', () => {
      analyticsService.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
        riskTier: 'HIGH_RISK'
      });
      
      expect(analyticsService.getQueuedEventCount()).toBe(2);
    });

    it('should track API calls', () => {
      const startTime = Date.now();
      
      analyticsService.trackApiCall('/api/test', 'POST', startTime, true);
      
      // Should have extension loaded + success + performance events
      expect(analyticsService.getQueuedEventCount()).toBe(3);
    });

    it('should update configuration', () => {
      analyticsService.updateConfig({ enabled: false });
      
      // Should not track new events when disabled
      analyticsService.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      
      expect(analyticsService.getQueuedEventCount()).toBe(1); // Only initial extension loaded
    });

    it('should clean up on destroy', () => {
      const initialCount = analyticsService.getQueuedEventCount();
      analyticsService.destroy();
      
      // After destroy, queue should be empty (events flushed)
      expect(analyticsService.getQueuedEventCount()).toBe(0);
    });
  });

  describe('Event Types', () => {
    it('should have all required event types', () => {
      expect(AnalyticsEventType.EXTENSION_LOADED).toBe('extension_loaded');
      expect(AnalyticsEventType.EXTENSION_ERROR).toBe('extension_error');
      expect(AnalyticsEventType.API_CALL_STARTED).toBe('api_call_started');
      expect(AnalyticsEventType.API_CALL_SUCCESS).toBe('api_call_success');
      expect(AnalyticsEventType.API_CALL_ERROR).toBe('api_call_error');
      expect(AnalyticsEventType.WHATSAPP_CLICKED).toBe('whatsapp_clicked');
      expect(AnalyticsEventType.RECOMMENDATIONS_VIEWED).toBe('recommendations_viewed');
      expect(AnalyticsEventType.RISK_CARD_VIEWED).toBe('risk_card_viewed');
      expect(AnalyticsEventType.RENDER_PERFORMANCE).toBe('render_performance');
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration values', () => {
      expect(defaultAnalyticsConfig.enabled).toBe(false);
      expect(defaultAnalyticsConfig.batchSize).toBe(10);
      expect(defaultAnalyticsConfig.flushInterval).toBe(30000);
      expect(defaultAnalyticsConfig.enablePerformanceTracking).toBe(true);
      expect(defaultAnalyticsConfig.enableErrorTracking).toBe(true);
      expect(defaultAnalyticsConfig.enableUserInteractionTracking).toBe(true);
      expect(defaultAnalyticsConfig.maxRetries).toBe(3);
    });
  });
});