import {
  BlockStack,
  Text,
  InlineLayout,
  View,
  Button,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';
import { ExtensionConfig, RiskProfileResponse, ErrorState } from '../types';
import { 
  generateMessage, 
  generatePersonalizedRecommendations,
  truncateText,
  formatMessage,
  MessageContext 
} from '../services/messageGenerator';

export interface MessageDisplayProps {
  riskProfile?: RiskProfileResponse;
  config: ExtensionConfig;
  customerName?: string;
  orderNumber?: string;
  error?: ErrorState;
  compactMode?: boolean;
}

/**
 * Message Display Component
 * 
 * Handles dynamic message generation and display with:
 * - Risk tier and customer status-based messaging
 * - Custom merchant messages from theme customizer
 * - Fallback messages for error states and new customers
 * - Text truncation and "read more" functionality
 * - Personalized recommendations
 */
export function MessageDisplay({
  riskProfile,
  config,
  customerName,
  orderNumber,
  error,
  compactMode = false
}: MessageDisplayProps) {
  const [isPrimaryExpanded, setIsPrimaryExpanded] = useState(false);
  const [isSecondaryExpanded, setIsSecondaryExpanded] = useState(false);

  // Generate contextual message
  const messageContext: MessageContext = {
    riskProfile,
    config,
    customerName,
    orderNumber,
    error
  };

  const generatedMessage = generateMessage(messageContext);

  // Format messages with dynamic placeholders
  const formattedPrimary = formatMessage(generatedMessage.primary, messageContext);
  const formattedSecondary = generatedMessage.secondary 
    ? formatMessage(generatedMessage.secondary, messageContext)
    : undefined;

  // Handle text truncation for primary message
  const primaryMaxLength = compactMode ? 100 : 150;
  const primaryTruncation = truncateText(formattedPrimary, primaryMaxLength);
  const displayPrimary = isPrimaryExpanded 
    ? primaryTruncation.fullText 
    : primaryTruncation.truncated;

  // Handle text truncation for secondary message
  const secondaryMaxLength = compactMode ? 80 : 120;
  const secondaryTruncation = formattedSecondary 
    ? truncateText(formattedSecondary, secondaryMaxLength)
    : null;
  const displaySecondary = secondaryTruncation && isSecondaryExpanded
    ? secondaryTruncation.fullText
    : secondaryTruncation?.truncated;

  // Get appearance based on message tone
  const getAppearance = (tone: string) => {
    switch (tone) {
      case 'positive':
        return 'success' as const;
      case 'warning':
        return 'warning' as const;
      case 'critical':
        return 'critical' as const;
      default:
        return 'subdued' as const;
    }
  };

  return (
    <View>
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        {/* Primary Message */}
        <BlockStack spacing="extraTight">
          <Text
            size={compactMode ? "small" : "base"}
            emphasis={compactMode ? undefined : "bold"}
            appearance={getAppearance(generatedMessage.tone)}
          >
            {displayPrimary}
          </Text>
          
          {/* Read more/less for primary message */}
          {primaryTruncation.needsTruncation && (
            <View inlineAlignment="start">
              <Button
                kind="plain"
                onPress={() => setIsPrimaryExpanded(!isPrimaryExpanded)}
                accessibilityLabel={
                  isPrimaryExpanded 
                    ? 'Show less of main message' 
                    : 'Show full main message'
                }
              >
                {isPrimaryExpanded ? 'Show Less' : 'Read More'}
              </Button>
            </View>
          )}
        </BlockStack>

        {/* Secondary Message */}
        {formattedSecondary && (
          <BlockStack spacing="extraTight">
            <Text
              size={compactMode ? "extraSmall" : "small"}
              appearance="subdued"
            >
              {displaySecondary}
            </Text>
            
            {/* Read more/less for secondary message */}
            {secondaryTruncation?.needsTruncation && (
              <View inlineAlignment="start">
                <Button
                  kind="plain"
                  onPress={() => setIsSecondaryExpanded(!isSecondaryExpanded)}
                  accessibilityLabel={
                    isSecondaryExpanded 
                      ? 'Show less of description' 
                      : 'Show full description'
                  }
                >
                  {isSecondaryExpanded ? 'Show Less' : 'Read More'}
                </Button>
              </View>
            )}
          </BlockStack>
        )}

        {/* Call to Action */}
        {generatedMessage.callToAction && (
          <View
            border="base"
            cornerRadius="base"
            padding={compactMode ? "tight" : "base"}
          >
            <InlineLayout spacing="base" columns={['auto', 'fill']}>
              <Text size={compactMode ? "small" : "base"}>
                💬
              </Text>
              <Text 
                size={compactMode ? "small" : "base"}
                emphasis="bold"
                appearance={getAppearance(generatedMessage.tone)}
              >
                {generatedMessage.callToAction}
              </Text>
            </InlineLayout>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Compact Message Display for minimal space scenarios
 */
export function CompactMessageDisplay({
  riskProfile,
  config,
  customerName,
  orderNumber,
  error
}: MessageDisplayProps) {
  const messageContext: MessageContext = {
    riskProfile,
    config,
    customerName,
    orderNumber,
    error
  };

  const generatedMessage = generateMessage(messageContext);
  const formattedPrimary = formatMessage(generatedMessage.primary, messageContext);
  
  // Very short truncation for compact display
  const { truncated } = truncateText(formattedPrimary, 60);

  return (
    <View
      border="base"
      cornerRadius="base"
      padding="tight"
    >
      <InlineLayout spacing="tight" columns={['auto', 'fill']}>
        <Text size="small">
          {generatedMessage.tone === 'positive' ? '✅' : 
           generatedMessage.tone === 'critical' ? '⚠️' : 
           generatedMessage.tone === 'warning' ? '💡' : '📋'}
        </Text>
        <Text size="small">
          {truncated}
        </Text>
      </InlineLayout>
    </View>
  );
}

/**
 * Error Message Display for various error states
 */
export function ErrorMessageDisplay({
  error,
  config,
  compactMode = false,
  onRetry
}: {
  error: ErrorState;
  config: ExtensionConfig;
  compactMode?: boolean;
  onRetry?: () => void;
}) {
  const messageContext: MessageContext = {
    config,
    error
  };

  const generatedMessage = generateMessage(messageContext);
  const formattedPrimary = formatMessage(generatedMessage.primary, messageContext);

  return (
    <View
      border="base"
      cornerRadius="base"
      padding={compactMode ? "tight" : "base"}
    >
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        <Text
          size={compactMode ? "small" : "base"}
          appearance="subdued"
        >
          {formattedPrimary}
        </Text>
        
        {generatedMessage.secondary && (
          <Text
            size={compactMode ? "extraSmall" : "small"}
            appearance="subdued"
          >
            {formatMessage(generatedMessage.secondary, messageContext)}
          </Text>
        )}

        {/* Retry button for retryable errors */}
        {error.retryable && onRetry && (
          <View inlineAlignment="start">
            <Button
              onPress={onRetry}
              kind="secondary"
            >
              Try Again
            </Button>
          </View>
        )}

        {/* Debug information */}
        {config.enable_debug_mode && (
          <Text size="extraSmall" appearance="critical">
            Debug: {error.type} - {error.message}
          </Text>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * New Customer Welcome Message with personalized content
 */
export function NewCustomerMessageDisplay({
  config,
  customerName,
  orderNumber,
  compactMode = false
}: {
  config: ExtensionConfig;
  customerName?: string;
  orderNumber?: string;
  compactMode?: boolean;
}) {
  const messageContext: MessageContext = {
    config,
    customerName,
    orderNumber,
    riskProfile: {
      success: true,
      riskTier: 'ZERO_RISK',
      riskScore: 100,
      totalOrders: 0,
      failedAttempts: 0,
      successfulDeliveries: 0,
      isNewCustomer: true,
      message: ''
    }
  };

  const generatedMessage = generateMessage(messageContext);
  const formattedPrimary = formatMessage(generatedMessage.primary, messageContext);
  const formattedSecondary = generatedMessage.secondary 
    ? formatMessage(generatedMessage.secondary, messageContext)
    : undefined;

  return (
    <View
      border="base"
      cornerRadius="base"
      padding={compactMode ? "tight" : "base"}
    >
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        <Text
          size={compactMode ? "small" : "base"}
          emphasis="bold"
        >
          {formattedPrimary}
        </Text>
        
        {formattedSecondary && (
          <Text
            size={compactMode ? "extraSmall" : "small"}
            appearance="subdued"
          >
            {formattedSecondary}
          </Text>
        )}

        {/* Welcome tips for new customers */}
        {!compactMode && generatedMessage.recommendations && (
          <BlockStack spacing="tight">
            <Text size="small" emphasis="bold">
              📋 Getting Started Tips:
            </Text>
            {generatedMessage.recommendations.slice(0, 3).map((tip, index) => (
              <InlineLayout key={index} spacing="tight" columns={['auto', 'fill']}>
                <Text size="small" appearance="subdued">•</Text>
                <Text size="small" appearance="subdued">{tip}</Text>
              </InlineLayout>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </View>
  );
}