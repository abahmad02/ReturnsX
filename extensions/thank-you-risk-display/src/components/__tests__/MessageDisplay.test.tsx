import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  MessageDisplay, 
  CompactMessageDisplay, 
  ErrorMessageDisplay, 
  NewCustomerMessageDisplay 
} from '../MessageDisplay';
import { ExtensionConfig, RiskProfileResponse, ErrorType } from '../../types';

// Mock the message generator service
const mockGenerateMessage = vi.fn();
const mockGeneratePersonalizedRecommendations = vi.fn();
const mockTruncateText = vi.fn();
const mockFormatMessage = vi.fn();

vi.mock('../../services/messageGenerator', () => ({
  generateMessage: mockGenerateMessage,
  generatePersonalizedRecommendations: mockGeneratePersonalizedRecommendations,
  truncateText: mockTruncateText,
  formatMessage: mockFormatMessage
}));

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

const mockRiskProfile: RiskProfileResponse = {
  success: true,
  riskTier: 'MEDIUM_RISK',
  riskScore: 70,
  totalOrders: 8,
  failedAttempts: 2,
  successfulDeliveries: 6,
  isNewCustomer: false,
  message: 'Test risk profile message',
  recommendations: ['Test recommendation 1', 'Test recommendation 2']
};

describe('MessageDisplay Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockGenerateMessage.mockReturnValue({
      primary: 'Test primary message',
      secondary: 'Test secondary message',
      recommendations: ['Test recommendation 1', 'Test recommendation 2'],
      tone: 'positive'
    });
    
    mockTruncateText.mockImplementation((text: string, maxLength: number) => ({
      truncated: text.length > maxLength ? text.substring(0, maxLength) + '...' : text,
      needsTruncation: text.length > maxLength,
      fullText: text
    }));
    
    mockFormatMessage.mockImplementation((template: string) => template);
  });

  it('should render primary message', () => {
    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    expect(screen.getByText('Test primary message')).toBeInTheDocument();
  });

  it('should render secondary message when provided', () => {
    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    expect(screen.getByText('Test secondary message')).toBeInTheDocument();
  });

  it('should handle compact mode', () => {
    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
        compactMode={true}
      />
    );

    // Should still render the message but with different styling
    expect(screen.getByText('Test primary message')).toBeInTheDocument();
  });

  it('should handle long text with truncation', () => {
    const longMessage = 'A'.repeat(200);
    
    // Mock truncateText to return truncated result
    mockTruncateText.mockReturnValue({
      truncated: longMessage.substring(0, 100) + '...',
      needsTruncation: true,
      fullText: longMessage
    });

    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    // Should show "Read More" button for truncated content
    expect(screen.getByText('Read More')).toBeInTheDocument();
  });

  it('should expand text when "Read More" is clicked', () => {
    const longMessage = 'A'.repeat(200);
    
    // Mock truncateText to return truncated result
    mockTruncateText.mockReturnValue({
      truncated: longMessage.substring(0, 100) + '...',
      needsTruncation: true,
      fullText: longMessage
    });

    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    const readMoreButton = screen.getByText('Read More');
    fireEvent.click(readMoreButton);

    expect(screen.getByText('Show Less')).toBeInTheDocument();
  });

  it('should handle customer name and order number placeholders', () => {
    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
        customerName="John Doe"
        orderNumber="ORD-12345"
      />
    );

    // The formatMessage mock should be called with the context
    expect(mockFormatMessage).toHaveBeenCalled();
  });
});

