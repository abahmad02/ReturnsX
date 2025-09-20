import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRiskProfile, useApiHealth } from '../useRiskProfile';
import { ExtensionConfig, CustomerData, RiskProfileResponse } from '../../types';
import * as apiClientModule from '../../services/apiClient';

// Mock the API client
const mockApiClient = {
  getRiskProfile: vi.fn(),
  healthCheck: vi.fn(),
  cancelRequests: vi.fn(),
};

const mockCreateApiClient = vi.fn(() => mockApiClient);

vi.mock('../../services/apiClient', () => ({
  createApiClient: mockCreateApiClient,
  DEFAULT_API_CONFIG: {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
    enableDebug: false,
  },
}));

// Mock error boundary hook
const mockHandleError = vi.fn();
vi.mock('../../components/ErrorBoundary', () => ({
  useErrorHandler: () => mockHandleError,
}));

describe('useRiskProfile', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Welcome!',
    medium_risk_message: 'Please be available',
    high_risk_message: 'Please contact us',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  const mockCustomerData: CustomerData = {
    phone: '+923001234567',
    email: 'test@example.com',
    orderId: 'order_123',
    checkoutToken: 'token_456',
  };

  const mockRiskProfile: RiskProfileResponse = {
    success: true,
    riskTier: 'MEDIUM_RISK',
    riskScore: 45,
    totalOrders: 10,
    failedAttempts: 2,
    successfulDeliveries: 8,
    isNewCustomer: false,
    message: 'Medium risk customer',
    recommendations: ['Be available for delivery'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getRiskProfile.mockResolvedValue(mockRiskProfile);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('basic functionality', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.riskProfile).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should fetch risk profile successfully', async () => {
      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.riskProfile).toEqual(mockRiskProfile);
      expect(result.current.error).toBe(null);
      expect(mockApiClient.getRiskProfile).toHaveBeenCalledWith({
        phone: mockCustomerData.phone,
        email: mockCustomerData.email,
        orderId: mockCustomerData.orderId,
        checkoutToken: mockCustomerData.checkoutToken,
      });
    });

    it('should not fetch when disabled', () => {
      renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
          enabled: false,
        })
      );

      expect(mockApiClient.getRiskProfile).not.toHaveBeenCalled();
    });

    it('should not fetch without config', () => {
      renderHook(() =>
        useRiskProfile({
          config: null,
          customerData: mockCustomerData,
        })
      );

      expect(mockApiClient.getRiskProfile).not.toHaveBeenCalled();
    });

    it('should not fetch without customer data', () => {
      renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: null,
        })
      );

      expect(mockApiClient.getRiskProfile).not.toHaveBeenCalled();
    });

    it('should handle missing customer identifiers', async () => {
      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: { orderId: 'order_123' }, // No phone or email
        })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBe(null);
      });

      expect(result.current.error?.type).toBe('CONFIGURATION_ERROR');
      expect(result.current.error?.message).toContain('No customer phone or email available');
      expect(mockApiClient.getRiskProfile).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle API client initialization error', async () => {
      mockCreateApiClient.mockImplementationOnce(() => {
        throw new Error('Invalid configuration');
      });

      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBe(null);
      });

      expect(result.current.error?.type).toBe('CONFIGURATION_ERROR');
      expect(mockHandleError).toHaveBeenCalled();
    });

    it('should handle API request failure', async () => {
      const apiError = new Error('Network error');
      mockApiClient.getRiskProfile.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error?.type).toBe('NETWORK_ERROR');
      expect(result.current.error?.message).toBe('Network error');
      expect(result.current.riskProfile?.isNewCustomer).toBe(true);
      expect(mockHandleError).toHaveBeenCalledWith(apiError, 'useRiskProfile:fetch');
    });

    it('should handle API response with error', async () => {
      const errorResponse: RiskProfileResponse = {
        success: false,
        riskTier: 'ZERO_RISK',
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        isNewCustomer: true,
        message: 'Welcome!',
        error: 'Customer not found',
      };

      mockApiClient.getRiskProfile.mockResolvedValue(errorResponse);

      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error?.type).toBe('NETWORK_ERROR');
      expect(result.current.error?.message).toBe('Customer not found');
      expect(result.current.error?.fallbackData).toEqual(errorResponse);
      expect(result.current.riskProfile).toEqual(errorResponse);
    });
  });

  describe('callbacks', () => {
    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();

      renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
          onSuccess,
        })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockRiskProfile);
      });
    });

    it('should call onError callback', async () => {
      const onError = vi.fn();
      const apiError = new Error('Network error');
      mockApiClient.getRiskProfile.mockRejectedValue(apiError);

      renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
          onError,
        })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'NETWORK_ERROR',
            message: 'Network error',
          })
        );
      });
    });
  });

  describe('refetch functionality', () => {
    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      mockApiClient.getRiskProfile.mockClear();

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockApiClient.getRiskProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('request cancellation', () => {
    it('should cancel requests when cancelRequest is called', () => {
      const { result } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      act(() => {
        result.current.cancelRequest();
      });

      expect(mockApiClient.cancelRequests).toHaveBeenCalled();
    });

    it('should cancel requests on unmount', () => {
      const { unmount } = renderHook(() =>
        useRiskProfile({
          config: mockConfig,
          customerData: mockCustomerData,
        })
      );

      unmount();

      expect(mockApiClient.cancelRequests).toHaveBeenCalled();
    });
  });

  describe('race condition handling', () => {
    it('should handle race conditions with multiple requests', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise(resolve => {
        resolveSecond = resolve;
      });

      mockApiClient.getRiskProfile
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result, rerender } = renderHook(
        ({ customerData }) =>
          useRiskProfile({
            config: mockConfig,
            customerData,
          }),
        {
          initialProps: { customerData: mockCustomerData },
        }
      );

      // Trigger second request
      rerender({
        customerData: { ...mockCustomerData, orderId: 'order_456' },
      });

      // Resolve first request (should be ignored)
      resolveFirst!({
        ...mockRiskProfile,
        message: 'First request',
      });

      // Resolve second request (should be used)
      resolveSecond!({
        ...mockRiskProfile,
        message: 'Second request',
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.riskProfile?.message).toBe('Second request');
    });
  });
});

