import { useState, useCallback, useRef, useEffect } from 'react';
import { ErrorState, ErrorType, ExtensionConfig } from '../types';

interface ErrorHandlingOptions {
  config?: ExtensionConfig | null;
  maxRetries?: number;
  retryDelay?: number;
  enableAutoRetry?: boolean;
  onError?: (error: ErrorState) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: (error: ErrorState) => void;
}

interface ErrorHandlingResult {
  error: ErrorState | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
  setError: (error: ErrorState | null) => void;
  retry: () => Promise<void>;
  clearError: () => void;
  handleError: (error: unknown, context?: string) => ErrorState;
}

/**
 * Comprehensive error handling hook with retry logic and fallback management
 */
export function useErrorHandling({
  config,
  maxRetries = 3,
  retryDelay = 1000,
  enableAutoRetry = false,
  onError,
  onRetry,
  onMaxRetriesReached,
}: ErrorHandlingOptions = {}): ErrorHandlingResult {
  const [error, setErrorState] = useState<ErrorState | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRetryFunctionRef = useRef<(() => Promise<void>) | null>(null);

  // Clear retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Set error with automatic retry logic
   */
  const setError = useCallback((newError: ErrorState | null) => {
    setErrorState(newError);
    
    if (newError) {
      // Call error callback
      if (onError) {
        onError(newError);
      }

      // Auto-retry for retryable errors
      if (enableAutoRetry && newError.retryable && retryCount < maxRetries) {
        const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
        
        retryTimeoutRef.current = setTimeout(() => {
          if (lastRetryFunctionRef.current) {
            retry();
          }
        }, delay);
      }
    } else {
      // Clear retry count when error is cleared
      setRetryCount(0);
    }
  }, [enableAutoRetry, retryCount, maxRetries, retryDelay, onError]);

  /**
   * Manual retry function
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!error || !error.retryable || retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    // Call retry callback
    if (onRetry) {
      onRetry(newRetryCount);
    }

    try {
      // Execute the last retry function if available
      if (lastRetryFunctionRef.current) {
        await lastRetryFunctionRef.current();
        // If successful, clear error
        setErrorState(null);
        setRetryCount(0);
      }
    } catch (retryError) {
      // Handle retry failure
      const retryErrorState = handleError(retryError, 'retry');
      
      if (newRetryCount >= maxRetries) {
        // Max retries reached
        if (onMaxRetriesReached) {
          onMaxRetriesReached(retryErrorState);
        }
        
        // Update error to indicate max retries reached
        setErrorState({
          ...retryErrorState,
          message: `${retryErrorState.message} (Max retries reached)`,
          retryable: false,
        });
      } else {
        // Update error for next retry
        setErrorState(retryErrorState);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [error, retryCount, maxRetries, onRetry, onMaxRetriesReached]);

  /**
   * Clear error and reset retry count
   */
  const clearError = useCallback(() => {
    setErrorState(null);
    setRetryCount(0);
    setIsRetrying(false);
    
    // Clear any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Convert unknown error to ErrorState
   */
  const handleError = useCallback((error: unknown, context?: string): ErrorState => {
    let errorState: ErrorState;

    if (error instanceof Error) {
      // Categorize error based on message content
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorState = {
          type: ErrorType.TIMEOUT_ERROR,
          message: 'Request timed out. Please try again.',
          retryable: true,
        };
      } else if (error.message.includes('Network error') || error.message.includes('fetch')) {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: 'Network connection failed. Please check your internet connection.',
          retryable: true,
        };
      } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Authentication')) {
        errorState = {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication failed. Please contact support.',
          retryable: false,
        };
      } else if (error.message.includes('Invalid response') || error.message.includes('validation')) {
        errorState = {
          type: ErrorType.INVALID_RESPONSE,
          message: 'Received invalid response from server.',
          retryable: false,
        };
      } else if (error.message.includes('Configuration') || error.message.includes('config')) {
        errorState = {
          type: ErrorType.CONFIGURATION_ERROR,
          message: `Configuration error: ${error.message}`,
          retryable: false,
        };
      } else if (error.message.includes('Circuit breaker') || error.message.includes('Service temporarily unavailable')) {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: 'Service is temporarily unavailable. Please try again later.',
          retryable: true,
        };
      } else {
        errorState = {
          type: ErrorType.NETWORK_ERROR,
          message: error.message || 'An unexpected error occurred.',
          retryable: true,
        };
      }
    } else {
      errorState = {
        type: ErrorType.NETWORK_ERROR,
        message: 'An unknown error occurred.',
        retryable: true,
      };
    }

    // Add context if provided
    if (context && config?.enable_debug_mode) {
      errorState.message = `[${context}] ${errorState.message}`;
    }

    return errorState;
  }, [config?.enable_debug_mode]);

  /**
   * Register retry function for auto-retry
   */
  const registerRetryFunction = useCallback((retryFn: () => Promise<void>) => {
    lastRetryFunctionRef.current = retryFn;
  }, []);

  const canRetry = error?.retryable === true && retryCount < maxRetries && !isRetrying;

  return {
    error,
    isRetrying,
    retryCount,
    canRetry,
    setError,
    retry,
    clearError,
    handleError,
    registerRetryFunction,
  } as ErrorHandlingResult & { registerRetryFunction: (retryFn: () => Promise<void>) => void };
}

/**
 * Specialized error handling hook for API operations
 */
export function useApiErrorHandling(config?: ExtensionConfig | null) {
  return useErrorHandling({
    config,
    maxRetries: 3,
    retryDelay: 1000,
    enableAutoRetry: false, // Manual retry for API calls
  });
}

/**
 * Specialized error handling hook for configuration loading
 */
export function useConfigErrorHandling(config?: ExtensionConfig | null) {
  return useErrorHandling({
    config,
    maxRetries: 1,
    retryDelay: 500,
    enableAutoRetry: false, // Configuration errors usually aren't retryable
  });
}

/**
 * Specialized error handling hook with aggressive retry for critical operations
 */
export function useCriticalErrorHandling(config?: ExtensionConfig | null) {
  return useErrorHandling({
    config,
    maxRetries: 5,
    retryDelay: 500,
    enableAutoRetry: true, // Auto-retry for critical operations
  });
}

/**
 * Error boundary helper for converting React errors to ErrorState
 */
export function convertReactErrorToErrorState(error: Error, errorInfo?: React.ErrorInfo): ErrorState {
  return {
    type: ErrorType.CONFIGURATION_ERROR,
    message: `Component error: ${error.message}`,
    retryable: false,
    fallbackData: {
      success: false,
      riskTier: 'ZERO_RISK' as const,
      riskScore: 0,
      totalOrders: 0,
      failedAttempts: 0,
      successfulDeliveries: 0,
      isNewCustomer: true,
      message: 'Welcome! Thank you for your order.',
      error: 'Component error occurred',
    },
  };
}