import { ExtensionConfig } from '../types';
import { validateWhatsAppPhone } from '../utils/validation';
import { sanitizeWhatsAppTemplate, sanitizeText } from '../utils/sanitization';

/**
 * WhatsApp Service
 * 
 * Provides utilities for WhatsApp integration including:
 * - Configuration validation
 * - URL generation
 * - Message template processing
 * - Device detection and deep linking
 */

export interface WhatsAppValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WhatsAppUrlOptions {
  phoneNumber: string;
  message: string;
  fallbackUrl?: string;
}

/**
 * Validates WhatsApp configuration
 */
export function validateWhatsAppConfig(config: ExtensionConfig): WhatsAppValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if WhatsApp is enabled
  if (!config.whatsapp_enabled) {
    return { isValid: true, errors, warnings };
  }

  // Validate phone number using validation utility
  if (!config.whatsapp_phone) {
    errors.push('WhatsApp phone number is required when WhatsApp integration is enabled');
  } else {
    const phoneValidation = validateWhatsAppPhone(config.whatsapp_phone);
    if (!phoneValidation.isValid) {
      errors.push(`Invalid WhatsApp phone number: ${phoneValidation.errors.join(', ')}`);
    }
    
    // Additional legacy validation for warnings
    const legacyValidation = validatePhoneNumber(config.whatsapp_phone);
    if (legacyValidation.warning) {
      warnings.push(legacyValidation.warning);
    }
  }

  // Validate message template
  if (!config.whatsapp_message_template) {
    warnings.push('No WhatsApp message template provided. Default template will be used.');
  } else {
    // Sanitize template first
    const sanitizedTemplate = sanitizeWhatsAppTemplate(config.whatsapp_message_template);
    if (sanitizedTemplate !== config.whatsapp_message_template) {
      warnings.push('WhatsApp message template was sanitized for security');
    }
    
    const templateValidation = validateMessageTemplate(sanitizedTemplate);
    if (!templateValidation.isValid) {
      errors.push(`Invalid WhatsApp message template: ${templateValidation.error}`);
    }
    if (templateValidation.warnings && templateValidation.warnings.length > 0) {
      warnings.push(...templateValidation.warnings);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates phone number format
 */
export function validatePhoneNumber(phone: string): {
  isValid: boolean;
  error?: string;
  warning?: string;
  normalized?: string;
} {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check if we have any digits at all
  if (!/\d/.test(cleaned)) {
    return { isValid: false, error: 'Phone number must contain digits' };
  }

  // Check if it starts with +
  if (!cleaned.startsWith('+')) {
    // Assume Pakistani number if no country code
    if (cleaned.startsWith('0')) {
      const normalized = '+92' + cleaned.substring(1);
      return {
        isValid: true,
        normalized,
        warning: `Assumed Pakistani country code. Normalized to: ${normalized}`,
      };
    } else {
      const normalized = '+92' + cleaned;
      return {
        isValid: true,
        normalized,
        warning: `Assumed Pakistani country code. Normalized to: ${normalized}`,
      };
    }
  }

  // Validate length
  if (cleaned.length < 10 || cleaned.length > 15) {
    return {
      isValid: false,
      error: 'Phone number must be between 10 and 15 digits (including country code)',
    };
  }

  // Check for invalid characters (should only contain digits and +)
  if (!/^\+\d+$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Phone number contains invalid characters',
    };
  }

  // Specific validation for Pakistani numbers
  if (cleaned.startsWith('+92')) {
    if (cleaned.length !== 13) {
      return {
        isValid: false,
        error: 'Pakistani phone numbers must be 13 digits total (+92 followed by 10 digits)',
      };
    }
  }

  return { isValid: true, normalized: cleaned };
}

/**
 * Validates message template
 */
export function validateMessageTemplate(template: string): {
  isValid: boolean;
  error?: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!template || typeof template !== 'string') {
    return { isValid: false, error: 'Message template is required' };
  }

  // Check template length
  if (template.length > 1000) {
    return {
      isValid: false,
      error: 'Message template is too long (maximum 1000 characters)',
    };
  }

  // Check for valid template variables
  const validVariables = [
    'orderNumber',
    'orderName',
    'riskTier',
    'riskScore',
    'failedAttempts',
    'totalOrders',
    'customerType',
  ];

  const templateVariables = template.match(/{(\w+)}/g) || [];
  const invalidVariables = templateVariables
    .map(v => v.slice(1, -1)) // Remove { and }
    .filter(v => !validVariables.includes(v));

  if (invalidVariables.length > 0) {
    warnings.push(
      `Unknown template variables: ${invalidVariables.join(', ')}. ` +
      `Valid variables are: ${validVariables.map(v => `{${v}}`).join(', ')}`
    );
  }

  // Check if template includes order context
  if (!template.includes('{orderNumber}') && !template.includes('{orderName}')) {
    warnings.push('Template does not include order number. Consider adding {orderNumber} or {orderName}');
  }

  return { isValid: true, warnings };
}

