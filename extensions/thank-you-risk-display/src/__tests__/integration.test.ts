import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRiskProfile } from '../hooks/useRiskProfile';
import { ExtensionConfig, CustomerData } from '../types';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Mock crypto.subtle for hashing
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
  },
};
global.crypto = mockCrypto as any;

// Mock TextEncoder
global.TextEncoder = class {
  encoding = 'utf-8';
  
  encode(input: string) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
  
  encodeInto() {
    throw new Error('encodeInto not implemented in mock');
  }
} as any;

// Mock error boundary hook
const mockHandleError = vi.fn();
vi.mock('../components/ErrorBoundary', () => ({
  useErrorHandler: () => mockHandleError,
}));

describe('API Client Integration', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock crypto.subtle.digest to return a consistent hash
    mockCrypto.subtle.digest.mockResolvedValue(
      new ArrayBuffer(32) // 32 bytes for SHA-256
    );
  });

  it('should successfully fetch and display risk profile', async () => {
    const mockResponse = {
      success: true,
      riskTier: 'MEDIUM_RISK',
      riskScore: 45,
      totalOrders: 10,
      failedAttempts: 2,
      successfulDeliveries: 8,
      isNewCustomer: false,
      message: 'Medium risk customer',
      recommendations: ['Be available for delivery', 'Ensure correct address'],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    // Should start loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.riskProfile).toBe(null);

    // Wait for API call to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have successful result
    expect(result.current.riskProfile).toEqual(mockResponse);
    expect(result.current.error).toBe(null);

    // Verify API was called with hashed data
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.returnsx.com/api/risk-profile',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      })
    );

    // Verify request body contains hashed data
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.phone).not.toBe(mockCustomerData.phone); // Should be hashed
    expect(requestBody.email).not.toBe(mockCustomerData.email); // Should be hashed
    expect(requestBody.orderId).toBe(mockCustomerData.orderId); // Should not be hashed
    expect(requestBody.checkoutToken).toBe(mockCustomerData.checkoutToken); // Should not be hashed
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have fallback profile for new customer
    expect(result.current.riskProfile?.isNewCustomer).toBe(true);
    expect(result.current.riskProfile?.riskTier).toBe('ZERO_RISK');
    expect(result.current.error?.type).toBe('NETWORK_ERROR');
  });

  it('should handle network timeouts', async () => {
    // Mock a timeout scenario
    mockFetch.mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('Request timeout');
          error.name = 'AbortError';
          reject(error);
        }, 100);
      });
    });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 2000 });

    // Should have fallback profile
    expect(result.current.riskProfile?.isNewCustomer).toBe(true);
    expect(result.current.error?.message).toContain('Request timeout');
  });

  it('should retry failed requests', async () => {
    // First call fails, second succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          riskTier: 'ZERO_RISK',
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          isNewCustomer: true,
          message: 'Welcome!',
        }),
      });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    // Should eventually succeed after retries
    expect(result.current.riskProfile?.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should validate API response structure', async () => {
    // Return invalid response structure
    const invalidResponse = {
      success: true,
      // Missing required fields like riskTier, riskScore, etc.
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(invalidResponse),
    });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should handle invalid response gracefully
    expect(result.current.riskProfile?.isNewCustomer).toBe(true);
    expect(result.current.error?.type).toBe('NETWORK_ERROR');
  });

  it('should handle authentication errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const { result } = renderHook(() =>
      useRiskProfile({
        config: mockConfig,
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not retry authentication errors
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.riskProfile?.isNewCustomer).toBe(true);
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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle configuration errors', async () => {
    const { result } = renderHook(() =>
      useRiskProfile({
        config: { ...mockConfig, api_endpoint: 'invalid-url' },
        customerData: mockCustomerData,
      })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBe(null);
    });

    expect(result.current.error?.type).toBe('CONFIGURATION_ERROR');
    expect(mockHandleError).toHaveBeenCalled();
  });
});