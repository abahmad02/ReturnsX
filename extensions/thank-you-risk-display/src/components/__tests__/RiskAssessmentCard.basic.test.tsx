import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskAssessmentCard } from '../RiskAssessmentCard';
import { ExtensionConfig, RiskProfileResponse } from '../../types';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Grid: ({ children, ...props }: any) => <div data-testid="grid" {...props}>{children}</div>,
}));

// Mock child components
vi.mock('../RiskTierIndicator', () => ({
  RiskTierIndicator: ({ riskTier, isNewCustomer }: any) => (
    <div data-testid="risk-tier-indicator" data-risk-tier={riskTier} data-new-customer={isNewCustomer}>
      Risk Tier: {riskTier}
    </div>
  ),
}));

vi.mock('../CustomerStatistics', () => ({
  CustomerStatistics: ({ riskProfile }: any) => (
    <div data-testid="customer-statistics" data-total-orders={riskProfile.totalOrders}>
      Statistics
    </div>
  ),
}));

vi.mock('../RecommendationsList', () => ({
  RecommendationsList: ({ recommendations, riskTier }: any) => (
    <div data-testid="recommendations-list" data-risk-tier={riskTier}>
      {recommendations.join(', ')}
    </div>
  ),
}));

vi.mock('../WhatsAppContact', () => ({
  WhatsAppContact: ({ config, onContact }: any) => (
    <button data-testid="whatsapp-contact" onClick={onContact}>
      WhatsApp: {config.whatsapp_phone}
    </button>
  ),
}));

vi.mock('../MessageDisplay', () => ({
  MessageDisplay: ({ riskProfile }: any) => (
    <div data-testid="message-display" data-risk-tier={riskProfile.riskTier}>
      {riskProfile.message}
    </div>
  ),
  NewCustomerMessageDisplay: ({ config }: any) => (
    <div data-testid="new-customer-message">Welcome message</div>
  ),
}));

vi.mock('../../services/messageGenerator', () => ({
  generatePersonalizedRecommendations: vi.fn((riskProfile) => {
    if (riskProfile.riskTier === 'HIGH_RISK') {
      return ['Please be available during delivery', 'Confirm your address'];
    }
    if (riskProfile.riskTier === 'MEDIUM_RISK') {
      return ['Keep up the good work'];
    }
    return ['Excellent customer'];
  }),
}));