describe('CompactMessageDisplay Component', () => {
  it('should render compact message with icon', () => {
    render(
      <CompactMessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    expect(screen.getByText('Test primary message')).toBeInTheDocument();
  });

  it('should use appropriate icon for message tone', () => {
    // Test critical tone
    mockGenerateMessage.mockReturnValue({
      primary: 'Critical message',
      tone: 'critical'
    });

    render(
      <CompactMessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });
});

describe('ErrorMessageDisplay Component', () => {
  const mockError = {
    type: ErrorType.NETWORK_ERROR,
    message: 'Network connection failed',
    retryable: true
  };

  it('should render error message', () => {
    render(
      <ErrorMessageDisplay
        error={mockError}
        config={mockConfig}
      />
    );

    expect(screen.getByText('Test primary message')).toBeInTheDocument();
  });

  it('should show retry button for retryable errors', () => {
    const mockRetry = vi.fn();

    render(
      <ErrorMessageDisplay
        error={mockError}
        config={mockConfig}
        onRetry={mockRetry}
      />
    );

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalled();
  });

  it('should not show retry button for non-retryable errors', () => {
    const nonRetryableError = {
      ...mockError,
      retryable: false
    };

    render(
      <ErrorMessageDisplay
        error={nonRetryableError}
        config={mockConfig}
      />
    );

    expect(screen.queryByText('Try Again')).toBeNull();
  });

  it('should show debug information when debug mode is enabled', () => {
    const debugConfig = {
      ...mockConfig,
      enable_debug_mode: true
    };

    render(
      <ErrorMessageDisplay
        error={mockError}
        config={debugConfig}
      />
    );

    expect(screen.getByText(/Debug:/)).toBeInTheDocument();
  });
});

describe('NewCustomerMessageDisplay Component', () => {
  it('should render welcome message for new customers', () => {
    render(
      <NewCustomerMessageDisplay
        config={mockConfig}
      />
    );

    expect(screen.getByText('Test primary message')).toBeInTheDocument();
  });

  it('should show getting started tips in non-compact mode', () => {
    mockGenerateMessage.mockReturnValue({
      primary: 'Welcome message',
      secondary: 'Welcome description',
      recommendations: ['Tip 1', 'Tip 2', 'Tip 3'],
      tone: 'positive'
    });

    render(
      <NewCustomerMessageDisplay
        config={mockConfig}
        compactMode={false}
      />
    );

    expect(screen.getByText('📋 Getting Started Tips:')).toBeInTheDocument();
    expect(screen.getByText('Tip 1')).toBeInTheDocument();
    expect(screen.getByText('Tip 2')).toBeInTheDocument();
    expect(screen.getByText('Tip 3')).toBeInTheDocument();
  });

  it('should not show tips in compact mode', () => {
    render(
      <NewCustomerMessageDisplay
        config={mockConfig}
        compactMode={true}
      />
    );

    expect(screen.queryByText('📋 Getting Started Tips:')).toBeNull();
  });

  it('should handle customer name personalization', () => {
    render(
      <NewCustomerMessageDisplay
        config={mockConfig}
        customerName="Jane Doe"
        orderNumber="ORD-67890"
      />
    );

    expect(mockFormatMessage).toHaveBeenCalled();
  });
});

describe('Message Display Accessibility', () => {
  it('should have proper accessibility labels for read more buttons', () => {
    const longMessage = 'A'.repeat(200);
    
    mockTruncateText.mockReturnValue({
      truncated: longMessage.substring(0, 100) + '...',
      needsTruncation: true,
      fullText: longMessage
    });

    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    const readMoreButton = screen.getByLabelText('Show full main message');
    expect(readMoreButton).toBeInTheDocument();
  });

  it('should update accessibility label when expanded', () => {
    const longMessage = 'A'.repeat(200);
    
    mockTruncateText.mockReturnValue({
      truncated: longMessage.substring(0, 100) + '...',
      needsTruncation: true,
      fullText: longMessage
    });

    render(
      <MessageDisplay
        riskProfile={mockRiskProfile}
        config={mockConfig}
      />
    );

    const readMoreButton = screen.getByLabelText('Show full main message');
    fireEvent.click(readMoreButton);

    expect(screen.getByLabelText('Show less of main message')).toBeInTheDocument();
  });
});