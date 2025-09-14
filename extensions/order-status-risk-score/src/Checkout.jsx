import {
  reactExtension,
  useApi,
  useOrder,
  useSettings,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  TextBlock,
  Divider,
  Heading,
  Spinner,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

/**
 * Order Status Risk Score Extension
 * 
 * Shows customer's risk score on the Thank-You/Order Status page.
 * Works with ALL payment methods including COD.
 */
export default reactExtension(
  'purchase.thank-you.customer-information.render-after',
  () => {
    console.log('[OrderStatus] Extension rendering...');
    return <OrderStatusRiskScore />;
  }
);

function OrderStatusRiskScore() {
  const { 
    order, 
    sessionToken,
    shop
  } = useApi();
  
  // Backup method to get order data
  const orderFromHook = useOrder();
  const settings = useSettings();

  // Use order from either source
  const currentOrder = order || orderFromHook;
  
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debug logging
  console.log('[OrderStatus] Component mounted', {
    shop: shop?.domain,
    settings,
    order,
    orderFromHook,
    currentOrder,
    hasSessionToken: !!sessionToken
  });

  // Fetch risk data on mount
  useEffect(() => {
    async function fetchRiskData() {
      try {
        console.log('[OrderStatus] Starting risk data fetch', {
          hasOrder: !!order,
          hasSettings: !!settings,
          apiEndpoint: settings?.api_endpoint
        });

        // Check if we have the required data
        if (!currentOrder) {
          setError('Order data not available');
          setLoading(false);
          return;
        }

        if (!settings?.api_endpoint) {
          setError('API endpoint not configured');
          setLoading(false);
          return;
        }

        // Extract phone from order
        const phone = 
          currentOrder.customer?.phone || 
          currentOrder.billingAddress?.phone || 
          currentOrder.shippingAddress?.phone;

        console.log('[OrderStatus] Phone extraction:', {
          customerPhone: currentOrder.customer?.phone,
          billingPhone: currentOrder.billingAddress?.phone,
          shippingPhone: currentOrder.shippingAddress?.phone,
          finalPhone: phone
        });

        if (!phone) {
          setError('Phone number not available for risk assessment');
          setLoading(false);
          return;
        }

        // Get session token and make API call
        const token = await sessionToken.get();
        const apiUrl = `${settings.api_endpoint}?phone=${encodeURIComponent(phone)}`;
        
        console.log('[OrderStatus] Making API call:', {
          url: apiUrl,
          phone: phone,
          shop: shop?.domain,
          hasToken: !!token
        });

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Shop-Domain': shop?.domain || '',
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('[OrderStatus] API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[OrderStatus] API error response:', errorText);
          throw new Error(`API responded with status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[OrderStatus] API response data:', data);

        if (data.success) {
          setRiskData(data.profile);
          setError(null);
        } else {
          throw new Error(data.error || 'Failed to fetch risk profile');
        }

      } catch (err) {
        console.error('[OrderStatus] Risk API error:', err);
        setError(err.message || 'Risk score temporarily unavailable');
        setRiskData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRiskData();
  }, [currentOrder, sessionToken, settings, shop]);

  // Helper functions
  const getRiskDisplayInfo = (riskTier, riskScore) => {
    switch (riskTier) {
      case 'HIGH_RISK':
        return {
          label: '🔴 High Risk',
          tone: 'critical',
          message: 'Please ensure prompt delivery acceptance to improve your score.'
        };
      case 'MEDIUM_RISK':
        return {
          label: '🟡 Medium Risk',
          tone: 'warning', 
          message: 'You have a good track record! Continue accepting deliveries on time.'
        };
      default:
        return {
          label: '🟢 Low Risk',
          tone: 'success',
          message: 'Excellent! You have a perfect delivery record.'
        };
    }
  };

  const calculateSuccessRate = (data) => {
    if (!data.totalOrders || data.totalOrders === 0) return 100;
    const failedAttempts = data.failedAttempts || 0;
    return Math.round(((data.totalOrders - failedAttempts) / data.totalOrders) * 100);
  };

  const getImprovementTips = (riskTier) => {
    switch (riskTier) {
      case 'HIGH_RISK':
        return [
          '• Accept deliveries promptly when they arrive',
          '• Avoid cancelling orders after placement',
          '• Consider prepayment for faster processing'
        ];
      case 'MEDIUM_RISK':
        return [
          '• Continue accepting deliveries on time',
          '• Keep cancellations to a minimum',
          '• Ensure contact information is current'
        ];
      default:
        return [
          '• Keep up the excellent work! 🎉',
          '• Continue accepting deliveries reliably'
        ];
    }
  };

  // Debug render states
  console.log('[OrderStatus] Render state:', {
    hasApiEndpoint: !!settings?.api_endpoint,
    apiEndpoint: settings?.api_endpoint,
    loading,
    error,
    hasRiskData: !!riskData,
    hasOrder: !!currentOrder
  });

  // Always show something - don't return null
  if (!settings?.api_endpoint) {
    return (
      <BlockStack spacing="base">
        <Divider />
        <Heading level={3}>⚙️ ReturnsX Configuration</Heading>
        <Banner tone="warning">
          Extension not configured. Please set the API endpoint in theme customizer.
        </Banner>
      </BlockStack>
    );
  }

  if (loading) {
    return (
      <BlockStack spacing="base">
        <Divider />
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small" />
          <Text>Loading ReturnsX risk profile...</Text>
        </InlineStack>
      </BlockStack>
    );
  }

  if (error && !riskData) {
    return (
      <BlockStack spacing="base">
        <Divider />
        <Heading level={3}>📊 ReturnsX Risk Profile</Heading>
        <Banner tone="info">
          {error === 'Phone number not available for risk assessment' 
            ? 'Risk score unavailable - phone number not provided during checkout.'
            : 'Risk score temporarily unavailable. Your order will be processed normally.'
          }
        </Banner>
      </BlockStack>
    );
  }

  if (!riskData) {
    return (
      <BlockStack spacing="base">
        <Divider />
        <Heading level={3}>🆕 Welcome to ReturnsX!</Heading>
        <Banner tone="success">
          As a new customer, you have Zero Risk status with full COD access.
        </Banner>
        <TextBlock>
          Your risk score will be updated based on your delivery success rate.
        </TextBlock>
      </BlockStack>
    );
  }

  const riskInfo = getRiskDisplayInfo(riskData.riskTier, riskData.riskScore);
  const successRate = calculateSuccessRate(riskData);

  return (
    <BlockStack spacing="base">
      <Divider />
      
      {/* Header */}
      <Heading level={3}>📊 Your ReturnsX Risk Profile</Heading>

      {/* Risk Score Banner */}
      <Banner tone={riskInfo.tone}>
        <BlockStack spacing="tight">
          <InlineStack spacing="base" blockAlignment="center">
            <Text emphasis="bold" size="large">{riskInfo.label}</Text>
            <Text emphasis="bold">Score: {parseFloat(riskData.riskScore).toFixed(1)}/100</Text>
          </InlineStack>
          <Text>{riskInfo.message}</Text>
        </BlockStack>
      </Banner>

      {/* Statistics */}
      <BlockStack spacing="tight">
        <Text emphasis="bold">Your delivery history:</Text>
        <InlineStack spacing="large">
          <Text>Total orders: {riskData.totalOrders || 0}</Text>
          <Text>Success rate: {successRate}%</Text>
        </InlineStack>
      </BlockStack>

      {/* Improvement Tips */}
      {settings?.show_detailed_tips && (
        <BlockStack spacing="tight">
          <Text emphasis="bold">Tips for maintaining good standing:</Text>
          {getImprovementTips(riskData.riskTier).map((tip) => (
            <Text key={tip} size="small">{tip}</Text>
          ))}
        </BlockStack>
      )}

      {/* Footer */}
      <Text appearance="subdued" size="small">
        ReturnsX helps reduce COD return rates through unified risk assessment
      </Text>
    </BlockStack>
  );
}

// Fallback component to ensure something always renders
function FallbackDisplay() {
  return (
    <BlockStack spacing="base">
      <Divider />
      <Heading level={3}>🔧 ReturnsX Debug</Heading>
      <Banner tone="info">
        Extension loaded but no data available. Check console for details.
      </Banner>
    </BlockStack>
  );
}