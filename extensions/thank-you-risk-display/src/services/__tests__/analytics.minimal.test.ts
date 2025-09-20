import { describe, it, expect, vi } from 'vitest';
import { AnalyticsService, AnalyticsEventType } from '../analyticsService';

// Mock global objects
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

describe('Analytics Minimal Test', () => {
  it('should create analytics service and track basic events', () => {
    const config = {
      enabled: true,
      endpoint: 'https://test.com',
      batchSize: 10,
      flushInterval: 30000,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserInteractionTracking: true,
      enableDebugLogging: false,
      maxRetries: 3,
      retryDelay: 1000
    };

    const service = new AnalyticsService(config);
    
    // Should have a valid session ID
    expect(service.getSessionId()).toMatch(/^session_\d+_[a-z0-9]+$/);
    
    // Should start with extension loaded event
    expect(service.getQueuedEventCount()).toBe(1);
    
    // Should be able to track events
    service.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { test: 'data' });
    expect(service.getQueuedEventCount()).toBe(2);
    
    // Should be able to track errors
    service.trackError({
      errorType: 'JAVASCRIPT_ERROR',
      message: 'Test error'
    });
    expect(service.getQueuedEventCount()).toBe(3);
    
    // Cleanup
    service.destroy();
  });

  it('should not track when disabled', () => {
    const config = {
      enabled: false,
      endpoint: 'https://test.com',
      batchSize: 10,
      flushInterval: 30000,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserInteractionTracking: true,
      enableDebugLogging: false,
      maxRetries: 3,
      retryDelay: 1000
    };

    const service = new AnalyticsService(config);
    
    // Should start with 0 events when disabled
    expect(service.getQueuedEventCount()).toBe(0);
    
    // Should not track events when disabled
    service.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { test: 'data' });
    expect(service.getQueuedEventCount()).toBe(0);
    
    // Cleanup
    service.destroy();
  });
});