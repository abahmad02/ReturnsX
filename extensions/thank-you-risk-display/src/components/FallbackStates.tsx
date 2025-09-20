import React from 'react';
import {
  BlockStack,
  Text,
  View,
  Button,
  InlineLayout,
} from '@shopify/ui-extensions-react/checkout';
import { ExtensionConfig, ErrorState } from '../types';

interface FallbackStateProps {
  config: ExtensionConfig;
  compactMode?: boolean;
  onRetry?: () => void;
  error?: ErrorState | null;
}

/**
 * New customer welcome fallback when API is unavailable
 */
export function NewCustomerFallbackState({ 
  config, 
  compactMode = false, 
  onRetry,
  error 
}: FallbackStateProps) {
  const welcomeMessage = config.zero_risk_message || 
    "Welcome! Thank you for choosing us. We're excited to serve you and ensure a great delivery experience.";

  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="region"
        accessibilityLabel="Welcome message for new customer"
      >
        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            🎉 Welcome!
          </Text>
          <Text size="small" appearance="subdued">
            Thank you for your order.
          </Text>
          {onRetry && error?.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading personalized information"
            >
              Load Details
            </Button>
          )}
        </BlockStack>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="region"
      accessibilityLabel="Welcome message for new customer"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            🎉 Welcome to Our Store!
          </Text>
          <Text size="small" appearance="subdued">
            {welcomeMessage}
          </Text>
        </BlockStack>

        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            What to Expect:
          </Text>
          <BlockStack spacing="extraTight">
            <Text size="small" appearance="subdued">
              • Order confirmation via SMS/email
            </Text>
            <Text size="small" appearance="subdued">
              • Tracking information when shipped
            </Text>
            <Text size="small" appearance="subdued">
              • Delivery within 2-5 business days
            </Text>
          </BlockStack>
        </BlockStack>

        {onRetry && error?.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading personalized delivery information"
            >
              Load Personalized Info
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && error && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Showing fallback due to {error.type} - {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Generic service unavailable fallback
 */
export function ServiceUnavailableFallbackState({ 
  config, 
  compactMode = false, 
  onRetry,
  error 
}: FallbackStateProps) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="region"
        accessibilityLabel="Service unavailable message"
      >
        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            ✅ Order Confirmed
          </Text>
          <Text size="small" appearance="subdued">
            Your order is being processed.
          </Text>
          {onRetry && error?.retryable && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry loading additional information"
            >
              Retry
            </Button>
          )}
        </BlockStack>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="region"
      accessibilityLabel="Service unavailable message"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            ✅ Order Confirmed Successfully
          </Text>
          <Text size="small" appearance="subdued">
            Your order has been received and is being processed. You'll receive updates via SMS and email.
          </Text>
        </BlockStack>

        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            Next Steps:
          </Text>
          <BlockStack spacing="extraTight">
            <Text size="small" appearance="subdued">
              • You'll receive an order confirmation shortly
            </Text>
            <Text size="small" appearance="subdued">
              • We'll notify you when your order ships
            </Text>
            <Text size="small" appearance="subdued">
              • Track your order using the provided link
            </Text>
          </BlockStack>
        </BlockStack>

        {onRetry && error?.retryable && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading additional order information"
            >
              Load Additional Info
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && error && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Service unavailable fallback - {error.type}: {error.message}
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Minimal fallback for critical errors
 */
export function MinimalFallbackState({ 
  config, 
  compactMode = true 
}: Omit<FallbackStateProps, 'onRetry' | 'error'>) {
  const message = "Thank you for your order! You'll receive confirmation details shortly.";

  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="region"
        accessibilityLabel="Order confirmation message"
      >
        <Text size="small" appearance="subdued">
          ✅ {message}
        </Text>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="region"
      accessibilityLabel="Order confirmation message"
    >
      <BlockStack spacing="tight">
        <Text size="medium" emphasis="bold">
          ✅ Order Confirmed
        </Text>
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Offline fallback state
 */
export function OfflineFallbackState({ 
  config, 
  compactMode = false, 
  onRetry 
}: Omit<FallbackStateProps, 'error'>) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="region"
        accessibilityLabel="Offline mode message"
      >
        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            📱 Offline Mode
          </Text>
          <Text size="small" appearance="subdued">
            Your order is confirmed.
          </Text>
          {onRetry && (
            <Button 
              onPress={onRetry} 
              kind="plain" 
              size="small"
              accessibilityLabel="Retry when online"
            >
              Retry
            </Button>
          )}
        </BlockStack>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="region"
      accessibilityLabel="Offline mode message"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            📱 You're Currently Offline
          </Text>
          <Text size="small" appearance="subdued">
            Don't worry! Your order has been confirmed and saved. We'll process it normally.
          </Text>
        </BlockStack>

        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            Your Order Status:
          </Text>
          <BlockStack spacing="extraTight">
            <Text size="small" appearance="subdued">
              ✅ Order received and confirmed
            </Text>
            <Text size="small" appearance="subdued">
              📦 Will be processed when connection resumes
            </Text>
            <Text size="small" appearance="subdued">
              📧 Confirmation email will be sent
            </Text>
          </BlockStack>
        </BlockStack>

        {onRetry && (
          <InlineLayout spacing="base">
            <Button 
              onPress={onRetry} 
              kind="secondary"
              accessibilityLabel="Retry loading when connection is restored"
            >
              Try Again When Online
            </Button>
          </InlineLayout>
        )}

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Offline fallback state active
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Maintenance mode fallback
 */
export function MaintenanceFallbackState({ 
  config, 
  compactMode = false 
}: Omit<FallbackStateProps, 'onRetry' | 'error'>) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="region"
        accessibilityLabel="Maintenance mode message"
      >
        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            🔧 Maintenance
          </Text>
          <Text size="small" appearance="subdued">
            Order confirmed successfully.
          </Text>
        </BlockStack>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="region"
      accessibilityLabel="Maintenance mode message"
    >
      <BlockStack spacing="base">
        <BlockStack spacing="tight">
          <Text size="medium" emphasis="bold">
            🔧 System Maintenance
          </Text>
          <Text size="small" appearance="subdued">
            We're performing scheduled maintenance to improve our services. Your order has been confirmed and will be processed normally.
          </Text>
        </BlockStack>

        <BlockStack spacing="tight">
          <Text size="small" emphasis="bold">
            What This Means:
          </Text>
          <BlockStack spacing="extraTight">
            <Text size="small" appearance="subdued">
              • Your order is safe and confirmed
            </Text>
            <Text size="small" appearance="subdued">
              • Processing will continue as normal
            </Text>
            <Text size="small" appearance="subdued">
              • You'll receive all standard notifications
            </Text>
          </BlockStack>
        </BlockStack>

        {config.enable_debug_mode && (
          <View border="base" cornerRadius="base" padding="tight">
            <Text size="small" appearance="critical">
              Debug: Maintenance mode fallback active
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}