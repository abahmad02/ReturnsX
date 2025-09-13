import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  useSettings,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  TextBlock,
  Button,
  Divider,
  Heading,
  Link,
  Spinner,
  View,
} from '@shopify/ui-extensions-react/checkout';

// Post-Purchase UI Extension 
export default reactExtension(
  'purchase.checkout.block.render',
  () => <PostPurchaseRiskDisplay />
);

function PostPurchaseRiskDisplay() {
  const { 
    query, 
    sessionToken,
    extension,
  } = useApi();
  
  const settings = useSettings();
  
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [correlationStored, setCorrelationStored] = useState(false);

  // Get checkout information from post-purchase context
  useEffect(() => {
    async function getCheckoutInfo() {
      try {
        // Query checkout data - note: order ID may not be available yet
        const checkoutQuery = `
          query getCheckout {
            checkout {
              token
              webUrl
              totalPrice {
                amount
                currencyCode
              }
              buyerIdentity {
                customer {
                  id
                  email
                  phone
                }
                email
                phone
              }
              shippingAddress {
                phone
              }
              order {
                id
                name
              }
            }
          }
        `;

        const result = await query(checkoutQuery);
        console.log('Checkout Query Result:', result);

        if (result?.data?.checkout) {
          const checkout = result.data.checkout;
          setCheckoutData({
            token: checkout.token,
            webUrl: checkout.webUrl,
            totalPrice: checkout.totalPrice,
            customerEmail: checkout.buyerIdentity?.customer?.email || checkout.buyerIdentity?.email,
            customerPhone: checkout.buyerIdentity?.customer?.phone || checkout.buyerIdentity?.phone || checkout.shippingAddress?.phone,
            customerId: checkout.buyerIdentity?.customer?.id,
            orderId: checkout.order?.id,
            orderName: checkout.order?.name
          });
          
          console.log('Processed Checkout Data:', {
            token: checkout.token,
            customerPhone: checkout.buyerIdentity?.customer?.phone || checkout.buyerIdentity?.phone || checkout.shippingAddress?.phone,
            orderId: checkout.order?.id
          });
        } else {
          console.warn('No checkout data found in query result');
        }

      } catch (err) {
        console.error('Error fetching checkout info:', err);
        setError('Unable to load checkout information');
        setLoading(false);
      }
    }
    
    getCheckoutInfo();
  }, [query]);

  // Store checkout correlation data for later matching with webhooks
  useEffect(() => {
    async function storeCheckoutCorrelation() {
      if (!checkoutData?.token || correlationStored) return;

      try {
        const token = await sessionToken.get();
        const correlationEndpoint = settings.correlation_endpoint || 'https://returnsx.vercel.app/api/checkout-correlation';

        const correlationData = {
          checkoutToken: checkoutData.token,
          customerPhone: checkoutData.customerPhone,
          customerEmail: checkoutData.customerEmail,
          customerId: checkoutData.customerId,
          orderId: checkoutData.orderId, // May be null
          orderName: checkoutData.orderName, // May be null
          totalPrice: checkoutData.totalPrice,
          timestamp: new Date().toISOString(),
          webUrl: checkoutData.webUrl
        };

        const response = await fetch(correlationEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(correlationData)
        });

        if (response.ok) {
          setCorrelationStored(true);
          console.log('Checkout correlation stored successfully');
        } else {
          console.warn('Failed to store checkout correlation:', response.statusText);
        }

      } catch (err) {
        console.error('Error storing checkout correlation:', err);
        // Non-critical error, continue with risk display
      }
    }

    storeCheckoutCorrelation();
  }, [checkoutData, sessionToken, settings.correlation_endpoint, correlationStored]);

  // Fetch risk data when checkout data is available
  useEffect(() => {
    async function fetchRiskData() {
      if (!checkoutData?.customerPhone) {
        // If no phone available, show generic new customer message
        setRiskData({
          success: true,
          isNewCustomer: true,
          riskTier: "ZERO_RISK",
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          message: "Welcome! You are classified as a Zero Risk customer."
        });
        setLoading(false);
        return;
      }

      try {
        const token = await sessionToken.get();
        
        const apiEndpoint = settings.api_endpoint || 'https://returnsx.vercel.app/api/risk-profile';
        const params = new URLSearchParams({
          phone: checkoutData.customerPhone,
          ...(checkoutData.customerEmail && { email: checkoutData.customerEmail }),
          ...(checkoutData.customerId && { customerId: checkoutData.customerId }),
          checkoutToken: checkoutData.token,
          context: 'post-purchase'
        });

        const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Shopify-Checkout-Token': checkoutData.token,
            ...(checkoutData.customerId && { 'X-Shopify-Customer-Id': checkoutData.customerId })
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const riskProfile = await response.json();
        setRiskData(riskProfile);
        
      } catch (err) {
        console.error('Error fetching risk data:', err);
        
        // Fallback for new customers or API errors
        setRiskData({
          success: true,
          isNewCustomer: true,
          riskTier: "ZERO_RISK",
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          message: "Welcome! You are a new customer with Zero Risk status."
        });
        
      } finally {
        setLoading(false);
      }
    }

    if (checkoutData) {
      fetchRiskData();
    }
  }, [checkoutData, sessionToken, settings.api_endpoint]);

  // Loading state
  if (loading) {
    return (
      <View>
        <BlockStack spacing="base">
          <InlineStack spacing="tight" blockAlignment="center">
            <Spinner size="small" />
            <Text>Loading your ReturnsX profile...</Text>
          </InlineStack>
        </BlockStack>
      </View>
    );
  }

  // Error state
  if (error && !riskData) {
    return (
      <View>
        <BlockStack spacing="base">
          <Heading level={3}>ReturnsX Status</Heading>
          <Banner tone="info">
            Unable to load risk profile at this time. Your order is being processed normally.
          </Banner>
        </BlockStack>
      </View>
    );
  }

  // No risk data (should not happen due to fallback)
  if (!riskData) {
    return null;
  }

  const { 
    riskTier, 
    riskScore, 
    totalOrders, 
    failedAttempts, 
    isNewCustomer,
    message 
  } = riskData;

  // Risk display configuration
  const getRiskDisplayInfo = (tier) => {
    switch (tier) {
      case 'ZERO_RISK':
        return {
          label: 'Zero Risk ✅',
          tone: 'success',
          message: 'Excellent! You are a trusted customer.',
          priority: 'low'
        };
      case 'MEDIUM_RISK':
        return {
          label: 'Medium Risk ⚠️',
          tone: 'warning',
          message: 'Your order may require additional verification.',
          priority: 'medium'
        };
      case 'HIGH_RISK':
        return {
          label: 'High Risk ❌',
          tone: 'critical',
          message: 'Future orders may require advance payment.',
          priority: 'high'
        };
      default:
        return {
          label: 'New Customer 🎉',
          tone: 'success',
          message: 'Welcome to our partner network!',
          priority: 'low'
        };
    }
  };

  const riskInfo = getRiskDisplayInfo(riskTier);
  const successRate = totalOrders > 0 ? 
    Math.round(((totalOrders - failedAttempts) / totalOrders) * 100) : 100;

  // Show different content based on risk level and settings
  return (
    <View>
      <BlockStack spacing="base">
        
        {/* Header */}
        <InlineStack spacing="base" blockAlignment="center">
          <Heading level={3}>ReturnsX Customer Status</Heading>
        </InlineStack>

        {/* Risk Status */}
        <Banner tone={riskInfo.tone}>
          <BlockStack spacing="tight">
            <InlineStack spacing="base" blockAlignment="center">
              <Text emphasis="bold">{riskInfo.label}</Text>
              {!isNewCustomer && (
                <Text size="small">Score: {parseFloat(riskScore || 0).toFixed(1)}/100</Text>
              )}
            </InlineStack>
            <Text>{message || riskInfo.message}</Text>
          </BlockStack>
        </Banner>

        {/* Order Statistics for existing customers */}
        {!isNewCustomer && totalOrders > 0 && (
          <InlineStack spacing="base">
            <Text size="small">
              <Text emphasis="bold">Orders:</Text> {totalOrders}
            </Text>
            <Text size="small">
              <Text emphasis="bold">Success Rate:</Text> {successRate}%
            </Text>
          </InlineStack>
        )}

        {/* New Customer Welcome */}
        {isNewCustomer && settings.show_welcome_message && (
          <BlockStack spacing="tight">
            <Text emphasis="bold" size="medium">🎉 Welcome to ReturnsX Network!</Text>
            <TextBlock>
              Thank you for your order! As a new customer, you have Zero Risk status 
              with full Cash-on-Delivery access across all partner stores.
            </TextBlock>
          </BlockStack>
        )}

        {/* Improvement Tips for Medium/High Risk */}
        {settings.show_improvement_tips && riskTier !== 'ZERO_RISK' && !isNewCustomer && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <Text emphasis="bold" size="small">💡 Quick Tips:</Text>
              {riskTier === 'HIGH_RISK' ? (
                <TextBlock size="small">
                  • Accept deliveries when they arrive • Avoid order cancellations • Consider prepayment for faster service
                </TextBlock>
              ) : (
                <TextBlock size="small">
                  • Continue accepting deliveries on time • Keep cancellations minimal • Maintain updated contact info
                </TextBlock>
              )}
            </BlockStack>
          </>
        )}

        {/* High Risk Support Contact */}
        {riskTier === 'HIGH_RISK' && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <Text emphasis="bold" size="small">Need Help?</Text>
              <Text size="small">
                Contact support for payment assistance and faster order processing.
              </Text>
            </BlockStack>
          </>
        )}

        {/* Debug Info (remove in production) */}
        {checkoutData?.token && (
          <Text appearance="subdued" size="extraSmall">
            Checkout: {checkoutData.token.slice(-8)} | Phone: {checkoutData.customerPhone ? '✓' : '✗'}
          </Text>
        )}

      </BlockStack>
    </View>
  );
}