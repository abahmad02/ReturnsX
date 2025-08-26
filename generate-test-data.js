#!/usr/bin/env node

/**
 * ReturnsX Test Data Generator
 * 
 * This script creates dummy customers and orders for testing the COD risk management system
 */

import { shopifyApi } from '@shopify/shopify-api';
import { ApiVersion } from '@shopify/shopify-api';

// Configuration
const CONFIG = {
  shopDomain: 'returnsx123.myshopify.com',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN, // You'll need to set this
  numCustomers: 20,
  numOrders: 50,
  apiVersion: ApiVersion.July24
};

// Test customer templates
const CUSTOMER_TEMPLATES = {
  zeroRisk: [
    { firstName: 'Ahmed', lastName: 'Khan', email: 'ahmed.khan@test.com', phone: '+923001234567' },
    { firstName: 'Fatima', lastName: 'Ali', email: 'fatima.ali@test.com', phone: '+923001234568' },
    { firstName: 'Hassan', lastName: 'Shah', email: 'hassan.shah@test.com', phone: '+923001234569' },
    { firstName: 'Ayesha', lastName: 'Malik', email: 'ayesha.malik@test.com', phone: '+923001234570' },
    { firstName: 'Omar', lastName: 'Ahmed', email: 'omar.ahmed@test.com', phone: '+923001234571' }
  ],
  mediumRisk: [
    { firstName: 'Bilal', lastName: 'Hussain', email: 'bilal.hussain@test.com', phone: '+923009876543' },
    { firstName: 'Zara', lastName: 'Tariq', email: 'zara.tariq@test.com', phone: '+923009876544' },
    { firstName: 'Imran', lastName: 'Siddique', email: 'imran.siddique@test.com', phone: '+923009876545' },
    { firstName: 'Sana', lastName: 'Rehman', email: 'sana.rehman@test.com', phone: '+923009876546' }
  ],
  highRisk: [
    { firstName: 'Risky', lastName: 'Customer', email: 'risky.customer@test.com', phone: '+923009999999' },
    { firstName: 'Problem', lastName: 'User', email: 'problem.user@test.com', phone: '+923009999998' },
    { firstName: 'Fraud', lastName: 'Alert', email: 'fraud.alert@test.com', phone: '+923009999997' },
    { firstName: 'High', lastName: 'Risk', email: 'high.risk@test.com', phone: '+923009999996' }
  ]
};

// Product templates for orders
const PRODUCT_TEMPLATES = [
  { title: 'Premium Phone Case', price: 25.00, weight: 0.1 },
  { title: 'Cotton T-Shirt', price: 15.00, weight: 0.2 },
  { title: 'Wireless Earbuds', price: 75.00, weight: 0.15 },
  { title: 'Laptop Stand', price: 45.00, weight: 1.2 },
  { title: 'Smart Watch', price: 299.00, weight: 0.3 },
  { title: 'High Value Electronics', price: 500.00, weight: 2.0 },
  { title: 'Designer Sunglasses', price: 120.00, weight: 0.1 },
  { title: 'Bluetooth Speaker', price: 89.00, weight: 0.8 }
];

console.log('🧪 ReturnsX Test Data Generator\n');
console.log('=====================================\n');

// Initialize Shopify API
function initializeShopifyApi() {
  if (!CONFIG.accessToken) {
    console.error('❌ Error: SHOPIFY_ACCESS_TOKEN environment variable not set');
    console.log('\n💡 How to get your access token:');
    console.log('1. Go to your store admin: https://returnsx123.myshopify.com/admin');
    console.log('2. Apps → ReturnsX → Settings');
    console.log('3. Or create a private app with these permissions:');
    console.log('   - read_customers, write_customers');
    console.log('   - read_orders, write_orders');
    console.log('   - read_products, write_products');
    console.log('\n🔧 Set it with: export SHOPIFY_ACCESS_TOKEN="your_token_here"');
    process.exit(1);
  }

  return shopifyApi({
    apiKey: 'your_api_key', // Not needed for admin API calls
    apiSecretKey: 'your_secret', // Not needed for admin API calls
    scopes: ['read_customers', 'write_customers', 'read_orders', 'write_orders', 'read_products', 'write_products'],
    hostName: CONFIG.shopDomain,
    apiVersion: CONFIG.apiVersion
  });
}

// Generate random Pakistani address
function generateAddress() {
  const cities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'];
  const areas = ['Block A', 'Block B', 'Phase 1', 'Phase 2', 'Model Town', 'DHA', 'Gulberg', 'Johar Town'];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const area = areas[Math.floor(Math.random() * areas.length)];
  
  return {
    first_name: '',
    last_name: '',
    address1: `House ${Math.floor(Math.random() * 999) + 1}, ${area}`,
    city: city,
    province: 'Punjab',
    country: 'Pakistan',
    zip: `${Math.floor(Math.random() * 90000) + 10000}`
  };
}

