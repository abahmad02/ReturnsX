import React from 'react';
import {
  BlockStack,
  Text,
  View,
  Button,
  InlineLayout,
  Icon,
} from '@shopify/ui-extensions-react/checkout';
import { ErrorState, ErrorType, ExtensionConfig } from '../types';

interface ErrorStateComponentProps {
  error: ErrorState;
  config: ExtensionConfig;
  onRetry?: () => void;
  compactMode?: boolean;
}

/**
 * Main error state component that renders appropriate error UI based on error type
 */
export function ErrorStateComponent({ 
  error, 
  config, 
  onRetry, 
  compactMode = false 
}: ErrorStateComponentProps) {
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      return (
        <NetworkErrorState 
          error={error} 
          config={config} 
          onRetry={onRetry} 
          compactMode={compactMode} 
        />
      );
    case ErrorType.TIMEOUT_ERROR:
      return (
        <TimeoutErrorState 
          error={error} 
          config={config} 
          onRetry={onRetry} 
          compactMode={compactMode} 
        />
      );
    case ErrorType.AUTHENTICATION_ERROR:
      return (
        <AuthenticationErrorState 
          error={error} 
          config={config} 
          compactMode={compactMode} 
        />
      );
    case ErrorType.INVALID_RESPONSE:
      return (
        <InvalidResponseErrorState 
          error={error} 
          config={config} 
          onRetry={onRetry} 
          compactMode={compactMode} 
        />
      );
    case ErrorType.CONFIGURATION_ERROR:
      return (
        <ConfigurationErrorState 
          error={error} 
          config={config} 
          compactMode={compactMode} 
        />
      );
    default:
      return (
        <GenericErrorState 
          error={error} 
          config={config} 
          onRetry={onRetry} 
          compactMode={compactMode} 
        />
      );
  }
}

/**
 * Network error state component
 */
function NetworkErrorState({ 
  error, 
  config, 
  onRetry, 
  compactMode 
}: ErrorStateComponentProps) {
  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <InlineLayout spacing="tight" blockAlignment="center">
          <Text size="small" appearance="subdued">
            ⚠️ Connection issue
          </Text>
          {onRetry && error.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading risk assessment"
            >
              Retry
            </Button>
          )}
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Network connection error"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            🌐 Connection Issue
          </Text>
          <Text size="small" appearance="subdued">
            We're having trouble connecting to our servers. Your order is safe and confirmed.
          </Text>
        </BlockStack>

        {onRetry && error.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading risk assessment"
            >
              Try Again
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Timeout error state component
 */
function TimeoutErrorState({ 
  error, 
  config, 
  onRetry, 
  compactMode 
}: ErrorStateComponentProps) {
  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <InlineLayout spacing="tight" blockAlignment="center">
          <Text size="small" appearance="subdued">
            ⏱️ Request timed out
          </Text>
          {onRetry && error.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading risk assessment"
            >
              Retry
            </Button>
          )}
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Request timeout error"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            ⏱️ Request Timed Out
          </Text>
          <Text size="small" appearance="subdued">
            The request is taking longer than expected. Your order is confirmed and being processed.
          </Text>
        </BlockStack>

        {onRetry && error.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading risk assessment"
            >
              Try Again
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Authentication error state component
 */
function AuthenticationErrorState({ 
  error, 
  config, 
  compactMode 
}: Omit<ErrorStateComponentProps, 'onRetry'>) {
  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <Text size="small" appearance="subdued">
          🔒 Service temporarily unavailable
        </Text>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Authentication error"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            🔒 Service Temporarily Unavailable
          </Text>
          <Text size="small" appearance="subdued">
            We're experiencing technical difficulties. Your order has been confirmed and will be processed normally.
          </Text>
        </BlockStack>

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Authentication failed - {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Invalid response error state component
 */
function InvalidResponseErrorState({ 
  error, 
  config, 
  onRetry, 
  compactMode 
}: ErrorStateComponentProps) {
  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <InlineLayout spacing="tight" blockAlignment="center">
          <Text size="small" appearance="subdued">
            ⚠️ Data error
          </Text>
          {onRetry && error.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading risk assessment"
            >
              Retry
            </Button>
          )}
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Invalid response error"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            ⚠️ Data Processing Error
          </Text>
          <Text size="small" appearance="subdued">
            We received unexpected data from our servers. Your order is confirmed and secure.
          </Text>
        </BlockStack>

        {onRetry && error.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading risk assessment"
            >
              Try Again
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Invalid response - {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Configuration error state component
 */
function ConfigurationErrorState({ 
  error, 
  config, 
  compactMode 
}: Omit<ErrorStateComponentProps, 'onRetry'>) {
  // Configuration errors should be silent for customers
  if (!config.enable_debug_mode) {
    return null;
  }

  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <Text size="small" appearance="critical">
          🔧 Configuration error
        </Text>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Configuration error"
    >
      <BlockStack spacing="tight">
        <Text size="medium" emphasis="bold" appearance="critical">
          🔧 Configuration Error (Debug Mode)
        </Text>
        <Text size="small" appearance="critical">
          {error.message}
        </Text>
        <Text size="small" appearance="subdued">
          This error is only visible in debug mode and won't affect customers.
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Generic error state component for unknown error types
 */
function GenericErrorState({ 
  error, 
  config, 
  onRetry, 
  compactMode 
}: ErrorStateComponentProps) {
  if (compactMode) {
    return (
      <View border="base" cornerRadius="base" padding="tight">
        <InlineLayout spacing="tight" blockAlignment="center">
          <Text size="small" appearance="subdued">
            ⚠️ Temporary issue
          </Text>
          {onRetry && error.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading risk assessment"
            >
              Retry
            </Button>
          )}
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="alert"
      accessibilityLabel="Unknown error"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            ⚠️ Temporary Issue
          </Text>
          <Text size="small" appearance="subdued">
            We're experiencing a temporary issue. Your order has been confirmed successfully.
          </Text>
        </BlockStack>

        {onRetry && error.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading risk assessment"
            >
              Try Again
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: {error.type} - {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}