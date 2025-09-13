import {
  reactExtension,
  useApi,
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
  'purchase.thank-you.block.render',
  () => <OrderStatusRiskScore />
);

function OrderStatusRiskScore() {
  const { 
    query, 
    sessionToken,
    shop
  } = useApi();
  
  const settings = useSettings();
  
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  // Get customer and order information
  useEffect(() => {
    async function getOrderInfo() {
      try {
        const orderQuery = await query(`
          query {
            order {
              id
              name
              customer {
                id
                phone
                email
                firstName
                lastName
              }
              billingAddress {
                phone
              }
              shippingAddress {
                phone
              }
              totalPrice {
                amount
                currencyCode
              }
            }
          }
        `);

        if (settings?.enable_debug) {
          console.log('[OrderStatus] Order query result:', orderQuery);
        }

        const order = orderQuery?.data?.order;
        if (!order) {
          throw new Error('No order data available');
        }

        console.log('[OrderStatus] Order data:', JSON.stringify(order, null, 2));

        // Extract customer phone from multiple sources
        const customerPhone = 
          order.customer?.phone || 
          order.billingAddress?.phone || 
          order.shippingAddress?.phone;

        console.log('[OrderStatus] Phone extraction:', {
          customerPhone: order.customer?.phone,
          billingPhone: order.billingAddress?.phone,
          shippingPhone: order.shippingAddress?.phone,
          finalPhone: customerPhone
        });

        if (!customerPhone) {
          setError('Phone number not available for risk assessment');
          setLoading(false);
          return;
        }

        setCustomerData({
          phone: customerPhone,
          email: order.customer?.email,
          name: order.customer?.firstName || 'Customer',
          orderId: order.id,
          orderName: order.name,
          totalPrice: order.totalPrice
        });

      } catch (err) {
        console.error('[OrderStatus] Failed to get order info:', err);
        setError('Unable to load order information');
        setLoading(false);
      }
    }

    getOrderInfo();
  }, [query, settings]);

  // Fetch risk data when customer data is available
  useEffect(() => {
    if (!customerData || !settings?.api_endpoint) {
      setLoading(false);
      return;
    }

    async function fetchRiskData() {
      try {
        const token = await sessionToken.get();
        const apiUrl = `${settings.api_endpoint}?phone=${encodeURIComponent(customerData.phone)}`;
        
        console.log('[OrderStatus] Making API call:', {
          url: apiUrl,
          phone: customerData.phone,
          shop: shop.domain,
          hasToken: !!token
        });

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Shop-Domain': shop.domain,
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
        setError('Risk score temporarily unavailable');
        setRiskData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRiskData();
  }, [customerData, sessionToken, settings, shop]);

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

  // Render states
  if (!settings?.api_endpoint) {
    return null; // Don't show anything if not configured
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

  if (!riskData || !riskData.success) {
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