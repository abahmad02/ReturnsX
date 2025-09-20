import {
  BlockStack,
  Text,
  InlineLayout,
  View,
  Button,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';
import { RecommendationsListProps } from '../types';
import { truncateText } from '../services/messageGenerator';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsEventType } from '../services/analyticsService';

/**
 * Recommendations List Component
 * 
 * Displays improvement tips and recommendations with:
 * - Expandable/collapsible content for long lists
 * - Risk-tier specific styling
 * - Mobile-friendly touch targets
 * - Accessibility support
 */
export function RecommendationsList({ 
  recommendations, 
  riskTier, 
  compactMode 
}: RecommendationsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Initialize analytics
  const { trackUserInteraction } = useAnalytics({ 
    config: { analytics_enabled: true } as any // Minimal config for analytics
  });
  
  // Track recommendations view
  useEffect(() => {
    trackUserInteraction(AnalyticsEventType.RECOMMENDATIONS_VIEWED, {
      riskTier,
      recommendationCount: recommendations.length,
      compactMode,
      timestamp: Date.now()
    });
  }, [recommendations.length, riskTier, compactMode, trackUserInteraction]);
  
  // Determine how many recommendations to show initially
  const maxInitialItems = compactMode ? 2 : 3;
  const hasMoreItems = recommendations.length > maxInitialItems;
  const displayedRecommendations = isExpanded 
    ? recommendations 
    : recommendations.slice(0, maxInitialItems);

  // Get styling based on risk tier
  const getTierStyling = () => {
    switch (riskTier) {
      case 'HIGH_RISK':
        return {
          headerIcon: '🚨',
          headerText: 'Important Recommendations',
          appearance: 'critical' as const,
        };
      case 'MEDIUM_RISK':
        return {
          headerIcon: '💡',
          headerText: 'Tips for Improvement',
          appearance: 'warning' as const,
        };
      case 'ZERO_RISK':
        return {
          headerIcon: '⭐',
          headerText: 'Keep Up the Great Work',
          appearance: 'success' as const,
        };
      default:
        return {
          headerIcon: '📋',
          headerText: 'Recommendations',
          appearance: 'base' as const,
        };
    }
  };

  const styling = getTierStyling();

  return (
    <View>
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        {/* Section header */}
        <InlineLayout 
          spacing="base" 
          columns={['auto', 'fill']}
          blockAlignment="center"
        >
          <Text size={compactMode ? "base" : "large"}>
            {styling.headerIcon}
          </Text>
          <Text 
            size={compactMode ? "small" : "base"} 
            emphasis="bold"
            appearance={styling.appearance === 'base' ? 'subdued' : styling.appearance}
          >
            {styling.headerText}
          </Text>
        </InlineLayout>

        {/* Recommendations list */}
        <BlockStack spacing={compactMode ? "extraTight" : "tight"}>
          {displayedRecommendations.map((recommendation, index) => (
            <RecommendationItem
              key={index}
              recommendation={recommendation}
              index={index}
              compactMode={compactMode}
              riskTier={riskTier}
            />
          ))}
        </BlockStack>

        {/* Expand/collapse button */}
        {hasMoreItems && (
          <View inlineAlignment="center">
            <Button
              kind="plain"
              onPress={() => {
                const newExpandedState = !isExpanded;
                setIsExpanded(newExpandedState);
                
                // Track expand/collapse interaction
                trackUserInteraction(AnalyticsEventType.RECOMMENDATIONS_VIEWED, {
                  riskTier,
                  action: newExpandedState ? 'expanded' : 'collapsed',
                  totalRecommendations: recommendations.length,
                  visibleRecommendations: newExpandedState ? recommendations.length : maxInitialItems,
                  timestamp: Date.now()
                });
              }}
              accessibilityLabel={
                isExpanded 
                  ? 'Show fewer recommendations' 
                  : `Show ${recommendations.length - maxInitialItems} more recommendations`
              }
            >
              {isExpanded 
                ? 'Show Less' 
                : `Show ${recommendations.length - maxInitialItems} More`
              }
            </Button>
          </View>
        )}

        {/* Call to action for high-risk customers */}
        {riskTier === 'HIGH_RISK' && !compactMode && (
          <View
            border="base"
            cornerRadius="base"
            padding="base"
          >
            <BlockStack spacing="tight">
              <Text size="small" emphasis="bold" appearance="critical">
                🎯 Priority Action Required
              </Text>
              <Text size="small">
                Following these recommendations will significantly improve your delivery success rate and unlock better shipping options.
              </Text>
            </BlockStack>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Individual recommendation item component with text truncation
 */
function RecommendationItem({ 
  recommendation, 
  index, 
  compactMode, 
  riskTier 
}: { 
  recommendation: string; 
  index: number; 
  compactMode: boolean; 
  riskTier: string; 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get priority indicator based on position and risk tier
  const getPriorityIndicator = () => {
    if (riskTier === 'HIGH_RISK' && index < 2) {
      return '🔥'; // High priority for high-risk customers
    }
    if (index === 0) {
      return '⭐'; // Top recommendation
    }
    return '•'; // Regular bullet point
  };

  // Truncate long recommendations
  const maxLength = compactMode ? 80 : 120;
  const { truncated, needsTruncation, fullText } = truncateText(recommendation, maxLength);
  const displayText = isExpanded ? fullText : truncated;

  return (
    <View>
      <BlockStack spacing="extraTight">
        <InlineLayout 
          spacing={compactMode ? "tight" : "base"} 
          columns={['auto', 'fill']}
          blockAlignment="start"
        >
          <Text 
            size={compactMode ? "small" : "base"}
            appearance={index < 2 && riskTier === 'HIGH_RISK' ? 'critical' : 'subdued'}
          >
            {getPriorityIndicator()}
          </Text>
          <Text 
            size={compactMode ? "small" : "base"}
            appearance={index < 2 && riskTier === 'HIGH_RISK' ? 'critical' : 'subdued'}
          >
            {displayText}
          </Text>
        </InlineLayout>
        
        {/* Read more/less button for long content */}
        {needsTruncation && (
          <View inlineAlignment="end">
            <Button
              kind="plain"
              onPress={() => setIsExpanded(!isExpanded)}
              accessibilityLabel={
                isExpanded 
                  ? 'Show less text' 
                  : 'Show full recommendation'
              }
            >
              {isExpanded ? 'Show Less' : 'Read More'}
            </Button>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Recommendations summary for very compact displays
 */
export function RecommendationsSummary({ 
  recommendations, 
  riskTier 
}: { 
  recommendations: string[]; 
  riskTier: string; 
}) {
  const topRecommendation = recommendations[0];
  const remainingCount = recommendations.length - 1;

  if (!topRecommendation) return null;

  return (
    <View
      border="base"
      cornerRadius="base"
      padding="tight"
    >
      <BlockStack spacing="extraTight">
        <InlineLayout spacing="tight" columns={['auto', 'fill']}>
          <Text size="small">💡</Text>
          <Text size="small" emphasis="bold">
            Quick Tip
          </Text>
        </InlineLayout>
        <Text size="small">
          {topRecommendation}
        </Text>
        {remainingCount > 0 && (
          <Text size="extraSmall" appearance="subdued">
            +{remainingCount} more tip{remainingCount > 1 ? 's' : ''} available
          </Text>
        )}
      </BlockStack>
    </View>
  );
}