#!/usr/bin/env node

/**
 * Populate Test Data Script
 * 
 * This script uses your ReturnsX API to create test customer data
 */

import https from 'https';

const BASE_URL = 'https://combo-explicit-industry-heights.trycloudflare.com'; // Your current tunnel URL

console.log('🚀 Populating ReturnsX Test Data\n');
console.log('=====================================\n');

async function makeAPIRequest(endpoint, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const responseData = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: responseData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function createTestCustomers() {
  console.log('👥 Creating test customers...\n');
  
  try {
    const response = await makeAPIRequest('/api/test-data', 'POST', {
      action: 'create_customers'
    });

    if (response.status === 200 && response.data.success) {
      console.log('✅ Test customers created successfully!\n');
      console.log('📊 Summary:');
      console.log(`   Created: ${response.data.summary.created} customers`);
      console.log(`   Updated: ${response.data.summary.updated} customers`);
      console.log(`   Errors: ${response.data.summary.errors} customers`);
      console.log(`   Total: ${response.data.summary.total} customers\n`);
      
      if (response.data.details.created.length > 0) {
        console.log('🆕 New customers created:');
        response.data.details.created.forEach(customer => {
          const emoji = customer.riskTier === 'ZERO_RISK' ? '🟢' : 
                       customer.riskTier === 'MEDIUM_RISK' ? '🟡' : '🔴';
          console.log(`   ${emoji} ${customer.email} (${customer.riskTier})`);
        });
        console.log();
      }
      
      if (response.data.details.updated.length > 0) {
        console.log('🔄 Customers updated:');
        response.data.details.updated.forEach(customer => {
          const emoji = customer.riskTier === 'ZERO_RISK' ? '🟢' : 
                       customer.riskTier === 'MEDIUM_RISK' ? '🟡' : '🔴';
          console.log(`   ${emoji} ${customer.email} (${customer.riskTier})`);
        });
        console.log();
      }
      
      if (response.data.details.errors.length > 0) {
        console.log('❌ Errors:');
        response.data.details.errors.forEach(error => {
          console.log(`   ${error.email}: ${error.error}`);
        });
        console.log();
      }
      
    } else {
      console.error('❌ Failed to create test customers');
      console.error('Response:', response);
    }
    
  } catch (error) {
    console.error('❌ Error creating test customers:', error.message);
  }
}

async function checkTestDataStatus() {
  console.log('🔍 Checking test data status...\n');
  
  try {
    const response = await makeAPIRequest('/api/test-data', 'POST', {
      action: 'get_test_data'
    });

    if (response.status === 200 && response.data.success) {
      console.log('📊 Test Data Status:');
      console.log(`   Test profiles exist: ${response.data.testDataExists ? '✅' : '❌'}`);
      console.log(`   Total test profiles: ${response.data.summary.totalTestProfiles}`);
      console.log(`   Expected profiles: ${response.data.summary.expectedProfiles}\n`);
      
      if (response.data.summary.riskDistribution) {
        console.log('🎯 Risk Distribution:');
        Object.entries(response.data.summary.riskDistribution).forEach(([tier, count]) => {
          const emoji = tier === 'ZERO_RISK' ? '🟢' : tier === 'MEDIUM_RISK' ? '🟡' : '🔴';
          console.log(`   ${emoji} ${tier}: ${count} customers`);
        });
        console.log();
      }
      
    } else {
      console.error('❌ Failed to check test data status');
      console.error('Response:', response);
    }
    
  } catch (error) {
    console.error('❌ Error checking test data status:', error.message);
  }
}

async function clearTestData() {
  console.log('🧹 Clearing test data...\n');
  
  try {
    const response = await makeAPIRequest('/api/test-data', 'POST', {
      action: 'clear_test_data'
    });

    if (response.status === 200 && response.data.success) {
      console.log('✅ Test data cleared successfully!');
      console.log(`   Deleted ${response.data.deletedCount} test customer profiles\n`);
    } else {
      console.error('❌ Failed to clear test data');
      console.error('Response:', response);
    }
    
  } catch (error) {
    console.error('❌ Error clearing test data:', error.message);
  }
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      await createTestCustomers();
      break;
      
    case 'status':
      await checkTestDataStatus();
      break;
      
    case 'clear':
      await clearTestData();
      break;
      
    default:
      console.log('📋 Available commands:\n');
      console.log('   node populate-test-data.js create   - Create test customers');
      console.log('   node populate-test-data.js status   - Check test data status');
      console.log('   node populate-test-data.js clear    - Clear test data\n');
      
      console.log('🎯 Test Customer Profiles:');
      console.log('   🟢 good.customer@test.com (+923001234567) - ZERO RISK');
      console.log('   🟢 ahmed.khan@test.com (+923001234568) - ZERO RISK');
      console.log('   🟢 fatima.ali@test.com (+923001234569) - ZERO RISK');
      console.log('   🟡 medium.risk@test.com (+923005555555) - MEDIUM RISK');
      console.log('   🟡 bilal.hussain@test.com (+923009876544) - MEDIUM RISK');
      console.log('   🔴 risky.customer@test.com (+923009876543) - HIGH RISK');
      console.log('   🔴 problem.user@test.com (+923009999998) - HIGH RISK');
      console.log('   🔴 fraud.alert@test.com (+923009999997) - HIGH RISK\n');
      
      console.log('💡 Usage:');
      console.log('   1. Run "node populate-test-data.js create" to create test customers');
      console.log('   2. Use these emails/phones in your checkout testing');
      console.log('   3. Check your ReturnsX dashboard to see the profiles');
      console.log('   4. Test different risk scenarios in checkout\n');
      break;
  }
}

main().catch(console.error);
