import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecommendationsList, RecommendationsSummary } from '../RecommendationsList';

// Mock the Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Button: ({ children, onPress, ...props }: any) => (
    <button data-testid="button" onClick={onPress} {...props}>{children}</button>
  ),
}));

// Mock the message generator service
vi.mock('../../services/messageGenerator', () => ({
  truncateText: vi.fn((text: string, maxLength: number) => {
    if (text.length <= maxLength) {
      return {
        truncated: text,
        needsTruncation: false,
        fullText: text,
      };
    }
    return {
      truncated: text.substring(0, maxLength) + '...',
      needsTruncation: true,
      fullText: text,
    };
  }),
}));

describe('RecommendationsList', () => {
  const defaultProps = {
    recommendations: [
      'Be available during delivery hours',
      'Confirm your address details',
      'Keep your phone number updated',
    ],
    riskTier: 'MEDIUM_RISK',
    compactMode: false,
  };

  describe('Basic Rendering', () => {
    it('renders recommendations list with header', () => {
      render(<RecommendationsList {...defaultProps} />);

      expect(screen.getByText('Tips for Improvement')).toBeInTheDocument();
      expect(screen.getByText('💡')).toBeInTheDocument();
      expect(screen.getByText('Be available during delivery hours')).toBeInTheDocument();
      expect(screen.getByText('Confirm your address details')).toBeInTheDocument();
      expect(screen.getByText('Keep your phone number updated')).toBeInTheDocument();
    });

    it('displays all recommendations when count is within limit', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2'],
      };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Tip 1')).toBeInTheDocument();
      expect(screen.getByText('Tip 2')).toBeInTheDocument();
      expect(screen.queryByText(/Show.*More/)).not.toBeInTheDocument();
    });
  });

  describe('Risk Tier Styling', () => {
    it('displays high risk styling and header', () => {
      const props = { ...defaultProps, riskTier: 'HIGH_RISK' };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Important Recommendations')).toBeInTheDocument();
      expect(screen.getByText('🚨')).toBeInTheDocument();
      expect(screen.getByText('🎯 Priority Action Required')).toBeInTheDocument();
    });

    it('displays medium risk styling and header', () => {
      const props = { ...defaultProps, riskTier: 'MEDIUM_RISK' };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Tips for Improvement')).toBeInTheDocument();
      expect(screen.getByText('💡')).toBeInTheDocument();
      expect(screen.queryByText('Priority Action Required')).not.toBeInTheDocument();
    });

    it('displays zero risk styling and header', () => {
      const props = { ...defaultProps, riskTier: 'ZERO_RISK' };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Keep Up the Great Work')).toBeInTheDocument();
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('displays default styling for unknown risk tier', () => {
      const props = { ...defaultProps, riskTier: 'UNKNOWN_TIER' };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('📋')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('shows expand button when there are more than 3 recommendations', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Show 2 More')).toBeInTheDocument();
      expect(screen.getByText('Tip 1')).toBeInTheDocument();
      expect(screen.getByText('Tip 2')).toBeInTheDocument();
      expect(screen.getByText('Tip 3')).toBeInTheDocument();
      expect(screen.queryByText('Tip 4')).not.toBeInTheDocument();
      expect(screen.queryByText('Tip 5')).not.toBeInTheDocument();
    });

    it('expands to show all recommendations when expand button is clicked', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      };

      render(<RecommendationsList {...props} />);

      const expandButton = screen.getByText('Show 2 More');
      fireEvent.click(expandButton);

      expect(screen.getByText('Tip 4')).toBeInTheDocument();
      expect(screen.getByText('Tip 5')).toBeInTheDocument();
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    it('collapses recommendations when show less is clicked', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      };

      render(<RecommendationsList {...props} />);

      // Expand first
      fireEvent.click(screen.getByText('Show 2 More'));
      expect(screen.getByText('Tip 4')).toBeInTheDocument();

      // Then collapse
      fireEvent.click(screen.getByText('Show Less'));
      expect(screen.queryByText('Tip 4')).not.toBeInTheDocument();
      expect(screen.getByText('Show 2 More')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('shows fewer initial items in compact mode', () => {
      const props = {
        ...defaultProps,
        compactMode: true,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4'],
      };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Tip 1')).toBeInTheDocument();
      expect(screen.getByText('Tip 2')).toBeInTheDocument();
      expect(screen.queryByText('Tip 3')).not.toBeInTheDocument();
      expect(screen.getByText('Show 2 More')).toBeInTheDocument();
    });

    it('hides priority action section in compact mode', () => {
      const props = {
        ...defaultProps,
        riskTier: 'HIGH_RISK',
        compactMode: true,
      };

      render(<RecommendationsList {...props} />);

      expect(screen.queryByText('Priority Action Required')).not.toBeInTheDocument();
    });
  });

  describe('Priority Indicators', () => {
    it('shows high priority indicators for high-risk customers', () => {
      const props = {
        ...defaultProps,
        riskTier: 'HIGH_RISK',
        recommendations: ['Critical tip', 'Important tip', 'Regular tip'],
      };

      render(<RecommendationsList {...props} />);

      // First two items should have fire emoji for high priority
      const fireEmojis = screen.getAllByText('🔥');
      expect(fireEmojis).toHaveLength(2);
    });

    it('shows star indicator for top recommendation', () => {
      render(<RecommendationsList {...defaultProps} />);

      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('shows bullet points for regular recommendations', () => {
      render(<RecommendationsList {...defaultProps} />);

      const bullets = screen.getAllByText('•');
      expect(bullets.length).toBeGreaterThan(0);
    });
  });

  describe('Text Truncation', () => {
    it('truncates long recommendations and shows read more button', () => {
      const longRecommendation = 'This is a very long recommendation that should be truncated because it exceeds the maximum length limit for display in the component and needs a read more button';
      
      const props = {
        ...defaultProps,
        recommendations: [longRecommendation],
      };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Read More')).toBeInTheDocument();
    });

    it('expands truncated text when read more is clicked', () => {
      const longRecommendation = 'This is a very long recommendation that should be truncated because it exceeds the maximum length limit for display in the component and needs a read more button';
      
      const props = {
        ...defaultProps,
        recommendations: [longRecommendation],
      };

      render(<RecommendationsList {...props} />);

      const readMoreButton = screen.getByText('Read More');
      fireEvent.click(readMoreButton);

      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper accessibility labels for expand button', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      };

      render(<RecommendationsList {...props} />);

      const expandButton = screen.getByLabelText('Show 2 more recommendations');
      expect(expandButton).toBeInTheDocument();
    });

    it('provides proper accessibility labels for collapse button', () => {
      const props = {
        ...defaultProps,
        recommendations: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      };

      render(<RecommendationsList {...props} />);

      fireEvent.click(screen.getByText('Show 2 More'));
      
      const collapseButton = screen.getByLabelText('Show fewer recommendations');
      expect(collapseButton).toBeInTheDocument();
    });

    it('provides accessibility labels for read more buttons', () => {
      const longRecommendation = 'This is a very long recommendation that should be truncated';
      
      const props = {
        ...defaultProps,
        recommendations: [longRecommendation],
      };

      render(<RecommendationsList {...props} />);

      const readMoreButton = screen.getByLabelText('Show full recommendation');
      expect(readMoreButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty recommendations array', () => {
      const props = { ...defaultProps, recommendations: [] };

      expect(() => {
        render(<RecommendationsList {...props} />);
      }).not.toThrow();
    });

    it('handles single recommendation', () => {
      const props = { ...defaultProps, recommendations: ['Single tip'] };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Single tip')).toBeInTheDocument();
      expect(screen.queryByText(/Show.*More/)).not.toBeInTheDocument();
    });

    it('handles very long recommendation list', () => {
      const manyRecommendations = Array.from({ length: 20 }, (_, i) => `Tip ${i + 1}`);
      const props = { ...defaultProps, recommendations: manyRecommendations };

      render(<RecommendationsList {...props} />);

      expect(screen.getByText('Show 17 More')).toBeInTheDocument();
    });
  });
});

describe('RecommendationsSummary', () => {
  it('renders summary with top recommendation', () => {
    const recommendations = ['Top tip', 'Second tip', 'Third tip'];

    render(<RecommendationsSummary recommendations={recommendations} riskTier="MEDIUM_RISK" />);

    expect(screen.getByText('Quick Tip')).toBeInTheDocument();
    expect(screen.getByText('Top tip')).toBeInTheDocument();
    expect(screen.getByText('+2 more tips available')).toBeInTheDocument();
  });

  it('shows singular form for one additional tip', () => {
    const recommendations = ['Top tip', 'Second tip'];

    render(<RecommendationsSummary recommendations={recommendations} riskTier="MEDIUM_RISK" />);

    expect(screen.getByText('+1 more tip available')).toBeInTheDocument();
  });

  it('hides additional count when only one recommendation', () => {
    const recommendations = ['Only tip'];

    render(<RecommendationsSummary recommendations={recommendations} riskTier="MEDIUM_RISK" />);

    expect(screen.getByText('Only tip')).toBeInTheDocument();
    expect(screen.queryByText(/more tip/)).not.toBeInTheDocument();
  });

  it('returns null for empty recommendations', () => {
    const { container } = render(
      <RecommendationsSummary recommendations={[]} riskTier="MEDIUM_RISK" />
    );

    expect(container.firstChild).toBeNull();
  });
});