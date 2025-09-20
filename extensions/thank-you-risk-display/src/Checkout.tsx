import {
  reactExtension,
  BlockStack,
  Text,
  View,
  Button,
} from '@shopify/ui-extensions-react/checkout';
import {
  ErrorBoundary,
  RiskAssessmentCard,
  ErrorStateComponent,
  RiskAssessmentLoadingState,
  ConfigurationLoadingState,
  CustomerDataLoadingState,
  NewCustomerFallbackState,
  ServiceUnavailableFallbackState,
  MinimalFallbackState,
} from './components';
import { useExtensionConfig } from './hooks/useExtensionConfig';
import { useCustomerData } from './hooks/useCustomerData';
import { useOptimizedRiskProfile } from './hooks/useOptimizedRiskProfile';
import { useErrorHandling } from './hooks/useErrorHandling';
import { useAnalytics, useComponentPerformance } from './hooks/useAnalytics';
import { globalPerformanceMonitor } from './services/performanceMonitor';
import { AnalyticsEventType } from './services/analyticsService';
import { ExtensionConfig, CustomerData, RiskProfileResponse, ErrorType } from './types';
import { validateCustomerData, sanitizeDebugInfo } from './utils';
import React from 'react';

// Extension entry point for the Thank You page
export default reactExtension(
  'purchase.thank-you.block.render',
  () => (
    <ErrorBoundary>
      <ThankYouRiskDisplay />
    </ErrorBoundary>
  )
);

