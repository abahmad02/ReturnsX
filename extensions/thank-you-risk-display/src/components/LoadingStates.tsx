import React from 'react';
import {
  BlockStack,
  Text,
  View,
  Spinner,
  InlineLayout,
} from '@shopify/ui-extensions-react/checkout';

interface LoadingStateProps {
  message?: string;
  compactMode?: boolean;
  showSpinner?: boolean;
  accessibilityLabel?: string;
}

/**
 * Primary loading state for risk assessment
 */
export function RiskAssessmentLoadingState({ 
  message = "Analyzing your delivery profile...", 
  compactMode = false,
  showSpinner = true,
  accessibilityLabel = "Loading risk assessment information"
}: LoadingStateProps) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          {showSpinner && <Spinner size="small" />}
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="base" inlineAlignment="center">
        {showSpinner && <Spinner size="medium" />}
        <BlockStack spacing="tight" inlineAlignment="center">
          <Text size="medium" emphasis="bold">
            Loading Risk Assessment
          </Text>
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </BlockStack>
      </BlockStack>
    </View>
  );
}

/**
 * Configuration loading state
 */
export function ConfigurationLoadingState({ 
  compactMode = false,
  accessibilityLabel = "Loading extension configuration"
}: Omit<LoadingStateProps, 'message' | 'showSpinner'>) {
  const message = "Loading configuration...";

  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        <Spinner size="small" />
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Customer data loading state
 */
export function CustomerDataLoadingState({ 
  compactMode = false,
  accessibilityLabel = "Loading customer information"
}: Omit<LoadingStateProps, 'message' | 'showSpinner'>) {
  const message = "Loading customer data...";

  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        <Spinner size="small" />
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * API health check loading state
 */
export function ApiHealthCheckLoadingState({ 
  compactMode = false,
  accessibilityLabel = "Checking API connection"
}: Omit<LoadingStateProps, 'message' | 'showSpinner'>) {
  const message = "Checking connection...";

  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        <Spinner size="small" />
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Retry loading state (when retrying after an error)
 */
export function RetryLoadingState({ 
  message = "Retrying...", 
  compactMode = false,
  accessibilityLabel = "Retrying request"
}: LoadingStateProps) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="assertive"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="assertive"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        <Spinner size="small" />
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Generic loading state with customizable content
 */
export function GenericLoadingState({ 
  message = "Loading...", 
  compactMode = false,
  showSpinner = true,
  accessibilityLabel = "Loading content"
}: LoadingStateProps) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <InlineLayout spacing="tight" blockAlignment="center">
          {showSpinner && <Spinner size="small" />}
          <Text size="small" appearance="subdued">
            {message}
          </Text>
        </InlineLayout>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        {showSpinner && <Spinner size="small" />}
        <Text size="small" appearance="subdued">
          {message}
        </Text>
      </BlockStack>
    </View>
  );
}

/**
 * Skeleton loading state for risk assessment card
 */
export function RiskAssessmentSkeletonState({ 
  compactMode = false,
  accessibilityLabel = "Loading risk assessment card"
}: Omit<LoadingStateProps, 'message' | 'showSpinner'>) {
  if (compactMode) {
    return (
      <View 
        border="base" 
        cornerRadius="base" 
        padding="tight"
        accessibilityRole="status"
        accessibilityLabel={accessibilityLabel}
        accessibilityLive="polite"
      >
        <BlockStack spacing="tight">
          <View 
            border="base" 
            cornerRadius="base" 
            padding="extraTight"
            minBlockSize={20}
          >
            <Text size="small" appearance="subdued">
              ░░░░░░░░░░░░░░░░
            </Text>
          </View>
          <View 
            border="base" 
            cornerRadius="base" 
            padding="extraTight"
            minBlockSize={16}
          >
            <Text size="small" appearance="subdued">
              ░░░░░░░░░░░░
            </Text>
          </View>
        </BlockStack>
      </View>
    );
  }

  return (
    <View 
      border="base" 
      cornerRadius="base" 
      padding="base"
      accessibilityRole="status"
      accessibilityLabel={accessibilityLabel}
      accessibilityLive="polite"
    >
      <BlockStack spacing="base">
        {/* Header skeleton */}
        <BlockStack spacing="tight">
          <View 
            border="base" 
            cornerRadius="base" 
            padding="tight"
            minBlockSize={24}
          >
            <Text size="medium" appearance="subdued">
              ░░░░░░░░░░░░░░░░░░░░
            </Text>
          </View>
          <View 
            border="base" 
            cornerRadius="base" 
            padding="tight"
            minBlockSize={20}
          >
            <Text size="small" appearance="subdued">
              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░
            </Text>
          </View>
        </BlockStack>

        {/* Content skeleton */}
        <BlockStack spacing="tight">
          <View 
            border="base" 
            cornerRadius="base" 
            padding="tight"
            minBlockSize={16}
          >
            <Text size="small" appearance="subdued">
              ░░░░░░░░░░░░░░░░
            </Text>
          </View>
          <View 
            border="base" 
            cornerRadius="base" 
            padding="tight"
            minBlockSize={16}
          >
            <Text size="small" appearance="subdued">
              ░░░░░░░░░░░░
            </Text>
          </View>
        </BlockStack>
      </BlockStack>
    </View>
  );
}