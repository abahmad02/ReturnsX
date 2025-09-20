import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsEventType } from '../services/analyticsService';
import { ExtensionConfig } from '../types';

// Mock fetch for analytics endpoint
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Shopify UI Extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children }: any) => React.createElement('div', { 'data-testid': 'block-stack' }, children),
  Text: ({ children }: any) => React.createElement('span', { 'data-testid': 'text' }, children),
  View: ({ children }: any) => React.createElement('div', { 'data-testid': 'view' }, children),
  Button: ({ children, onPress }: any) => 
    React.createElement('button', { 'data-testid': 'button', onClick: onPress }, children),
  InlineLayout: ({ children }: any) => React.createElement('div', { 'data-testid': 'inline-layout' }, children),
  useOrder: () => ({ id: 'test-order-123', name: '#1001' })
}));

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: { usedJSHeapSize: 1024000 }
};
Object.defineProperty(global, 'performance', { value: mockPerformance });

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    connection: { effectiveType: '4g' }
  }
});

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    innerWidth: 1920,
    innerHeight: 1080,
    location: { href: 'https://test-store.myshopify.com/thank-you' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    open: vi.fn()
  }
});

describe('Analytics Integration Tests', () => {
  let mockConfig: ExtensionConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockConfig = {
      analytics_enabled: true,
      analytics_endpoint: 'https://analytics.returnsx.com/events',
      performance_tracking_enabled: true,
      error_reporting_enabled: true,
      user_interaction_tracking_enabled: true,
      analytics_debug_mode: false,
      api_endpoint: 'https://api.returnsx.com',
      whatsapp_enabled: true,
      whatsapp_phone: '+923001234567',
      whatsapp_message_template: 'Hi, I need help with order {orderNumber}',
      show_detailed_tips: true
    } as ExtensionConfig;

    // Mock successful analytics endpoint
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Extension Load Analytics', () => {
    it('should track extension load event', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      
      // Wait for auto-flush
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        mockConfig.analytics_endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('extension_loaded')
        })
      );
    });

    it('should include proper metadata in load event', async () => {
      renderHook(() => useAnalytics({ config: mockConfig }));
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.events[0]).toMatchObject({
        type: 'extension_loaded',
        metadata: {
          userAgent: expect.stringContaining('Mozilla'),
          viewport: { width: 1920, height: 1080 },
          connectionType: '4g',
          deviceType: 'desktop'
        }
      });
    });
  });

  describe('User Interaction Analytics', () => {
    it('should track WhatsApp click events', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
          riskTier: 'HIGH_RISK',
          orderId: 'test-order-123',
          phoneNumber: '+923001234567'
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const whatsappEvent = requestBody.events.find((e: any) => e.type === 'whatsapp_clicked');
      expect(whatsappEvent).toMatchObject({
        type: 'whatsapp_clicked',
        data: {
          riskTier: 'HIGH_RISK',
          orderId: 'test-order-123',
          phoneNumber: '+923001234567',
          interactionTime: expect.any(Number)
        }
      });
    });

    it('should track recommendations view events', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackUserInteraction(AnalyticsEventType.RECOMMENDATIONS_VIEWED, {
          riskTier: 'MEDIUM_RISK',
          recommendationCount: 3,
          compactMode: false
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const recommendationsEvent = requestBody.events.find((e: any) => e.type === 'recommendations_viewed');
      expect(recommendationsEvent).toMatchObject({
        type: 'recommendations_viewed',
        data: {
          riskTier: 'MEDIUM_RISK',
          recommendationCount: 3,
          compactMode: false
        }
      });
    });

    it('should track risk card view events', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackUserInteraction(AnalyticsEventType.RISK_CARD_VIEWED, {
          riskTier: 'ZERO_RISK',
          riskScore: 95,
          isNewCustomer: false,
          hasRecommendations: false
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const cardViewEvent = requestBody.events.find((e: any) => e.type === 'risk_card_viewed');
      expect(cardViewEvent).toMatchObject({
        type: 'risk_card_viewed',
        data: {
          riskTier: 'ZERO_RISK',
          riskScore: 95,
          isNewCustomer: false,
          hasRecommendations: false
        }
      });
    });
  });

  describe('API Call Analytics', () => {
    it('should track successful API calls', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const startTime = Date.now();
      
      act(() => {
        result.current.trackApiCall('/api/risk-profile', 'POST', startTime, true);
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const apiSuccessEvent = requestBody.events.find((e: any) => e.type === 'api_call_success');
      expect(apiSuccessEvent).toMatchObject({
        type: 'api_call_success',
        data: {
          endpoint: '/api/risk-profile',
          method: 'POST',
          duration: expect.any(Number),
          success: true
        }
      });
      
      const apiPerformanceEvent = requestBody.events.find((e: any) => e.type === 'api_performance');
      expect(apiPerformanceEvent).toMatchObject({
        type: 'api_performance',
        data: {
          endpoint: '/api/risk-profile',
          responseTime: expect.any(Number),
          success: true
        }
      });
    });

    it('should track failed API calls', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const startTime = Date.now();
      
      act(() => {
        result.current.trackApiCall('/api/risk-profile', 'POST', startTime, false, 'Network timeout');
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const apiErrorEvent = requestBody.events.find((e: any) => e.type === 'api_call_error');
      expect(apiErrorEvent).toMatchObject({
        type: 'api_call_error',
        data: {
          endpoint: '/api/risk-profile',
          method: 'POST',
          duration: expect.any(Number),
          success: false,
          error: 'Network timeout'
        }
      });
    });
  });

  describe('Performance Analytics', () => {
    it('should track performance metrics', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackPerformance({
          renderTime: 150,
          apiResponseTime: 300,
          totalLoadTime: 450,
          memoryUsage: 1024000
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const performanceEvent = requestBody.events.find((e: any) => e.type === 'render_performance');
      expect(performanceEvent).toMatchObject({
        type: 'render_performance',
        data: {
          renderTime: 150,
          apiResponseTime: 300,
          totalLoadTime: 450,
          memoryUsage: 1024000
        }
      });
    });

    it('should track performance timer usage', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      let endTimer: () => number;
      
      act(() => {
        endTimer = result.current.startPerformanceTimer();
      });
      
      // Simulate some work
      mockPerformance.now.mockReturnValue(Date.now() + 200);
      
      let duration: number;
      act(() => {
        duration = endTimer();
      });
      
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Error Analytics', () => {
    it('should track JavaScript errors', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackError({
          errorType: 'JAVASCRIPT_ERROR',
          message: 'Test error message',
          stack: 'Error: Test error\n    at TestComponent',
          component: 'TestComponent',
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const errorEvent = requestBody.events.find((e: any) => e.type === 'extension_error');
      expect(errorEvent).toMatchObject({
        type: 'extension_error',
        data: {
          errorType: 'JAVASCRIPT_ERROR',
          message: 'Test error message',
          stack: expect.stringContaining('Error: Test error'),
          component: 'TestComponent'
        }
      });
    });

    it('should track network errors', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackError({
          errorType: 'NETWORK_ERROR',
          message: 'Failed to fetch risk profile',
          component: 'ApiClient'
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const errorEvent = requestBody.events.find((e: any) => e.type === 'extension_error');
      expect(errorEvent).toMatchObject({
        type: 'extension_error',
        data: {
          errorType: 'NETWORK_ERROR',
          message: 'Failed to fetch risk profile',
          component: 'ApiClient'
        }
      });
    });
  });

  describe('Analytics Configuration', () => {
    it('should not track events when analytics is disabled', async () => {
      const disabledConfig = { ...mockConfig, analytics_enabled: false };
      const { result } = renderHook(() => useAnalytics({ config: disabledConfig }));
      
      expect(result.current.isEnabled).toBe(false);
      
      act(() => {
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, {});
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not track user interactions when disabled', async () => {
      const noInteractionConfig = { 
        ...mockConfig, 
        user_interaction_tracking_enabled: false 
      };
      const { result } = renderHook(() => useAnalytics({ config: noInteractionConfig }));
      
      act(() => {
        result.current.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {});
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      // Should only have extension_loaded event, not the interaction
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const interactionEvents = requestBody.events.filter((e: any) => 
        e.type === 'whatsapp_clicked'
      );
      expect(interactionEvents).toHaveLength(0);
    });

    it('should not track performance when disabled', async () => {
      const noPerformanceConfig = { 
        ...mockConfig, 
        performance_tracking_enabled: false 
      };
      const { result } = renderHook(() => useAnalytics({ config: noPerformanceConfig }));
      
      act(() => {
        result.current.trackPerformance({
          renderTime: 150,
          apiResponseTime: 300,
          totalLoadTime: 450
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const performanceEvents = requestBody.events.filter((e: any) => 
        e.type === 'render_performance'
      );
      expect(performanceEvents).toHaveLength(0);
    });

    it('should not track errors when disabled', async () => {
      const noErrorConfig = { 
        ...mockConfig, 
        error_reporting_enabled: false 
      };
      const { result } = renderHook(() => useAnalytics({ config: noErrorConfig }));
      
      act(() => {
        result.current.trackError({
          errorType: 'JAVASCRIPT_ERROR',
          message: 'Test error'
        });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const errorEvents = requestBody.events.filter((e: any) => 
        e.type === 'extension_error'
      );
      expect(errorEvents).toHaveLength(0);
    });
  });

  describe('Analytics Batching and Retry', () => {
    it('should batch events before sending', async () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      // Add multiple events
      act(() => {
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { event: 1 });
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { event: 2 });
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { event: 3 });
      });
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      // Should include extension_loaded + 3 risk_card_viewed events
      expect(requestBody.events).toHaveLength(4);
    });

    it('should retry failed analytics requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });
      
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackEvent(AnalyticsEventType.EXTENSION_ERROR, {
          errorType: 'NETWORK_ERROR'
        });
      });
      
      // Wait for initial attempt and retry
      await act(async () => {
        vi.advanceTimersByTime(35000); // Initial + retry delay
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});