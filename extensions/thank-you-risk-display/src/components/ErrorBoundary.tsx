import React, { Component, ReactNode, useCallback } from 'react';
import { BlockStack, Text, View } from '@shopify/ui-extensions-react/checkout';
import { ErrorState, ErrorType } from '../types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorState?: ErrorState;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorState: {
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'An unexpected error occurred while loading the risk assessment.',
        retryable: false,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('Extension Error Boundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI or custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View border="base" cornerRadius="base" padding="base">
          <BlockStack spacing="tight">
            <Text size="small" appearance="subdued">
              Unable to load risk assessment information
            </Text>
          </BlockStack>
        </View>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary for functional components
export function useErrorHandler() {
  const handleError = useCallback((error: Error, context?: string) => {
    console.error(`Extension Error${context ? ` (${context})` : ''}:`, error);
    
    // In a real implementation, you might want to send this to an error reporting service
    // For now, we'll just log it
  }, []);

  return handleError;
}