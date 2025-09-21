/**
 * Optimized Risk Profile Hook with Caching and Performance Monitoring
 * 
 * Enhanced version of useRiskProfile with:
 * - Response caching for repeated requests
 * - Performance monitoring
 * - Optimized re-renders with proper memoization
 * - Lazy loading capabilities
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ExtensionConfig, CustomerData, RiskProfileResponse } from '../types';
import { createApiClient } from '../services/apiClient';
import { extensionCache, createCacheKey } from '../services/cacheService';
import { globalPerformanceMonitor } from '../services/performanceMonitor';

/**
 * Helper function to detect circuit breaker errors
 */
function isCircuitBreakerError(error: Error | null | undefined): boolean {
  if (!error) return false;
  return error.message.includes('Service temporarily unavailable') || 
         error.message.includes('Circuit breaker is OPEN');
}

interface UseOptimizedRiskProfileOptions {
  config: ExtensionConfig;
  customerData: CustomerData;
  enabled?: boolean;
  lazy?: boolean;
  cacheKey?: string;
  cacheTtl?: number;
  onApiCallStart?: () => void;
  onApiCallComplete?: (success: boolean, error?: string) => void;
}

interface UseOptimizedRiskProfileResult {
  riskProfile: RiskProfileResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
  cacheStats: {
    hit: boolean;
    key: string;
  };
}

