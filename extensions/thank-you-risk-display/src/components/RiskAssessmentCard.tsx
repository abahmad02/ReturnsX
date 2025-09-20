import React, { memo, useMemo, useEffect } from 'react';
import {
    BlockStack,
    Text,
    InlineLayout,
    View,
} from '@shopify/ui-extensions-react/checkout';
import { RiskAssessmentCardProps } from '../types';
import { RiskTierIndicator } from './RiskTierIndicator';
import { CustomerStatistics } from './CustomerStatistics';
import { RecommendationsList } from './RecommendationsList';
import { WhatsAppContact } from './WhatsAppContact';
import { MessageDisplay, NewCustomerMessageDisplay } from './MessageDisplay';
import { generatePersonalizedRecommendations } from '../services/messageGenerator';
import { ConditionalLazyComponents, ProgressiveEnhancement, ViewportLazyComponent } from './LazyComponents';
import { globalPerformanceMonitor } from '../services/performanceMonitor';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsEventType } from '../services/analyticsService';

/**
 * Main Risk Assessment Card Component (Optimized)
 * 
 * Displays customer risk information in a responsive card format with:
 * - Risk tier indicator with color coding and icons
 * - Customer statistics (success rate, total orders, failed attempts)
 * - Conditional rendering based on customer type (new vs existing)
 * - Mobile-responsive design with proper touch targets
 * - WhatsApp integration for high-risk customers
 * - Performance optimizations with memoization and lazy loading
 */
export const RiskAssessmentCard = memo(function RiskAssessmentCard({
    riskProfile,
    config,
    onWhatsAppContact
}: RiskAssessmentCardProps) {
    // Initialize analytics
    const { trackUserInteraction, trackPerformance } = useAnalytics({ config });

    // Performance monitoring with analytics
    useEffect(() => {
        const startTime = performance.now();
        
        return () => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            globalPerformanceMonitor.recordRender('RiskAssessmentCard', renderTime);
            
            // Track performance metrics
            trackPerformance({
                renderTime,
                apiResponseTime: 0,
                totalLoadTime: renderTime,
                memoryUsage: (performance as any).memory?.usedJSHeapSize
            });
        };
    }, [trackPerformance]);

    // Memoize computed values to prevent unnecessary recalculations
    const computedValues = useMemo(() => {
        const isNewCustomer = riskProfile.isNewCustomer;
        const isHighRisk = riskProfile.riskTier === 'HIGH_RISK';
        const showWhatsApp = isHighRisk && config.whatsapp_enabled && config.whatsapp_phone;
        const personalizedRecommendations = generatePersonalizedRecommendations(riskProfile, config);
        
        return {
            isNewCustomer,
            isHighRisk,
            showWhatsApp,
            personalizedRecommendations,
        };
    }, [
        riskProfile.isNewCustomer,
        riskProfile.riskTier,
        riskProfile.riskScore,
        riskProfile.totalOrders,
        riskProfile.failedAttempts,
        riskProfile.successfulDeliveries,
        config.whatsapp_enabled,
        config.whatsapp_phone,
        config.show_detailed_tips,
    ]);

    const { isNewCustomer, isHighRisk, showWhatsApp, personalizedRecommendations } = computedValues;

    return (
        <View
            border="base"
            cornerRadius="base"
            padding={config.compact_mode ? "tight" : "base"}
            minBlockSize="fill"
        >
            <BlockStack spacing={config.compact_mode ? "tight" : "base"}>
                {/* Header with title and risk score */}
                <InlineLayout
                    spacing="base"
                    columns={['fill', 'auto']}
                    blockAlignment="center"
                >
                    <Text size={config.compact_mode ? "small" : "medium"} emphasis="bold">
                        {isNewCustomer ? 'Welcome to ReturnsX' : 'Delivery Profile'}
                    </Text>
                    {config.show_risk_score && !isNewCustomer && (
                        <Text
                            size="small"
                            appearance="subdued"
                        >
                            Score: {riskProfile.riskScore}%
                        </Text>
                    )}
                </InlineLayout>

                {/* Risk tier indicator */}
                <RiskTierIndicator
                    riskTier={riskProfile.riskTier}
                    riskScore={riskProfile.riskScore}
                    showScore={config.show_risk_score}
                    useColorCoding={config.use_color_coding}
                    compactMode={config.compact_mode}
                    isNewCustomer={isNewCustomer}
                />

                {/* Dynamic message display */}
                {isNewCustomer ? (
                    <NewCustomerMessageDisplay
                        config={config}
                        compactMode={config.compact_mode}
                    />
                ) : (
                    <MessageDisplay
                        riskProfile={riskProfile}
                        config={config}
                        compactMode={config.compact_mode}
                    />
                )}

                {/* Lazy-loaded components for better performance */}
                <ProgressiveEnhancement
                    condition={!isNewCustomer}
                    delay={100} // Small delay to prioritize critical content
                    enhanced={
                        <ViewportLazyComponent
                            fallback={<Text size="small" appearance="subdued">Loading details...</Text>}
                        >
                            <ConditionalLazyComponents
                                riskProfile={riskProfile}
                                config={config}
                                onWhatsAppContact={onWhatsAppContact}
                            />
                        </ViewportLazyComponent>
                    }
                >
                    {/* Fallback for immediate display */}
                    {!isNewCustomer && (
                        <CustomerStatistics
                            riskProfile={riskProfile}
                            compactMode={config.compact_mode}
                        />
                    )}
                </ProgressiveEnhancement>


            </BlockStack>
        </View>
    );
});