/**
 * Generates WhatsApp URL with proper encoding and validation
 */
export function generateWhatsAppUrl(options: WhatsAppUrlOptions): string | null {
  // Validate phone number using validation utility
  const phoneValidation = validateWhatsAppPhone(options.phoneNumber);
  
  if (!phoneValidation.isValid) {
    console.error('Invalid phone number for WhatsApp URL:', phoneValidation.errors.join(', '));
    return null;
  }

  const normalizedPhone = phoneValidation.sanitized || options.phoneNumber;
  // Remove + for WhatsApp URL format
  const phoneForUrl = normalizedPhone.startsWith('+') ? normalizedPhone.substring(1) : normalizedPhone;

  // Sanitize and encode message for URL
  const sanitizedMessage = sanitizeText(options.message);
  const encodedMessage = encodeURIComponent(sanitizedMessage);

  return `https://wa.me/${phoneForUrl}?text=${encodedMessage}`;
}

/**
 * Detects device type and capabilities
 */
export function getDeviceCapabilities(): {
  isMobile: boolean;
  hasWhatsApp: boolean;
  hasClipboard: boolean;
  canMakePhoneCalls: boolean;
  canSendSMS: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      hasWhatsApp: false,
      hasClipboard: false,
      canMakePhoneCalls: false,
      canSendSMS: false,
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/.test(userAgent) ||
                   window.innerWidth <= 768;

  return {
    isMobile,
    hasWhatsApp: isMobile, // Assume WhatsApp is available on mobile devices
    hasClipboard: !!navigator.clipboard,
    canMakePhoneCalls: isMobile, // Phone calls typically work on mobile
    canSendSMS: isMobile, // SMS typically works on mobile
  };
}

/**
 * Opens WhatsApp with fallback handling
 */
export function openWhatsApp(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    try {
      const capabilities = getDeviceCapabilities();
      
      if (capabilities.isMobile) {
        // On mobile, use location.href for better app integration
        window.location.href = url;
        resolve(true);
      } else {
        // On desktop, open in new tab
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        resolve(!!opened);
      }
    } catch (error) {
      console.error('Failed to open WhatsApp:', error);
      resolve(false);
    }
  });
}

/**
 * Copies text to clipboard with fallback
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      resolve(false);
      return;
    }

    const writeTextPromise = navigator.clipboard.writeText(text);
    if (writeTextPromise && typeof writeTextPromise.then === 'function') {
      writeTextPromise
        .then(() => resolve(true))
        .catch((error) => {
          console.error('Failed to copy to clipboard:', error);
          resolve(false);
        });
    } else {
      resolve(false);
    }
  });
}

/**
 * Creates fallback contact URLs
 */
export function createFallbackContactUrls(phoneNumber: string, orderContext: any): {
  tel: string;
  sms: string;
} {
  const phoneValidation = validateWhatsAppPhone(phoneNumber);
  const normalizedPhone = phoneValidation.sanitized || phoneNumber;

  // Sanitize order context
  const sanitizedOrderNumber = sanitizeText(String(orderContext.orderNumber || 'Unknown'));
  const smsMessage = `Order ${sanitizedOrderNumber}: Need delivery assistance for high-risk order.`;
  
  return {
    tel: `tel:${normalizedPhone}`,
    sms: `sms:${normalizedPhone}?body=${encodeURIComponent(smsMessage)}`,
  };
}