export function useOptimizedRiskProfile({
  config,
  customerData,
  enabled = true,
  lazy = false,
  cacheKey,
  cacheTtl = 3 * 60 * 1000, // 3 minutes
  onApiCallStart,
  onApiCallComplete
}: UseOptimizedRiskProfileOptions): UseOptimizedRiskProfileResult {
  const [riskProfile, setRiskProfile] = useState<RiskProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Memoize API client to prevent recreation on every render
  const apiClient = useMemo(() => {
    if (!config?.api_endpoint) return null;
    
    return createApiClient({
      baseUrl: config.api_endpoint,
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableDebug: config.enable_debug_mode,
    });
  }, [
    config?.api_endpoint,
    config?.enable_debug_mode,
  ]);

  // Memoize cache key generation
  const generatedCacheKey = useMemo(() => {
    if (cacheKey) return cacheKey;
    
    if (!customerData) return null;
    
    return createCacheKey('risk-profile', {
      phone: customerData.phone || '',
      email: customerData.email || '',
      orderId: customerData.orderId || '',
    });
  }, [cacheKey, customerData]);

  // Memoize request parameters to prevent unnecessary API calls
  const requestParams = useMemo(() => {
    if (!customerData) return null;
    
    return {
      phone: customerData.phone,
      email: customerData.email,
      orderId: customerData.orderId,
      checkoutToken: customerData.checkoutToken,
    };
  }, [
    customerData?.phone,
    customerData?.email,
    customerData?.orderId,
    customerData?.checkoutToken,
  ]);

  // Optimized fetch function with caching and performance monitoring
  const fetchRiskProfile = useCallback(async (bypassCache = false) => {
    if (!apiClient || !requestParams || !generatedCacheKey) {
      return;
    }

    // Skip API calls for mock/development data to prevent infinite loops
    const isMockData = requestParams.email === 'test@example.com' || 
                      requestParams.phone === '+923001234567' ||
                      requestParams.orderId?.startsWith('dev-order-');
    
    if (isMockData) {
      console.log('[ReturnsX Extension] Detected mock data, returning fallback response instead of making API call');
      const mockResponse: RiskProfileResponse = {
        success: true,
        riskTier: 'ZERO_RISK',
        riskScore: 0,
        totalOrders: 0,
        failedAttempts: 0,
        successfulDeliveries: 0,
        isNewCustomer: true,
        message: 'Welcome! Thank you for your order. We look forward to serving you.',
        recommendations: ['Ensure you are available for delivery', 'Keep your phone accessible']
      };
      
      if (isMountedRef.current) {
        setRiskProfile(mockResponse);
        setIsLoading(false);
      }
      return;
    }

    // Check cache first (unless bypassing)
    if (!bypassCache) {
      const cached = extensionCache.get<RiskProfileResponse>(generatedCacheKey);
      if (cached) {
        setRiskProfile(cached);
        setCacheHit(true);
        globalPerformanceMonitor.recordApiCall(
          '/api/risk-profile',
          'POST',
          0, // No actual API call time
          true,
          true // Cache hit
        );
        return;
      }
    }

    setCacheHit(false);
    setIsLoading(true);
    setError(null);

    try {
      // Notify analytics of API call start
      if (onApiCallStart) {
        onApiCallStart();
      }
      
      // Time the API call for performance monitoring
      const startTime = performance.now();
      
      const response = await apiClient.getRiskProfile(requestParams);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Record API performance
      globalPerformanceMonitor.recordApiCall(
        '/api/risk-profile',
        'POST',
        responseTime,
        response.success,
        false // Not a cache hit
      );

      // Notify analytics of API call completion
      if (onApiCallComplete) {
        onApiCallComplete(response.success, response.error);
      }

      if (isMountedRef.current) {
        setRiskProfile(response);
        
        // Cache successful responses
        if (response.success) {
          extensionCache.set(generatedCacheKey, response, cacheTtl);
        }
      }
    } catch (err) {
      const apiError = err instanceof Error ? err : new Error('Unknown error');
      
      // Check if this is a circuit breaker error (service temporarily unavailable)
      const isBreakerError = isCircuitBreakerError(apiError);
      
      // Record failed API call
      globalPerformanceMonitor.recordApiCall(
        '/api/risk-profile',
        'POST',
        0,
        false,
        false
      );

      // Notify analytics of API call failure
      if (onApiCallComplete) {
        onApiCallComplete(false, apiError.message);
      }

      if (isMountedRef.current) {
        setError(apiError);
        
        // If circuit breaker is open, don't keep retrying - show fallback immediately
        if (isBreakerError) {
          console.warn('[ReturnsX Extension] Circuit breaker is open, stopping retries and showing fallback');
          // Create a fallback response for graceful degradation
          const fallbackResponse: RiskProfileResponse = {
            success: false,
            riskTier: 'ZERO_RISK',
            riskScore: 0,
            totalOrders: 0,
            failedAttempts: 0,
            successfulDeliveries: 0,
            isNewCustomer: true,
            message: 'Welcome! We look forward to serving you.',
            error: 'Service temporarily unavailable'
          };
          setRiskProfile(fallbackResponse);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiClient, requestParams, generatedCacheKey, cacheTtl, onApiCallStart, onApiCallComplete]);

  // Memoized refetch function
  const refetch = useCallback(async () => {
    await fetchRiskProfile(true); // Bypass cache on manual refetch
  }, [fetchRiskProfile]);

  // Memoized cache clear function
  const clearCache = useCallback(() => {
    if (generatedCacheKey) {
      extensionCache.delete(generatedCacheKey);
    }
  }, [generatedCacheKey]);

  // Effect for automatic fetching (with proper dependencies)
  useEffect(() => {
    if (!enabled || lazy) return;
    
    // Don't retry if we have a circuit breaker error
    if (isCircuitBreakerError(error)) {
      console.log('[ReturnsX Extension] Skipping fetch due to circuit breaker being open');
      return;
    }
    
    fetchRiskProfile();
  }, [enabled, lazy, fetchRiskProfile, error]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      apiClient?.cancelRequests();
    };
  }, [apiClient]);

  // Memoized result to prevent unnecessary re-renders
  const result = useMemo((): UseOptimizedRiskProfileResult => ({
    riskProfile,
    isLoading,
    error,
    refetch,
    clearCache,
    cacheStats: {
      hit: cacheHit,
      key: generatedCacheKey || '',
    },
  }), [
    riskProfile,
    isLoading,
    error,
    refetch,
    clearCache,
    cacheHit,
    generatedCacheKey,
  ]);

  return result;
}

/**
 * Hook for lazy loading risk profile data
 */
export function useLazyRiskProfile(options: Omit<UseOptimizedRiskProfileOptions, 'lazy'>) {
  const [shouldLoad, setShouldLoad] = useState(false);
  
  const result = useOptimizedRiskProfile({
    ...options,
    lazy: true,
    enabled: shouldLoad,
  });

  const load = useCallback(() => {
    setShouldLoad(true);
  }, []);

  return {
    ...result,
    load,
    isLazy: !shouldLoad,
  };
}

/**
 * Hook for preloading risk profile data
 */
export function usePreloadRiskProfile(
  configs: UseOptimizedRiskProfileOptions[],
  enabled = true
) {
  const [preloadedData, setPreloadedData] = useState<Map<string, RiskProfileResponse>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const preloadData = async () => {
      const promises = configs.map(async (config) => {
        const cacheKey = createCacheKey('risk-profile', {
          phone: config.customerData?.phone || '',
          email: config.customerData?.email || '',
          orderId: config.customerData?.orderId || '',
        });

        // Check if already cached
        const cached = extensionCache.get<RiskProfileResponse>(cacheKey);
        if (cached) {
          return { key: cacheKey, data: cached };
        }

        // Preload data
        try {
          const apiClient = createApiClient({
            baseUrl: config.config.api_endpoint,
            enableDebug: false, // Disable debug for preloading
          });

          const response = await apiClient.getRiskProfile({
            phone: config.customerData?.phone,
            email: config.customerData?.email,
            orderId: config.customerData?.orderId,
            checkoutToken: config.customerData?.checkoutToken,
          });

          if (response.success) {
            extensionCache.set(cacheKey, response, config.cacheTtl);
            return { key: cacheKey, data: response };
          }
        } catch (error) {
          // Silently fail preloading
          console.warn('Preload failed for', cacheKey, error);
        }

        return null;
      });

      const results = await Promise.allSettled(promises);
      const newPreloadedData = new Map<string, RiskProfileResponse>();

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          newPreloadedData.set(result.value.key, result.value.data);
        }
      });

      setPreloadedData(newPreloadedData);
    };

    preloadData();
  }, [configs, enabled]);

  return {
    preloadedData,
    isPreloaded: (cacheKey: string) => preloadedData.has(cacheKey),
    getPreloaded: (cacheKey: string) => preloadedData.get(cacheKey),
  };
}