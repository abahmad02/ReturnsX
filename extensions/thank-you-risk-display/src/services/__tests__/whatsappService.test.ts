import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateWhatsAppConfig,
  validatePhoneNumber,
  validateMessageTemplate,
  generateWhatsAppUrl,
  getDeviceCapabilities,
  openWhatsApp,
  copyToClipboard,
  createFallbackContactUrls,
} from '../whatsappService';
import { ExtensionConfig } from '../../types';

describe('WhatsApp Service', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Zero risk message',
    medium_risk_message: 'Medium risk message',
    high_risk_message: 'High risk message',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with my order {orderNumber}.',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  // Mock window and navigator
  const mockWindow = {
    location: { href: '' },
    open: vi.fn(),
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    innerWidth: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    global.window = mockWindow;
    // @ts-ignore
    global.navigator = mockWindow.navigator;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateWhatsAppConfig', () => {
    it('should validate enabled WhatsApp config successfully', () => {
      const result = validateWhatsAppConfig(mockConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for disabled WhatsApp', () => {
      const disabledConfig = { ...mockConfig, whatsapp_enabled: false };
      const result = validateWhatsAppConfig(disabledConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require phone number when WhatsApp is enabled', () => {
      const configWithoutPhone = { ...mockConfig, whatsapp_phone: '' };
      const result = validateWhatsAppConfig(configWithoutPhone);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('WhatsApp phone number is required when WhatsApp integration is enabled');
    });

    it('should validate phone number format', () => {
      const configWithInvalidPhone = { ...mockConfig, whatsapp_phone: 'invalid' };
      const result = validateWhatsAppConfig(configWithInvalidPhone);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid WhatsApp phone number');
    });

    it('should warn about missing message template', () => {
      const configWithoutTemplate = { ...mockConfig, whatsapp_message_template: '' };
      const result = validateWhatsAppConfig(configWithoutTemplate);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No WhatsApp message template provided. Default template will be used.');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate Pakistani number with country code', () => {
      const result = validatePhoneNumber('+923001234567');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+923001234567');
    });

    it('should normalize Pakistani number without country code', () => {
      const result = validatePhoneNumber('03001234567');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+923001234567');
      expect(result.warning).toContain('Assumed Pakistani country code');
    });

    it('should normalize Pakistani number starting with 0', () => {
      const result = validatePhoneNumber('03001234567');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+923001234567');
    });

    it('should handle formatted numbers', () => {
      const result = validatePhoneNumber('+92 (300) 123-4567');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+923001234567');
    });

    it('should reject empty phone number', () => {
      const result = validatePhoneNumber('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number is required');
    });

    it('should reject too short numbers', () => {
      const result = validatePhoneNumber('+92123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be between 10 and 15 digits');
    });

    it('should reject too long numbers', () => {
      const result = validatePhoneNumber('+921234567890123456');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be between 10 and 15 digits');
    });

    it('should validate Pakistani number length specifically', () => {
      const result = validatePhoneNumber('+92300123456'); // 12 digits instead of 13
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Pakistani phone numbers must be 13 digits total');
    });
  });

  describe('validateMessageTemplate', () => {
    it('should validate correct template', () => {
      const result = validateMessageTemplate('Hi, order {orderNumber} needs help.');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject empty template', () => {
      const result = validateMessageTemplate('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message template is required');
    });

    it('should reject too long template', () => {
      const longTemplate = 'a'.repeat(1001);
      const result = validateMessageTemplate(longTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should warn about invalid variables', () => {
      const result = validateMessageTemplate('Hi, {invalidVariable} and {orderNumber}');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('Unknown template variables: invalidVariable');
    });

    it('should warn about missing order context', () => {
      const result = validateMessageTemplate('Hi, I need help.');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('does not include order number');
    });

    it('should accept all valid variables', () => {
      const template = 'Order {orderNumber} ({orderName}) - Risk: {riskTier} ({riskScore}%) - Failed: {failedAttempts}/{totalOrders} - Type: {customerType}';
      const result = validateMessageTemplate(template);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('generateWhatsAppUrl', () => {
    it('should generate correct WhatsApp URL', () => {
      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message: 'Hello, I need help with order #1001',
      });
      
      expect(url).toBe('https://wa.me/923001234567?text=Hello%2C%20I%20need%20help%20with%20order%20%231001');
    });

    it('should handle phone number normalization', () => {
      const url = generateWhatsAppUrl({
        phoneNumber: '03001234567',
        message: 'Hello',
      });
      
      expect(url).toBe('https://wa.me/923001234567?text=Hello');
    });

    it('should return null for invalid phone number', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const url = generateWhatsAppUrl({
        phoneNumber: 'invalid',
        message: 'Hello',
      });
      
      expect(url).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should properly encode special characters in message', () => {
      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message: 'Hello! Order #1001 & delivery?',
      });
      
      expect(url).toContain('Hello!%20Order%20%231001%20%26%20delivery%3F');
    });
  });

  describe('getDeviceCapabilities', () => {
    it('should detect desktop capabilities', () => {
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      mockWindow.innerWidth = 1024;
      
      const capabilities = getDeviceCapabilities();
      
      expect(capabilities.isMobile).toBe(false);
      expect(capabilities.hasWhatsApp).toBe(false);
      expect(capabilities.hasClipboard).toBe(true);
      expect(capabilities.canMakePhoneCalls).toBe(false);
      expect(capabilities.canSendSMS).toBe(false);
    });

    it('should detect mobile capabilities', () => {
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      mockWindow.innerWidth = 375;
      
      const capabilities = getDeviceCapabilities();
      
      expect(capabilities.isMobile).toBe(true);
      expect(capabilities.hasWhatsApp).toBe(true);
      expect(capabilities.hasClipboard).toBe(true);
      expect(capabilities.canMakePhoneCalls).toBe(true);
      expect(capabilities.canSendSMS).toBe(true);
    });

    it('should detect mobile by screen width', () => {
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      mockWindow.innerWidth = 600; // Mobile width
      
      const capabilities = getDeviceCapabilities();
      
      expect(capabilities.isMobile).toBe(true);
    });

    it('should handle missing clipboard', () => {
      // @ts-ignore
      global.navigator = { ...mockWindow.navigator, clipboard: undefined };
      
      const capabilities = getDeviceCapabilities();
      
      expect(capabilities.hasClipboard).toBe(false);
    });

    it('should handle server-side rendering', () => {
      // @ts-ignore
      global.window = undefined;
      
      const capabilities = getDeviceCapabilities();
      
      expect(capabilities.isMobile).toBe(false);
      expect(capabilities.hasWhatsApp).toBe(false);
      expect(capabilities.hasClipboard).toBe(false);
      expect(capabilities.canMakePhoneCalls).toBe(false);
      expect(capabilities.canSendSMS).toBe(false);
    });
  });

  describe('openWhatsApp', () => {
    it('should open WhatsApp on mobile using location.href', async () => {
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      mockWindow.innerWidth = 375;
      
      const result = await openWhatsApp('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(true);
      expect(mockWindow.location.href).toBe('https://wa.me/923001234567?text=Hello');
    });

    it('should open WhatsApp on desktop using window.open', async () => {
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      mockWindow.innerWidth = 1024;
      mockWindow.open = vi.fn().mockReturnValue({});
      
      const result = await openWhatsApp('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(true);
      expect(mockWindow.open).toHaveBeenCalledWith(
        'https://wa.me/923001234567?text=Hello',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle popup blocking', async () => {
      mockWindow.open = vi.fn().mockReturnValue(null);
      
      const result = await openWhatsApp('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockWindow.open = vi.fn().mockImplementation(() => {
        throw new Error('Popup blocked');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await openWhatsApp('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle server-side rendering', async () => {
      // @ts-ignore
      global.window = undefined;
      
      const result = await openWhatsApp('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(false);
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard successfully', async () => {
      const result = await copyToClipboard('https://wa.me/923001234567?text=Hello');
      
      expect(result).toBe(true);
      expect(mockWindow.navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://wa.me/923001234567?text=Hello'
      );
    });

    it('should handle clipboard errors', async () => {
      mockWindow.navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await copyToClipboard('test text');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing clipboard API', async () => {
      // @ts-ignore
      global.navigator = { ...mockWindow.navigator, clipboard: undefined };
      
      const result = await copyToClipboard('test text');
      
      expect(result).toBe(false);
    });

    it('should handle server-side rendering', async () => {
      // @ts-ignore
      global.window = undefined;
      
      const result = await copyToClipboard('test text');
      
      expect(result).toBe(false);
    });
  });

  describe('createFallbackContactUrls', () => {
    it('should create correct fallback URLs', () => {
      const orderContext = { orderNumber: 'order_123' };
      const urls = createFallbackContactUrls('+923001234567', orderContext);
      
      expect(urls.tel).toBe('tel:+923001234567');
      expect(urls.sms).toContain('sms:+923001234567?body=');
      expect(decodeURIComponent(urls.sms)).toContain('Order order_123');
    });

    it('should normalize phone number for fallback URLs', () => {
      const orderContext = { orderNumber: 'order_123' };
      const urls = createFallbackContactUrls('03001234567', orderContext);
      
      expect(urls.tel).toBe('tel:+923001234567');
      expect(urls.sms).toContain('sms:+923001234567');
    });

    it('should handle formatted phone numbers', () => {
      const orderContext = { orderNumber: 'order_123' };
      const urls = createFallbackContactUrls('+92 (300) 123-4567', orderContext);
      
      expect(urls.tel).toBe('tel:+923001234567');
      expect(urls.sms).toContain('sms:+923001234567');
    });
  });
});