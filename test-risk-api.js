// Test the risk profile API directly to verify backend functionality
const testRiskProfileAPI = async () => {
  console.log('🧪 Testing risk profile API after webhook fix...');
  
  // Test with a sample phone number
  const testPhone = '+1234567890';
  
  try {
    console.log(`Testing risk profile for phone: ${testPhone}`);
    
    const response = await fetch('https://returnsx.pk/api/risk-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReturnsX-Extension-Test/1.0'
      },
      body: JSON.stringify({
        phone: testPhone
      })
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Risk Profile API Success!');
      console.log('📈 Response Data:', JSON.stringify(data, null, 2));
      
      if (data.success && data.profile) {
        console.log('🎯 Risk Assessment Details:');
        console.log(`   Risk Level: ${data.profile.riskLevel}`);
        console.log(`   Risk Score: ${data.profile.riskScore}%`);
        console.log(`   Message: ${data.profile.message}`);
        if (data.profile.tips) {
          console.log('   Tips:', data.profile.tips);
        }
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error Response:', errorText);
    }
    
  } catch (error) {
    console.error('🚨 Test Error:', error.message);
  }
};

// Test with different scenarios
const runComprehensiveTest = async () => {
  console.log('🚀 Starting comprehensive risk profile API test...\n');
  
  // Test 1: Valid phone number
  await testRiskProfileAPI();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Check if the API handles duplicate order events correctly
  console.log('🔄 Testing duplicate handling scenario...');
  
  // Simulate multiple calls (like duplicate webhooks)
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      fetch('https://returnsx.pk/api/risk-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+1234567890' })
      })
    );
  }
  
  try {
    const results = await Promise.all(promises);
    console.log('✅ Concurrent calls completed successfully');
    console.log(`📊 Response statuses: ${results.map(r => r.status).join(', ')}`);
  } catch (error) {
    console.error('❌ Concurrent test failed:', error.message);
  }
};

// Run the comprehensive test
runComprehensiveTest();