import { describe, it, expect } from 'vitest';
import {
  generateMessage,
  generatePersonalizedRecommendations,
  truncateText,
  formatMessage,
  MessageContext
} from '../messageGenerator';
import { ExtensionConfig, RiskProfileResponse, ErrorType } from '../../types';

// Mock configuration for testing
const mockConfig: ExtensionConfig = {
  api_endpoint: 'https://api.returnsx.com',
  enable_debug_mode: false,
  show_detailed_tips: true,
  zero_risk_message: 'Custom zero risk message',
  medium_risk_message: 'Custom medium risk message',
  high_risk_message: 'Custom high risk message',
  whatsapp_enabled: true,
  whatsapp_phone: '+923001234567',
  whatsapp_message_template: 'Hello, I need help with order {orderNumber}',
  show_risk_score: true,
  use_color_coding: true,
  compact_mode: false
};

// Mock risk profiles for testing
const mockZeroRiskProfile: RiskProfileResponse = {
  success: true,
  riskTier: 'ZERO_RISK',
  riskScore: 95,
  totalOrders: 10,
  failedAttempts: 0,
  successfulDeliveries: 10,
  isNewCustomer: false,
  message: 'API zero risk message',
  recommendations: ['Keep up the good work', 'Consider express delivery']
};

const mockMediumRiskProfile: RiskProfileResponse = {
  success: true,
  riskTier: 'MEDIUM_RISK',
  riskScore: 70,
  totalOrders: 8,
  failedAttempts: 2,
  successfulDeliveries: 6,
  isNewCustomer: false,
  message: 'API medium risk message',
  recommendations: ['Be available for delivery', 'Update your address']
};

const mockHighRiskProfile: RiskProfileResponse = {
  success: true,
  riskTier: 'HIGH_RISK',
  riskScore: 30,
  totalOrders: 10,
  failedAttempts: 7,
  successfulDeliveries: 3,
  isNewCustomer: false,
  message: 'API high risk message',
  recommendations: ['Verify delivery address', 'Be available during delivery window']
};

const mockNewCustomerProfile: RiskProfileResponse = {
  success: true,
  riskTier: 'ZERO_RISK',
  riskScore: 100,
  totalOrders: 0,
  failedAttempts: 0,
  successfulDeliveries: 0,
  isNewCustomer: true,
  message: 'Welcome new customer'
};

