import {
  reactExtension,
  useApi,
  BlockStack,
  InlineStack,
  Text,
  TextBlock,
  Link,
  Banner,
  Divider,
  Heading,
  Button,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

// Thank you page UI extension
export default reactExtension('purchase.thank-you.block.render', () => <OrderStatusRiskDisplay />);

function OrderStatusRiskDisplay() {
  const { query, i18n, extension } = useApi();
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get customer and order information from thank you page
  const [customerPhone, setCustomerPhone] = useState(null);
  const [customerEmail, setCustomerEmail] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [orderTotal, setOrderTotal] = useState(null);

  // Fetch customer and order data from thank you page
  useEffect(() => {
    async function getOrderInfo() {
      try {
        const result = await query(`
          query {
            order {
              id
              totalPrice {
                amount
                currencyCode
              }
              customer {
                email
                phone
              }
              shippingAddress {
                phone
              }
            }
          }
        `);
        
        const order = result?.data?.order;
        if (order) {
          setOrderId(order.id);
          setOrderTotal(order.totalPrice?.amount);
          setCustomerEmail(order.customer?.email);
          setCustomerPhone(order.customer?.phone || order.shippingAddress?.phone);
        }
      } catch (err) {
        console.error('Error fetching order info:', err);
      }
    }
    
    getOrderInfo();
  }, [query]);

  // Fetch customer risk data
  useEffect(() => {
    async function fetchRiskData() {
      if (!customerPhone && !customerEmail) {
        setError('No customer contact information available');
        setLoading(false);
        return;
      }

      try {
        // Create query parameters for our API
        const params = new URLSearchParams();
        if (customerPhone) params.append('phone', customerPhone);
        if (customerEmail) params.append('email', customerEmail);
        if (orderId) params.append('orderId', orderId);

        // Make API call to our ReturnsX backend
        // Get API endpoint from extension settings
        const apiEndpoint = extension.settings.api_endpoint || 'https://returnsx.vercel.app/api/customer-risk';
        const apiUrl = `${apiEndpoint}?${params.toString()}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const riskInfo = await response.json();
        setRiskData(riskInfo);
      } catch (err) {
        console.error('Error fetching risk data:', err);
        setError('Unable to load risk information');
        
        // Fallback to new customer display
        setRiskData({
          success: true,
          isNewCustomer: true,
          riskTier: "ZERO_RISK",
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          message: "Welcome! You are classified as a Zero Risk customer."
        });
      } finally {
        setLoading(false);
      }
    }

    fetchRiskData();
  }, [customerPhone, customerEmail, orderId]);

  // Loading state
  if (loading) {
    return (
      <BlockStack spacing="loose">
        <Text size="medium" emphasis="bold">ReturnsX Customer Status</Text>
        <Text appearance="subdued">Loading your customer information...</Text>
      </BlockStack>
    );
  }

  // Error state
  if (error) {
    return (
      <BlockStack spacing="loose">
        <Text size="medium" emphasis="bold">ReturnsX Customer Status</Text>
        <Text appearance="subdued">{error}</Text>
      </BlockStack>
    );
  }

  // No risk data found (new customer)
  if (!riskData || !riskData.success) {
    return (
      <BlockStack spacing="loose">
        <Text size="medium" emphasis="bold">Welcome to ReturnsX! 🎉</Text>
        <TextBlock>
          Thank you for your order! As a new customer, you have been classified as a 
          <Text emphasis="bold"> Zero Risk</Text> customer. This means you can enjoy 
          our full Cash-on-Delivery service with no restrictions.
        </TextBlock>
        <Text appearance="subdued" size="small">
          Your risk score will be updated based on your order history and delivery success rate.
        </Text>
      </BlockStack>
    );
  }

  const { riskTier, riskScore, totalOrders, failedAttempts, successfulDeliveries } = riskData;

  // Determine risk display properties
  const getRiskDisplayInfo = (tier) => {
    switch (tier) {
      case 'ZERO_RISK':
        return {
          label: 'Zero Risk',
          color: 'success',
          icon: '✅',
          message: 'Excellent! You are a trusted customer with full COD access.',
          bgColor: '#f0f9f0'
        };
      case 'MEDIUM_RISK':
        return {
          label: 'Medium Risk',
          color: 'warning',
          icon: '⚠️',
          message: 'Your orders may require additional verification before shipping.',
          bgColor: '#fff8e1'
        };
      case 'HIGH_RISK':
        return {
          label: 'High Risk',
          color: 'critical',
          icon: '❌',
          message: 'Future COD orders may require advance payment or deposit.',
          bgColor: '#ffebee'
        };
      default:
        return {
          label: 'Unknown',
          color: 'base',
          icon: '❓',
          message: 'We are still evaluating your order history.',
          bgColor: '#f5f5f5'
        };
    }
  };

  const riskInfo = getRiskDisplayInfo(riskTier);

  // Calculate success rate
  const successRate = totalOrders > 0 ? 
    Math.round(((totalOrders - failedAttempts) / totalOrders) * 100) : 100;

  return (
    <BlockStack spacing="loose">
      {/* Header */}
      <InlineStack spacing="tight" blockAlignment="center">
        <Text size="large" emphasis="bold">ReturnsX Customer Status</Text>
        <Text>{riskInfo.icon}</Text>
      </InlineStack>

      {/* Risk Score Display */}
      <BlockStack spacing="tight" 
                 padding="base" 
                 background={riskInfo.bgColor}
                 cornerRadius="base">
        
        <InlineStack spacing="base" blockAlignment="center">
          <Banner tone={riskInfo.color}>{riskInfo.label}</Banner>
          <Text emphasis="bold">Score: {parseFloat(riskScore).toFixed(1)}/100</Text>
        </InlineStack>

        <TextBlock>
          {riskInfo.message}
        </TextBlock>
      </BlockStack>

      {/* Order Statistics */}
      <BlockStack spacing="tight">
        <Text emphasis="bold" size="medium">Your Order History</Text>
        
        <InlineStack spacing="base">
          <Text>Total Orders: <Text emphasis="bold">{totalOrders}</Text></Text>
          <Text>Success Rate: <Text emphasis="bold">{successRate}%</Text></Text>
        </InlineStack>

        {failedAttempts > 0 && (
          <Text appearance="subdued" size="small">
            Failed Deliveries: {failedAttempts}
          </Text>
        )}
      </BlockStack>

      <Divider />

      {/* Risk Factors Explanation */}
      <BlockStack spacing="tight">
        <Text emphasis="bold" size="medium">What Affects Your Risk Score?</Text>
        
        <BlockStack spacing="extraTight">
          <Text size="small">• <Text emphasis="bold">Delivery Success:</Text> Accepting orders when delivered</Text>
          <Text size="small">• <Text emphasis="bold">Order History:</Text> Consistent ordering and payment</Text>
          <Text size="small">• <Text emphasis="bold">Cancellation Rate:</Text> Fewer cancelled orders improve your score</Text>
          <Text size="small">• <Text emphasis="bold">Return Frequency:</Text> Lower return rates show reliability</Text>
        </BlockStack>
      </BlockStack>

      {/* Improvement Tips */}
      <Divider />
      <BlockStack spacing="tight">
        <Text emphasis="bold" size="medium">How to Improve Your Score</Text>
        
        {riskTier === 'HIGH_RISK' ? (
          <BlockStack spacing="extraTight">
            <Text size="small">• Accept deliveries when they arrive</Text>
            <Text size="small">• Avoid cancelling orders after placement</Text>
            <Text size="small">• Consider prepayment for faster processing</Text>
            <Text size="small">• Contact us before cancelling if needed</Text>
          </BlockStack>
        ) : riskTier === 'MEDIUM_RISK' ? (
          <BlockStack spacing="extraTight">
            <Text size="small">• Continue accepting deliveries promptly</Text>
            <Text size="small">• Minimize order cancellations</Text>
            <Text size="small">• Keep your contact information updated</Text>
          </BlockStack>
        ) : (
          <BlockStack spacing="extraTight">
            <Text size="small">• Keep up the excellent work! 🎉</Text>
            <Text size="small">• Continue accepting deliveries on time</Text>
            <Text size="small">• Your reliability is appreciated</Text>
          </BlockStack>
        )}
      </BlockStack>

      {/* High Risk Support Contact */}
      {riskTier === 'HIGH_RISK' && (
        <>
          <Divider />
          <BlockStack spacing="tight">
            <Text emphasis="bold" size="medium">Need Help?</Text>
            <TextBlock>
              For faster service on future orders, please contact us on WhatsApp
            </TextBlock>
            
            <Link 
              to={`https://wa.me/923001234567?text=Hi, I need help with my ReturnsX risk score. Order: ${orderId}`}
              external
            >
              <InlineStack spacing="tight" blockAlignment="center">
                <Text>📱 Contact Support on WhatsApp</Text>
              </InlineStack>
            </Link>
          </BlockStack>
        </>
      )}

      {/* Footer */}
      <Divider />
      <Text appearance="subdued" size="small" alignment="center">
        ReturnsX helps merchants reduce COD return rates through smart risk assessment
      </Text>
    </BlockStack>
  );
}