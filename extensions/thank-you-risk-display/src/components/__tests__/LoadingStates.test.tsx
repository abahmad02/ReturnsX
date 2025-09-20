import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  RiskAssessmentLoadingState,
  ConfigurationLoadingState,
  CustomerDataLoadingState,
  ApiHealthCheckLoadingState,
  RetryLoadingState,
  GenericLoadingState,
  RiskAssessmentSkeletonState,
} from '../LoadingStates';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
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
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

// Mock Shopify UI extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  BlockStack: ({ children, ...props }: any) => <div data-testid="block-stack" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  View: ({ children, ...props }: any) => <div data-testid="view" {...props}>{children}</div>,
  Spinner: ({ ...props }: any) => <div data-testid="spinner" {...props} />,
  InlineLayout: ({ children, ...props }: any) => <div data-testid="inline-layout" {...props}>{children}</div>,
}));

describe('Loading States', () => {
  describe('RiskAssessmentLoadingState', () => {
    it('renders default loading state', () => {
      render(<RiskAssessmentLoadingState />);

      expect(screen.getByText('Loading Risk Assessment')).toBeInTheDocument();
      expect(screen.getByText('Analyzing your delivery profile...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders with custom message', () => {
      const customMessage = 'Custom loading message';
      render(<RiskAssessmentLoadingState message={customMessage} />);

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it('renders in compact mode', () => {
      render(<RiskAssessmentLoadingState compactMode={true} />);

      expect(screen.queryByText('Loading Risk Assessment')).not.toBeInTheDocument();
      expect(screen.getByText('Analyzing your delivery profile...')).toBeInTheDocument();
    });

    it('renders without spinner when disabled', () => {
      render(<RiskAssessmentLoadingState showSpinner={false} />);

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    it('includes proper accessibility attributes', () => {
      render(<RiskAssessmentLoadingState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityRole', 'status');
      expect(view).toHaveAttribute('accessibilityLabel', 'Loading risk assessment information');
      expect(view).toHaveAttribute('accessibilityLive', 'polite');
    });

    it('uses custom accessibility label', () => {
      const customLabel = 'Custom accessibility label';
      render(<RiskAssessmentLoadingState accessibilityLabel={customLabel} />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLabel', customLabel);
    });
  });

  describe('ConfigurationLoadingState', () => {
    it('renders configuration loading state', () => {
      render(<ConfigurationLoadingState />);

      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders in compact mode', () => {
      render(<ConfigurationLoadingState compactMode={true} />);

      expect(screen.getByTestId('inline-layout')).toBeInTheDocument();
    });

    it('includes proper accessibility attributes', () => {
      render(<ConfigurationLoadingState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLabel', 'Loading extension configuration');
    });
  });

  describe('CustomerDataLoadingState', () => {
    it('renders customer data loading state', () => {
      render(<CustomerDataLoadingState />);

      expect(screen.getByText('Loading customer data...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('includes proper accessibility attributes', () => {
      render(<CustomerDataLoadingState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLabel', 'Loading customer information');
    });
  });

  describe('ApiHealthCheckLoadingState', () => {
    it('renders API health check loading state', () => {
      render(<ApiHealthCheckLoadingState />);

      expect(screen.getByText('Checking connection...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('includes proper accessibility attributes', () => {
      render(<ApiHealthCheckLoadingState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLabel', 'Checking API connection');
    });
  });

  describe('RetryLoadingState', () => {
    it('renders retry loading state', () => {
      render(<RetryLoadingState />);

      expect(screen.getByText('Retrying...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders with custom message', () => {
      const customMessage = 'Retrying API call...';
      render(<RetryLoadingState message={customMessage} />);

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it('uses assertive accessibility live region', () => {
      render(<RetryLoadingState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLive', 'assertive');
    });
  });

  describe('GenericLoadingState', () => {
    it('renders generic loading state', () => {
      render(<GenericLoadingState />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders with custom message and no spinner', () => {
      const customMessage = 'Processing...';
      render(<GenericLoadingState message={customMessage} showSpinner={false} />);

      expect(screen.getByText(customMessage)).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  describe('RiskAssessmentSkeletonState', () => {
    it('renders skeleton loading state', () => {
      render(<RiskAssessmentSkeletonState />);

      // Check for skeleton placeholder text
      const skeletonTexts = screen.getAllByText(/░/);
      expect(skeletonTexts.length).toBeGreaterThan(0);
    });

    it('renders in compact mode', () => {
      render(<RiskAssessmentSkeletonState compactMode={true} />);

      const skeletonTexts = screen.getAllByText(/░/);
      expect(skeletonTexts.length).toBeGreaterThan(0);
    });

    it('includes proper accessibility attributes', () => {
      render(<RiskAssessmentSkeletonState />);

      const view = screen.getByTestId('view');
      expect(view).toHaveAttribute('accessibilityLabel', 'Loading risk assessment card');
    });
  });

  describe('Accessibility Compliance', () => {
    const loadingComponents = [
      { Component: RiskAssessmentLoadingState, name: 'RiskAssessmentLoadingState' },
      { Component: ConfigurationLoadingState, name: 'ConfigurationLoadingState' },
      { Component: CustomerDataLoadingState, name: 'CustomerDataLoadingState' },
      { Component: ApiHealthCheckLoadingState, name: 'ApiHealthCheckLoadingState' },
      { Component: RetryLoadingState, name: 'RetryLoadingState' },
      { Component: GenericLoadingState, name: 'GenericLoadingState' },
      { Component: RiskAssessmentSkeletonState, name: 'RiskAssessmentSkeletonState' },
    ];

    loadingComponents.forEach(({ Component, name }) => {
      it(`${name} has proper accessibility role`, () => {
        render(<Component />);

        const view = screen.getByTestId('view');
        expect(view).toHaveAttribute('accessibilityRole', 'status');
      });

      it(`${name} has accessibility label`, () => {
        render(<Component />);

        const view = screen.getByTestId('view');
        expect(view).toHaveAttribute('accessibilityLabel');
      });

      it(`${name} has accessibility live region`, () => {
        render(<Component />);

        const view = screen.getByTestId('view');
        const liveValue = view.getAttribute('accessibilityLive');
        expect(['polite', 'assertive']).toContain(liveValue);
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts layout for compact mode', () => {
      const { rerender } = render(<RiskAssessmentLoadingState compactMode={false} />);
      
      expect(screen.getByTestId('block-stack')).toBeInTheDocument();
      expect(screen.queryByTestId('inline-layout')).not.toBeInTheDocument();

      rerender(<RiskAssessmentLoadingState compactMode={true} />);
      
      expect(screen.getByTestId('inline-layout')).toBeInTheDocument();
    });
  });
});