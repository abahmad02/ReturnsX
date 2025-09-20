import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  useSettings: vi.fn(),
}));

// Mock the error handler
const mockErrorHandler = vi.fn();
vi.mock('../../components/ErrorBoundary', () => ({
  useErrorHandler: () => mockErrorHandler,
}));

import { useSettings } from '@shopify/ui-extensions-react/checkout';
import { useExtensionConfig } from '../useExtensionConfig';

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;

describe('useExtensionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockErrorHandler.mockClear();
  });

  it('should return loading state when settings are not available', () => {
    mockUseSettings.mockReturnValue(null);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current).toEqual({
      config: null,
      isLoading: true,
      error: null,
    });
  });

  it('should return valid configuration with default values', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      enable_debug_mode: true,
      show_detailed_tips: true,
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.config).toMatchObject({
      api_endpoint: 'https://api.returnsx.com',
      enable_debug_mode: true,
      show_detailed_tips: true,
      api_timeout: 5,
      display_position: 'middle',
      minimum_risk_threshold: 'all',
      animation_enabled: true,
    });
  });

  it('should validate API endpoint URL', () => {
    const mockSettings = {
      api_endpoint: 'invalid-url',
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe('Invalid API endpoint URL');
    expect(result.current.config).toBe(null);
  });

  it('should validate WhatsApp configuration', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      whatsapp_enabled: true,
      whatsapp_phone: '', // Missing phone number
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe('WhatsApp phone number is required when WhatsApp integration is enabled');
  });

  it('should validate API timeout range', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      api_timeout: 50, // Too high
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe('API timeout must be between 1 and 30 seconds');
  });

  it('should handle all configuration options correctly', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      auth_token: 'test-token',
      api_timeout: 10,
      enable_caching: true,
      enable_debug_mode: false,
      show_detailed_tips: true,
      show_recommendations: false,
      show_risk_score: true,
      use_color_coding: true,
      compact_mode: false,
      zero_risk_message: 'Custom zero risk message',
      medium_risk_message: 'Custom medium risk message',
      high_risk_message: 'Custom high risk message',
      new_customer_message: 'Custom new customer message',
      error_message: 'Custom error message',
      whatsapp_enabled: true,
      whatsapp_phone: '+923001234567',
      whatsapp_message_template: 'Custom WhatsApp template',
      fallback_contact_method: 'support@example.com',
      display_position: 'top',
      animation_enabled: false,
      hide_for_prepaid: true,
      minimum_risk_threshold: 'medium',
      custom_css_classes: 'custom-class',
      merchant_branding_enabled: true,
      data_retention_notice: 'Custom privacy notice',
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.config).toEqual({
      api_endpoint: 'https://api.returnsx.com',
      auth_token: 'test-token',
      api_timeout: 10,
      enable_caching: true,
      enable_debug_mode: false,
      show_detailed_tips: true,
      show_recommendations: false,
      show_risk_score: true,
      use_color_coding: true,
      compact_mode: false,
      zero_risk_message: 'Custom zero risk message',
      medium_risk_message: 'Custom medium risk message',
      high_risk_message: 'Custom high risk message',
      new_customer_message: 'Custom new customer message',
      error_message: 'Custom error message',
      whatsapp_enabled: true,
      whatsapp_phone: '+923001234567',
      whatsapp_message_template: 'Custom WhatsApp template',
      fallback_contact_method: 'support@example.com',
      display_position: 'top',
      animation_enabled: false,
      hide_for_prepaid: true,
      minimum_risk_threshold: 'medium',
      custom_css_classes: 'custom-class',
      merchant_branding_enabled: true,
      data_retention_notice: 'Custom privacy notice',
    });
  });

  it('should validate fallback contact method format', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      fallback_contact_method: 'invalid-contact',
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe('Fallback contact method must be a valid email or phone number');
  });

  it('should accept valid email as fallback contact method', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      fallback_contact_method: 'support@example.com',
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe(null);
    expect(result.current.config?.fallback_contact_method).toBe('support@example.com');
  });

  it('should accept valid phone as fallback contact method', () => {
    const mockSettings = {
      api_endpoint: 'https://api.returnsx.com',
      fallback_contact_method: '+923001234567',
    };

    mockUseSettings.mockReturnValue(mockSettings);

    const { result } = renderHook(() => useExtensionConfig());

    expect(result.current.error).toBe(null);
    expect(result.current.config?.fallback_contact_method).toBe('+923001234567');
  });
});