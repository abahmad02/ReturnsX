import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalytics, useComponentPerformance } from '../useAnalytics';
import { AnalyticsEventType } from '../../services/analyticsService';
import { ExtensionConfig } from '../../types';

// Mock the analytics service
vi.mock('../../services/analyticsService', () => ({
  AnalyticsEventType: {
    EXTENSION_LOADED: 'extension_loaded',
    RISK_CARD_VIEWED: 'risk_card_viewed',
    WHATSAPP_CLICKED: 'whatsapp_clicked',
    RECOMMENDATIONS_VIEWED: 'recommendations_viewed',
    API_CALL_STARTED: 'api_call_started',
    API_CALL_SUCCESS: 'api_call_success',
    API_CALL_ERROR: 'api_call_error',
    EXTENSION_ERROR: 'extension_error',
    RENDER_PERFORMANCE: 'render_performance'
  },
  createAnalyticsService: vi.fn(() => mockAnalyticsService),
  getAnalyticsService: vi.fn(() => mockAnalyticsService),
  defaultAnalyticsConfig: {
    enabled: false,
    batchSize: 10,
    flushInterval: 30000,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableUserInteractionTracking: true,
    enableDebugLogging: false,
    maxRetries: 3,
    retryDelay: 1000
  }
}));

const mockAnalyticsService = {
  trackEvent: vi.fn(),
  trackError: vi.fn(),
  trackPerformance: vi.fn(),
  trackUserInteraction: vi.fn(),
  trackApiCall: vi.fn(),
  getSessionId: vi.fn(() => 'test-session-id'),
  destroy: vi.fn()
};

describe('useAnalytics', () => {
  let mockConfig: ExtensionConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockConfig = {
      analytics_enabled: true,
      analytics_endpoint: 'https://analytics.example.com',
      performance_tracking_enabled: true,
      error_reporting_enabled: true,
      user_interaction_tracking_enabled: true,
      analytics_debug_mode: false
    } as ExtensionConfig;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize analytics service when enabled', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.sessionId).toBe('test-session-id');
    });

    it('should not initialize analytics service when disabled', () => {
      const disabledConfig = { ...mockConfig, analytics_enabled: false };
      const { result } = renderHook(() => useAnalytics({ config: disabledConfig }));
      
      expect(result.current.isEnabled).toBe(false);
    });

    it('should not initialize when hook is disabled', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig, enabled: false }));
      
      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('Event Tracking', () => {
    it('should track events correctly', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED, { test: 'data' });
      });
      
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        AnalyticsEventType.RISK_CARD_VIEWED,
        { test: 'data' }
      );
    });

    it('should track events with default empty data', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackEvent(AnalyticsEventType.RISK_CARD_VIEWED);
      });
      
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        AnalyticsEventType.RISK_CARD_VIEWED,
        {}
      );
    });
  });

  describe('Error Tracking', () => {
    it('should track errors correctly', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const errorData = {
        errorType: 'JAVASCRIPT_ERROR' as const,
        message: 'Test error',
        component: 'TestComponent'
      };
      
      act(() => {
        result.current.trackError(errorData);
      });
      
      expect(mockAnalyticsService.trackError).toHaveBeenCalledWith(errorData);
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const metrics = {
        renderTime: 150,
        apiResponseTime: 300,
        totalLoadTime: 450
      };
      
      act(() => {
        result.current.trackPerformance(metrics);
      });
      
      expect(mockAnalyticsService.trackPerformance).toHaveBeenCalledWith(metrics);
    });
  });

  describe('User Interaction Tracking', () => {
    it('should track user interactions', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      act(() => {
        result.current.trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
          riskTier: 'HIGH_RISK'
        });
      });
      
      expect(mockAnalyticsService.trackUserInteraction).toHaveBeenCalledWith(
        AnalyticsEventType.WHATSAPP_CLICKED,
        { riskTier: 'HIGH_RISK' }
      );
    });
  });

  describe('API Call Tracking', () => {
    it('should track API calls', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const startTime = Date.now();
      
      act(() => {
        result.current.trackApiCall('/api/test', 'POST', startTime, true);
      });
      
      expect(mockAnalyticsService.trackApiCall).toHaveBeenCalledWith(
        '/api/test',
        'POST',
        startTime,
        true,
        undefined
      );
    });

    it('should track failed API calls with error', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      const startTime = Date.now();
      
      act(() => {
        result.current.trackApiCall('/api/test', 'POST', startTime, false, 'Network error');
      });
      
      expect(mockAnalyticsService.trackApiCall).toHaveBeenCalledWith(
        '/api/test',
        'POST',
        startTime,
        false,
        'Network error'
      );
    });
  });

  describe('Performance Timer', () => {
    it('should create and return performance timer', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      let endTimer: () => number;
      
      act(() => {
        endTimer = result.current.startPerformanceTimer();
      });
      
      expect(typeof endTimer!).toBe('function');
      
      act(() => {
        const duration = endTimer();
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return 0 for invalid timer', () => {
      const { result } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      let endTimer: () => number;
      
      act(() => {
        endTimer = result.current.startPerformanceTimer();
      });
      
      // Call timer twice (second call should return 0)
      act(() => {
        endTimer();
        const duration = endTimer();
        expect(duration).toBe(0);
      });
    });
  });

  describe('Configuration Changes', () => {
    it('should update when configuration changes', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useAnalytics({ config }),
        { initialProps: { config: mockConfig } }
      );
      
      expect(result.current.isEnabled).toBe(true);
      
      const disabledConfig = { ...mockConfig, analytics_enabled: false };
      rerender({ config: disabledConfig });
      
      expect(result.current.isEnabled).toBe(false);
    });

    it('should destroy and recreate service on endpoint change', () => {
      const { rerender } = renderHook(
        ({ config }) => useAnalytics({ config }),
        { initialProps: { config: mockConfig } }
      );
      
      const newConfig = { ...mockConfig, analytics_endpoint: 'https://new-endpoint.com' };
      rerender({ config: newConfig });
      
      expect(mockAnalyticsService.destroy).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should destroy analytics service on unmount', () => {
      const { unmount } = renderHook(() => useAnalytics({ config: mockConfig }));
      
      unmount();
      
      expect(mockAnalyticsService.destroy).toHaveBeenCalled();
    });
  });
});

