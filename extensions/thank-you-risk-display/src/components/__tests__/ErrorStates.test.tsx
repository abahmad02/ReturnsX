import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorStateComponent } from '../ErrorStates';
import { ErrorType, ErrorState, ExtensionConfig } from '../../types';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} data-testid="button" {...props}>{children}</button>
  ),
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
}));

describe('ErrorStateComponent', () => {
  const mockConfig: ExtensionConfig = {
    api_endpoint: 'https://api.example.com',
    enable_debug_mode: false,
    show_detailed_tips: true,
    zero_risk_message: 'Welcome!',
    medium_risk_message: 'Good customer',
    high_risk_message: 'Please contact us',
    whatsapp_enabled: true,
    whatsapp_phone: '+1234567890',
    whatsapp_message_template: 'Hello, order {orderNumber}',
    show_risk_score: true,
    use_color_coding: true,
    compact_mode: false,
  };

  const mockOnRetry = jest.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Error State', () => {
    const networkError: ErrorState = {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network connection failed',
      retryable: true,
    };

    it('renders network error in normal mode', () => {
      render(
        <ErrorStateComponent 
          error={networkError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('🌐 Connection Issue')).toBeInTheDocument();
      expect(screen.getByText(/having trouble connecting/)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('renders network error in compact mode', () => {
      render(
        <ErrorStateComponent 
          error={networkError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
          compactMode={true}
        />
      );

      expect(screen.getByText('⚠️ Connection issue')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      render(
        <ErrorStateComponent 
          error={networkError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
        />
      );

      fireEvent.click(screen.getByText('Try Again'));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('shows debug information when debug mode is enabled', () => {
      const debugConfig = { ...mockConfig, enable_debug_mode: true };
      
      render(
        <ErrorStateComponent 
          error={networkError} 
          config={debugConfig} 
        />
      );

      expect(screen.getByText(/Debug:/)).toBeInTheDocument();
      expect(screen.getByText(networkError.message)).toBeInTheDocument();
    });
  });

  describe('Timeout Error State', () => {
    const timeoutError: ErrorState = {
      type: ErrorType.TIMEOUT_ERROR,
      message: 'Request timed out',
      retryable: true,
    };

    it('renders timeout error correctly', () => {
      render(
        <ErrorStateComponent 
          error={timeoutError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('⏱️ Request Timed Out')).toBeInTheDocument();
      expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument();
    });

    it('renders timeout error in compact mode', () => {
      render(
        <ErrorStateComponent 
          error={timeoutError} 
          config={mockConfig} 
          compactMode={true}
        />
      );

      expect(screen.getByText('⏱️ Request timed out')).toBeInTheDocument();
    });
  });

  describe('Authentication Error State', () => {
    const authError: ErrorState = {
      type: ErrorType.AUTHENTICATION_ERROR,
      message: 'Authentication failed',
      retryable: false,
    };

    it('renders authentication error without retry button', () => {
      render(
        <ErrorStateComponent 
          error={authError} 
          config={mockConfig} 
        />
      );

      expect(screen.getByText('🔒 Service Temporarily Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/technical difficulties/)).toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('renders authentication error in compact mode', () => {
      render(
        <ErrorStateComponent 
          error={authError} 
          config={mockConfig} 
          compactMode={true}
        />
      );

      expect(screen.getByText('🔒 Service temporarily unavailable')).toBeInTheDocument();
    });
  });

  describe('Invalid Response Error State', () => {
    const invalidResponseError: ErrorState = {
      type: ErrorType.INVALID_RESPONSE,
      message: 'Invalid response format',
      retryable: false,
    };

    it('renders invalid response error', () => {
      render(
        <ErrorStateComponent 
          error={invalidResponseError} 
          config={mockConfig} 
        />
      );

      expect(screen.getByText('⚠️ Data Processing Error')).toBeInTheDocument();
      expect(screen.getByText(/unexpected data/)).toBeInTheDocument();
    });
  });

  describe('Configuration Error State', () => {
    const configError: ErrorState = {
      type: ErrorType.CONFIGURATION_ERROR,
      message: 'Invalid API endpoint',
      retryable: false,
    };

    it('does not render configuration error when debug mode is disabled', () => {
      const { container } = render(
        <ErrorStateComponent 
          error={configError} 
          config={mockConfig} 
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders configuration error when debug mode is enabled', () => {
      const debugConfig = { ...mockConfig, enable_debug_mode: true };
      
      render(
        <ErrorStateComponent 
          error={configError} 
          config={debugConfig} 
        />
      );

      expect(screen.getByText('🔧 Configuration Error (Debug Mode)')).toBeInTheDocument();
      expect(screen.getByText(configError.message)).toBeInTheDocument();
    });
  });

  describe('Generic Error State', () => {
    const genericError: ErrorState = {
      type: 'UNKNOWN_ERROR' as ErrorType,
      message: 'Unknown error occurred',
      retryable: true,
    };

    it('renders generic error for unknown error types', () => {
      render(
        <ErrorStateComponent 
          error={genericError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('⚠️ Temporary Issue')).toBeInTheDocument();
      expect(screen.getByText(/temporary issue/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    const networkError: ErrorState = {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network connection failed',
      retryable: true,
    };

    it('includes proper accessibility attributes', () => {
      render(
        <ErrorStateComponent 
          error={networkError} 
          config={mockConfig} 
          onRetry={mockOnRetry}
        />
      );

      const errorView = screen.getByTestId('view');
      expect(errorView).toHaveAttribute('accessibilityRole', 'alert');
      expect(errorView).toHaveAttribute('accessibilityLabel', 'Network connection error');

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toHaveAttribute('accessibilityLabel', 'Retry loading risk assessment');
    });
  });

  describe('Non-retryable Errors', () => {
    const nonRetryableError: ErrorState = {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network error',
      retryable: false,
    };

    it('does not show retry button for non-retryable errors', () => {
      render(
        <ErrorStateComponent 
          error={nonRetryableError} 
          config={mockConfig} 
        />
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });
  });
});