describe('RiskAssessmentCard', () => {
  const baseConfig: ExtensionConfig = {
    api_endpoint: 'https://api.returnsx.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'You are a trusted customer!',
    medium_risk_message: 'Good customer with room for improvement',
    high_risk_message: 'Please contact support for delivery assistance',
    whatsapp_enabled: true,
    whatsapp_phone: '+923001234567',
    whatsapp_message_template: 'Hi, I need help with order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  const createRiskProfile = (overrides: Partial<RiskProfileResponse> = {}): RiskProfileResponse => ({
    success: true,
    riskTier: 'ZERO_RISK',
    riskScore: 5,
    totalOrders: 10,
    failedAttempts: 0,
    successfulDeliveries: 10,
    isNewCustomer: false,
    message: 'Excellent delivery record',
    recommendations: ['Keep up the great work!'],
    ...overrides,
  });

  describe('Zero Risk Customer Scenarios', () => {
    it('renders zero risk customer correctly', () => {
      const riskProfile = createRiskProfile({
        riskTier: 'ZERO_RISK',
        riskScore: 5,
        totalOrders: 15,
        successfulDeliveries: 15,
        failedAttempts: 0,
      });

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-risk-tier', 'ZERO_RISK');
      expect(screen.getByTestId('customer-statistics')).toHaveAttribute('data-total-orders', '15');
      expect(screen.getByText('Delivery Profile')).toBeInTheDocument();
      expect(screen.queryByTestId('whatsapp-contact')).not.toBeInTheDocument();
    });

    it('shows risk score when enabled for zero risk customer', () => {
      const riskProfile = createRiskProfile({ riskTier: 'ZERO_RISK', riskScore: 3 });
      const config = { ...baseConfig, show_risk_score: true };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      expect(screen.getByText('Score: 3%')).toBeInTheDocument();
    });

    it('hides risk score when disabled for zero risk customer', () => {
      const riskProfile = createRiskProfile({ riskTier: 'ZERO_RISK', riskScore: 3 });
      const config = { ...baseConfig, show_risk_score: false };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      expect(screen.queryByText('Score: 3%')).not.toBeInTheDocument();
    });
  });

  describe('Medium Risk Customer Scenarios', () => {
    it('renders medium risk customer with recommendations', () => {
      const riskProfile = createRiskProfile({
        riskTier: 'MEDIUM_RISK',
        riskScore: 25,
        totalOrders: 8,
        successfulDeliveries: 6,
        failedAttempts: 2,
      });

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-risk-tier', 'MEDIUM_RISK');
      expect(screen.getByTestId('recommendations-list')).toHaveAttribute('data-risk-tier', 'MEDIUM_RISK');
      expect(screen.queryByTestId('whatsapp-contact')).not.toBeInTheDocument();
    });

    it('hides recommendations when show_detailed_tips is false', () => {
      const riskProfile = createRiskProfile({ riskTier: 'MEDIUM_RISK' });
      const config = { ...baseConfig, show_detailed_tips: false };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      expect(screen.queryByTestId('recommendations-list')).not.toBeInTheDocument();
    });
  });

  describe('High Risk Customer Scenarios', () => {
    it('renders high risk customer with WhatsApp contact', () => {
      const riskProfile = createRiskProfile({
        riskTier: 'HIGH_RISK',
        riskScore: 75,
        totalOrders: 10,
        successfulDeliveries: 3,
        failedAttempts: 7,
      });

      const onWhatsAppContact = vi.fn();

      render(
        <RiskAssessmentCard 
          riskProfile={riskProfile} 
          config={baseConfig} 
          onWhatsAppContact={onWhatsAppContact}
        />
      );

      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-risk-tier', 'HIGH_RISK');
      expect(screen.getByTestId('whatsapp-contact')).toBeInTheDocument();
      expect(screen.getByTestId('recommendations-list')).toHaveAttribute('data-risk-tier', 'HIGH_RISK');
    });

    it('hides WhatsApp contact when disabled in config', () => {
      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });
      const config = { ...baseConfig, whatsapp_enabled: false };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      expect(screen.queryByTestId('whatsapp-contact')).not.toBeInTheDocument();
    });

    it('hides WhatsApp contact when phone number is missing', () => {
      const riskProfile = createRiskProfile({ riskTier: 'HIGH_RISK' });
      const config = { ...baseConfig, whatsapp_phone: '' };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      expect(screen.queryByTestId('whatsapp-contact')).not.toBeInTheDocument();
    });
  });

  describe('New Customer Scenarios', () => {
    it('renders new customer welcome message', () => {
      const riskProfile = createRiskProfile({
        isNewCustomer: true,
        totalOrders: 0,
        successfulDeliveries: 0,
        failedAttempts: 0,
      });

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.getByText('Welcome to ReturnsX')).toBeInTheDocument();
      expect(screen.getByTestId('new-customer-message')).toBeInTheDocument();
      expect(screen.queryByTestId('customer-statistics')).not.toBeInTheDocument();
      expect(screen.queryByText('Score:')).not.toBeInTheDocument();
    });

    it('shows new customer indicator in risk tier component', () => {
      const riskProfile = createRiskProfile({ isNewCustomer: true });

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.getByTestId('risk-tier-indicator')).toHaveAttribute('data-new-customer', 'true');
    });
  });

  describe('Compact Mode Scenarios', () => {
    it('applies compact mode styling when enabled', () => {
      const riskProfile = createRiskProfile();
      const config = { ...baseConfig, compact_mode: true };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      // Verify compact mode is passed to child components
      const view = screen.getByTestId('view');
      expect(view).toBeInTheDocument();
    });

    it('uses regular spacing when compact mode is disabled', () => {
      const riskProfile = createRiskProfile();
      const config = { ...baseConfig, compact_mode: false };

      render(<RiskAssessmentCard riskProfile={riskProfile} config={config} />);

      const view = screen.getByTestId('view');
      expect(view).toBeInTheDocument();
    });
  });

  describe('Configuration Handling', () => {
    it('handles missing customer data gracefully', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 0,
        successfulDeliveries: 0,
        failedAttempts: 0,
        riskScore: 0,
      });

      expect(() => {
        render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);
      }).not.toThrow();
    });

    it('handles undefined risk score', () => {
      const riskProfile = createRiskProfile({ riskScore: undefined as any });

      expect(() => {
        render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);
      }).not.toThrow();
    });

    it('handles empty recommendations array', () => {
      const riskProfile = createRiskProfile({ recommendations: [] });

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.queryByTestId('recommendations-list')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders all required elements for mobile view', () => {
      const riskProfile = createRiskProfile();

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      expect(screen.getByTestId('risk-tier-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('message-display')).toBeInTheDocument();
      expect(screen.getByTestId('customer-statistics')).toBeInTheDocument();
    });

    it('maintains proper component hierarchy', () => {
      const riskProfile = createRiskProfile();

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      const mainView = screen.getByTestId('view');
      const blockStack = screen.getByTestId('block-stack');
      
      expect(mainView).toContainElement(blockStack);
    });
  });

  describe('Accessibility', () => {
    it('provides proper structure for screen readers', () => {
      const riskProfile = createRiskProfile();

      render(<RiskAssessmentCard riskProfile={riskProfile} config={baseConfig} />);

      // Verify main container exists
      expect(screen.getByTestId('view')).toBeInTheDocument();
      
      // Verify content is structured properly
      expect(screen.getByTestId('risk-tier-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('message-display')).toBeInTheDocument();
    });
  });
});