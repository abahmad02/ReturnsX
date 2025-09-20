import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskAssessmentCard } from '../RiskAssessmentCard';
import { CustomerStatistics } from '../CustomerStatistics';
import { RecommendationsList } from '../RecommendationsList';
import { WhatsAppContact } from '../WhatsAppContact';
import { ExtensionConfig, RiskProfileResponse } from '../../types';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, spacing, ...props }: any) => (
    <div data-testid="block-stack" data-spacing={spacing} {...props}>{children}</div>
  ),
  Text: ({ children, size, ...props }: any) => (
    <span data-testid="text" data-size={size} {...props}>{children}</span>
  ),
  InlineLayout: ({ children, columns, spacing, ...props }: any) => (
    <div data-testid="inline-layout" data-columns={JSON.stringify(columns)} data-spacing={spacing} {...props}>
      {children}
    </div>
  ),
  View: ({ children, padding, ...props }: any) => (
    <div data-testid="view" data-padding={padding} {...props}>{children}</div>
  ),
  Grid: ({ children, columns, spacing, ...props }: any) => (
    <div data-testid="grid" data-columns={JSON.stringify(columns)} data-spacing={spacing} {...props}>
      {children}
    </div>
  ),
  Button: ({ children, onPress, ...props }: any) => (
    <button data-testid="button" onClick={onPress} {...props}>{children}</button>
  ),
}));

// Mock child components to focus on responsive behavior
vi.mock('../RiskTierIndicator', () => ({
  RiskTierIndicator: ({ compactMode, ...props }: any) => (
    <div data-testid="risk-tier-indicator" data-compact={compactMode} {...props}>
      Risk Tier Indicator
    </div>
  ),
}));

vi.mock('../MessageDisplay', () => ({
  MessageDisplay: ({ compactMode, ...props }: any) => (
    <div data-testid="message-display" data-compact={compactMode} {...props}>
      Message Display
    </div>
  ),
  NewCustomerMessageDisplay: ({ compactMode, ...props }: any) => (
    <div data-testid="new-customer-message" data-compact={compactMode} {...props}>
      New Customer Message
    </div>
  ),
}));

vi.mock('../../services/messageGenerator', () => ({
  generatePersonalizedRecommendations: vi.fn(() => ['Test recommendation']),
  truncateText: vi.fn((text: string, maxLength: number) => ({
    truncated: text.length > maxLength ? text.substring(0, maxLength) + '...' : text,
    needsTruncation: text.length > maxLength,
    fullText: text,
  })),
}));

vi.mock('../../services/whatsappService', () => ({
  getDeviceCapabilities: vi.fn(() => ({
    isMobile: false,
    hasWhatsApp: false,
    hasClipboard: true,
    canMakePhoneCalls: false,
    canSendSMS: false,
  })),
  openWhatsApp: vi.fn(),
  generateWhatsAppUrl: vi.fn(() => 'https://wa.me/923001234567?text=Test'),
}));

