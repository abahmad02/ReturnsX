/**
 * Manual test file to verify WhatsApp integration functionality
 * Run this with: npm run test:run -- src/__tests__/whatsapp-manual-test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateWhatsAppConfig,
  generateWhatsAppUrl,
  validatePhoneNumber,
  validateMessageTemplate,
  getDeviceCapabilities,
} from '../services/whatsappService';
import { ExtensionConfig } from '../types';

describe('WhatsApp Integration Manual Tests', () => {
  const validConfig: ExtensionConfig = {
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

  it('should validate a correct WhatsApp configuration', () => {
    const result = validateWhatsAppConfig(validConfig);
    console.log('✅ Valid config validation:', result);
    expect(result.isValid).toBe(true);
  });

  it('should generate correct WhatsApp URLs', () => {
    const testCases = [
      {
        phone: '+923001234567',
        message: 'Hello World!',
        expected: 'https://wa.me/923001234567?text=Hello%20World!'
      },
      {
        phone: '03001234567',
        message: 'Order #123 needs help',
        expected: 'https://wa.me/923001234567?text=Order%20%23123%20needs%20help'
      }
    ];

    testCases.forEach(({ phone, message, expected }) => {
      const url = generateWhatsAppUrl({ phoneNumber: phone, message });
      console.log(`✅ Generated URL for ${phone}:`, url);
      expect(url).toBe(expected);
    });
  });

  it('should validate phone numbers correctly', () => {
    const testCases = [
      { phone: '+923001234567', shouldBeValid: true },
      { phone: '03001234567', shouldBeValid: true },
      { phone: '+92 (300) 123-4567', shouldBeValid: true },
      { phone: 'invalid', shouldBeValid: false },
      { phone: '', shouldBeValid: false },
    ];

    testCases.forEach(({ phone, shouldBeValid }) => {
      const result = validatePhoneNumber(phone);
      console.log(`✅ Phone validation for "${phone}":`, result);
      expect(result.isValid).toBe(shouldBeValid);
    });
  });

  it('should validate message templates correctly', () => {
    const testCases = [
      { 
        template: 'Hi, order {orderNumber} needs help', 
        shouldBeValid: true 
      },
      { 
        template: 'Order {orderNumber} - Risk: {riskTier} - Failed: {failedAttempts}', 
        shouldBeValid: true 
      },
      { 
        template: '', 
        shouldBeValid: false 
      },
      { 
        template: 'a'.repeat(1001), 
        shouldBeValid: false 
      },
    ];

    testCases.forEach(({ template, shouldBeValid }) => {
      const result = validateMessageTemplate(template);
      console.log(`✅ Template validation for "${template.substring(0, 50)}...":`, result);
      expect(result.isValid).toBe(shouldBeValid);
    });
  });

  it('should detect device capabilities', () => {
    const capabilities = getDeviceCapabilities();
    console.log('✅ Device capabilities:', capabilities);
    
    expect(capabilities).toHaveProperty('isMobile');
    expect(capabilities).toHaveProperty('hasWhatsApp');
    expect(capabilities).toHaveProperty('hasClipboard');
    expect(capabilities).toHaveProperty('canMakePhoneCalls');
    expect(capabilities).toHaveProperty('canSendSMS');
  });

  it('should demonstrate complete WhatsApp flow', () => {
    console.log('\n🚀 Complete WhatsApp Integration Flow:');
    
    // Step 1: Validate configuration
    console.log('\n1. Validating configuration...');
    const configValidation = validateWhatsAppConfig(validConfig);
    console.log('   Config validation:', configValidation.isValid ? '✅ Valid' : '❌ Invalid');
    
    // Step 2: Generate WhatsApp URL with order context
    console.log('\n2. Generating WhatsApp URL...');
    const orderContext = {
      orderNumber: 'ORD-12345',
      failedAttempts: 3,
    };
    
    const message = validConfig.whatsapp_message_template
      .replace('{orderNumber}', orderContext.orderNumber)
      .replace('{failedAttempts}', orderContext.failedAttempts.toString());
    
    const whatsappUrl = generateWhatsAppUrl({
      phoneNumber: validConfig.whatsapp_phone,
      message,
    });
    
    console.log('   Generated URL:', whatsappUrl);
    console.log('   Decoded message:', decodeURIComponent(whatsappUrl!.split('text=')[1]));
    
    // Step 3: Check device capabilities
    console.log('\n3. Checking device capabilities...');
    const capabilities = getDeviceCapabilities();
    console.log('   Mobile device:', capabilities.isMobile ? '📱 Yes' : '💻 No');
    console.log('   WhatsApp available:', capabilities.hasWhatsApp ? '✅ Yes' : '❌ No');
    console.log('   Clipboard available:', capabilities.hasClipboard ? '✅ Yes' : '❌ No');
    
    // Step 4: Demonstrate fallback URLs
    console.log('\n4. Generating fallback contact URLs...');
    const phoneNumber = validConfig.whatsapp_phone;
    const telUrl = `tel:${phoneNumber}`;
    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(`Order ${orderContext.orderNumber}: Need delivery assistance`)}`;
    
    console.log('   Phone call URL:', telUrl);
    console.log('   SMS URL:', smsUrl);
    
    console.log('\n✅ WhatsApp integration is working correctly!');
    
    expect(configValidation.isValid).toBe(true);
    expect(whatsappUrl).toContain('https://wa.me/923001234567');
    expect(whatsappUrl).toContain('ORD-12345');
  });
});