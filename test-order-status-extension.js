#!/usr/bin/env node

/**
 * Test script for Order Status Page Extension
 * 
 * Tests the customer risk API and simulates different customer scenarios
 * that will be displayed on the order status/thank you page
 */

const https = require('https');
const http = require('http');

console.log('🎉 ReturnsX Order Status Extension Test');
console.log('======================================\n');

// Test scenarios representing different customer types
const testScenarios = [
  {
    name: 'New Customer',
    description: 'First-time customer with no history',
    phone: '+923001111111',
    email: 'newcustomer@example.com',
    expectedRisk: 'ZERO_RISK',
    expectedMessage: 'Welcome! Zero Risk customer'
  },
  {
    name: 'Good Customer',
    description: 'Existing customer with good delivery record',
    phone: '+923002222222', 
    email: 'goodcustomer@example.com',
    expectedRisk: 'ZERO_RISK',
    expectedMessage: 'Trusted customer with full COD access'
  },
  {
    name: 'Medium Risk Customer',
    description: 'Customer with some failed deliveries',
    phone: '+923003333333',
    email: 'mediumrisk@example.com',
    expectedRisk: 'MEDIUM_RISK',
    expectedMessage: 'May require additional verification'
  },
  {
    name: 'High Risk Customer',
    description: 'Customer with multiple failed deliveries',
    phone: '+923004444444',
    email: 'highrisk@example.com',
    expectedRisk: 'HIGH_RISK',
    expectedMessage: 'May require advance payment'
  },
  {
    name: 'Phone Only Customer',
    description: 'Customer with only phone number',
    phone: '+923005555555',
    email: null,
    expectedRisk: 'ZERO_RISK',
    expectedMessage: 'Phone-based lookup'
  },
  {
    name: 'Email Only Customer', 
    description: 'Customer with only email',
    phone: null,
    email: 'emailonly@example.com',
    expectedRisk: 'ZERO_RISK',
    expectedMessage: 'Email-based lookup'
  }
];

/**
 * Make API request to test customer risk endpoint
 */
function testCustomerRiskAPI(scenario) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (scenario.phone) params.append('phone', scenario.phone);
    if (scenario.email) params.append('email', scenario.email);
    params.append('orderId', 'test-order-12345');

    const url = `http://localhost:3000/api/customer-risk?${params.toString()}`;
    
    const request = http.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            scenario: scenario.name,
            status: response.statusCode,
            data: result,
            success: response.statusCode === 200 && result.success
          });
        } catch (error) {
          reject({
            scenario: scenario.name,
            error: 'Invalid JSON response',
            rawData: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      reject({
        scenario: scenario.name,
        error: error.message
      });
    });
    
    request.setTimeout(5000, () => {
      request.destroy();
      reject({
        scenario: scenario.name,
        error: 'Request timeout'
      });
    });
  });
}

/**
 * Test API response structure
 */
function validateAPIResponse(result) {
  const { data } = result;
  const issues = [];

  // Required fields
  if (typeof data.success !== 'boolean') issues.push('Missing success field');
  if (typeof data.riskTier !== 'string') issues.push('Missing riskTier field');
  if (typeof data.riskScore !== 'number') issues.push('Missing riskScore field');
  if (typeof data.message !== 'string') issues.push('Missing message field');

  // Optional but expected fields
  if (data.success && !data.isNewCustomer) {
    if (typeof data.totalOrders !== 'number') issues.push('Missing totalOrders for existing customer');
    if (typeof data.failedAttempts !== 'number') issues.push('Missing failedAttempts for existing customer');
  }

  // Recommendations array
  if (!Array.isArray(data.recommendations)) issues.push('Missing or invalid recommendations array');

  return issues;
}

/**
 * Simulate Order Status page display
 */