// Create customers
async function createCustomers(session) {
  console.log('👥 Creating test customers...\n');
  
  const allCustomers = [
    ...CUSTOMER_TEMPLATES.zeroRisk.map(c => ({ ...c, riskLevel: 'zero' })),
    ...CUSTOMER_TEMPLATES.mediumRisk.map(c => ({ ...c, riskLevel: 'medium' })),
    ...CUSTOMER_TEMPLATES.highRisk.map(c => ({ ...c, riskLevel: 'high' }))
  ];

  const createdCustomers = [];

  for (const template of allCustomers) {
    try {
      const address = generateAddress();
      address.first_name = template.firstName;
      address.last_name = template.lastName;

      const customer = {
        first_name: template.firstName,
        last_name: template.lastName,
        email: template.email,
        phone: template.phone,
        addresses: [address],
        tags: `test-data,risk-${template.riskLevel}`,
        note: `Test customer - ${template.riskLevel} risk level`
      };

      const response = await session.rest.Customer.save({ session });
      Object.assign(response, customer);
      await response.save();

      console.log(`✅ Created ${template.riskLevel} risk customer: ${template.firstName} ${template.lastName} (${template.email})`);
      
      createdCustomers.push({
        id: response.id,
        email: template.email,
        phone: template.phone,
        riskLevel: template.riskLevel,
        ...template
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Failed to create customer ${template.email}:`, error.message);
    }
  }

  return createdCustomers;
}

// Create products if they don't exist
async function createProducts(session) {
  console.log('\n📦 Creating test products...\n');
  
  const createdProducts = [];

  for (const template of PRODUCT_TEMPLATES) {
    try {
      const product = {
        title: template.title,
        body_html: `<p>Test product for ReturnsX testing - ${template.title}</p>`,
        vendor: 'ReturnsX Test',
        product_type: 'Test Product',
        tags: 'test-data,returnsx-testing',
        variants: [{
          price: template.price.toFixed(2),
          weight: template.weight,
          weight_unit: 'kg',
          inventory_quantity: 100,
          inventory_management: 'shopify'
        }]
      };

      const response = await session.rest.Product.save({ session });
      Object.assign(response, product);
      await response.save();

      console.log(`✅ Created product: ${template.title} - $${template.price}`);
      
      createdProducts.push({
        id: response.id,
        variant_id: response.variants[0].id,
        title: template.title,
        price: template.price
      });

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`❌ Failed to create product ${template.title}:`, error.message);
    }
  }

  return createdProducts;
}

// Create orders
async function createOrders(session, customers, products) {
  console.log('\n🛒 Creating test orders...\n');
  
  const paymentMethods = ['cash_on_delivery', 'bank_transfer', 'credit_card'];
  const orderStatuses = ['pending', 'open', 'closed'];
  
  for (let i = 0; i < CONFIG.numOrders; i++) {
    try {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
      const selectedProducts = [];
      
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        selectedProducts.push({
          variant_id: product.variant_id,
          quantity: quantity,
          price: product.price
        });
      }

      const paymentMethod = customer.riskLevel === 'high' ? 'cash_on_delivery' : 
                           paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      const address = generateAddress();
      address.first_name = customer.firstName;
      address.last_name = customer.lastName;

      const order = {
        customer: {
          id: customer.id
        },
        line_items: selectedProducts,
        shipping_address: address,
        billing_address: address,
        financial_status: paymentMethod === 'cash_on_delivery' ? 'pending' : 'paid',
        fulfillment_status: null,
        note: `Test order - Customer risk level: ${customer.riskLevel}, Payment: ${paymentMethod}`,
        tags: `test-data,risk-${customer.riskLevel},payment-${paymentMethod}`,
        gateway: paymentMethod,
        processing_method: paymentMethod === 'cash_on_delivery' ? 'manual' : 'direct'
      };

      const response = await session.rest.Order.save({ session });
      Object.assign(response, order);
      await response.save();

      const totalValue = selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      console.log(`✅ Created order #${response.order_number || response.id} - ${customer.firstName} ${customer.lastName} - $${totalValue.toFixed(2)} (${paymentMethod})`);

      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      console.error(`❌ Failed to create order ${i + 1}:`, error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('🔧 Initializing Shopify API...\n');
    
    // Note: For this to work, you'll need proper authentication
    // This is a template - you'll need to adapt it based on your auth method
    
    console.log('⚠️  SETUP REQUIRED:\n');
    console.log('This script template shows you how to create test data.');
    console.log('To use it, you need to:');
    console.log('1. Set up proper Shopify API authentication');
    console.log('2. Install required dependencies: npm install @shopify/shopify-api');
    console.log('3. Set environment variables');
    console.log('4. Adapt the authentication method to your app setup');
    console.log('\n📋 Alternative: Use Shopify Admin Manual Creation');
    console.log('For quick testing, you can manually create:');
    console.log('- A few customers with the emails/phones from the templates above');
    console.log('- Some test products');
    console.log('- Orders using those customers and products');
    console.log('\n🎯 Customer Templates:');
    console.log('Zero Risk: good.customer@test.com (+923001234567)');
    console.log('High Risk: risky.customer@test.com (+923009876543)');
    console.log('New Customer: new.customer@test.com (+923005555555)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Export for potential use in other scripts
export {
  CUSTOMER_TEMPLATES,
  PRODUCT_TEMPLATES,
  generateAddress,
  createCustomers,
  createProducts,
  createOrders
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

