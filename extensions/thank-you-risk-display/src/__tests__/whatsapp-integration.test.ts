import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateWhatsAppConfig,
  generateWhatsAppUrl,
  getDeviceCapabilities,
} from '../services/whatsappService';
import { ExtensionConfig } from '../types';

describe('WhatsApp Integration', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Zero risk message',
    medium_risk_message: 'Medium risk message',
    high_risk_message: 'High risk message',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with my order {orderNumber}. I have {failedAttempts} failed deliveries.',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End WhatsApp Flow', () => {
    it('should validate config, generate URL, and detect capabilities', () => {
      // Step 1: Validate configuration
      const configValidation = validateWhatsAppConfig(mockConfig);
      expect(configValidation.isValid).toBe(true);
      expect(configValidation.errors).toHaveLength(0);

      // Step 2: Generate WhatsApp URL
      const orderContext = {
        orderNumber: 'order_123',
        failedAttempts: 5,
      };
      
      const message = mockConfig.whatsapp_message_template
        .replace('{orderNumber}', orderContext.orderNumber)
        .replace('{failedAttempts}', orderContext.failedAttempts.toString());

      const whatsappUrl = generateWhatsAppUrl({
        phoneNumber: mockConfig.whatsapp_phone,
        message,
      });

      expect(whatsappUrl).toBe('https://wa.me/923001234567?text=Hi%2C%20I%20need%20help%20with%20my%20order%20order_123.%20I%20have%205%20failed%20deliveries.');

      // Step 3: Check device capabilities
      const capabilities = getDeviceCapabilities();
      expect(capabilities).toHaveProperty('isMobile');
      expect(capabilities).toHaveProperty('hasWhatsApp');
      expect(capabilities).toHaveProperty('hasClipboard');
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...mockConfig,
        whatsapp_phone: 'invalid-phone',
      };

      const configValidation = validateWhatsAppConfig(invalidConfig);
      console.log('Validation result:', configValidation);
      expect(configValidation.isValid).toBe(false);
      expect(configValidation.errors).toContain(
        expect.stringContaining('Invalid WhatsApp phone number')
      );
    });

    it('should generate proper URLs for different phone formats', () => {
      const testCases = [
        {
          input: '+923001234567',
          expected: '923001234567',
        },
        {
          input: '03001234567',
          expected: '923001234567',
        },
        {
          input: '+92 (300) 123-4567',
          expected: '923001234567',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const url = generateWhatsAppUrl({
          phoneNumber: input,
          message: 'Test message',
        });
        
        expect(url).toContain(`https://wa.me/${expected}`);
      });
    });

    it('should handle message template variables correctly', () => {
      const template = 'Order {orderNumber} - Risk: {riskTier} - Failed: {failedAttempts}/{totalOrders}';
      const context = {
        orderNumber: 'ORD-123',
        riskTier: 'HIGH_RISK',
        failedAttempts: 3,
        totalOrders: 10,
      };

      const message = template
        .replace(/{orderNumber}/g, context.orderNumber)
        .replace(/{riskTier}/g, context.riskTier)
        .replace(/{failedAttempts}/g, context.failedAttempts.toString())
        .replace(/{totalOrders}/g, context.totalOrders.toString());

      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message,
      });

      const decodedMessage = decodeURIComponent(url!.split('text=')[1]);
      expect(decodedMessage).toBe('Order ORD-123 - Risk: HIGH_RISK - Failed: 3/10');
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    it('should handle disabled WhatsApp correctly', () => {
      const disabledConfig = {
        ...mockConfig,
        whatsapp_enabled: false,
        whatsapp_phone: '', // Empty phone should be OK when disabled
      };

      const validation = validateWhatsAppConfig(disabledConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should validate message template length', () => {
      const configWithLongTemplate = {
        ...mockConfig,
        whatsapp_message_template: 'a'.repeat(1001), // Too long
      };

      const validation = validateWhatsAppConfig(configWithLongTemplate);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringContaining('too long')
      );
    });

    it('should warn about unknown template variables', () => {
      const configWithInvalidVars = {
        ...mockConfig,
        whatsapp_message_template: 'Order {orderNumber} with {unknownVariable}',
      };

      const validation = validateWhatsAppConfig(configWithInvalidVars);
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain(
        expect.stringContaining('Unknown template variables: unknownVariable')
      );
    });
  });

  describe('URL Generation Edge Cases', () => {
    it('should handle special characters in messages', () => {
      const message = 'Order #123: Need help! 50% discount & free delivery?';
      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message,
      });

      expect(url).toContain('Order%20%23123%3A%20Need%20help!%2050%25%20discount%20%26%20free%20delivery%3F');
    });

    it('should handle empty messages', () => {
      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message: '',
      });

      expect(url).toBe('https://wa.me/923001234567?text=');
    });

    it('should handle very long messages', () => {
      const longMessage = 'This is a very long message. '.repeat(100);
      const url = generateWhatsAppUrl({
        phoneNumber: '+923001234567',
        message: longMessage,
      });

      expect(url).toContain('https://wa.me/923001234567?text=');
      expect(url!.length).toBeGreaterThan(100);
    });
  });
});