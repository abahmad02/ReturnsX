import { useOrder } from '@shopify/ui-extensions-react/checkout';
import { CustomerData } from '../types';
import { useErrorHandler } from '../components/ErrorBoundary';

/**
 * Hook to extract customer data from the order for risk assessment
 */
export function useCustomerData(): {
  customerData: CustomerData | null;
  isLoading: boolean;
  error: string | null;
} {
  const order = useOrder();
  const handleError = useErrorHandler();

  try {
    // If order is not loaded yet, return loading state
    if (!order) {
      return {
        customerData: null,
        isLoading: true,
        error: null,
      };
    }

    // Extract customer data from order
    const customerData: CustomerData = {
      phone: extractPhoneNumber(order),
      email: extractEmail(order),
      orderId: order.id,
      checkoutToken: (order as any).token || order.id, // Fallback to order ID if token not available
    };

    // Validate that we have at least one identifier
    if (!customerData.phone && !customerData.email) {
      return {
        customerData: null,
        isLoading: false,
        error: 'No customer phone or email found in order',
      };
    }

    return {
      customerData,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract customer data';
    handleError(error instanceof Error ? error : new Error(errorMessage), 'useCustomerData');
    
    return {
      customerData: null,
      isLoading: false,
      error: errorMessage,
    };
  }
}

/**
 * Extracts phone number from order data
 */
function extractPhoneNumber(order: any): string | undefined {
  // Try to get phone from shipping address first
  if (order.shippingAddress?.phone) {
    return normalizePhoneNumber(order.shippingAddress.phone);
  }

  // Try billing address
  if (order.billingAddress?.phone) {
    return normalizePhoneNumber(order.billingAddress.phone);
  }

  // Try customer phone
  if (order.customer?.phone) {
    return normalizePhoneNumber(order.customer.phone);
  }

  return undefined;
}

/**
 * Extracts email from order data
 */
function extractEmail(order: any): string | undefined {
  // Try customer email first
  if (order.customer?.email) {
    return order.customer.email.toLowerCase().trim();
  }

  // Try contact email
  if (order.email) {
    return order.email.toLowerCase().trim();
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