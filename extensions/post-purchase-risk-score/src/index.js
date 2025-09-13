import {
  extend,
  Banner,
  BlockStack,
  Button,
  Heading,
  InlineStack,
  Layout,
  Text,
  TextBlock,
  Spinner,
} from '@shopify/post-purchase-ui-extensions';

/**
 * Post-Purchase Risk Score Extension
 * 
 * Shows customer's risk score immediately after payment completion.
 * Only displays for paid orders (not COD/manual payments).
 */
export default extend('post_purchase_ui', (root, { inputData, calculatedPurchase, settings, done, storage }) => {
  const { initialPurchase, token } = inputData;
  
  // ShouldRender: Determine if we should show this extension
  const shouldRender = () => {
    try {
      // Only show for orders with customer phone number
      if (!initialPurchase?.customer?.phone) {
        console.log('[PostPurchase] No customer phone found, not rendering');
        return false;
      }

      // Only show for successful payments (not pending/failed)
      if (initialPurchase?.status !== 'paid') {
        console.log('[PostPurchase] Order not paid, not rendering. Status:', initialPurchase?.status);
        return false;
      }

      // Check if we have API endpoint configured
      if (!settings?.api_endpoint) {
        console.log('[PostPurchase] No API endpoint configured, not rendering');
        return false;
      }

      console.log('[PostPurchase] All conditions met, rendering extension');
      return true;

    } catch (error) {
      console.error('[PostPurchase] Error in shouldRender:', error);
      return false;
    }
  };

  // Don't render if conditions aren't met
  if (!shouldRender()) {
    return;
  }

  // State management
  let isLoading = true;
  let riskData = null;
  let error = null;

  // Render function
  const render = () => {
    const content = root.createComponent(Layout, {
      media: [
        { viewportSize: 'small', sizes: [1, 0, 1], maxInlineSize: 0.9 },
        { viewportSize: 'medium', sizes: [532, 0, 1], maxInlineSize: 420 },
        { viewportSize: 'large', sizes: [560, 38, 340] },
      ],
    });

    if (isLoading) {
      content.appendChild(
        root.createComponent(BlockStack, { spacing: 'base' }, [
          root.createComponent(InlineStack, { spacing: 'tight', blockAlignment: 'center' }, [
            root.createComponent(Spinner, { size: 'small' }),
            root.createComponent(Text, { size: 'medium' }, 'Loading your ReturnsX risk profile...'),
          ]),
        ])
      );
    } else if (error) {
      content.appendChild(
        root.createComponent(BlockStack, { spacing: 'base' }, [
          root.createComponent(Banner, { status: 'warning' }, [
            root.createComponent(TextBlock, {}, 'Unable to load risk profile. Your order is confirmed and will be processed normally.'),
          ]),
        ])
      );
    } else if (riskData) {
      const riskInfo = getRiskDisplayInfo(riskData.riskTier, riskData.riskScore);
      
      content.appendChild(
        root.createComponent(BlockStack, { spacing: 'base' }, [
          root.createComponent(Heading, { level: 2 }, '📊 Your ReturnsX Risk Profile'),
          
          root.createComponent(Banner, { status: riskInfo.status }, [
            root.createComponent(BlockStack, { spacing: 'tight' }, [
              root.createComponent(InlineStack, { spacing: 'base', blockAlignment: 'center' }, [
                root.createComponent(Text, { emphasis: 'bold', size: 'large' }, riskInfo.label),
                root.createComponent(Text, { emphasis: 'bold' }, `Score: ${riskData.riskScore}/100`),
              ]),
              root.createComponent(TextBlock, {}, riskInfo.message),
            ]),
          ]),

          // Order statistics
          root.createComponent(BlockStack, { spacing: 'tight' }, [
            root.createComponent(Text, { emphasis: 'bold' }, 'Your delivery history:'),
            root.createComponent(Text, {}, `Total orders: ${riskData.totalOrders || 0}`),
            root.createComponent(Text, {}, `Success rate: ${calculateSuccessRate(riskData)}%`),
          ]),

          // Improvement tips
          root.createComponent(BlockStack, { spacing: 'tight' }, [
            root.createComponent(Text, { emphasis: 'bold' }, 'Tips to maintain good standing:'),
            ...getImprovementTips(riskData.riskTier).map(tip => 
              root.createComponent(Text, { size: 'small' }, tip)
            ),
          ]),

          root.createComponent(Button, {
            onPress: () => done(),
          }, 'Continue to Order Confirmation'),
        ])
      );
    }

    return content;
  };

  // Fetch risk data
  const fetchRiskData = async () => {
    try {
      const customerPhone = initialPurchase.customer.phone;
      const apiEndpoint = settings.api_endpoint;
      
      const response = await fetch(`${apiEndpoint}?phone=${encodeURIComponent(customerPhone)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': initialPurchase.shop.domain,
          'Authorization': `Bearer ${token}`, // Session token for authentication
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        riskData = data.profile;
        error = null;
      } else {
        throw new Error(data.error || 'Failed to fetch risk profile');
      }

    } catch (err) {
      console.error('[PostPurchase] Risk API error:', err);
      error = err.message;
      riskData = null;
    } finally {
      isLoading = false;
      root.mount(render());
    }
  };

  // Helper functions
  const getRiskDisplayInfo = (riskTier, riskScore) => {
    switch (riskTier) {
      case 'HIGH_RISK':
        return {
          label: '🔴 High Risk',
          status: 'critical',
          message: 'Please ensure prompt delivery acceptance to improve your score. Consider prepayment for faster processing.'
        };
      case 'MEDIUM_RISK':
        return {
          label: '🟡 Medium Risk', 
          status: 'warning',
          message: 'You have a good track record! Continue accepting deliveries on time to maintain your score.'
        };
      default:
        return {
          label: '🟢 Low Risk',
          status: 'success',
          message: 'Excellent! You have a perfect delivery record. Keep up the great work!'
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
          '• Consider prepayment for faster order processing',
          '• Contact support before cancelling if needed'
        ];
      case 'MEDIUM_RISK':
        return [
          '• Continue accepting deliveries on time',
          '• Keep cancellations to a minimum',
          '• Ensure your contact information is current'
        ];
      default:
        return [
          '• Keep up the excellent work! 🎉',
          '• Continue accepting deliveries reliably',
          '• Your consistent behavior is appreciated'
        ];
    }
  };

  // Start loading data and render initial loading state
  root.mount(render());
  fetchRiskData();
});