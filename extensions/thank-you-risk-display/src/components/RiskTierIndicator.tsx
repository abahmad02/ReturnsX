import {
  BlockStack,
  Text,
  InlineLayout,
  View,
} from '@shopify/ui-extensions-react/checkout';

interface RiskTierIndicatorProps {
  riskTier: 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  riskScore?: number;
  showScore: boolean;
  useColorCoding: boolean;
  compactMode: boolean;
  isNewCustomer: boolean;
}

/**
 * Risk Tier Indicator Component
 * 
 * Displays risk level with:
 * - Color coding based on risk tier
 * - Icons for visual representation
 * - Accessible labels and descriptions
 * - Responsive design for mobile devices
 */
export function RiskTierIndicator({ 
  riskTier, 
  riskScore, 
  showScore, 
  useColorCoding, 
  compactMode,
  isNewCustomer 
}: RiskTierIndicatorProps) {
  
  // Get risk tier display properties
  const getRiskTierProps = () => {
    if (isNewCustomer) {
      return {
        label: 'New Customer',
        description: 'Building your delivery profile',
        appearance: 'subdued' as const,
        icon: '👤',
        colorClass: 'new-customer',
      };
    }

    switch (riskTier) {
      case 'ZERO_RISK':
        return {
          label: 'Trusted Customer',
          description: 'Excellent delivery record',
          appearance: useColorCoding ? 'success' as const : 'subdued' as const,
          icon: '✅',
          colorClass: 'zero-risk',
        };
      case 'MEDIUM_RISK':
        return {
          label: 'Good Customer',
          description: 'Reliable with room for improvement',
          appearance: useColorCoding ? 'warning' as const : 'subdued' as const,
          icon: '⚠️',
          colorClass: 'medium-risk',
        };
      case 'HIGH_RISK':
        return {
          label: 'Needs Attention',
          description: 'Multiple delivery challenges',
          appearance: useColorCoding ? 'critical' as const : 'subdued' as const,
          icon: '🚨',
          colorClass: 'high-risk',
        };
      default:
        return {
          label: 'Unknown',
          description: 'Risk assessment unavailable',
          appearance: 'subdued' as const,
          icon: '❓',
          colorClass: 'unknown',
        };
    }
  };

  const tierProps = getRiskTierProps();

  return (
    <View
      accessibilityRole="status"
      accessibilityLabel={`Risk level: ${tierProps.label}. ${tierProps.description}`}
    >
      <InlineLayout 
        spacing={compactMode ? "tight" : "base"} 
        columns={['auto', 'fill', 'auto']}
        blockAlignment="center"
      >
        {/* Risk tier icon */}
        <View>
          <Text size={compactMode ? "small" : "base"}>
            {tierProps.icon}
          </Text>
        </View>

        {/* Risk tier label and description */}
        <BlockStack spacing="extraTight">
          <Text 
            size={compactMode ? "small" : "base"}
            emphasis={compactMode ? undefined : "bold"}
            appearance={tierProps.appearance}
          >
            {tierProps.label}
          </Text>
          {!compactMode && (
            <Text 
              size="small" 
              appearance="subdued"
            >
              {tierProps.description}
            </Text>
          )}
        </BlockStack>

        {/* Risk score badge */}
        {showScore && !isNewCustomer && riskScore !== undefined && (
          <View
            border="base"
            cornerRadius="base"
            padding="extraTight"
          >
            <Text 
              size="small" 
              emphasis="bold"
              appearance={tierProps.appearance}
            >
              {riskScore}%
            </Text>
          </View>
        )}
      </InlineLayout>

      {/* Success rate indicator for non-new customers */}
      {!isNewCustomer && !compactMode && (
        <View>
          <RiskProgressBar 
            riskScore={riskScore || 0}
            riskTier={riskTier}
            useColorCoding={useColorCoding}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Visual progress bar for risk score
 */
function RiskProgressBar({ 
  riskScore, 
  riskTier, 
  useColorCoding 
}: { 
  riskScore: number; 
  riskTier: string; 
  useColorCoding: boolean; 
}) {
  // Calculate success rate (inverse of risk score)
  const successRate = Math.max(0, 100 - riskScore);
  
  // Get color based on risk tier
  const getBarColor = () => {
    if (!useColorCoding) return 'base';
    
    switch (riskTier) {
      case 'ZERO_RISK': return 'success';
      case 'MEDIUM_RISK': return 'warning';
      case 'HIGH_RISK': return 'critical';
      default: return 'base';
    }
  };

  return (
    <BlockStack spacing="extraTight">
      <InlineLayout spacing="base" columns={['fill', 'auto']}>
        <Text size="small" appearance="subdued">
          Success Rate
        </Text>
        <Text size="small" emphasis="bold">
          {successRate}%
        </Text>
      </InlineLayout>
      
      {/* Progress bar representation using text */}
      <View
        border="base"
        cornerRadius="base"
        padding="extraTight"
      >
        <Text size="small">
          {'█'.repeat(Math.floor(successRate / 10))}{'░'.repeat(10 - Math.floor(successRate / 10))}
        </Text>
      </View>
    </BlockStack>
  );
}