describe('Message Generator Service', () => {
  describe('generateMessage', () => {
    it('should generate zero risk message with custom config', () => {
      const context: MessageContext = {
        riskProfile: mockZeroRiskProfile,
        config: mockConfig
      };

      const result = generateMessage(context);

      expect(result.primary).toBe(mockConfig.zero_risk_message);
      expect(result.tone).toBe('positive');
      expect(result.recommendations).toEqual(mockZeroRiskProfile.recommendations);
    });

    it('should generate medium risk message with API fallback', () => {
      const configWithoutCustomMessage = { ...mockConfig, medium_risk_message: '' };
      const context: MessageContext = {
        riskProfile: mockMediumRiskProfile,
        config: configWithoutCustomMessage
      };

      const result = generateMessage(context);

      expect(result.primary).toBe(mockMediumRiskProfile.message);
      expect(result.tone).toBe('neutral');
    });

    it('should generate high risk message with call to action', () => {
      const context: MessageContext = {
        riskProfile: mockHighRiskProfile,
        config: mockConfig
      };

      const result = generateMessage(context);

      expect(result.primary).toBe(mockConfig.high_risk_message);
      expect(result.tone).toBe('critical');
      expect(result.callToAction).toBeDefined();
    });

    it('should generate new customer message', () => {
      const context: MessageContext = {
        riskProfile: mockNewCustomerProfile,
        config: mockConfig
      };

      const result = generateMessage(context);

      expect(result.tone).toBe('positive');
      expect(result.recommendations).toBeDefined();
    });

    it('should generate error message when no risk profile', () => {
      const context: MessageContext = {
        config: mockConfig,
        error: {
          type: ErrorType.NETWORK_ERROR,
          message: 'Network connection failed',
          retryable: true
        }
      };

      const result = generateMessage(context);

      expect(result.tone).toBe('neutral');
      expect(result.primary).toContain('Thank you for your order');
    });

    it('should handle different error types', () => {
      const timeoutContext: MessageContext = {
        config: mockConfig,
        error: {
          type: ErrorType.TIMEOUT_ERROR,
          message: 'Request timed out',
          retryable: true
        }
      };

      const result = generateMessage(timeoutContext);

      expect(result.secondary).toContain('running slowly');
    });
  });

  describe('generatePersonalizedRecommendations', () => {
    it('should add personalized recommendations for high failure rate', () => {
      const recommendations = generatePersonalizedRecommendations(mockHighRiskProfile, mockConfig);

      expect(recommendations.length).toBeGreaterThan(mockHighRiskProfile.recommendations?.length || 0);
      expect(recommendations.some(rec => rec.includes('7 failed delivery attempts'))).toBe(true);
    });

    it('should add success rate recommendations', () => {
      const lowSuccessProfile = {
        ...mockMediumRiskProfile,
        totalOrders: 10,
        successfulDeliveries: 3
      };

      const recommendations = generatePersonalizedRecommendations(lowSuccessProfile, mockConfig);

      expect(recommendations.some(rec => rec.includes('success rate is 30%'))).toBe(true);
    });

    it('should not duplicate recommendations', () => {
      const recommendations = generatePersonalizedRecommendations(mockZeroRiskProfile, mockConfig);
      const uniqueRecommendations = Array.from(new Set(recommendations));

      expect(recommendations.length).toBe(uniqueRecommendations.length);
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      const shortText = 'This is short';
      const result = truncateText(shortText, 100);

      expect(result.needsTruncation).toBe(false);
      expect(result.truncated).toBe(shortText);
      expect(result.fullText).toBe(shortText);
    });

    it('should truncate long text at word boundary', () => {
      const longText = 'This is a very long text that should be truncated at a word boundary to avoid cutting words in half';
      const result = truncateText(longText, 50);

      expect(result.needsTruncation).toBe(true);
      expect(result.truncated.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.truncated.endsWith('...')).toBe(true);
      expect(result.fullText).toBe(longText);
    });

    it('should handle text without spaces', () => {
      const noSpaceText = 'Thisisaverylongtextwithoutanyspacesthatshouldbetruncat';
      const result = truncateText(noSpaceText, 20);

      expect(result.needsTruncation).toBe(true);
      expect(result.truncated).toBe(noSpaceText.substring(0, 20) + '...');
    });
  });

  describe('formatMessage', () => {
    it('should replace customer name placeholder', () => {
      const template = 'Hello {customerName}, thank you for your order!';
      const context: MessageContext = {
        config: mockConfig,
        customerName: 'John Doe'
      };

      const result = formatMessage(template, context);

      expect(result).toBe('Hello John Doe, thank you for your order!');
    });

    it('should replace order number placeholder', () => {
      const template = 'Your order {orderNumber} is being processed';
      const context: MessageContext = {
        config: mockConfig,
        orderNumber: 'ORD-12345'
      };

      const result = formatMessage(template, context);

      expect(result).toBe('Your order ORD-12345 is being processed');
    });

    it('should replace risk profile placeholders', () => {
      const template = 'Success rate: {successRate}%, Total orders: {totalOrders}, Failed: {failedAttempts}';
      const context: MessageContext = {
        config: mockConfig,
        riskProfile: mockMediumRiskProfile
      };

      const result = formatMessage(template, context);

      expect(result).toBe('Success rate: 75%, Total orders: 8, Failed: 2');
    });

    it('should handle missing placeholders gracefully', () => {
      const template = 'Hello {customerName}, your order {orderNumber} is ready';
      const context: MessageContext = {
        config: mockConfig
      };

      const result = formatMessage(template, context);

      expect(result).toBe(template); // Should remain unchanged
    });

    it('should replace multiple instances of same placeholder', () => {
      const template = '{customerName} ordered item for {customerName}';
      const context: MessageContext = {
        config: mockConfig,
        customerName: 'Jane'
      };

      const result = formatMessage(template, context);

      expect(result).toBe('Jane ordered item for Jane');
    });
  });
});

describe('Message Generation Edge Cases', () => {
  it('should handle empty recommendations array', () => {
    const profileWithoutRecommendations = {
      ...mockZeroRiskProfile,
      recommendations: []
    };

    const context: MessageContext = {
      riskProfile: profileWithoutRecommendations,
      config: mockConfig
    };

    const result = generateMessage(context);

    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('should handle undefined recommendations', () => {
    const profileWithoutRecommendations = {
      ...mockZeroRiskProfile,
      recommendations: undefined
    };

    const context: MessageContext = {
      riskProfile: profileWithoutRecommendations,
      config: mockConfig
    };

    const result = generateMessage(context);

    expect(result.recommendations).toBeDefined();
  });

  it('should handle zero division in success rate calculation', () => {
    const zeroOrderProfile = {
      ...mockNewCustomerProfile,
      totalOrders: 0,
      successfulDeliveries: 0
    };

    const recommendations = generatePersonalizedRecommendations(zeroOrderProfile, mockConfig);

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('should handle very long custom messages', () => {
    const veryLongMessage = 'A'.repeat(500);
    const configWithLongMessage = {
      ...mockConfig,
      zero_risk_message: veryLongMessage
    };

    const context: MessageContext = {
      riskProfile: mockZeroRiskProfile,
      config: configWithLongMessage
    };

    const result = generateMessage(context);

    expect(result.primary).toBe(veryLongMessage);
  });
});