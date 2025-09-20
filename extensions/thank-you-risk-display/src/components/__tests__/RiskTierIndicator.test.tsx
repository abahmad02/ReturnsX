import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskTierIndicator } from '../RiskTierIndicator';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Grid: ({ children, ...props }: any) => <div data-testid="grid" {...props}>{children}</div>,
}));

describe('RiskTierIndicator', () => {
  const defaultProps = {
    riskTier: 'ZERO_RISK' as const,
    riskScore: 5,
    showScore: true,
    useColorCoding: true,
    compactMode: false,
    isNewCustomer: false,
  };

  describe('Zero Risk Customer', () => {
    it('displays correct label and icon for zero risk', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" />);

      expect(screen.getByText('Trusted Customer')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
      expect(screen.getByText('Excellent delivery record')).toBeInTheDocument();
    });

    it('shows risk score when enabled', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" riskScore={3} showScore={true} />);

      expect(screen.getByText('3%')).toBeInTheDocument();
    });

    it('hides risk score when disabled', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" riskScore={3} showScore={false} />);

      expect(screen.queryByText('3%')).not.toBeInTheDocument();
    });

    it('displays success rate progress bar in expanded mode', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" riskScore={5} compactMode={false} />);

      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument(); // 100 - 5 = 95%
    });
  });

  describe('Medium Risk Customer', () => {
    it('displays correct label and icon for medium risk', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="MEDIUM_RISK" />);

      expect(screen.getByText('Good Customer')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText('Reliable with room for improvement')).toBeInTheDocument();
    });

    it('calculates success rate correctly for medium risk', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="MEDIUM_RISK" riskScore={30} compactMode={false} />);

      expect(screen.getByText('70%')).toBeInTheDocument(); // 100 - 30 = 70%
    });
  });

  describe('High Risk Customer', () => {
    it('displays correct label and icon for high risk', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="HIGH_RISK" />);

      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('🚨')).toBeInTheDocument();
      expect(screen.getByText('Multiple delivery challenges')).toBeInTheDocument();
    });

    it('shows low success rate for high risk customer', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="HIGH_RISK" riskScore={80} compactMode={false} />);

      expect(screen.getByText('20%')).toBeInTheDocument(); // 100 - 80 = 20%
    });
  });

  describe('New Customer', () => {
    it('displays new customer label and icon', () => {
      render(<RiskTierIndicator {...defaultProps} isNewCustomer={true} />);

      expect(screen.getByText('New Customer')).toBeInTheDocument();
      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.getByText('Building your delivery profile')).toBeInTheDocument();
    });

    it('hides risk score for new customers', () => {
      render(<RiskTierIndicator {...defaultProps} isNewCustomer={true} riskScore={0} showScore={true} />);

      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });

    it('hides progress bar for new customers', () => {
      render(<RiskTierIndicator {...defaultProps} isNewCustomer={true} compactMode={false} />);

      expect(screen.queryByText('Success Rate')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('hides description in compact mode', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" compactMode={true} />);

      expect(screen.queryByText('Excellent delivery record')).not.toBeInTheDocument();
    });

    it('hides progress bar in compact mode', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" compactMode={true} />);

      expect(screen.queryByText('Success Rate')).not.toBeInTheDocument();
    });

    it('shows description in expanded mode', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" compactMode={false} />);

      expect(screen.getByText('Excellent delivery record')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('applies color coding when enabled', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" useColorCoding={true} />);

      // The component should render without errors when color coding is enabled
      expect(screen.getByText('Trusted Customer')).toBeInTheDocument();
    });

    it('uses subdued appearance when color coding is disabled', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="HIGH_RISK" useColorCoding={false} />);

      // The component should render without errors when color coding is disabled
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper accessibility labels', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="ZERO_RISK" />);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Risk level: Trusted Customer. Excellent delivery record'
      );
    });

    it('provides accessibility labels for new customers', () => {
      render(<RiskTierIndicator {...defaultProps} isNewCustomer={true} />);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Risk level: New Customer. Building your delivery profile'
      );
    });

    it('provides accessibility labels for high risk customers', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier="HIGH_RISK" />);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Risk level: Needs Attention. Multiple delivery challenges'
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined risk score gracefully', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={undefined} showScore={true} />);

      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });

    it('handles zero risk score', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={0} compactMode={false} />);

      expect(screen.getByText('100%')).toBeInTheDocument(); // 100 - 0 = 100%
    });

    it('handles maximum risk score', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={100} compactMode={false} />);

      expect(screen.getByText('0%')).toBeInTheDocument(); // 100 - 100 = 0%
    });

    it('handles invalid risk tier gracefully', () => {
      render(<RiskTierIndicator {...defaultProps} riskTier={'INVALID_TIER' as any} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('Risk assessment unavailable')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Component', () => {
    it('displays correct progress bar for high success rate', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={10} compactMode={false} />);

      // Should show 90% success rate with mostly filled progress bar
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('displays correct progress bar for low success rate', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={90} compactMode={false} />);

      // Should show 10% success rate with mostly empty progress bar
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('handles negative risk scores by showing 100% success', () => {
      render(<RiskTierIndicator {...defaultProps} riskScore={-10} compactMode={false} />);

      // Should cap at 100% success rate
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});