# Shopify Risk Score Extensions: Implementation Guide

## 🎯 Extension Types Comparison

### 1. Post-Purchase UI Extension (`post_purchase_ui`)
**Shows:** Immediately after payment completion, before Thank-You page
**User Experience:** Customer sees risk score right after paying, in a dedicated screen

#### ✅ Pros for Risk Score Display:
- **Immediate feedback**: Customer sees their risk score right after payment
- **Full screen control**: Can display detailed risk information and tips
- **Upsell opportunities**: Can suggest prepayment for future orders if high risk
- **Educational moment**: Perfect time to explain risk scoring system
- **No checkout interference**: Doesn't affect checkout flow performance

#### ❌ Cons for Risk Score Display:
- **Only shows for paid orders**: Won't appear for COD/manual payment methods
- **Limited payment methods**: Doesn't work with bank transfers, manual payments
- **Can be skipped**: Customer can click "Continue to Thank You page"
- **Requires ShouldRender**: Must implement logic to determine when to show

### 2. Order Status Extension (`checkout_ui_extension` with `order-status` target)
**Shows:** On the final Thank-You/Order Status page after checkout
**User Experience:** Customer sees risk score on the order confirmation page

#### ✅ Pros for Risk Score Display:
- **Universal compatibility**: Works with ALL payment methods (COD, bank transfer, etc.)
- **Always visible**: Shows on Thank-You page regardless of payment method
- **Persistent access**: Customer can revisit this page anytime via order status
- **Order context**: Has full access to order details and customer info
- **No rendering conditions**: Always shows if extension is active

#### ❌ Cons for Risk Score Display:
- **Shared space**: Competes with other order status information
- **Less prominent**: May be overlooked among other order details
- **No interaction**: Limited ability to show detailed risk improvement tips
- **Later timing**: Customer may have already left the page

---

## 🏆 **Recommendation for Risk Score Display**

**For Pakistani COD/ReturnsX use case: Use Order Status Extension**

**Why?**
1. **COD Compatibility**: Most Pakistani e-commerce uses COD - Post-Purchase won't show
2. **Universal Coverage**: Works for all payment methods your customers use
3. **Future Access**: Customers can check their risk score later via order status
4. **Simpler Implementation**: No ShouldRender logic needed

---

## 🚀 Implementation Details

### Use Cases by Payment Method:

| Payment Method | Post-Purchase Shows | Order Status Shows | Best Choice |
|---------------|--------------------|--------------------|-------------|
| Shopify Payments | ✅ Yes | ✅ Yes | Either |
| PayPal | ✅ Yes | ✅ Yes | Either |
| COD (Cash on Delivery) | ❌ No | ✅ Yes | **Order Status** |
| Bank Transfer | ❌ No | ✅ Yes | **Order Status** |
| Manual Payment | ❌ No | ✅ Yes | **Order Status** |

### Extension Targeting:

```javascript
// Post-Purchase Extension
export const extend = extension(
  'post_purchase_ui',
  (root, { extensionApi }) => {
    // Shows after payment, before thank you page
  }
);

// Order Status Extension  
export const extend = extension(
  'checkout_ui_extension',
  (root, { extensionApi }) => {
    // Shows on thank you / order status page
  }
);
```

---

## 📱 **For Your ReturnsX App:**

Given that your target market (Pakistan) heavily uses COD payments, I recommend starting with the **Order Status Extension** approach. This ensures your risk scores are visible to all customers regardless of payment method.

We can later add the Post-Purchase extension as a premium feature for merchants who want more prominent risk score display for their paid orders.