import { useState, useEffect, useCallback, useRef } from 'react';
import { RiskProfileResponse, ErrorState, ErrorType, ExtensionConfig, CustomerData } from '../types';
import { ReturnsXApiClient, createApiClient, createAuthenticatedApiClient, DEFAULT_API_CONFIG } from '../services/apiClient';
import { useErrorHandler } from '../components/ErrorBoundary';
import { useSessionToken } from '@shopify/ui-extensions-react/checkout';

interface UseRiskProfileResult {
  riskProfile: RiskProfileResponse | null;
  isLoading: boolean;
  error: ErrorState | null;
  refetch: () => Promise<void>;
  cancelRequest: () => void;
}

interface UseRiskProfileOptions {
  config: ExtensionConfig | null;
  customerData: CustomerData | null;
  enabled?: boolean;
  onSuccess?: (profile: RiskProfileResponse) => void;
  onError?: (error: ErrorState) => void;
  sessionToken?: string;
}

/**
 * Hook for fetching customer risk profile from ReturnsX API
 * 
 * Features:
 * - Automatic request management with cleanup
 * - Error handling with fallback states
 * - Request cancellation on component unmount
 * - Retry functionality
 * - Loading state management
 */
export function useRiskProfile({
  config,
  customerData,
  enabled = true,
  onSuccess,
  onError,
  sessionToken,
}: UseRiskProfileOptions): UseRiskProfileResult {
  const [riskProfile, setRiskProfile] = useState<RiskProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  
  const apiClientRef = useRef<ReturnsXApiClient | null>(null);
  const handleError = useErrorHandler();
  const requestIdRef = useRef<number>(0);
  const shopifySessionToken = useSessionToken();

  // Initialize API client with authentication when config changes
  useEffect(() => {
    const initializeApiClient = async () => {
      if (config?.api_endpoint) {
        try {
          const tokenToUse = sessionToken || shopifySessionToken;
          
          if (tokenToUse) {
            // Create authenticated API client with session token
            apiClientRef.current = await createAuthenticatedApiClient({
              ...DEFAULT_API_CONFIG,
              baseUrl: config.api_endpoint,
              enableDebug: config.enable_debug_mode,
            }, tokenToUse);
          } else {
            // Fallback to basic API client (for backward compatibility)
            apiClientRef.current = createApiClient({
              ...DEFAULT_API_CONFIG,
              baseUrl: config.api_endpoint,
              authToken: config.auth_token,
              enableDebug: config.enable_debug_mode,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize API client';
          handleError(error instanceof Error ? error : new Error(errorMessage), 'useRiskProfile:init');
          
          setError({
            type: ErrorType.AUTHENTICATION_ERROR,
            message: `Authentication error: ${errorMessage}`,
            retryable: true,
          });
        }
      }
    };

    initializeApiClient();

    return () => {
      // Cleanup API client on config change
      if (apiClientRef.current) {
        apiClientRef.current.cancelRequests();
        apiClientRef.current = null;
      }
    };
  }, [config?.api_endpoint, config?.enable_debug_mode, config?.auth_token, sessionToken, shopifySessionToken, handleError]);

  // Fetch risk profile function
  const fetchRiskProfile = useCallback(async (): Promise<void> => {
    // Validate prerequisites
    if (!enabled || !config || !customerData || !apiClientRef.current) {
      return;
    }

    // Don't fetch if we don't have any customer identifiers
    if (!customerData.phone && !customerData.email) {
      setError({
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'No customer phone or email available',
        retryable: false,
      });
      return;
    }

    // Generate unique request ID to handle race conditions
    const currentRequestId = ++requestIdRef.current;
    
    try {
      setIsLoading(true);
      setError(null);

      // Check authentication state before making request
      const authState = apiClientRef.current.getAuthenticationState();
      if (!authState.isAuthenticated && authState.error) {
        throw new Error(`Authentication failed: ${authState.error.message}`);
      }

      const profile = await apiClientRef.current.getRiskProfile({
        phone: customerData.phone,
        email: customerData.email,
        orderId: customerData.orderId,
        checkoutToken: customerData.checkoutToken,
      });

      // Check if this is still the current request (handle race conditions)
      if (currentRequestId === requestIdRef.current) {
        setRiskProfile(profile);
        
        if (profile.success && onSuccess) {
          onSuccess(profile);
        } else if (!profile.success && profile.error) {
          const errorState: ErrorState = {
            type: ErrorType.NETWORK_ERROR,
            message: profile.error,
            retryable: true,
            fallbackData: profile,
          };
          setError(errorState);
          
          if (onError) {
            onError(errorState);
          }
        }
      }

    } catch (error) {
      // Only update state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        handleError(error instanceof Error ? error : new Error(errorMessage), 'useRiskProfile:fetch');
        
        // Determine error type based on error message
        let errorType = ErrorType.NETWORK_ERROR;
        let retryable = true;
        
        if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
          errorType = ErrorType.AUTHENTICATION_ERROR;
          
          // Try to handle authentication error and retry
          if (apiClientRef.current) {
            const recoverySuccess = await apiClientRef.current.handleAuthenticationError(error);
            if (!recoverySuccess) {
              retryable = false; // Don't retry if auth recovery failed
            }
          }
        } else if (errorMessage.includes('timeout')) {
          errorType = ErrorType.TIMEOUT_ERROR;
        } else if (errorMessage.includes('Configuration') || errorMessage.includes('Invalid')) {
          errorType = ErrorType.CONFIGURATION_ERROR;
          retryable = false;
        }
        
        const errorState: ErrorState = {
          type: errorType,
          message: errorMessage,
          retryable,
        };
        
        setError(errorState);
        
        // Set fallback profile for new customers (except for auth errors)
        if (errorType !== ErrorType.AUTHENTICATION_ERROR) {
          setRiskProfile({
            success: false,
            riskTier: 'ZERO_RISK',
            riskScore: 0,
            totalOrders: 0,
            failedAttempts: 0,
            successfulDeliveries: 0,
            isNewCustomer: true,
            message: 'Welcome! We\'re excited to serve you.',
            error: errorMessage,
          });
        }

        if (onError) {
          onError(errorState);
        }
      }
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, config, customerData, onSuccess, onError, handleError]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (enabled && config && customerData && apiClientRef.current) {
      fetchRiskProfile();
    }
  }, [fetchRiskProfile, enabled, config, customerData]);

  // Refetch function for manual retry
  const refetch = useCallback(async (): Promise<void> => {
    await fetchRiskProfile();
  }, [fetchRiskProfile]);

  // Cancel request function
  const cancelRequest = useCallback((): void => {
    if (apiClientRef.current) {
      apiClientRef.current.cancelRequests();
    }
    
    // Increment request ID to invalidate any pending requests
    requestIdRef.current++;
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRequest();
    };
  }, [cancelRequest]);

  return {
    riskProfile,
    isLoading,
    error,
    refetch,
    cancelRequest,
  };
}

