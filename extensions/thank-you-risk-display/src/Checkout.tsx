import {
  reactExtension,
  BlockStack,
  Text,
  View,
  Button,
  useApi,
  useSubscription,
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
import { useOptimizedRiskProfile } from './hooks/useOptimizedRiskProfile';
import { useErrorHandling } from './hooks/useErrorHandling';
import { useAnalytics } from './hooks/useAnalytics';
import { globalPerformanceMonitor } from './services/performanceMonitor';
import { AnalyticsEventType } from './services/analyticsService';
import { ExtensionConfig, CustomerData, RiskProfileResponse, ErrorType, ErrorState } from './types';
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
  
  // Get order confirmation API for Thank You page - access it correctly
  const api = useApi();
  const orderConfirmationData = useSubscription((api as any).orderConfirmation);
  
  // Extract customer data from backend via webhook correlation
  const [customerData, setCustomerData] = React.useState<CustomerData | null>(null);
  const [customerLoading, setCustomerLoading] = React.useState(true);
  const [customerError, setCustomerError] = React.useState<string | null>(null);
  
  // Constants for retry logic
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 200; // Start with 200ms, increase with backoff
  
  React.useEffect(() => {
    async function fetchCustomerDataFromBackend(retryCount = 0) {
      try {
        setCustomerLoading(true);
        
        // Get order ID from OrderConfirmationApi
        const orderId = (orderConfirmationData as any)?.order?.id;
        
        if (!orderId) {
          if (retryCount >= MAX_RETRIES) {
            console.error(`Failed to get order ID after ${MAX_RETRIES} retries, giving up`);
            setCustomerError('Unable to load order information. Please refresh the page.');
            setCustomerLoading(false);
            return;
          }
          
          console.log(`No order ID available yet from OrderConfirmationApi, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
          // Use exponential backoff with jitter
          const delay = RETRY_DELAY * Math.pow(1.5, retryCount) + Math.random() * 100;
          setTimeout(() => fetchCustomerDataFromBackend(retryCount + 1), delay);
          return;
        }
        
        console.log('Fetching customer data for order ID:', orderId);
        
        // Call the backend API endpoint to get customer data - use absolute URL for sandbox environment
        // Determine backend URL with proper fallback hierarchy
        let backendUrl: string;
        
        if (config?.api_endpoint) {
          // 1. Prefer config.api_endpoint when present
          backendUrl = new URL('/api/get-order-data', config.api_endpoint).toString();
        } else if (typeof process !== 'undefined' && process.env?.REACT_APP_API_ENDPOINT) {
          // 2. Fall back to environment variable
          backendUrl = new URL('/api/get-order-data', process.env.REACT_APP_API_ENDPOINT).toString();
        } else if (typeof window !== 'undefined' && window.location.hostname.includes('extensions.shopifycdn.com')) {
          // 3. Development mode - use tunnel URL
          backendUrl = 'https://active-burner-shipping-viewpicture.trycloudflare.com/api/get-order-data';
        } else {
          // 4. Finally default to production URL
          backendUrl = 'https://returnsx.pk/api/get-order-data';
        }
        
        console.log('Making API request to:', `${backendUrl}?orderId=${encodeURIComponent(orderId)}`);
        
        const response = await fetch(`${backendUrl}?orderId=${encodeURIComponent(orderId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('API response status:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        const apiData = await response.json();
        
        if (apiData.error) {
          throw new Error(apiData.error);
        }
        
        // Extract customer data from API response
        const customer = apiData.customer;
        const orderInfo = apiData.orderInfo;
        
        if (customer || orderInfo) {
          setCustomerData({
            phone: customer?.phone || orderInfo?.customerPhone || undefined,
            email: customer?.email || orderInfo?.customerEmail || undefined,
            orderId: orderInfo?.orderId || orderId,
            checkoutToken: undefined, // No longer using checkout tokens
          });
        } else {
          // No customer data found - this is a new customer
          setCustomerData(null);
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
        setCustomerError(`Failed to load customer data: ${error instanceof Error ? error.message : String(error)}`);
        setCustomerData(null);
      } finally {
        setCustomerLoading(false);
      }
    }
    
    // Only start fetching if we have the API available
    if ((api as any).orderConfirmation) {
      fetchCustomerDataFromBackend();
    }
  }, [orderConfirmationData, api]);

  // Initialize analytics tracking with stable config
  const analyticsConfig = React.useMemo(() => config || {} as ExtensionConfig, [config]);
  const {
    trackEvent,
    trackError,
    isEnabled: analyticsEnabled
  } = useAnalytics({
    config: analyticsConfig,
    enabled: true
  });

  // Initialize error handling for the main component
  const {
    handleError: handleMainError,
  } = useErrorHandling({
    config,
    maxRetries: 2,
    enableAutoRetry: false,
  });

  // Track extension load with stable dependencies
  const hasTrackedLoad = React.useRef(false);
  React.useEffect(() => {
    if (config && analyticsEnabled && !hasTrackedLoad.current) {
      trackEvent(AnalyticsEventType.EXTENSION_LOADED, {
        configLoaded: !!config,
        customerDataLoaded: !!customerData,
        timestamp: Date.now()
      });
      hasTrackedLoad.current = true;
    }
  }, [config, customerData, analyticsEnabled]); // Removed trackEvent from dependencies

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
  readonly config: ExtensionConfig;
  readonly customerData: CustomerData;
}) {
  // Initialize analytics for this component
  const {
    trackEvent,
    trackError,
    trackApiCall
  } = useAnalytics({ config });

  // Track successful render with stable reference (must be at top of component)
  const hasTrackedRender = React.useRef<string | null>(null);

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
    onRetry: React.useCallback((attempt: number) => {
      console.log(`Retrying API request, attempt ${attempt}`);
      trackEvent(AnalyticsEventType.API_CALL_STARTED, {
        endpoint: config.api_endpoint,
        retryAttempt: attempt,
        timestamp: Date.now()
      });
    }, [config.api_endpoint]),
  });

  // Convert API error to handled error if needed
  const currentError = apiError ? handleError(new Error(apiError.message), 'api') : handledError;

  // Track errors with stable reference
  const hasTrackedError = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (currentError && hasTrackedError.current !== currentError.message) {
      trackError({
        errorType: currentError.type,
        message: currentError.message,
        component: 'RiskAssessmentView',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      hasTrackedError.current = currentError.message;
    }
  }, [currentError]); // Removed trackError from dependencies

  // Track render effect (now that riskProfile is available)
  React.useEffect(() => {
    if (riskProfile) {
      const riskProfileKey = `${riskProfile.riskTier}-${riskProfile.isNewCustomer}`;
      if (hasTrackedRender.current !== riskProfileKey) {
        trackEvent(AnalyticsEventType.EXTENSION_RENDERED, {
          renderType: 'risk_profile',
          riskTier: riskProfile.riskTier,
          isNewCustomer: riskProfile.isNewCustomer,
          hasRecommendations: !!riskProfile.recommendations?.length,
          timestamp: Date.now()
        });
        hasTrackedRender.current = riskProfileKey;
      }
    }
  }, [riskProfile]);

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
  readonly riskProfile: RiskProfileResponse;
  readonly config: ExtensionConfig;
  readonly customerData: CustomerData;
  readonly error: ErrorState | null;
  readonly onRetry: () => Promise<void>;
}) {
  // Initialize analytics for user interactions
  const { trackUserInteraction } = useAnalytics({ config });

  // Track risk card view with stable reference
  const hasTrackedCardView = React.useRef<string | null>(null);
  const cardViewKey = `${riskProfile.riskTier}-${riskProfile.riskScore}`;
  React.useEffect(() => {
    if (hasTrackedCardView.current !== cardViewKey) {
      trackUserInteraction(AnalyticsEventType.RISK_CARD_VIEWED, {
        riskTier: riskProfile.riskTier,
        riskScore: riskProfile.riskScore,
        isNewCustomer: riskProfile.isNewCustomer,
        hasRecommendations: !!riskProfile.recommendations?.length,
        timestamp: Date.now()
      });
      hasTrackedCardView.current = cardViewKey;
    }
  }, [riskProfile, trackUserInteraction, cardViewKey]);

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