function simulateOrderStatusDisplay(apiResponse) {
  const { data } = apiResponse;
  
  if (!data.success) {
    return `❌ Error: ${data.error}`;
  }

  const riskInfo = {
    'ZERO_RISK': { icon: '✅', label: 'Zero Risk', color: 'green' },
    'MEDIUM_RISK': { icon: '⚠️', label: 'Medium Risk', color: 'orange' },
    'HIGH_RISK': { icon: '❌', label: 'High Risk', color: 'red' }
  };

  const risk = riskInfo[data.riskTier] || { icon: '❓', label: 'Unknown', color: 'gray' };
  
  let display = `
${risk.icon} ReturnsX Customer Status

${risk.label} | Score: ${data.riskScore}/100

${data.message}

Your Order History:
• Total Orders: ${data.totalOrders || 0}
• Success Rate: ${data.totalOrders > 0 ? Math.round(((data.totalOrders - (data.failedAttempts || 0)) / data.totalOrders) * 100) : 100}%`;

  if (data.failedAttempts > 0) {
    display += `\n• Failed Deliveries: ${data.failedAttempts}`;
  }

  if (data.recommendations && data.recommendations.length > 0) {
    display += `\n\nHow to Improve Your Score:`;
    data.recommendations.forEach(rec => {
      display += `\n• ${rec}`;
    });
  }

  if (data.riskTier === 'HIGH_RISK') {
    display += `\n\nNeed Help?\nFor faster service on future orders, please contact us on WhatsApp\n[Contact Support on WhatsApp] → Opens WhatsApp chat`;
  }

  return display;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('1. Testing API Endpoint:');
  console.log('========================');

  const results = [];
  
  for (const scenario of testScenarios) {
    try {
      console.log(`\n📞 Testing: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Phone: ${scenario.phone || 'N/A'}`);
      console.log(`   Email: ${scenario.email || 'N/A'}`);
      
      const result = await testCustomerRiskAPI(scenario);
      results.push(result);
      
      if (result.success) {
        console.log(`   ✅ API Response: Success`);
        console.log(`   📊 Risk Tier: ${result.data.riskTier}`);
        console.log(`   🎯 Risk Score: ${result.data.riskScore}`);
        console.log(`   💬 Message: ${result.data.message?.substring(0, 50)}...`);
        
        // Validate response structure
        const issues = validateAPIResponse(result);
        if (issues.length > 0) {
          console.log(`   ⚠️ Response Issues: ${issues.join(', ')}`);
        }
      } else {
        console.log(`   ❌ API Response: Failed (${result.status})`);
        console.log(`   Error: ${result.data?.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Test Failed: ${error.error}`);
      results.push({ scenario: scenario.name, success: false, error: error.error });
    }
  }

  console.log('\n\n2. Simulating Order Status Page Display:');
  console.log('========================================');

  results.filter(r => r.success).forEach(result => {
    console.log(`\n📱 ${result.scenario} - Order Status Page:`);
    console.log('─'.repeat(50));
    const display = simulateOrderStatusDisplay(result);
    console.log(display);
    console.log('─'.repeat(50));
  });

  console.log('\n\n3. Test Summary:');
  console.log('===============');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful Tests: ${successful}/${testScenarios.length}`);
  console.log(`❌ Failed Tests: ${failed}/${testScenarios.length}`);
  
  if (successful === testScenarios.length) {
    console.log('\n🎉 All tests passed! Order Status extension is ready.');
  } else {
    console.log('\n⚠️ Some tests failed. Check API endpoint and database.');
  }

  console.log('\n4. Extension Setup Checklist:');
  console.log('=============================');
  console.log('[ ] API endpoint deployed and responding');
  console.log('[ ] Extension files created in extensions/ directory');
  console.log('[ ] Extension built with: shopify app build');
  console.log('[ ] Extension deployed with: shopify app deploy');
  console.log('[ ] Theme customization: Add ReturnsX block to Order Status page');
  console.log('[ ] Extension settings configured in theme editor');
  console.log('[ ] Test order placed to verify display');
  console.log('[ ] WhatsApp integration tested for high-risk customers');
  
  console.log('\n🚀 Ready to enhance your customer experience!');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node test-order-status-extension.js');
  console.log('');
  console.log('This script tests the ReturnsX Order Status Page Extension by:');
  console.log('1. Testing the customer risk API endpoint');
  console.log('2. Simulating different customer scenarios');
  console.log('3. Showing what customers will see on the order status page');
  console.log('');
  console.log('Make sure your ReturnsX app is running on localhost:3000');
  process.exit(0);
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});

module.exports = {
  testCustomerRiskAPI,
  simulateOrderStatusDisplay,
  validateAPIResponse
};