function ThankYouRiskDisplay() {
  const { config, isLoading: configLoading, error: configError } = useExtensionConfig();
  const { customerData, isLoading: customerLoading, error: customerError } = useCustomerData();

  // Initialize analytics tracking
  const {
    trackEvent,
    trackError,
    trackPerformance,
    startPerformanceTimer,
    isEnabled: analyticsEnabled
  } = useAnalytics({
    config: config || {} as ExtensionConfig,
    enabled: true
  });

  // Track component performance
  const { trackCustomMetric } = useComponentPerformance('ThankYouRiskDisplay', config || {} as ExtensionConfig);

  // Initialize error handling for the main component
  const {
    handleError: handleMainError,
  } = useErrorHandling({
    config,
    maxRetries: 2,
    enableAutoRetry: false,
  });

  // Track extension load
  React.useEffect(() => {
    if (config && analyticsEnabled) {
      trackEvent(AnalyticsEventType.EXTENSION_LOADED, {
        configLoaded: !!config,
        customerDataLoaded: !!customerData,
        timestamp: Date.now()
      });
    }
  }, [config, customerData, analyticsEnabled, trackEvent]);

  // Show loading state while configuration is loading
  if (configLoading) {
    return (
      <ConfigurationLoadingState
        compactMode={false}
        accessibilityLabel="Loading extension configuration"
      />
    );
  }

  // Show loading state while customer data is loading
  if (customerLoading) {
    return (
      <CustomerDataLoadingState
        compactMode={false}
        accessibilityLabel="Loading customer information"
      />
    );
  }

  // Handle configuration errors with fallback
  if (configError) {
    const errorState = handleMainError(new Error(configError), 'configuration');

    // Track configuration error
    if (analyticsEnabled) {
      trackError({
        errorType: ErrorType.CONFIGURATION_ERROR,
        message: configError,
        component: 'ThankYouRiskDisplay',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }

    // For configuration errors, show minimal fallback unless debug mode
    if (!config?.enable_debug_mode) {
      return (
        <MinimalFallbackState
          config={config || {} as ExtensionConfig}
          compactMode={false}
        />
      );
    }

    return (
      <ErrorStateComponent
        error={errorState}
        config={config || {} as ExtensionConfig}
        compactMode={false}
      />
    );
  }

  // Handle customer data errors (show welcome message for new customers)
  if (customerError || !customerData) {
    if (!config) {
      return (
        <MinimalFallbackState
          config={{} as ExtensionConfig}
          compactMode={false}
        />
      );
    }

    const errorState = customerError ?
      handleMainError(new Error(customerError), 'customer-data') : null;

    // Track customer data error
    if (customerError && analyticsEnabled) {
      trackError({
        errorType: ErrorType.NETWORK_ERROR,
        message: customerError,
        component: 'ThankYouRiskDisplay',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }

    // Track new customer fallback
    if (!customerData && analyticsEnabled) {
      trackEvent(AnalyticsEventType.EXTENSION_RENDERED, {
        renderType: 'new_customer_fallback',
        hasCustomerData: false,
        timestamp: Date.now()
      });
    }

    return (
      <NewCustomerFallbackState
        config={config}
        compactMode={false}
        error={errorState}
      />
    );
  }

  // Validate customer data before proceeding
  if (customerData) {
    const validation = validateCustomerData(customerData);
    if (!validation.isValid) {
      const validationError = handleMainError(
        new Error(`Invalid customer data: ${validation.errors.join(', ')}`),
        'validation'
      );

      return (
        <NewCustomerFallbackState
          config={config!}
          compactMode={false}
          error={validationError}
        />
      );
    }
  }

  // Main risk assessment component with comprehensive error handling
  return (
    <RiskAssessmentView
      config={config!}
      customerData={customerData}
    />
  );
}



/**
 * Main risk assessment component with comprehensive API integration and error handling
 */
function RiskAssessmentView({
  config,
  customerData
}: {
  config: ExtensionConfig;
  customerData: CustomerData;
}) {
  // Initialize analytics for this component
  const {
    trackEvent,
    trackError,
    trackApiCall,
    startPerformanceTimer
  } = useAnalytics({ config });

  // Enable performance monitoring in debug mode
  React.useEffect(() => {
    globalPerformanceMonitor.setEnabled(config.enable_debug_mode);
  }, [config.enable_debug_mode]);

  // Track API call performance
  const apiStartTime = React.useRef<number>(0);

  const {
    riskProfile,
    isLoading,
    error: apiError,
    refetch
  } = useOptimizedRiskProfile({
    config,
    customerData,
    enabled: true,
    cacheTtl: 3 * 60 * 1000, // 3 minutes
    onApiCallStart: () => {
      apiStartTime.current = Date.now();
      trackEvent(AnalyticsEventType.API_CALL_STARTED, {
        endpoint: config.api_endpoint,
        customerType: customerData.phone ? 'phone' : 'email',
        timestamp: Date.now()
      });
    },
    onApiCallComplete: (success: boolean, error?: string) => {
      const duration = Date.now() - apiStartTime.current;
      trackApiCall(config.api_endpoint, 'POST', apiStartTime.current, success, error);

      if (success) {
        trackEvent(AnalyticsEventType.API_CALL_SUCCESS, {
          endpoint: config.api_endpoint,
          duration,
          timestamp: Date.now()
        });
      } else {
        trackEvent(AnalyticsEventType.API_CALL_ERROR, {
          endpoint: config.api_endpoint,
          duration,
          error,
          timestamp: Date.now()
        });
      }
    }
  });

  // Initialize error handling for API operations
  const {
    error: handledError,
    isRetrying,
    canRetry,
    handleError,
  } = useErrorHandling({
    config,
    maxRetries: 3,
    retryDelay: 2000,
    enableAutoRetry: false,
    onRetry: (attempt) => {
      console.log(`Retrying API request, attempt ${attempt}`);
      trackEvent(AnalyticsEventType.API_CALL_STARTED, {
        endpoint: config.api_endpoint,
        retryAttempt: attempt,
        timestamp: Date.now()
      });
    },
  });

  // Convert API error to handled error if needed
  const currentError = apiError ? handleError(new Error(apiError.message), 'api') : handledError;

  // Track errors
  React.useEffect(() => {
    if (currentError) {
      trackError({
        errorType: currentError.type,
        message: currentError.message,
        component: 'RiskAssessmentView',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  }, [currentError, trackError]);

  // Show loading state while fetching risk profile
  if (isLoading || isRetrying) {
    return (
      <RiskAssessmentLoadingState
        message={isRetrying ? "Retrying request..." : "Analyzing your delivery profile..."}
        compactMode={false}
        accessibilityLabel={isRetrying ? "Retrying risk assessment" : "Loading risk assessment"}
      />
    );
  }

  // Show error state with comprehensive fallback handling
  if (currentError && !riskProfile) {
    // For non-retryable errors or max retries reached, show service unavailable fallback
    if (!currentError.retryable || !canRetry) {
      return (
        <ServiceUnavailableFallbackState
          config={config}
          compactMode={false}
          error={currentError}
        />
      );
    }

    // Show error state with retry option
    return (
      <ErrorStateComponent
        error={currentError}
        config={config}
        onRetry={async () => {
          try {
            await refetch();
          } catch (retryError) {
            handleError(retryError, 'retry');
          }
        }}
        compactMode={false}
      />
    );
  }

  // Show risk profile (either successful or fallback)
  if (riskProfile) {
    // Track successful render
    React.useEffect(() => {
      trackEvent(AnalyticsEventType.EXTENSION_RENDERED, {
        renderType: 'risk_profile',
        riskTier: riskProfile.riskTier,
        isNewCustomer: riskProfile.isNewCustomer,
        hasRecommendations: !!riskProfile.recommendations?.length,
        timestamp: Date.now()
      });
    }, [riskProfile, trackEvent]);

    return (
      <RiskProfileView
        riskProfile={riskProfile}
        config={config}
        customerData={customerData}
        error={currentError}
        onRetry={async () => {
          try {
            await refetch();
          } catch (retryError) {
            handleError(retryError, 'manual-retry');
          }
        }}
      />
    );
  }

  // Ultimate fallback state
  return (
    <NewCustomerFallbackState
      config={config}
      compactMode={false}
      error={currentError}
    />
  );
}



/**
 * Component for displaying risk profile information with comprehensive error handling
 */
function RiskProfileView({
  riskProfile,
  config,
  customerData,
  error,
  onRetry
}: {
  riskProfile: RiskProfileResponse;
  config: ExtensionConfig;
  customerData: CustomerData;
  error: any;
  onRetry: () => Promise<void>;
}) {
  // Initialize analytics for user interactions
  const { trackUserInteraction } = useAnalytics({ config });

  // Track risk card view
  React.useEffect(() => {
    trackUserInteraction(AnalyticsEventType.RISK_CARD_VIEWED, {
      riskTier: riskProfile.riskTier,
      riskScore: riskProfile.riskScore,
      isNewCustomer: riskProfile.isNewCustomer,
      hasRecommendations: !!riskProfile.recommendations?.length,
      timestamp: Date.now()
    });
  }, [riskProfile, trackUserInteraction]);

  // Handle WhatsApp contact with error handling and analytics
  const handleWhatsAppContact = () => {
    try {
      const message = config.whatsapp_message_template
        .replace('{orderNumber}', customerData.orderId || 'N/A');
      const whatsappUrl = `https://wa.me/${config.whatsapp_phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`;

      // Track WhatsApp click
      trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
        riskTier: riskProfile.riskTier,
        orderId: customerData.orderId,
        phoneNumber: config.whatsapp_phone,
        timestamp: Date.now()
      });

      // Note: In a real Shopify extension, you'd use the proper navigation API
      console.log('WhatsApp URL:', whatsappUrl);

      // Attempt to open WhatsApp (browser environment)
      if (typeof window !== 'undefined') {
        window.open(whatsappUrl, '_blank');
      }
    } catch (whatsappError) {
      console.error('Failed to open WhatsApp:', whatsappError);
      // Fallback: could show a toast or alternative contact method
    }
  };

  return (
    <BlockStack spacing="base">
      {/* Main Risk Assessment Card */}
      <RiskAssessmentCard
        riskProfile={riskProfile}
        config={config}
        onWhatsAppContact={handleWhatsAppContact}
      />

      {/* Error indicator with retry - only show if there's an error but we have fallback data */}
      {error && riskProfile && !riskProfile.success && (
        <View
          border="base"
          cornerRadius="base"
          padding="tight"
          accessibilityRole="alert"
          accessibilityLabel="Connection issue warning"
        >
          <BlockStack spacing="tight">
            <Text size="small" appearance="warning">
              ⚠️ Using cached data due to connection issues
            </Text>
            {error.retryable && (
              <Button
                onPress={onRetry}
                kind="plain"
                accessibilityLabel="Retry loading fresh data"
              >
                Refresh
              </Button>
            )}
          </BlockStack>
        </View>
      )}

      {/* Debug information with comprehensive error details */}
      {config.enable_debug_mode && (
        <View border="base" cornerRadius="base" padding="tight">
          <BlockStack spacing="tight">
            <Text size="small" appearance="critical">
              Debug Information:
            </Text>
            <Text size="small" appearance="subdued">
              API Success: {riskProfile.success ? 'Yes' : 'No'}
            </Text>
            <Text size="small" appearance="subdued">
              Risk Tier: {riskProfile.riskTier}
            </Text>
            <Text size="small" appearance="subdued">
              Is New Customer: {riskProfile.isNewCustomer ? 'Yes' : 'No'}
            </Text>
            <Text size="small" appearance="subdued">
              Order ID: {customerData.orderId || 'N/A'}
            </Text>
            <Text size="small" appearance="subdued">
              API Endpoint: {config.api_endpoint}
            </Text>
            {error && (
              <>
                <Text size="small" appearance="critical">
                  Error Type: {error.type}
                </Text>
                <Text size="small" appearance="critical">
                  Error Message: {error.message}
                </Text>
                <Text size="small" appearance="subdued">
                  Retryable: {error.retryable ? 'Yes' : 'No'}
                </Text>
              </>
            )}
            <Text size="small" appearance="subdued">
              Sanitized Data: {JSON.stringify(sanitizeDebugInfo({ customerData, config }), null, 2)}
            </Text>
          </BlockStack>
        </View>
      )}
    </BlockStack>
  );
}