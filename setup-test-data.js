#!/usr/bin/env node

/**
 * ReturnsX Test Data Setup Script
 * 
 * This script helps you quickly set up test data for your ReturnsX app
 */

console.log('🧪 ReturnsX Test Data Setup\n');
console.log('=====================================\n');

console.log('📋 Quick Setup Checklist:\n');

console.log('1. 🏪 STORE SETUP');
console.log('   ✓ Store: returnsx123.myshopify.com');
console.log('   → Admin: https://returnsx123.myshopify.com/admin');
console.log('   → Storefront: https://returnsx123.myshopify.com');
console.log('');

console.log('2. 💳 ENABLE CASH ON DELIVERY');
console.log('   → Go to: Settings → Payments → Manual payment methods');
console.log('   → Add: "Cash on Delivery"');
console.log('   → Instructions: "Pay when your order is delivered"');
console.log('');

console.log('3. 📦 CREATE TEST PRODUCTS');
console.log('   → Go to: Products → Add product');
console.log('   → Create these test products:');
console.log('     • "Phone Case" - $25.00');
console.log('     • "T-Shirt" - $15.00');  
console.log('     • "High Value Item" - $500.00');
console.log('');

console.log('4. 👥 TEST CUSTOMER PROFILES');
console.log('');
console.log('   🟢 ZERO RISK CUSTOMER (should see success message):');
console.log('      Email: good.customer@test.com');
console.log('      Phone: +923001234567');
console.log('');
console.log('   🔴 HIGH RISK CUSTOMER (should see COD restriction):');
console.log('      Email: risky.customer@test.com');
console.log('      Phone: +923009876543');
console.log('');
console.log('   ⚪ NEW CUSTOMER (should have neutral experience):');
console.log('      Email: new.customer@test.com');
console.log('      Phone: +923005555555');
console.log('');

console.log('5. 🛒 TESTING FLOW');
console.log('   1. Go to storefront: https://returnsx123.myshopify.com');
console.log('   2. Add products to cart');
console.log('   3. Go to checkout');
console.log('   4. Enter test customer details');
console.log('   5. Try selecting "Cash on Delivery"');
console.log('   6. Watch for ReturnsX messages and restrictions');
console.log('');

console.log('6. 🔍 VERIFY SCRIPT IS WORKING');
console.log('   → Open browser Developer Tools (F12)');
console.log('   → Go to Console tab');
console.log('   → Look for: "ReturnsX: Checkout enforcement script loaded successfully"');
console.log('   → Look for: "ReturnsX: Initializing checkout enforcement..."');
console.log('');

console.log('7. 📊 MONITOR RESULTS');
console.log('   → Check your ReturnsX app dashboard');
console.log('   → View customer statistics and risk distribution');
console.log('   → Monitor development console logs');
console.log('');

console.log('🎯 SUCCESS CRITERIA:');
console.log('   ✓ High-risk customers see COD restriction modal');
console.log('   ✓ Zero-risk customers see success message');
console.log('   ✓ Script only loads on checkout pages');
console.log('   ✓ No JavaScript errors in console');
console.log('   ✓ Customer risk data is collected');
console.log('');

console.log('🚀 QUICK TEST URLs:');
console.log(`   Storefront: https://returnsx123.myshopify.com`);
console.log(`   Admin: https://returnsx123.myshopify.com/admin`);
console.log(`   ReturnsX App: Check your app dashboard`);
console.log('');

console.log('💡 PRO TIPS:');
console.log('   • Use incognito/private browsing for different customer tests');
console.log('   • Check browser console for detailed script behavior');
console.log('   • Test both desktop and mobile checkout flows');
console.log('   • Try different order values to test risk thresholds');
console.log('');

console.log('🎉 Happy Testing! Your COD risk management system is ready!');

