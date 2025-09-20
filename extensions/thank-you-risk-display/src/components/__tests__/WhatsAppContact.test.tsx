import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatsAppContact } from '../WhatsAppContact';
import { ExtensionConfig, RiskProfileResponse } from '../../types';

// Mock Shopify UI Extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children }: any) => <div data-testid="block-stack">{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  InlineLayout: ({ children }: any) => <div data-testid="inline-layout">{children}</div>,
  View: ({ children }: any) => <div data-testid="view">{children}</div>,
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} data-testid="button" {...props}>
      {children}
    </button>
  ),
  Link: ({ children, ...props }: any) => <a data-testid="link" {...props}>{children}</a>,
  useOrder: () => ({
    id: 'order_123',
    name: '#1001',
  }),
}));

describe('WhatsAppContact', () => {
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

  const mockHighRiskProfile: RiskProfileResponse = {
    success: true,
    riskTier: 'HIGH_RISK',
    riskScore: 85,
    totalOrders: 10,
    failedAttempts: 5,
    successfulDeliveries: 5,
    isNewCustomer: false,
    message: 'High risk customer',
    recommendations: ['Confirm delivery address', 'Be available during delivery'],
  };

  const mockOnContact = vi.fn();

  // Mock window and navigator objects
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

  describe('WhatsApp URL Generation', () => {
    it('should generate correct WhatsApp URL with order context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      // Check that window.open was called with correct URL
      expect(mockWindow.open).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/923001234567?text='),
        '_blank',
        'noopener,noreferrer'
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid phone numbers gracefully', () => {
      const configWithInvalidPhone = {
        ...mockConfig,
        whatsapp_phone: 'invalid-phone',
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={configWithInvalidPhone}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid WhatsApp phone number:',
        'invalid-phone'
      );

      consoleSpy.mockRestore();
    });

    it('should substitute template variables correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      const callArgs = mockWindow.open.mock.calls[0][0];
      const decodedMessage = decodeURIComponent(callArgs.split('text=')[1]);
      
      expect(decodedMessage).toContain('order_123');
      expect(decodedMessage).toContain('5 failed deliveries');

      consoleSpy.mockRestore();
    });
  });

  describe('Mobile Device Handling', () => {
    it('should use window.location.href for mobile devices', () => {
      // Mock mobile user agent
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      mockWindow.innerWidth = 375;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      // On mobile, should use window.location.href instead of window.open
      expect(mockWindow.location.href).toContain('https://wa.me/923001234567');

      consoleSpy.mockRestore();
    });

    it('should use window.open for desktop devices', () => {
      // Ensure desktop user agent
      mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      mockWindow.innerWidth = 1024;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(mockWindow.open).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/923001234567'),
        '_blank',
        'noopener,noreferrer'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fallback Contact Methods', () => {
    it('should render alternative contact methods', () => {
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      expect(screen.getByText('Other Ways to Contact Us:')).toBeInTheDocument();
      expect(screen.getByText('Call Support')).toBeInTheDocument();
      expect(screen.getByText('SMS Support')).toBeInTheDocument();
    });

    it('should handle phone call fallback', () => {
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const callButton = screen.getByText('Call Support').closest('button');
      fireEvent.click(callButton!);

      expect(mockWindow.location.href).toBe('tel:+923001234567');
    });

    it('should handle SMS fallback with order context', () => {
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const smsButton = screen.getByText('SMS Support').closest('button');
      fireEvent.click(smsButton!);

      expect(mockWindow.location.href).toContain('sms:+923001234567');
      expect(mockWindow.location.href).toContain('Order%20order_123');
    });

    it('should handle clipboard copy fallback', () => {
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const copyButton = screen.getByText('Copy WhatsApp Link').closest('button');
      fireEvent.click(copyButton!);

      expect(mockWindow.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/923001234567')
      );
    });

    it('should hide copy button when clipboard is not available', () => {
      // @ts-ignore
      global.navigator = { ...mockWindow.navigator, clipboard: undefined };

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      expect(screen.queryByText('Copy WhatsApp Link')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle WhatsApp opening errors gracefully', () => {
      mockWindow.open = vi.fn().mockImplementation(() => {
        throw new Error('Popup blocked');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to open WhatsApp:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle phone call errors gracefully', () => {
      const originalLocation = mockWindow.location;
      mockWindow.location = {
        ...originalLocation,
        set href(value) {
          throw new Error('Navigation blocked');
        },
        get href() {
          return originalLocation.href;
        }
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const callButton = screen.getByText('Call Support').closest('button');
      fireEvent.click(callButton!);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initiate phone call:', expect.any(Error));

      consoleSpy.mockRestore();
      mockWindow.location = originalLocation;
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={true}
        />
      );

      // Should still render the main WhatsApp button
      expect(screen.getByText('Contact via WhatsApp')).toBeInTheDocument();
      
      // Should render compact benefits message
      expect(screen.getByText(/Contact us to confirm delivery details/)).toBeInTheDocument();
    });
  });

  describe('Callback Handling', () => {
    it('should call onContact callback when WhatsApp is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={mockConfig}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(mockOnContact).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe('Phone Number Normalization', () => {
    it('should handle Pakistani numbers without country code', () => {
      const configWithLocalNumber = {
        ...mockConfig,
        whatsapp_phone: '03001234567',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={configWithLocalNumber}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(mockWindow.open).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/923001234567'),
        '_blank',
        'noopener,noreferrer'
      );

      consoleSpy.mockRestore();
    });

    it('should handle numbers with formatting characters', () => {
      const configWithFormattedNumber = {
        ...mockConfig,
        whatsapp_phone: '+92 (300) 123-4567',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <WhatsAppContact
          config={configWithFormattedNumber}
          riskProfile={mockHighRiskProfile}
          onContact={mockOnContact}
          compactMode={false}
        />
      );

      const whatsappButton = screen.getByText('Contact via WhatsApp').closest('button');
      fireEvent.click(whatsappButton!);

      expect(mockWindow.open).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/923001234567'),
        '_blank',
        'noopener,noreferrer'
      );

      consoleSpy.mockRestore();
    });
  });
});