import { useSettings } from '@shopify/ui-extensions-react/checkout';
import { ExtensionConfig } from '../types';
import { useErrorHandler } from '../components/ErrorBoundary';
import { validateExtensionConfig } from '../utils/validation';
import { sanitizeCustomMessage, sanitizeWhatsAppTemplate, sanitizeCssClasses } from '../utils/sanitization';

/**
 * Hook to load and validate extension configuration from theme customizer settings
 */
export function useExtensionConfig(): {
  config: ExtensionConfig | null;
  isLoading: boolean;
  error: string | null;
} {
  const settings = useSettings();
  const handleError = useErrorHandler();

  try {
    // If settings are not loaded yet, return loading state
    if (!settings) {
      return {
        config: null,
        isLoading: true,
        error: null,
      };
    }

    // Validate and transform settings into typed configuration with sanitization
    const rawConfig: Partial<ExtensionConfig> = {
      // Core API settings
      api_endpoint: String(settings.api_endpoint || '').trim(),
      api_timeout: Number(settings.api_timeout) || 5,
      enable_caching: Boolean(settings.enable_caching),
      
      // Debug and display settings
      enable_debug_mode: Boolean(settings.enable_debug_mode),
      show_detailed_tips: Boolean(settings.show_detailed_tips),
      show_recommendations: Boolean(settings.show_recommendations ?? settings.show_detailed_tips),
      show_risk_score: Boolean(settings.show_risk_score),
      use_color_coding: Boolean(settings.use_color_coding),
      compact_mode: Boolean(settings.compact_mode),
      
      // Custom messages (sanitized)
      zero_risk_message: sanitizeCustomMessage(String(settings.zero_risk_message || 'Thank you for being a trusted customer!')),
      medium_risk_message: sanitizeCustomMessage(String(settings.medium_risk_message || 'Please ensure you are available for delivery.')),
      high_risk_message: sanitizeCustomMessage(String(settings.high_risk_message || 'Please contact us to confirm your order details.')),
      new_customer_message: sanitizeCustomMessage(String(settings.new_customer_message || 'Welcome! We look forward to serving you.')),
      error_message: sanitizeCustomMessage(String(settings.error_message || 'Thank you for your order. We will process it shortly.')),
      
      // WhatsApp integration
      whatsapp_enabled: Boolean(settings.whatsapp_enabled),
      whatsapp_phone: String(settings.whatsapp_phone || '').trim(),
      whatsapp_message_template: sanitizeWhatsAppTemplate(String(settings.whatsapp_message_template || 'Hi, I need help with my order {orderNumber}. I have a high-risk delivery profile ({failedAttempts} failed deliveries) and want to ensure successful delivery.')),
      fallback_contact_method: String(settings.fallback_contact_method || '').trim(),
      
      // Advanced display options
      display_position: (settings.display_position as 'top' | 'middle' | 'bottom') || 'middle',
      animation_enabled: Boolean(settings.animation_enabled ?? true),
      hide_for_prepaid: Boolean(settings.hide_for_prepaid),
      minimum_risk_threshold: (settings.minimum_risk_threshold as 'all' | 'medium' | 'high') || 'all',
      custom_css_classes: sanitizeCssClasses(String(settings.custom_css_classes || '')),
      merchant_branding_enabled: Boolean(settings.merchant_branding_enabled),
      data_retention_notice: sanitizeCustomMessage(String(settings.data_retention_notice || '')),
    };

    // Validate the configuration
    const configValidation = validateExtensionConfig(rawConfig);
    if (!configValidation.isValid) {
      handleError(new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`), 'useExtensionConfig');
      return {
        config: null,
        isLoading: false,
        error: `Configuration validation failed: ${configValidation.errors.join(', ')}`,
      };
    }

    const config = rawConfig as ExtensionConfig;

    // Additional legacy validation (keeping for backward compatibility)
    const legacyValidationError = validateConfig(config);
    if (legacyValidationError) {
      handleError(new Error(`Legacy configuration validation failed: ${legacyValidationError}`), 'useExtensionConfig');
      return {
        config: null,
        isLoading: false,
        error: legacyValidationError,
      };
    }

    return {
      config,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
    handleError(error instanceof Error ? error : new Error(errorMessage), 'useExtensionConfig');
    
    return {
      config: null,
      isLoading: false,
      error: errorMessage,
    };
  }
}

/**
 * Validates extension configuration
 */
function validateConfig(config: ExtensionConfig): string | null {
  // Validate API endpoint if provided
  if (config.api_endpoint && !isValidUrl(config.api_endpoint)) {
    return 'Invalid API endpoint URL';
  }

  // Validate API timeout
  if (config.api_timeout < 1 || config.api_timeout > 30) {
    return 'API timeout must be between 1 and 30 seconds';
  }

  // Validate WhatsApp phone number if WhatsApp is enabled
  if (config.whatsapp_enabled && !config.whatsapp_phone) {
    return 'WhatsApp phone number is required when WhatsApp integration is enabled';
  }

  if (config.whatsapp_enabled && config.whatsapp_phone && !isValidPhoneNumber(config.whatsapp_phone)) {
    return 'Invalid WhatsApp phone number format';
  }

  // Validate display position
  if (!['top', 'middle', 'bottom'].includes(config.display_position)) {
    return 'Invalid display position';
  }

  // Validate minimum risk threshold
  if (!['all', 'medium', 'high'].includes(config.minimum_risk_threshold)) {
    return 'Invalid minimum risk threshold';
  }

  // Validate fallback contact method format if provided
  if (config.fallback_contact_method && config.fallback_contact_method.trim()) {
    const fallback = config.fallback_contact_method.trim();
    // Check if it's an email or phone number
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallback);
    const isPhone = /^\+?[\d\s-()]+$/.test(fallback);
    
    if (!isEmail && !isPhone) {
      return 'Fallback contact method must be a valid email or phone number';
    }
  }

  return null;
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates phone number format (basic validation for Pakistani numbers)
 */
function isValidPhoneNumber(phone: string): boolean {
  // Basic validation for international phone numbers
  // Should start with + and contain only digits and spaces/dashes
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  const cleanPhone = phone.replace(/[\s-]/g, '');
  return phoneRegex.test(cleanPhone);
}