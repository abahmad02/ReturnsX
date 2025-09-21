import { CustomerData } from '../types';
import { useState, useEffect } from 'react';

/**
 * Hook to extract customer data for risk assessment
 * Note: For thank-you page extensions, we extract data from the global Shopify context
 * since the standard order hooks are not available in this extension point
 */
export function useCustomerData(): {
  customerData: CustomerData | null;
  isLoading: boolean;
  error: string | null;
} {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const extractCustomerData = async () => {
      try {
        const orderData = extractOrderDataFromContext();
        
        if (!isMounted) return;

        // Extract customer data from order
        const extractedData: CustomerData = {
          phone: extractPhoneNumber(orderData),
          email: extractEmail(orderData),
          orderId: orderData?.id || 'unknown',
          checkoutToken: orderData?.token || orderData?.id || 'unknown',
        };

        // Validate that we have at least one identifier
        if (!extractedData.phone && !extractedData.email) {
          if (isMounted) {
            setError('No customer phone or email found in order data');
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setCustomerData(extractedData);
          setError(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to extract customer data';
        console.error('[ReturnsX Extension] Error extracting customer data:', err);
        if (isMounted) {
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Wait for DOM to be ready using requestAnimationFrame for better timing
    const waitForData = () => {
      requestAnimationFrame(() => {
        extractCustomerData();
      });
    };

    waitForData();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array since we only want this to run once

  return {
    customerData,
    isLoading,
    error,
  };
}

/**
 * Extracts order data from various sources (Shopify context, meta tags, URL params)
 */
function extractOrderDataFromContext(): any {
  // Method 1: Try to get data from Shopify global context
  if (typeof window !== 'undefined') {
    // Check for Shopify checkout data
    if ((window as any).Shopify?.checkout) {
      return (window as any).Shopify.checkout;
    }
    // Check for order data in meta tags or other global variables
    else if ((window as any).orderData) {
      return (window as any).orderData;
    }
    // Check for data in meta tags
    else {
      const orderIdMeta = document.querySelector('meta[name="shopify-checkout-order-id"]');
      const customerEmailMeta = document.querySelector('meta[name="shopify-checkout-customer-email"]');
      const customerPhoneMeta = document.querySelector('meta[name="shopify-checkout-customer-phone"]');
      
      if (orderIdMeta || customerEmailMeta || customerPhoneMeta) {
        return {
          id: orderIdMeta?.getAttribute('content'),
          email: customerEmailMeta?.getAttribute('content'),
          phone: customerPhoneMeta?.getAttribute('content'),
        };
      }
    }
  }

  // Method 2: Try to extract from URL parameters (fallback)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id') || urlParams.get('id');
    const email = urlParams.get('email');
    const phone = urlParams.get('phone');
    
    if (orderId || email || phone) {
      return {
        id: orderId,
        email: email,
        phone: phone,
      };
    }
  }

  // Method 3: Create mock data for development/testing
  // Only use mock data in development environment, not in production
  const isDevelopment = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && window.location?.hostname === 'localhost');
  
  if (isDevelopment) {
    const mockData = {
      id: 'dev-order-' + Date.now(),
      email: 'test@example.com',
      phone: '+923001234567',
      customer: {
        email: 'test@example.com',
        phone: '+923001234567',
      },
    };
    
    console.warn('[ReturnsX Extension] Using mock customer data for development. API calls will be skipped.');
    return mockData;
  }

  // In production, if no data is found, return null instead of mock data
  console.warn('[ReturnsX Extension] No customer data found in production environment.');
  return null;
}

/**
 * Extracts phone number from order data
 */
function extractPhoneNumber(orderData: any): string | undefined {
  // Try to get phone from shipping address first
  if (orderData.shippingAddress?.phone || orderData.shipping_address?.phone) {
    return normalizePhoneNumber(orderData.shippingAddress?.phone || orderData.shipping_address?.phone);
  }

  // Try billing address
  if (orderData.billingAddress?.phone || orderData.billing_address?.phone) {
    return normalizePhoneNumber(orderData.billingAddress?.phone || orderData.billing_address?.phone);
  }

  // Try customer phone
  if (orderData.customer?.phone) {
    return normalizePhoneNumber(orderData.customer.phone);
  }

  // Try direct phone field
  if (orderData.phone) {
    return normalizePhoneNumber(orderData.phone);
  }

  return undefined;
}

/**
 * Extracts email from order data
 */
function extractEmail(orderData: any): string | undefined {
  // Try customer email first
  if (orderData.customer?.email) {
    return orderData.customer.email.toLowerCase().trim();
  }

  // Try contact email
  if (orderData.email) {
    return orderData.email.toLowerCase().trim();
  }

  // Try contact_email field
  if (orderData.contact_email) {
    return orderData.contact_email.toLowerCase().trim();
  }

  return undefined;
}

/**
 * Normalizes phone number format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume it's a Pakistani number and add +92
  if (!normalized.startsWith('+')) {
    // Remove leading 0 if present (common in Pakistani numbers)
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = '+92' + normalized;
  }
  
  return normalized;
}