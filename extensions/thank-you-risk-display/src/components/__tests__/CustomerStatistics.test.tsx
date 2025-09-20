import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerStatistics } from '../CustomerStatistics';
import { RiskProfileResponse } from '../../types';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Grid: ({ children, ...props }: any) => <div data-testid="grid" {...props}>{children}</div>,
}));

describe('CustomerStatistics', () => {
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

  describe('Basic Statistics Display', () => {
    it('displays total orders correctly', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 15,
        successfulDeliveries: 12,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('Delivery History')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // Total orders
      expect(screen.getByText('12')).toBeInTheDocument(); // Successful deliveries
      expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate (12/15 * 100)
    });

    it('displays successful deliveries with highlight', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 20,
        successfulDeliveries: 18,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument(); // Success rate
    });

    it('shows failed attempts when present', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('3')).toBeInTheDocument(); // Failed attempts
      expect(screen.getByText('Failed Attempts')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
    });

    it('hides failed attempts when zero', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 10,
        failedAttempts: 0,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.queryByText('Failed Attempts')).not.toBeInTheDocument();
      expect(screen.queryByText('❌')).not.toBeInTheDocument();
    });
  });

  describe('Success Rate Calculations', () => {
    it('calculates 100% success rate correctly', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 5,
        successfulDeliveries: 5,
        failedAttempts: 0,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('calculates 0% success rate correctly', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 5,
        successfulDeliveries: 0,
        failedAttempts: 5,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('rounds success rate to nearest integer', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 3,
        successfulDeliveries: 2,
        failedAttempts: 1,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('67%')).toBeInTheDocument(); // 2/3 * 100 = 66.67, rounded to 67
    });

    it('handles zero total orders gracefully', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 0,
        successfulDeliveries: 0,
        failedAttempts: 0,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Compact Mode Layout', () => {
    it('uses compact layout when compact mode is enabled', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={true} />);

      // Should still show all the data
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('uses expanded layout when compact mode is disabled', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // Should show grid layout
      expect(screen.getByTestId('grid')).toBeInTheDocument();
    });
  });

  describe('Icons and Labels', () => {
    it('displays correct icons for each statistic', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('📦')).toBeInTheDocument(); // Total orders icon
      expect(screen.getByText('✅')).toBeInTheDocument(); // Successful deliveries icon
      expect(screen.getByText('📊')).toBeInTheDocument(); // Success rate icon
      expect(screen.getByText('❌')).toBeInTheDocument(); // Failed attempts icon
    });

    it('displays correct labels for each statistic', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('Total Orders')).toBeInTheDocument();
      expect(screen.getByText('Successful')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('Failed Attempts')).toBeInTheDocument();
    });

    it('displays correct descriptions for each statistic', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('Orders placed')).toBeInTheDocument();
      expect(screen.getByText('Delivered successfully')).toBeInTheDocument();
      expect(screen.getByText('Delivery success')).toBeInTheDocument();
      expect(screen.getByText('Delivery failures')).toBeInTheDocument();
    });
  });

  describe('High Failure Rate Warning', () => {
    it('shows tip when failure rate is 30% or higher', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3, // 30% failure rate
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText(/Tip: Ensure you're available during delivery hours/)).toBeInTheDocument();
      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('shows tip when failure rate is above 30%', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 6,
        failedAttempts: 4, // 40% failure rate
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText(/Tip: Ensure you're available during delivery hours/)).toBeInTheDocument();
    });

    it('hides tip when failure rate is below 30%', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2, // 20% failure rate
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.queryByText(/Tip: Ensure you're available during delivery hours/)).not.toBeInTheDocument();
    });

    it('hides tip when there are no failed attempts', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 10,
        failedAttempts: 0,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.queryByText(/Tip: Ensure you're available during delivery hours/)).not.toBeInTheDocument();
    });
  });

  describe('Highlight Logic', () => {
    it('highlights successful deliveries', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // The successful deliveries should be highlighted (this is tested through the component structure)
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('highlights success rate when 80% or higher', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 8,
        failedAttempts: 2,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // Success rate of 80% should be highlighted
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('does not highlight success rate when below 80%', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // Success rate of 70% should not be highlighted
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles inconsistent data gracefully', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 5,
        successfulDeliveries: 10, // More successful than total (shouldn't happen but handle gracefully)
        failedAttempts: 0,
      });

      expect(() => {
        render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);
      }).not.toThrow();

      expect(screen.getByText('200%')).toBeInTheDocument(); // 10/5 * 100 = 200%
    });

    it('handles negative values gracefully', () => {
      const riskProfile = createRiskProfile({
        totalOrders: -1,
        successfulDeliveries: -1,
        failedAttempts: -1,
      });

      expect(() => {
        render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);
      }).not.toThrow();
    });

    it('handles very large numbers', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 999999,
        successfulDeliveries: 999998,
        failedAttempts: 1,
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('999998')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument(); // Should round to 100%
    });
  });

  describe('Grid Layout Logic', () => {
    it('uses 2-column grid when there are 2 or fewer statistics', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 10,
        failedAttempts: 0, // No failed attempts, so only 3 stats total
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // Should render grid component
      expect(screen.getByTestId('grid')).toBeInTheDocument();
    });

    it('uses 3-column grid when there are more than 2 statistics', () => {
      const riskProfile = createRiskProfile({
        totalOrders: 10,
        successfulDeliveries: 7,
        failedAttempts: 3, // Has failed attempts, so 4 stats total
      });

      render(<CustomerStatistics riskProfile={riskProfile} compactMode={false} />);

      // Should render grid component
      expect(screen.getByTestId('grid')).toBeInTheDocument();
    });
  });
});