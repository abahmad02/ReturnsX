/**
 * Unit tests for sanitization utilities
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeCustomMessage,
  sanitizeWhatsAppTemplate,
  sanitizeCssClasses,
  sanitizePhoneForDisplay,
  sanitizeEmailForDisplay,
  sanitizeOrderIdForDisplay,
  sanitizeErrorMessage,
  sanitizeDebugInfo,
  sanitizeJsonInput,
  sanitizeUrlParams,
  sanitizeConfigForDisplay
} from '../sanitization';

describe('sanitizeHtml', () => {
  it('should remove HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello world');
  });

  it('should escape special characters', () => {
    const input = 'Hello & "world" <script>';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello &amp; &quot;world&quot;');
  });

  it('should remove control characters', () => {
    const input = 'Hello\x00\x01world\x7F';
    const result = sanitizeHtml(input);
    expect(result).toBe('Helloworld');
  });

  it('should normalize whitespace', () => {
    const input = 'Hello    \n\n   world   ';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello world');
  });

  it('should handle non-string input', () => {
    expect(sanitizeHtml(null as any)).toBe('');
    expect(sanitizeHtml(123 as any)).toBe('');
    expect(sanitizeHtml(undefined as any)).toBe('');
  });
});

describe('sanitizeText', () => {
  it('should preserve normal text', () => {
    const input = 'Hello world!';
    const result = sanitizeText(input);
    expect(result).toBe(input);
  });

  it('should remove control characters', () => {
    const input = 'Hello\x00world\x1F';
    const result = sanitizeText(input);
    expect(result).toBe('Helloworld');
  });

  it('should normalize line breaks', () => {
    const input = 'Line 1\r\nLine 2\rLine 3\nLine 4';
    const result = sanitizeText(input);
    expect(result).toBe('Line 1\nLine 2\nLine 3\nLine 4');
  });

  it('should limit consecutive newlines', () => {
    const input = 'Line 1\n\n\n\n\nLine 2';
    const result = sanitizeText(input);
    expect(result).toBe('Line 1\n\nLine 2');
  });
});

describe('sanitizeCustomMessage', () => {
  it('should sanitize and truncate long messages', () => {
    const longMessage = 'a'.repeat(600);
    const result = sanitizeCustomMessage(longMessage, 500);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should remove HTML from custom messages', () => {
    const input = '<script>alert("xss")</script>Hello world';
    const result = sanitizeCustomMessage(input);
    expect(result).toBe('alert(&quot;xss&quot;)Hello world');
  });

  it('should handle non-string input', () => {
    expect(sanitizeCustomMessage(null as any)).toBe('');
    expect(sanitizeCustomMessage(123 as any)).toBe('');
  });
});

describe('sanitizeWhatsAppTemplate', () => {
  it('should preserve valid placeholders', () => {
    const template = 'Order {orderNumber} failed {failedAttempts} times';
    const result = sanitizeWhatsAppTemplate(template);
    expect(result).toBe(template);
  });

  it('should remove invalid placeholders', () => {
    const template = 'Order {orderNumber} with {invalidPlaceholder}';
    const result = sanitizeWhatsAppTemplate(template);
    expect(result).toBe('Order {orderNumber} with');
  });

  it('should truncate long templates', () => {
    const longTemplate = 'a'.repeat(1100);
    const result = sanitizeWhatsAppTemplate(longTemplate);
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle non-string input', () => {
    expect(sanitizeWhatsAppTemplate(null as any)).toBe('');
    expect(sanitizeWhatsAppTemplate(123 as any)).toBe('');
  });
});

describe('sanitizeCssClasses', () => {
  it('should preserve valid CSS class names', () => {
    const classes = 'btn btn-primary my-class_name';
    const result = sanitizeCssClasses(classes);
    expect(result).toBe(classes);
  });

  it('should remove invalid CSS class names', () => {
    const classes = 'valid-class 123invalid @invalid #invalid';
    const result = sanitizeCssClasses(classes);
    expect(result).toBe('valid-class');
  });

  it('should handle empty input', () => {
    expect(sanitizeCssClasses('')).toBe('');
    expect(sanitizeCssClasses('   ')).toBe('');
  });

  it('should handle non-string input', () => {
    expect(sanitizeCssClasses(null as any)).toBe('');
    expect(sanitizeCssClasses(123 as any)).toBe('');
  });
});

describe('sanitizePhoneForDisplay', () => {
  it('should mask phone numbers properly', () => {
    const phone = '+923001234567';
    const result = sanitizePhoneForDisplay(phone);
    expect(result).toBe('+92******4567');
  });

  it('should handle short phone numbers', () => {
    const phone = '123';
    const result = sanitizePhoneForDisplay(phone);
    expect(result).toBe('***');
  });

  it('should handle phone without country code', () => {
    const phone = '3001234567';
    const result = sanitizePhoneForDisplay(phone);
    expect(result).toBe('******4567');
  });

  it('should handle non-string input', () => {
    expect(sanitizePhoneForDisplay(null as any)).toBe('');
    expect(sanitizePhoneForDisplay(123 as any)).toBe('');
  });
});

describe('sanitizeEmailForDisplay', () => {
  it('should mask email addresses properly', () => {
    const email = 'test@example.com';
    const result = sanitizeEmailForDisplay(email);
    expect(result).toBe('t**t@*******.com');
  });

  it('should handle short local parts', () => {
    const email = 'a@example.com';
    const result = sanitizeEmailForDisplay(email);
    expect(result).toBe('*@*******.com');
  });

  it('should handle invalid email format', () => {
    const email = 'invalid-email';
    const result = sanitizeEmailForDisplay(email);
    expect(result).toBe('***@***.***');
  });

  it('should handle non-string input', () => {
    expect(sanitizeEmailForDisplay(null as any)).toBe('');
    expect(sanitizeEmailForDisplay(123 as any)).toBe('');
  });
});

describe('sanitizeOrderIdForDisplay', () => {
  it('should mask order IDs properly', () => {
    const orderId = '1234567890';
    const result = sanitizeOrderIdForDisplay(orderId);
    expect(result).toBe('12****7890');
  });

  it('should handle short order IDs', () => {
    const orderId = '123';
    const result = sanitizeOrderIdForDisplay(orderId);
    expect(result).toBe('123');
  });

  it('should handle non-string input', () => {
    expect(sanitizeOrderIdForDisplay(null as any)).toBe('');
    expect(sanitizeOrderIdForDisplay(123 as any)).toBe('');
  });
});

describe('sanitizeErrorMessage', () => {
  it('should preserve safe error messages', () => {
    const error = 'Network connection failed';
    const result = sanitizeErrorMessage(error);
    expect(result).toBe(error);
  });

  it('should redact sensitive information', () => {
    const error = 'Authentication failed with token: abc123xyz';
    const result = sanitizeErrorMessage(error);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('abc123xyz');
  });

  it('should redact API keys', () => {
    const error = 'Invalid api_key: secret123';
    const result = sanitizeErrorMessage(error);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('secret123');
  });

  it('should truncate long error messages', () => {
    const longError = 'Error: ' + 'a'.repeat(300);
    const result = sanitizeErrorMessage(longError);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle non-string input', () => {
    expect(sanitizeErrorMessage(null as any)).toBe('An unknown error occurred');
    expect(sanitizeErrorMessage(123 as any)).toBe('An unknown error occurred');
  });
});

describe('sanitizeDebugInfo', () => {
  it('should redact sensitive fields in objects', () => {
    const info = {
      username: 'john',
      password: 'secret123',
      token: 'abc123',
      phone: '+923001234567',
      normalField: 'safe value'
    };

    const result = sanitizeDebugInfo(info);
    expect(result.username).toBe('john');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.phone).toBe('[REDACTED]');
    expect(result.normalField).toBe('safe value');
  });

  it('should handle nested objects', () => {
    const info = {
      user: {
        name: 'john',
        auth_token: 'secret123'
      },
      config: {
        api_key: 'key123',
        timeout: 5000
      }
    };

    const result = sanitizeDebugInfo(info);
    expect(result.user.name).toBe('john');
    expect(result.user.auth_token).toBe('[REDACTED]');
    expect(result.config.api_key).toBe('[REDACTED]');
    expect(result.config.timeout).toBe(5000);
  });

  it('should handle arrays', () => {
    const info = [
      { name: 'item1', secret: 'secret1' },
      { name: 'item2', secret: 'secret2' }
    ];

    const result = sanitizeDebugInfo(info);
    expect(result[0].name).toBe('item1');
    expect(result[0].secret).toBe('[REDACTED]');
    expect(result[1].name).toBe('item2');
    expect(result[1].secret).toBe('[REDACTED]');
  });

  it('should handle primitive values', () => {
    expect(sanitizeDebugInfo('string')).toBe('string');
    expect(sanitizeDebugInfo(123)).toBe(123);
    expect(sanitizeDebugInfo(null)).toBe(null);
  });
});

describe('sanitizeJsonInput', () => {
  it('should parse valid JSON', () => {
    const json = '{"name": "test", "value": 123}';
    const result = sanitizeJsonInput(json);
    
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual({ name: 'test', value: 123 });
  });

  it('should reject invalid JSON', () => {
    const json = '{"name": "test", invalid}';
    const result = sanitizeJsonInput(json);
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should sanitize input before parsing', () => {
    const json = '  {"name": "test"}  ';
    const result = sanitizeJsonInput(json);
    
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual({ name: 'test' });
  });

  it('should handle non-string input', () => {
    const result = sanitizeJsonInput(123 as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Input must be a string');
  });
});

describe('sanitizeUrlParams', () => {
  it('should sanitize valid parameters', () => {
    const params = {
      name: 'test value',
      id: '123',
      category: 'electronics'
    };

    const result = sanitizeUrlParams(params);
    expect(result.name).toBe('test%20value');
    expect(result.id).toBe('123');
    expect(result.category).toBe('electronics');
  });

  it('should reject invalid parameter names', () => {
    const params = {
      'valid-name': 'value1',
      'invalid@name': 'value2',
      'another_valid': 'value3'
    };

    const result = sanitizeUrlParams(params);
    expect(result['valid-name']).toBe('value1');
    expect(result['invalid@name']).toBeUndefined();
    expect(result['another_valid']).toBe('value3');
  });

  it('should handle empty values', () => {
    const params = {
      name: '',
      value: 'test'
    };

    const result = sanitizeUrlParams(params);
    expect(result.name).toBeUndefined();
    expect(result.value).toBe('test');
  });
});

describe('sanitizeConfigForDisplay', () => {
  it('should mask sensitive configuration values', () => {
    const config = {
      api_endpoint: 'https://api.example.com',
      auth_token: 'secret123token',
      whatsapp_phone: '+923001234567',
      timeout: 5000
    };

    const result = sanitizeConfigForDisplay(config);
    expect(result.api_endpoint).toBe('https://api.example.com');
    expect(result.auth_token).toBe('se**********en');
    expect(result.whatsapp_phone).toBe('+9*********67');
    expect(result.timeout).toBe(5000);
  });

  it('should handle short sensitive values', () => {
    const config = {
      auth_token: 'abc',
      secret: 'xy'
    };

    const result = sanitizeConfigForDisplay(config);
    expect(result.auth_token).toBe('***');
    expect(result.secret).toBe('**');
  });

  it('should handle non-object input', () => {
    expect(sanitizeConfigForDisplay(null)).toBe(null);
    expect(sanitizeConfigForDisplay('string')).toBe('string');
    expect(sanitizeConfigForDisplay(123)).toBe(123);
  });
});