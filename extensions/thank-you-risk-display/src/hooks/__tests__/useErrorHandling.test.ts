import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useErrorHandling, useApiErrorHandling, useConfigErrorHandling, useCriticalErrorHandling } from '../useErrorHandling';
import { ErrorType, ExtensionConfig } from '../../types';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock timers
vi.useFakeTimers();

describe('useErrorHandling', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.example.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Welcome!',
    medium_risk_message: 'Good customer',
    high_risk_message: 'Please contact us',
    whatsapp_enabled: true,
    whatsapp_phone: '+1234567890',
    whatsapp_message_template: 'Hello, order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  beforeEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
  });

  describe('Basic Error Handling', () => {
    it('initializes with no error', () => {
      const { result } = renderHook(() => useErrorHandling());

      expect(result.current.error).toBeNull();
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
    });

    it('sets error correctly', () => {
      const { result } = renderHook(() => useErrorHandling());

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
      });

      expect(result.current.error).toEqual(testError);
      expect(result.current.canRetry).toBe(true);
    });

    it('clears error correctly', () => {
      const { result } = renderHook(() => useErrorHandling());

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
      });

      expect(result.current.error).toEqual(testError);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.isRetrying).toBe(false);
    });
  });

  describe('Error Categorization', () => {
    it('categorizes timeout errors correctly', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const timeoutError = new Error('Request timeout');
      
      act(() => {
        const errorState = result.current.handleError(timeoutError);
        expect(errorState.type).toBe(ErrorType.TIMEOUT_ERROR);
        expect(errorState.retryable).toBe(true);
      });
    });

    it('categorizes network errors correctly', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const networkError = new Error('Network error occurred');
      
      act(() => {
        const errorState = result.current.handleError(networkError);
        expect(errorState.type).toBe(ErrorType.NETWORK_ERROR);
        expect(errorState.retryable).toBe(true);
      });
    });

    it('categorizes authentication errors correctly', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const authError = new Error('HTTP 401: Unauthorized');
      
      act(() => {
        const errorState = result.current.handleError(authError);
        expect(errorState.type).toBe(ErrorType.AUTHENTICATION_ERROR);
        expect(errorState.retryable).toBe(false);
      });
    });

    it('categorizes configuration errors correctly', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const configError = new Error('Configuration invalid');
      
      act(() => {
        const errorState = result.current.handleError(configError);
        expect(errorState.type).toBe(ErrorType.CONFIGURATION_ERROR);
        expect(errorState.retryable).toBe(false);
      });
    });

    it('categorizes circuit breaker errors correctly', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const circuitError = new Error('Circuit breaker is OPEN');
      
      act(() => {
        const errorState = result.current.handleError(circuitError);
        expect(errorState.type).toBe(ErrorType.NETWORK_ERROR);
        expect(errorState.message).toContain('temporarily unavailable');
        expect(errorState.retryable).toBe(true);
      });
    });
  });

  describe('Retry Logic', () => {
    it('tracks retry count correctly', async () => {
      const mockRetryFn = jest.fn().mockRejectedValue(new Error('Still failing'));
      const { result } = renderHook(() => useErrorHandling({ maxRetries: 3 }));

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      expect(result.current.retryCount).toBe(0);

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.retryCount).toBe(1);
      expect(mockRetryFn).toHaveBeenCalledTimes(1);
    });

    it('prevents retry when max retries reached', async () => {
      const mockRetryFn = jest.fn().mockRejectedValue(new Error('Still failing'));
      const { result } = renderHook(() => useErrorHandling({ maxRetries: 2 }));

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      // First retry
      await act(async () => {
        await result.current.retry();
      });

      // Second retry
      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.retryCount).toBe(2);
      expect(result.current.canRetry).toBe(false);

      // Third retry should not execute
      await act(async () => {
        await result.current.retry();
      });

      expect(mockRetryFn).toHaveBeenCalledTimes(2);
    });

    it('clears error on successful retry', async () => {
      const mockRetryFn = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useErrorHandling());

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });

    it('does not retry non-retryable errors', async () => {
      const mockRetryFn = jest.fn();
      const { result } = renderHook(() => useErrorHandling());

      const testError = {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Auth failed',
        retryable: false,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      expect(result.current.canRetry).toBe(false);

      await act(async () => {
        await result.current.retry();
      });

      expect(mockRetryFn).not.toHaveBeenCalled();
    });
  });

  describe('Auto Retry', () => {
    it('automatically retries when enabled', () => {
      const mockRetryFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => 
        useErrorHandling({ 
          enableAutoRetry: true, 
          retryDelay: 1000,
          maxRetries: 2 
        })
      );

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      // Fast-forward time to trigger auto retry
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockRetryFn).toHaveBeenCalledTimes(1);
    });

    it('uses exponential backoff for auto retry', () => {
      const mockRetryFn = vi.fn().mockRejectedValue(new Error('Still failing'));
      const { result } = renderHook(() => 
        useErrorHandling({ 
          enableAutoRetry: true, 
          retryDelay: 1000,
          maxRetries: 3 
        })
      );

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      // First auto retry after 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockRetryFn).toHaveBeenCalledTimes(1);

      // Second auto retry after 2 seconds (exponential backoff)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockRetryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Callbacks', () => {
    it('calls onError callback when error is set', () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useErrorHandling({ onError }));

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
      });

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('calls onRetry callback when retry is attempted', async () => {
      const onRetry = vi.fn();
      const mockRetryFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useErrorHandling({ onRetry }));

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(onRetry).toHaveBeenCalledWith(1);
    });

    it('calls onMaxRetriesReached when max retries exceeded', async () => {
      const onMaxRetriesReached = vi.fn();
      const mockRetryFn = vi.fn().mockRejectedValue(new Error('Still failing'));
      const { result } = renderHook(() => 
        useErrorHandling({ 
          maxRetries: 1, 
          onMaxRetriesReached 
        })
      );

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(onMaxRetriesReached).toHaveBeenCalled();
    });
  });

  describe('Specialized Hooks', () => {
    it('useApiErrorHandling has correct defaults', () => {
      const { result } = renderHook(() => useApiErrorHandling(mockConfig));

      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });

    it('useConfigErrorHandling has correct defaults', () => {
      const { result } = renderHook(() => useConfigErrorHandling(mockConfig));

      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });

    it('useCriticalErrorHandling enables auto retry', () => {
      const mockRetryFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useCriticalErrorHandling(mockConfig));

      const testError = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network failed',
        retryable: true,
      };

      act(() => {
        result.current.setError(testError);
        (result.current as any).registerRetryFunction(mockRetryFn);
      });

      // Should auto retry
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockRetryFn).toHaveBeenCalled();
    });
  });

  describe('Debug Mode', () => {
    it('adds context to error message in debug mode', () => {
      const debugConfig = { ...mockConfig, enable_debug_mode: true };
      const { result } = renderHook(() => useErrorHandling({ config: debugConfig }));

      const testError = new Error('Test error');
      
      act(() => {
        const errorState = result.current.handleError(testError, 'test-context');
        expect(errorState.message).toContain('[test-context]');
      });
    });

    it('does not add context in non-debug mode', () => {
      const { result } = renderHook(() => useErrorHandling({ config: mockConfig }));

      const testError = new Error('Test error');
      
      act(() => {
        const errorState = result.current.handleError(testError, 'test-context');
        expect(errorState.message).not.toContain('[test-context]');
      });
    });
  });
});