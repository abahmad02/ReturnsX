# ReturnsX Authentication Token Setup Guide

## Overview
The ReturnsX Thank You Page Extension requires an authentication token to securely communicate with the ReturnsX API. This guide explains how to obtain and configure your token.

## 🔑 How to Get Your Authentication Token

### Option 1: ReturnsX Dashboard (Recommended)
1. **Log into ReturnsX Dashboard**
   - Visit: `https://dashboard.returnsx.com`
   - Sign in with your ReturnsX merchant account

2. **Navigate to API Settings**
   - Go to **Settings** → **API Integration**
   - Or directly visit: `https://dashboard.returnsx.com/settings/api`

3. **Generate Extension Token**
   - Click **"Generate New Token"** 
   - Select **"Shopify Extension"** as the token type
   - Enter your Shopify store domain (e.g., `mystore.myshopify.com`)
   - Click **"Create Token"**

4. **Copy Your Token**
   - Your token will look like: `rtx_live_1234567890abcdef...`
   - **Important:** Copy it immediately - it won't be shown again!

### Option 2: Contact ReturnsX Support
If you don't have dashboard access yet:

1. **Email ReturnsX Support**
   - Email: `support@returnsx.com`
   - Subject: `Shopify Extension API Token Request`

2. **Include Required Information**
   ```
   Store Name: [Your Store Name]
   Shopify Domain: [yourstore.myshopify.com]
   ReturnsX Account Email: [your@email.com]
   Extension Version: Thank You Page Extension v1.0
   ```

3. **Receive Your Token**
   - Support will provide your token within 24 hours
   - Token format: `rtx_live_[32-character-string]`

## 🛠️ How to Configure the Token in Shopify

### Step 1: Install the Extension
1. Deploy the extension to your Shopify app
2. Install it in your Shopify store
3. The extension will appear in your theme customizer

### Step 2: Configure in Theme Customizer
1. **Go to Theme Customizer**
   - Shopify Admin → Online Store → Themes
   - Click **"Customize"** on your active theme

2. **Find the Extension Settings**
   - Navigate to **Checkout** → **Thank You Page**
   - Look for **"ReturnsX Risk Assessment"** section

3. **Enter Your Token**
   - Find **"Authentication Token"** field
   - Paste your token: `rtx_live_1234567890abcdef...`
   - Click **"Save"**

### Step 3: Configure API Endpoint (if needed)
- **Default Endpoint:** `https://api.returnsx.com` (usually correct)
- **Custom Endpoint:** Only change if instructed by ReturnsX support

## 🔒 Token Security Best Practices

### ✅ Do's
- **Store Securely:** Only enter in Shopify admin
- **Keep Private:** Never share in emails, chat, or code
- **Use HTTPS:** Always ensure secure connections
- **Monitor Usage:** Check ReturnsX dashboard for API usage

### ❌ Don'ts
- **Don't Hardcode:** Never put tokens in code or config files
- **Don't Share:** Don't share tokens with unauthorized users
- **Don't Reuse:** Each store should have its own unique token
- **Don't Store Locally:** Don't save tokens on local devices

## 🧪 Testing Your Token

### Test Configuration
1. **Save Settings** in theme customizer
2. **Place Test Order** in your store
3. **Check Thank You Page** - should show risk assessment
4. **Verify in ReturnsX Dashboard** - API calls should appear in logs

### Troubleshooting Token Issues

#### Token Not Working?
```
Error: "Authentication failed" or "Invalid token"
```
**Solutions:**
- Verify token is copied correctly (no extra spaces)
- Check if token has expired (contact support)
- Ensure API endpoint is correct
- Confirm store domain matches token registration

#### Extension Not Loading?
```
Error: "Service unavailable" or blank display
```
**Solutions:**
- Check internet connectivity
- Verify API endpoint URL
- Test with debug mode enabled
- Check browser console for errors

## 📋 Token Information Reference

### Token Format
- **Production:** `rtx_live_[32-character-alphanumeric-string]`
- **Staging:** `rtx_test_[32-character-alphanumeric-string]`
- **Length:** Exactly 40 characters total

### Token Permissions
Your extension token provides access to:
- ✅ Customer risk profile lookup
- ✅ Order risk assessment
- ✅ Delivery history analysis
- ❌ Account management (read-only for risk data)

### Token Expiration
- **Standard Tokens:** No expiration (permanent)
- **Trial Tokens:** 30-day expiration
- **Custom Tokens:** As specified by ReturnsX support

## 🆘 Getting Help

### ReturnsX Support Channels
- **Email:** support@returnsx.com
- **Live Chat:** Available in ReturnsX dashboard
- **Documentation:** https://docs.returnsx.com
- **Status Page:** https://status.returnsx.com

### Common Support Requests
1. **"I lost my token"** → Support can regenerate
2. **"Token not working"** → Support can verify and troubleshoot
3. **"Need staging token"** → Support can provide test environment access
4. **"Multiple stores"** → Each store needs separate token

## 📞 Emergency Contact
For urgent issues affecting live orders:
- **Emergency Email:** urgent@returnsx.com
- **Phone Support:** Available for enterprise customers
- **Response Time:** Within 2 hours for production issues

---

## Quick Setup Checklist

- [ ] Obtained authentication token from ReturnsX
- [ ] Installed extension in Shopify store
- [ ] Configured token in theme customizer
- [ ] Verified API endpoint setting
- [ ] Tested with sample order
- [ ] Confirmed risk assessment displays
- [ ] Checked ReturnsX dashboard for API activity

**Need help?** Contact ReturnsX support with your store domain and any error messages.