describe('useApiHealth', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Welcome!',
    medium_risk_message: 'Please be available',
    high_risk_message: 'Please contact us',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null health status', () => {
    const { result } = renderHook(() => useApiHealth(mockConfig));

    expect(result.current.isHealthy).toBe(null);
    expect(result.current.isChecking).toBe(false);
  });

  it('should check health successfully', async () => {
    mockApiClient.healthCheck.mockResolvedValue(true);

    const { result } = renderHook(() => useApiHealth(mockConfig));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isHealthy).toBe(true);
    expect(result.current.isChecking).toBe(false);
    expect(mockApiClient.healthCheck).toHaveBeenCalled();
  });

  it('should handle health check failure', async () => {
    mockApiClient.healthCheck.mockResolvedValue(false);

    const { result } = renderHook(() => useApiHealth(mockConfig));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isHealthy).toBe(false);
  });

  it('should handle health check error', async () => {
    mockApiClient.healthCheck.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useApiHealth(mockConfig));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isHealthy).toBe(false);
    expect(mockHandleError).toHaveBeenCalled();
  });

  it('should handle missing config', async () => {
    const { result } = renderHook(() => useApiHealth(null));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isHealthy).toBe(false);
    expect(mockApiClient.healthCheck).not.toHaveBeenCalled();
  });

  it('should show checking state during health check', async () => {
    let resolveHealthCheck: (value: boolean) => void;
    const healthCheckPromise = new Promise<boolean>(resolve => {
      resolveHealthCheck = resolve;
    });

    mockApiClient.healthCheck.mockReturnValue(healthCheckPromise);

    const { result } = renderHook(() => useApiHealth(mockConfig));

    act(() => {
      result.current.checkHealth();
    });

    expect(result.current.isChecking).toBe(true);

    await act(async () => {
      resolveHealthCheck!(true);
      await healthCheckPromise;
    });

    expect(result.current.isChecking).toBe(false);
    expect(result.current.isHealthy).toBe(true);
  });
});