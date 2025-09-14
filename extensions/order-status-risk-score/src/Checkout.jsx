import {
  reactExtension,
  BlockStack,
  Text,
  Banner,
  useApi,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

// Define the extension for the Thank You page block
export default reactExtension(
  'purchase.thank-you.block.render',
  () => <RiskScoreExtension />
);

function RiskScoreExtension() {
  const api = useApi();
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[Risk Score Extension] Component mounted');
    console.log('[Risk Score Extension] API object:', api);
    
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    try {
      console.log('[Risk Score Extension] Starting risk data fetch...');
      
      // Get phone from various sources (different API access points)
      const phone = api.billingAddress?.phone || api.shippingAddress?.phone || api.buyerIdentity?.phone;
      
      console.log('[Risk Score Extension] Available data:', {
        billingAddress: api.billingAddress,
        shippingAddress: api.shippingAddress,
        buyerIdentity: api.buyerIdentity,
        phone: phone
      });

      if (!phone) {
        console.log('[Risk Score Extension] No phone number found');
        setError('No phone number found');
        setLoading(false);
        return;
      }

      // Get session token
      const token = await api.sessionToken.get();
      console.log('[Risk Score Extension] Session token obtained');

      // Make API call to risk profile endpoint
      const response = await fetch('https://returnsx.pk/api/risk-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: phone
        })
      });

      console.log('[Risk Score Extension] API response status:', response.status);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[Risk Score Extension] API response data:', data);
      
      if (data.success) {
        setRiskData(data.profile);
      } else {
        setRiskData(data);
      }
    } catch (err) {
      console.error('[Risk Score Extension] Error fetching risk data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <BlockStack spacing="base">
        <Text size="medium">Loading risk assessment...</Text>
      </BlockStack>
    );
  }

  // Show error state
  if (error) {
    return (
      <BlockStack spacing="base">
        <Banner status="critical">
          <Text>Risk Assessment Error: {error}</Text>
        </Banner>
      </BlockStack>
    );
  }

  // Show risk data
  if (riskData) {
    const { riskScore, riskLevel, message, tips } = riskData;
    
    const getBannerStatus = (level) => {
      switch (level?.toLowerCase()) {
        case 'high': return 'critical';
        case 'medium': return 'warning';
        case 'low': return 'success';
        default: return 'info';
      }
    };

    return (
      <BlockStack spacing="base">
        <Banner status={getBannerStatus(riskLevel)}>
          <BlockStack spacing="tight">
            <Text size="medium" emphasis="bold">
              Risk Assessment: {riskLevel} ({riskScore}%)
            </Text>
            {message && <Text>{message}</Text>}
          </BlockStack>
        </Banner>
        
        {tips && tips.length > 0 && (
          <BlockStack spacing="tight">
            <Text size="small" emphasis="bold">Recommendations:</Text>
            {tips.map((tip) => (
              <Text key={tip} size="small">• {tip}</Text>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    );
  }

  // Fallback - no data to show
  return (
    <BlockStack spacing="base">
      <Text>No risk assessment data available</Text>
    </BlockStack>
  );
}