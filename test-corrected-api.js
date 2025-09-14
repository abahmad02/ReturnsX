// Test the corrected risk profile API with GET request
const testCorrectedRiskAPI = async () => {
  console.log('🧪 Testing corrected risk profile API (GET request)...');
  
  const testPhone = '+1234567890';
  const apiUrl = `https://returnsx.pk/api/risk-profile?phone=${encodeURIComponent(testPhone)}`;
  
  try {
    console.log(`Testing API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token-12345',
        'X-Shopify-Shop-Domain': 'returnsx123.myshopify.com',
        'User-Agent': 'ReturnsX-Extension-Test/1.0'
      }
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Risk Profile API Success!');
      console.log('📈 Response Data:', JSON.stringify(data, null, 2));
      
      if (data.success && data.profile) {
        console.log('\n🎯 Risk Assessment Details:');
        console.log(`   Risk Tier: ${data.profile.riskTier}`);
        console.log(`   Risk Score: ${data.profile.riskScore}%`);
        console.log(`   Total Orders: ${data.profile.totalOrders}`);
        console.log(`   Failed Attempts: ${data.profile.failedAttempts}`);
        console.log(`   Successful Deliveries: ${data.profile.successfulDeliveries}`);
        console.log(`   Return Rate: ${data.profile.returnRate}%`);
        console.log(`   Is New Customer: ${data.profile.isNewCustomer}`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error Response:', errorText);
    }
    
  } catch (error) {
    console.error('🚨 Test Error:', error.message);
  }
};

// Test different phone numbers to see different risk scenarios
const testMultipleScenarios = async () => {
  console.log('🚀 Testing multiple risk scenarios...\n');
  
  const testPhones = [
    '+1234567890', // High risk (ends in 0)
    '+1234567893', // Medium risk (ends in 3)  
    '+1234567897', // Low risk (ends in 7)
  ];
  
  for (const phone of testPhones) {
    console.log(`\n📞 Testing phone: ${phone}`);
    const apiUrl = `https://returnsx.pk/api/risk-profile?phone=${encodeURIComponent(phone)}`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token-12345',
          'X-Shopify-Shop-Domain': 'returnsx123.myshopify.com',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`   ✅ ${data.profile.riskTier} - Score: ${data.profile.riskScore}%`);
        }
      } else {
        console.log(`   ❌ Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   🚨 Error: ${error.message}`);
    }
  }
};

// Run the tests
const runAllTests = async () => {
  await testCorrectedRiskAPI();
  console.log('\n' + '='.repeat(60) + '\n');
  await testMultipleScenarios();
};

runAllTests();