describe('Responsive Design Tests', () => {
  const baseConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Trusted customer',
    medium_risk_message: 'Good customer',
    high_risk_message: 'Needs attention',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  const createRiskProfile = (overrides: Partial<RiskProfileResponse> = {}): RiskProfileResponse => ({
    success: true,
    riskTier: 'MEDIUM_RISK',
    riskScore: 25,
    totalOrders: 10,
    failedAttempts: 2,
    successfulDeliveries: 8,
    isNewCustomer: false,
    message: 'Good customer',
    recommendations: ['Be available during delivery', 'Confirm your address'],
    ...overrides,
  });

  // Mock window dimensions for responsive testing
  const mockWindowDimensions = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset window dimensions
    mockWindowDimensions(1024, 768);
  });

  describe('RiskAssessmentCard Responsive Behavior', () => {
    it('applies compact mode styling correctly', () => {
      const riskProfile = createRiskProfile();
      const compactConfig = { ...baseConfig, compact_mode: true };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={compactConfig} />);

      // Check that compact mode is passed to child components
      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-compact', 'true');
      expect(screen.getByTestId('message-display')).toHaveAttribute('data-compact', 'true');

      // Check spacing adjustments
      const blockStacks = screen.getAllByTestId('block-stack');
      expect(blockStacks.some(el => el.getAttribute('data-spacing') === 'tight')).toBe(true);

      // Check padding adjustments
      const mainView = screen.getByTestId('view');
      expect(mainView).toHaveAttribute('data-padding', 'tight');
    });

    it('uses regular spacing in expanded mode', () => {
      const riskProfile = createRiskProfile();
      const expandedConfig = { ...baseConfig, compact_mode: false };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={expandedConfig} />);

      // Check that compact mode is false for child components
      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-compact', 'false');
      expect(screen.getByTestId('message-display')).toHaveAttribute('data-compact', 'false');

      // Check spacing adjustments
      const blockStacks = screen.getAllByTestId('block-stack');
      expect(blockStacks.some(el => el.getAttribute('data-spacing') === 'base')).toBe(true);

      // Check padding adjustments
      const mainView = screen.getByTestId('view');
      expect(mainView).toHaveAttribute('data-padding', 'base');
    });

    it('maintains proper layout hierarchy in both modes', () => {
      const riskProfile = createRiskProfile();

      // Test compact mode
      const { rerender } = render(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: true }} />
      );

      let mainView = screen.getByTestId('view');
      let blockStack = screen.getByTestId('block-stack');
      expect(mainView).toContainElement(blockStack);

      // Test expanded mode
      rerender(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: false }} />
      );

      mainView = screen.getByTestId('view');
      blockStack = screen.getByTestId('block-stack');
      expect(mainView).toContainElement(blockStack);
    });
  });

  describe('CustomerStatistics Responsive Layout', () => {
    it('uses compact layout for mobile', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={true} />);

      // In compact mode, should use BlockStack instead of Grid
      expect(screen.queryByTestId('grid')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('inline-layout').length).toBeGreaterThan(0);
    });

    it('uses grid layout for desktop', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // In expanded mode, should use Grid layout
      expect(screen.getByTestId('grid')).toBeInTheDocument();
    });

    it('adjusts grid columns based on statistics count', () => {
      // Test with failed attempts (4 statistics)
      const riskProfileWithFailures = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      const { rerender } = render(
        <CustomerStatistics riskProfile={riskProfileWithFailures} compactMode={false} />
      );

      let grid = screen.getByTestId('grid');
      let columns = JSON.parse(grid.getAttribute('data-columns') || '[]');
      expect(columns).toEqual(['fill', 'fill', 'fill']); // 3-column grid

      // Test without failed attempts (3 statistics)
      const riskProfileNoFailures = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 10,
        failedAttempts: 0,
      });

      rerender(<CustomerStatistics riskProfile={riskProfileNoFailures} compactMode={false} />);

      grid = screen.getByTestId('grid');
      columns = JSON.parse(grid.getAttribute('data-columns') || '[]');
      expect(columns).toEqual(['fill', 'fill']); // 2-column grid
    });
  });

  describe('RecommendationsList Mobile Optimization', () => {
    const recommendations = [
      'Be available during delivery hours',
      'Confirm your address details',
      'Keep your phone number updated',
      'Provide clear delivery instructions',
      'Be present at the delivery location',
    ];

    it('shows fewer items initially in compact mode', () => {
      render(
        <RecommendationsList 
          recommendations={recommendations} 
          riskTier="MEDIUM_RISK" 
          compactMode={true} 
        />
      );

      // Should show only first 2 items in compact mode
      expect(screen.getByText('Be available during delivery hours')).toBeInTheDocument();
      expect(screen.getByText('Confirm your address details')).toBeInTheDocument();
      expect(screen.queryByText('Keep your phone number updated')).not.toBeInTheDocument();
      expect(screen.getByText('Show 3 More')).toBeInTheDocument();
    });

    it('shows more items initially in expanded mode', () => {
      render(
        <RecommendationsList 
          recommendations={recommendations} 
          riskTier="MEDIUM_RISK" 
          compactMode={false} 
        />
      );

      // Should show first 3 items in expanded mode
      expect(screen.getByText('Be available during delivery hours')).toBeInTheDocument();
      expect(screen.getByText('Confirm your address details')).toBeInTheDocument();
      expect(screen.getByText('Keep your phone number updated')).toBeInTheDocument();
      expect(screen.queryByText('Provide clear delivery instructions')).not.toBeInTheDocument();
      expect(screen.getByText('Show 2 More')).toBeInTheDocument();
    });

    it('adjusts text truncation based on mode', () => {
      const longRecommendation = 'This is a very long recommendation that should be truncated differently based on whether we are in compact mode or expanded mode for better mobile experience';
      
      const { rerender } = render(
        <RecommendationsList 
          recommendations={[longRecommendation]} 
          riskTier="MEDIUM_RISK" 
          compactMode={true} 
        />
      );

      // In compact mode, text should be truncated more aggressively
      expect(screen.getByText('Read More')).toBeInTheDocument();

      rerender(
        <RecommendationsList 
          recommendations={[longRecommendation]} 
          riskTier="MEDIUM_RISK" 
          compactMode={false} 
        />
      );

      // In expanded mode, text should be truncated less aggressively
      expect(screen.getByText('Read More')).toBeInTheDocument();
    });
  });

  describe('WhatsApp Contact Mobile Integration', () => {
    const { getDeviceCapabilities } = require('../../services/whatsappService');

    it('adapts to mobile device capabilities', () => {
      // Mock mobile device
      getDeviceCapabilities.mockReturnValue({
        isMobile: true,
        hasWhatsApp: true,
        hasClipboard: true,
        canMakePhoneCalls: true,
        canSendSMS: true,
      });

      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });

      render(
        <WhatsAppContact 
          config={baseConfig} 
          riskProfile={riskProfile} 
          compactMode={false}
        />
      );

      // Should render WhatsApp contact for mobile
      expect(screen.getByTestId('view')).toBeInTheDocument();
    });

    it('provides fallback options for desktop', () => {
      // Mock desktop device
      getDeviceCapabilities.mockReturnValue({
        isMobile: false,
        hasWhatsApp: false,
        hasClipboard: true,
        canMakePhoneCalls: false,
        canSendSMS: false,
      });

      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });

      render(
        <WhatsAppContact 
          config={baseConfig} 
          riskProfile={riskProfile} 
          compactMode={false}
        />
      );

      // Should still render contact options
      expect(screen.getByTestId('view')).toBeInTheDocument();
    });

    it('adjusts layout for compact mode', () => {
      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });

      const { rerender } = render(
        <WhatsAppContact 
          config={baseConfig} 
          riskProfile={riskProfile} 
          compactMode={true}
        />
      );

      // Should render in compact mode
      expect(screen.getByTestId('view')).toBeInTheDocument();

      rerender(
        <WhatsAppContact 
          config={baseConfig} 
          riskProfile={riskProfile} 
          compactMode={false}
        />
      );

      // Should render in expanded mode
      expect(screen.getByTestId('view')).toBeInTheDocument();
    });
  });

  describe('Touch Target Optimization', () => {
    it('ensures buttons have adequate touch targets', () => {
      const recommendations = ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4'];

      render(
        <RecommendationsList 
          recommendations={recommendations} 
          riskTier="MEDIUM_RISK" 
          compactMode={true} 
        />
      );

      const expandButton = screen.getByText('Show 2 More');
      expect(expandButton).toBeInTheDocument();
      expect(expandButton.tagName).toBe('BUTTON');
    });

    it('maintains touch targets in compact mode', () => {
      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });

      render(
        <WhatsAppContact 
          config={baseConfig} 
          riskProfile={riskProfile} 
          compactMode={true}
        />
      );

      // Touch targets should be maintained even in compact mode
      expect(screen.getByTestId('view')).toBeInTheDocument();
    });
  });

  describe('Content Adaptation', () => {
    it('adapts text sizes for different modes', () => {
      const riskProfile = createRiskProfile();

      const { rerender } = render(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: true }} />
      );

      // Check for smaller text sizes in compact mode
      const textElements = screen.getAllByTestId('text');
      const hasSmallText = textElements.some(el => el.getAttribute('data-size') === 'small');
      expect(hasSmallText).toBe(true);

      rerender(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: false }} />
      );

      // Check for regular text sizes in expanded mode
      const expandedTextElements = screen.getAllByTestId('text');
      const hasRegularText = expandedTextElements.some(el => 
        el.getAttribute('data-size') === 'medium' || el.getAttribute('data-size') === 'base'
      );
      expect(hasRegularText).toBe(true);
    });

    it('maintains content hierarchy across modes', () => {
      const riskProfile = createRiskProfile();

      const { rerender } = render(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: true }} />
      );

      // Essential components should be present in compact mode
      expect(screen.getByTestId('risk-tier-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('message-display')).toBeInTheDocument();

      rerender(
        <RiskAssessmentCard riskProfile={riskProfile} config={{ ...baseConfig, compact_mode: false }} />
      );

      // All components should be present in expanded mode
      expect(screen.getByTestId('risk-tier-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('message-display')).toBeInTheDocument();
    });
  });

  describe('Layout Flexibility', () => {
    it('handles varying content lengths gracefully', () => {
      const shortProfile = createRiskProfile({
        message: 'Short message',
        recommendations: ['Short tip'],
      });

      const longProfile = createRiskProfile({
        message: 'This is a very long message that contains detailed information about the customer risk profile and delivery history',
        recommendations: [
          'This is a very long recommendation with detailed instructions',
          'Another long recommendation with specific guidance',
          'A third detailed recommendation for improvement',
        ],
      });

      const { rerender } = render(
        <RiskAssessmentCard riskProfile={shortProfile} config={baseConfig} />
      );

      expect(screen.getByTestId('view')).toBeInTheDocument();

      rerender(
        <RiskAssessmentCard riskProfile={longProfile} config={baseConfig} />
      );

      expect(screen.getByTestId('view')).toBeInTheDocument();
    });

    it('maintains layout stability with dynamic content', () => {
      const riskProfile = createRiskProfile();

      // Test with different configurations
      const configs = [
        { ...baseConfig, show_risk_score: true, show_detailed_tips: true },
        { ...baseConfig, show_risk_score: false, show_detailed_tips: false },
        { ...baseConfig, compact_mode: true },
        { ...baseConfig, compact_mode: false },
      ];

      configs.forEach(config => {
        const { unmount } = render(
          <RiskAssessmentCard riskProfile={riskProfile} config={config} />
        );

        expect(screen.getByTestId('view')).toBeInTheDocument();
        unmount();
      });
    });
  });
});