describe('useComponentPerformance', () => {
  let mockConfig: ExtensionConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockConfig = {
      analytics_enabled: true,
      performance_tracking_enabled: true
    } as ExtensionConfig;

    // Mock performance.now()
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Performance Tracking', () => {
    it('should track component render performance', () => {
      const { result } = renderHook(() => 
        useComponentPerformance('TestComponent', mockConfig)
      );
      
      expect(result.current.isEnabled).toBe(true);
      
      // Simulate render completion
      vi.spyOn(performance, 'now').mockReturnValue(1150);
      
      // Force re-render to trigger performance tracking
      const { rerender } = renderHook(() => 
        useComponentPerformance('TestComponent', mockConfig)
      );
      rerender();
      
      expect(mockAnalyticsService.trackPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          renderTime: 150
        })
      );
    });

    it('should not track performance when disabled', () => {
      const disabledConfig = { ...mockConfig, analytics_enabled: false };
      const { result } = renderHook(() => 
        useComponentPerformance('TestComponent', disabledConfig)
      );
      
      expect(result.current.isEnabled).toBe(false);
      expect(mockAnalyticsService.trackPerformance).not.toHaveBeenCalled();
    });

    it('should track custom metrics', () => {
      const { result } = renderHook(() => 
        useComponentPerformance('TestComponent', mockConfig)
      );
      
      act(() => {
        result.current.trackCustomMetric('customMetric', 42, 'ms');
      });
      
      expect(mockAnalyticsService.trackPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          customMetric: 42
        })
      );
    });

    it('should provide performance timer', () => {
      const { result } = renderHook(() => 
        useComponentPerformance('TestComponent', mockConfig)
      );
      
      let endTimer: () => number;
      
      act(() => {
        endTimer = result.current.startTimer();
      });
      
      expect(typeof endTimer!).toBe('function');
      
      vi.spyOn(performance, 'now').mockReturnValue(1200);
      
      act(() => {
        const duration = endTimer();
        expect(duration).toBe(200);
      });
    });
  });
});