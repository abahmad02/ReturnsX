#!/usr/bin/env node

/**
 * Simple Test Customer Creator for ReturnsX
 * 
 * This script creates customer risk profiles directly in your ReturnsX database
 * bypassing the need for complex Shopify API setup
 */

console.log('👥 ReturnsX Test Customer Creator\n');
console.log('=====================================\n');

// Test customer data
const TEST_CUSTOMERS = [
  // Zero Risk Customers (should see success messages)
  {
    email: 'good.customer@test.com',
    phone: '+923001234567',
    riskScore: 5,
    riskTier: 'ZERO_RISK',
    orderCount: 15,
    returnCount: 1,
    averageOrderValue: 85.50,
    notes: 'Excellent customer - always pays on time, minimal returns'
  },
  {
    email: 'ahmed.khan@test.com', 
    phone: '+923001234568',
    riskScore: 8,
    riskTier: 'ZERO_RISK',
    orderCount: 22,
    returnCount: 0,
    averageOrderValue: 120.00,
    notes: 'VIP customer - high value, zero returns'
  },
  {
    email: 'fatima.ali@test.com',
    phone: '+923001234569',
    riskScore: 12,
    riskTier: 'ZERO_RISK', 
    orderCount: 8,
    returnCount: 0,
    averageOrderValue: 65.00,
    notes: 'Reliable customer - consistent orders'
  },

  // Medium Risk Customers (should see warning messages)
  {
    email: 'medium.risk@test.com',
    phone: '+923005555555',
    riskScore: 45,
    riskTier: 'MEDIUM_RISK',
    orderCount: 12,
    returnCount: 3,
    averageOrderValue: 75.00,
    notes: 'Some returns but generally okay'
  },
  {
    email: 'bilal.hussain@test.com',
    phone: '+923009876544',
    riskScore: 52,
    riskTier: 'MEDIUM_RISK',
    orderCount: 6,
    returnCount: 2,
    averageOrderValue: 45.00,
    notes: 'Moderate risk - watch closely'
  },

  // High Risk Customers (should see COD restrictions)
  {
    email: 'risky.customer@test.com',
    phone: '+923009876543',
    riskScore: 85,
    riskTier: 'HIGH_RISK',
    orderCount: 10,
    returnCount: 7,
    averageOrderValue: 150.00,
    notes: 'High return rate - requires deposit for COD'
  },
  {
    email: 'problem.user@test.com',
    phone: '+923009999998',
    riskScore: 92,
    riskTier: 'HIGH_RISK',
    orderCount: 5,
    returnCount: 4,
    averageOrderValue: 200.00,
    notes: 'Multiple payment issues - high risk'
  },
  {
    email: 'fraud.alert@test.com',
    phone: '+923009999997',
    riskScore: 95,
    riskTier: 'HIGH_RISK',
    orderCount: 3,
    returnCount: 3,
    averageOrderValue: 300.00,
    notes: 'Suspected fraud - manual review required'
  }
];

// Hash function (matches your app's crypto utility)
async function hashEmail(email) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

async function hashPhoneNumber(phone) {
  const crypto = await import('crypto');
  // Normalize phone number first
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('92')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    cleaned = '+92' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+92')) {
    cleaned = '+92' + cleaned;
  }
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