/**
 * Hook for checking API health status
 */
export function useApiHealth(config: ExtensionConfig | null, sessionToken?: string): {
  isHealthy: boolean | null;
  isChecking: boolean;
  checkHealth: () => Promise<void>;
  authenticationStatus: 'authenticated' | 'unauthenticated' | 'unknown';
} {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [authenticationStatus, setAuthenticationStatus] = useState<'authenticated' | 'unauthenticated' | 'unknown'>('unknown');
  const apiClientRef = useRef<ReturnsXApiClient | null>(null);
  const handleError = useErrorHandler();
  const shopifySessionToken = useSessionToken();

  // Initialize API client with authentication
  useEffect(() => {
    const initializeApiClient = async () => {
      if (config?.api_endpoint) {
        try {
          const tokenToUse = sessionToken || shopifySessionToken;
          
          if (tokenToUse) {
            apiClientRef.current = await createAuthenticatedApiClient({
              ...DEFAULT_API_CONFIG,
              baseUrl: config.api_endpoint,
              enableDebug: config.enable_debug_mode,
            }, tokenToUse);
            
            const authState = apiClientRef.current.getAuthenticationState();
            setAuthenticationStatus(authState.isAuthenticated ? 'authenticated' : 'unauthenticated');
          } else {
            apiClientRef.current = createApiClient({
              ...DEFAULT_API_CONFIG,
              baseUrl: config.api_endpoint,
              authToken: config.auth_token,
              enableDebug: config.enable_debug_mode,
            });
            setAuthenticationStatus('unauthenticated');
          }
        } catch (error) {
          handleError(error instanceof Error ? error : new Error('Failed to initialize API client'), 'useApiHealth');
          setIsHealthy(false);
          setAuthenticationStatus('unauthenticated');
        }
      }
    };

    initializeApiClient();

    return () => {
      if (apiClientRef.current) {
        apiClientRef.current.cancelRequests();
      }
    };
  }, [config?.api_endpoint, config?.enable_debug_mode, config?.auth_token, sessionToken, shopifySessionToken, handleError]);

  const checkHealth = useCallback(async (): Promise<void> => {
    if (!apiClientRef.current) {
      setIsHealthy(false);
      return;
    }

    try {
      setIsChecking(true);
      const healthy = await apiClientRef.current.healthCheck();
      setIsHealthy(healthy);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Health check failed'), 'useApiHealth');
      setIsHealthy(false);
    } finally {
      setIsChecking(false);
    }
  }, [handleError]);

  return {
    isHealthy,
    isChecking,
    checkHealth,
    authenticationStatus,
  };
}