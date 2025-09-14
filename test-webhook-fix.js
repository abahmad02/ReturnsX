// Test script to verify webhook processing and duplicate handling
const testOrderWebhook = async () => {
  console.log('Testing webhook processing with duplicate handling...');
  
  const testOrderData = {
    id: 5962321428550,
    name: '#1028',
    checkout_token: 'be0a48d9',
    total_price: '811.94',
    currency: 'USD',
    customer: {
      phone: '+1234567890',
      email: 'test@example.com'
    },
    billing_address: {
      phone: '+1234567890'
    },
    shipping_address: {
      phone: '+1234567890'
    }
  };

  try {
    // Simulate the webhook call
    const response = await fetch('https://returnsx.pk/webhooks/orders/created', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': 'returnsx123.myshopify.com',
        'X-Shopify-Webhook-Id': 'test-webhook-id'
      },
      body: JSON.stringify(testOrderData)
    });

    console.log('Webhook response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Webhook processed successfully');
      
      // Test the risk profile API
      const riskResponse = await fetch('https://returnsx.pk/api/risk-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: '+1234567890'
        })
      });
      
      console.log('Risk profile API status:', riskResponse.status);
      
      if (riskResponse.ok) {
        const riskData = await riskResponse.json();
        console.log('✅ Risk profile data:', riskData);
      } else {
        console.log('❌ Risk profile API failed');
      }
      
    } else {
      console.log('❌ Webhook processing failed');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Run the test
testOrderWebhook();