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
} from '@shopify/ui-extensions-react/customer-account';

// Customer Account UI Extension for Order Status page
export default reactExtension(
  'customer-account.order-status.block.render',
  () => <CustomerRiskDisplay />
);

// Helper function for success rate tone
function getSuccessRateTone(successRate) {
  if (successRate >= 80) return 'success';
  if (successRate >= 60) return 'warning';
  return 'critical';
}

function CustomerRiskDisplay() {
  const { 
    query, 
    sessionToken,
    buyerIdentity 
  } = useApi();
  
  const settings = useSettings();
  
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [authState, setAuthState] = useState('checking');

  const renderImprovementTips = (riskTier) => {
    switch (riskTier) {
      case 'HIGH_RISK':
        return (
          <BlockStack spacing="extraTight">
            <Text size="small">• Accept deliveries promptly when they arrive</Text>
            <Text size="small">• Avoid cancelling orders after placement</Text>
            <Text size="small">• Consider prepayment for faster order processing</Text>
            <Text size="small">• Contact support before cancelling if needed</Text>
          </BlockStack>
        );
      case 'MEDIUM_RISK':
        return (
          <BlockStack spacing="extraTight">
            <Text size="small">• Continue accepting deliveries on time</Text>
            <Text size="small">• Keep cancellations to a minimum</Text>
            <Text size="small">• Ensure your contact information is current</Text>
          </BlockStack>
        );
      default:
        return (
          <BlockStack spacing="extraTight">
            <Text size="small">• Keep up the excellent work! 🎉</Text>
            <Text size="small">• Continue accepting deliveries reliably</Text>
            <Text size="small">• Your consistent behavior is appreciated</Text>
          </BlockStack>
        );
    }
  };

  // Get customer information and authentication state
  useEffect(() => {
    async function getCustomerInfo() {
      try {
        // Check authentication state
        console.log('Buyer Identity:', buyerIdentity);
        
        if (!buyerIdentity?.customer) {
          setAuthState('unauthenticated');
          setError('Please log in to view your ReturnsX risk profile');
          setLoading(false);
          return;
        }

        if (!buyerIdentity.customer.id) {
          setAuthState('pre-authenticated');
          setError('Limited customer information available. Please log in fully to view complete risk profile.');
          setLoading(false);
          return;
        }

        setAuthState('authenticated');

        // Query customer data using GraphQL
        const customerQuery = `
          query getCustomer($customerId: ID!) {
            customer(id: $customerId) {
              id
              email
              phone
              firstName
              lastName
              orders(first: 1) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        `;

        const result = await query(customerQuery, {
          variables: { customerId: buyerIdentity.customer.id }
        });

        if (result?.data?.customer) {
          setCustomerData(result.data.customer);
          console.log('Customer Data Retrieved:', result.data.customer);
        } else {
          throw new Error('Unable to retrieve customer information');
        }

      } catch (err) {
        console.error('Error fetching customer info:', err);
        setError('Unable to load customer information');
        setAuthState('error');
        setLoading(false);
      }
    }
    
    getCustomerInfo();
  }, [buyerIdentity, query]);

  // Fetch risk data when customer data is available
  useEffect(() => {
    async function fetchRiskData() {
      if (!customerData?.phone || authState !== 'authenticated') {
        setLoading(false);
        return;
      }

      try {
        // Get session token for authentication
        const token = await sessionToken.get();
        
        // Prepare API request
        const apiEndpoint = settings.api_endpoint || 'https://returnsx.vercel.app/api/risk-profile';
        const params = new URLSearchParams({
          phone: customerData.phone,
          customerId: customerData.id,
          email: customerData.email || ''
        });

        const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Shopify-Customer-Id': customerData.id,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const riskProfile = await response.json();
        setRiskData(riskProfile);
        
      } catch (err) {
        console.error('Error fetching risk data:', err);
        
        // Fallback for new customers
        setRiskData({
          success: true,
          isNewCustomer: true,
          riskTier: "ZERO_RISK",
          riskScore: 0,
          totalOrders: 0,
          failedAttempts: 0,
          successfulDeliveries: 0,
          phone: customerData.phone,
          message: "Welcome! You are a new customer with Zero Risk status."
        });
        
      } finally {
        setLoading(false);
      }
    }

    fetchRiskData();
  }, [customerData, sessionToken, settings.api_endpoint, authState]);

  // Authentication state handlers
  if (authState === 'checking' || loading) {
    return (
      <View border="base" padding="base" borderRadius="base">
        <BlockStack spacing="loose">
          <InlineStack spacing="tight" blockAlignment="center">
            <Spinner size="small" />
            <Text>Loading ReturnsX risk profile...</Text>
          </InlineStack>
        </BlockStack>
      </View>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <View border="base" padding="base" borderRadius="base">
        <BlockStack spacing="loose">
          <Heading level={3}>🔒 ReturnsX Risk Profile</Heading>
          <Banner tone="info">
            Please log in to your account to view your personalized risk score and order history.
          </Banner>
          <TextBlock>
            ReturnsX helps merchants provide better service by tracking delivery success rates. 
            Your risk profile is based on your order history across all ReturnsX partner stores.
          </TextBlock>
        </BlockStack>
      </View>
    );
  }

  if (authState === 'pre-authenticated') {
    return (
      <View border="base" padding="base" borderRadius="base">
        <BlockStack spacing="loose">
          <Heading level={3}>⚠️ Limited Access</Heading>
          <Banner tone="warning">
            Complete login required to view full risk profile and order statistics.
          </Banner>
        </BlockStack>
      </View>
    );
  }

  if (error && !riskData) {
    return (
      <View border="base" padding="base" borderRadius="base">
        <BlockStack spacing="loose">
          <Heading level={3}>❌ ReturnsX Risk Profile</Heading>
          <Banner tone="critical">
            {error}
          </Banner>
        </BlockStack>
      </View>
    );
  }

  // Main risk display
  if (!riskData || !riskData.success) {
    return (
      <View border="base" padding="base" borderRadius="base">
        <BlockStack spacing="loose">
          <Heading level={3}>🆕 Welcome to ReturnsX!</Heading>
          <Banner tone="success">
            As a new customer, you have Zero Risk status with full COD access.
          </Banner>
          <TextBlock>
            Your risk score will be updated based on your delivery success rate across all partner stores.
          </TextBlock>
        </BlockStack>
      </View>
    );
  }

  const { 
    riskTier, 
    riskScore, 
    totalOrders, 
    failedAttempts, 
    successfulDeliveries,
    phone 
  } = riskData;

  // Risk display configuration
  const getRiskDisplayInfo = (tier) => {
    switch (tier) {
      case 'ZERO_RISK':
        return {
          label: 'Zero Risk ✅',
          tone: 'success',
          message: 'Excellent! You are a trusted customer with full COD access.',
          color: '#28a745',
          bgColor: '#d4edda'
        };
      case 'MEDIUM_RISK':
        return {
          label: 'Medium Risk ⚠️',
          tone: 'warning', 
          message: 'Your orders may require additional verification before shipping.',
          color: '#ffc107',
          bgColor: '#fff3cd'
        };
      case 'HIGH_RISK':
        return {
          label: 'High Risk ❌',
          tone: 'critical',
          message: 'Future COD orders may require advance payment or deposit.',
          color: '#dc3545',
          bgColor: '#f8d7da'
        };
      default:
        return {
          label: 'Unknown ❓',
          tone: 'base',
          message: 'We are still evaluating your order history.',
          color: '#6c757d',
          bgColor: '#f8f9fa'
        };
    }
  };

  const riskInfo = getRiskDisplayInfo(riskTier);
  const successRate = totalOrders > 0 ? 
    Math.round(((totalOrders - failedAttempts) / totalOrders) * 100) : 100;

  return (
    <View border="base" padding="base" borderRadius="base">
      <BlockStack spacing="loose">
        
        {/* Header */}
        <InlineStack spacing="base" blockAlignment="center">
          <Heading level={3}>ReturnsX Customer Profile</Heading>
        </InlineStack>

        {/* Risk Score Banner */}
        <Banner tone={riskInfo.tone}>
          <BlockStack spacing="tight">
            <InlineStack spacing="base" blockAlignment="center">
              <Text emphasis="bold" size="large">{riskInfo.label}</Text>
              <Text emphasis="bold">Score: {parseFloat(riskScore).toFixed(1)}/100</Text>
            </InlineStack>
            <Text>{riskInfo.message}</Text>
          </BlockStack>
        </Banner>

        {/* Customer Info */}
        {phone && (
          <InlineStack spacing="tight">
            <Text appearance="subdued" size="small">Profile for: {phone}</Text>
          </InlineStack>
        )}

        {/* Statistics */}
        {settings.show_detailed_stats && (
          <>
            <Divider />
            <InlineStack spacing="base">
              <BlockStack spacing="tight">
                <Text emphasis="bold">Total Orders</Text>
                <Text size="large">{totalOrders}</Text>
              </BlockStack>
              <BlockStack spacing="tight">
                <Text emphasis="bold">Success Rate</Text>
                <Text size="large" tone={getSuccessRateTone(successRate)}>
                  {successRate}%
                </Text>
              </BlockStack>
            </InlineStack>

            {totalOrders > 0 && (
              <InlineStack spacing="base">
                <BlockStack spacing="tight">
                  <Text appearance="subdued">Successful Deliveries</Text>
                  <Text>{successfulDeliveries || (totalOrders - failedAttempts)}</Text>
                </BlockStack>
                <BlockStack spacing="tight">
                  <Text appearance="subdued">Failed Deliveries</Text>
                  <Text tone={failedAttempts > 0 ? 'warning' : 'base'}>
                    {failedAttempts}
                  </Text>
                </BlockStack>
              </InlineStack>
            )}
          </>
        )}

        {/* Risk Factors Explanation */}
        <Divider />
        <BlockStack spacing="tight">
          <Text emphasis="bold">What Affects Your Risk Score?</Text>
          <BlockStack spacing="extraTight">
            <Text size="small">• <Text emphasis="bold">Delivery Acceptance:</Text> Taking deliveries when they arrive</Text>
            <Text size="small">• <Text emphasis="bold">Order Consistency:</Text> Regular ordering without cancellations</Text>
            <Text size="small">• <Text emphasis="bold">Return Frequency:</Text> Lower return rates improve your score</Text>
            <Text size="small">• <Text emphasis="bold">Cross-Store History:</Text> Your record across all ReturnsX partners</Text>
          </BlockStack>
        </BlockStack>

        {/* Improvement Tips */}
        {settings.enable_improvement_tips && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <Text emphasis="bold">How to Improve Your Score</Text>
              
              {renderImprovementTips(riskTier)}
            </BlockStack>
          </>
        )}

        {/* High Risk Support */}
        {riskTier === 'HIGH_RISK' && settings.whatsapp_support_number && (
          <>
            <Divider />
            <BlockStack spacing="tight">
              <Text emphasis="bold">Need Help? 📞</Text>
              <TextBlock>
                Contact our support team to discuss payment options and improve your delivery success rate.
              </TextBlock>
              
              <Link 
                to={`https://wa.me/${settings.whatsapp_support_number.replace(/[^\d]/g, '')}?text=Hi, I need help with my ReturnsX risk score. Customer ID: ${customerData?.id}`}
                external
              >
                <Button>Contact Support on WhatsApp</Button>
              </Link>
            </BlockStack>
          </>
        )}

        {/* Footer */}
        <Divider />
        <Text appearance="subdued" size="small" alignment="center">
          ReturnsX helps reduce COD return rates through unified risk assessment across partner stores
        </Text>

      </BlockStack>
    </View>
  );
}