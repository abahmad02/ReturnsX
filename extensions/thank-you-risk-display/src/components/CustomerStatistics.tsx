import {
  BlockStack,
  Text,
  InlineLayout,
  View,
  Grid,
} from '@shopify/ui-extensions-react/checkout';
import { RiskProfileResponse } from '../types';

interface CustomerStatisticsProps {
  riskProfile: RiskProfileResponse;
  compactMode: boolean;
}

/**
 * Customer Statistics Component
 * 
 * Displays customer delivery statistics including:
 * - Total orders placed
 * - Successful deliveries
 * - Failed delivery attempts
 * - Success rate percentage
 * - Mobile-responsive grid layout
 */
export function CustomerStatistics({ 
  riskProfile, 
  compactMode 
}: CustomerStatisticsProps) {
  const { 
    totalOrders, 
    successfulDeliveries, 
    failedAttempts 
  } = riskProfile;

  // Calculate success rate
  const successRate = totalOrders > 0 
    ? Math.round((successfulDeliveries / totalOrders) * 100)
    : 0;

  // Statistics data for display
  const statistics = [
    {
      label: 'Total Orders',
      value: totalOrders.toString(),
      description: 'Orders placed',
      icon: '📦',
    },
    {
      label: 'Successful',
      value: successfulDeliveries.toString(),
      description: 'Delivered successfully',
      icon: '✅',
      highlight: true,
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      description: 'Delivery success',
      icon: '📊',
      highlight: successRate >= 80,
    },
  ];

  // Add failed attempts if there are any
  if (failedAttempts > 0) {
    statistics.push({
      label: 'Failed Attempts',
      value: failedAttempts.toString(),
      description: 'Delivery failures',
      icon: '❌',
    });
  }

  return (
    <View>
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        {/* Section header */}
        <Text 
          size={compactMode ? "small" : "base"} 
          emphasis="bold"
          appearance="subdued"
        >
          Delivery History
        </Text>

        {/* Statistics grid - responsive layout */}
        {compactMode ? (
          <CompactStatisticsLayout statistics={statistics} />
        ) : (
          <ExpandedStatisticsLayout statistics={statistics} />
        )}

        {/* Additional context for high failure rates */}
        {failedAttempts > 0 && failedAttempts >= totalOrders * 0.3 && (
          <View
            border="base"
            cornerRadius="base"
            padding="tight"
          >
            <Text size="small" appearance="subdued">
              💡 Tip: Ensure you're available during delivery hours to improve your success rate
            </Text>
          </View>
        )}
      </BlockStack>
    </View>
  );
}

/**
 * Compact layout for mobile devices and compact mode
 */
function CompactStatisticsLayout({ 
  statistics 
}: { 
  statistics: Array<{
    label: string;
    value: string;
    description: string;
    icon: string;
    highlight?: boolean;
  }> 
}) {
  return (
    <BlockStack spacing="tight">
      {statistics.map((stat, index) => (
        <InlineLayout 
          key={index}
          spacing="base" 
          columns={['auto', 'fill', 'auto']}
          blockAlignment="center"
        >
          <Text size="small">{stat.icon}</Text>
          <Text size="small" appearance="subdued">
            {stat.label}
          </Text>
          <Text 
            size="small" 
            emphasis={stat.highlight ? "bold" : undefined}
            appearance={stat.highlight ? "success" : "subdued"}
          >
            {stat.value}
          </Text>
        </InlineLayout>
      ))}
    </BlockStack>
  );
}

/**
 * Expanded layout for desktop and full mode
 */
function ExpandedStatisticsLayout({ 
  statistics 
}: { 
  statistics: Array<{
    label: string;
    value: string;
    description: string;
    icon: string;
    highlight?: boolean;
  }> 
}) {
  return (
    <Grid
      columns={statistics.length <= 2 ? ['fill', 'fill'] : ['fill', 'fill', 'fill']}
      spacing="base"
    >
      {statistics.map((stat, index) => (
        <StatisticCard 
          key={index}
          statistic={stat}
        />
      ))}
    </Grid>
  );
}

/**
 * Individual statistic card for expanded layout
 */
function StatisticCard({ 
  statistic 
}: { 
  statistic: {
    label: string;
    value: string;
    description: string;
    icon: string;
    highlight?: boolean;
  } 
}) {
  return (
    <View
      border="base"
      cornerRadius="base"
      padding="base"
    >
      <BlockStack spacing="tight" inlineAlignment="center">
        <Text size="large">{statistic.icon}</Text>
        <Text 
          size="large" 
          emphasis="bold"
          appearance={statistic.highlight ? "success" : "subdued"}
        >
          {statistic.value}
        </Text>
        <Text 
          size="small" 
          appearance="subdued"
        >
          {statistic.label}
        </Text>
        <Text 
          size="extraSmall" 
          appearance="subdued"
        >
          {statistic.description}
        </Text>
      </BlockStack>
    </View>
  );
}