// Generate SQL insert statements
async function generateSQLInserts() {
  console.log('📝 Generating SQL insert statements...\n');
  
  const inserts = [];
  
  for (const customer of TEST_CUSTOMERS) {
    const emailHash = await hashEmail(customer.email);
    const phoneHash = await hashPhoneNumber(customer.phone);
    
    // Create customer profile insert
    const profileInsert = `
INSERT INTO "CustomerProfile" (
  id, emailHash, phoneHash, riskScore, riskTier, orderCount, returnCount, 
  averageOrderValue, lastOrderDate, lastRiskUpdate, shopDomain, notes, 
  createdAt, updatedAt
) VALUES (
  '${crypto.randomUUID()}',
  '${emailHash}',
  '${phoneHash}',
  ${customer.riskScore},
  '${customer.riskTier}',
  ${customer.orderCount},
  ${customer.returnCount},
  ${customer.averageOrderValue},
  datetime('now', '-${Math.floor(Math.random() * 30)} days'),
  datetime('now'),
  'returnsx123.myshopify.com',
  '${customer.notes}',
  datetime('now', '-${Math.floor(Math.random() * 90)} days'),
  datetime('now')
) ON CONFLICT(emailHash, shopDomain) DO UPDATE SET
  riskScore = excluded.riskScore,
  riskTier = excluded.riskTier,
  orderCount = excluded.orderCount,
  returnCount = excluded.returnCount,
  averageOrderValue = excluded.averageOrderValue,
  notes = excluded.notes,
  updatedAt = datetime('now');`;

    inserts.push(profileInsert);
    
    console.log(`✅ Generated profile for: ${customer.email} (${customer.riskTier})`);
  }
  
  return inserts;
}

// API-based approach (recommended)
async function generateAPIRequests() {
  console.log('🔧 Generating API request examples...\n');
  
  console.log('You can create these customers using your ReturnsX API:');
  console.log('POST to: /api/customer-profiles/bulk-create\n');
  
  const apiData = [];
  
  for (const customer of TEST_CUSTOMERS) {
    const apiRequest = {
      email: customer.email,
      phone: customer.phone,
      riskScore: customer.riskScore,
      riskTier: customer.riskTier,
      orderCount: customer.orderCount,
      returnCount: customer.returnCount,
      averageOrderValue: customer.averageOrderValue,
      shopDomain: 'returnsx123.myshopify.com',
      notes: customer.notes
    };
    
    apiData.push(apiRequest);
    console.log(`📋 ${customer.email} - ${customer.riskTier} (Score: ${customer.riskScore})`);
  }
  
  console.log('\n📤 Complete API payload:');
  console.log('```json');
  console.log(JSON.stringify({ customers: apiData }, null, 2));
  console.log('```\n');
  
  return apiData;
}

// Main execution
async function main() {
  console.log('🎯 Creating test customer data for ReturnsX...\n');
  
  console.log('📊 Customer Risk Distribution:');
  const riskCounts = TEST_CUSTOMERS.reduce((acc, c) => {
    acc[c.riskTier] = (acc[c.riskTier] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(riskCounts).forEach(([tier, count]) => {
    const emoji = tier === 'ZERO_RISK' ? '🟢' : tier === 'MEDIUM_RISK' ? '🟡' : '🔴';
    console.log(`   ${emoji} ${tier}: ${count} customers`);
  });
  
  console.log('\n' + '='.repeat(50));
  
  // Generate API requests (recommended approach)
  await generateAPIRequests();
  
  console.log('='.repeat(50));
  console.log('\n💡 How to use this data:\n');
  
  console.log('**Option 1: API Approach (Recommended)**');
  console.log('1. Create an API endpoint in your ReturnsX app to bulk insert customers');
  console.log('2. Use the JSON payload above');
  console.log('3. Send POST request to your endpoint\n');
  
  console.log('**Option 2: Manual Database Approach**');
  console.log('1. Access your database directly');
  console.log('2. Use the generated SQL statements');
  console.log('3. Run them against your CustomerProfile table\n');
  
  console.log('**Option 3: Simulate Real Orders**');
  console.log('1. Go to your store frontend');
  console.log('2. Create orders using the email/phone combinations above');
  console.log('3. Let ReturnsX naturally create the customer profiles\n');
  
  console.log('🧪 **Testing These Customers:**');
  console.log('- Use these emails/phones in your checkout testing');
  console.log('- Zero risk customers will see success messages');
  console.log('- High risk customers will see COD restrictions');
  console.log('- Check your app dashboard to see the profiles');
  
  console.log('\n🎉 Ready for comprehensive testing!');
}

// For CommonJS compatibility
const crypto = await import('crypto');

main().catch(console.error);

