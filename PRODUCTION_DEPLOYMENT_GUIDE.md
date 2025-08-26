# 🚀 ReturnsX Production Deployment Guide
## Setting up `returnsx.pk` for Shopify App Store

### 📋 **DEPLOYMENT CHECKLIST**

#### ✅ **Step 1: Domain Configuration (COMPLETED)**
- [x] Updated `shopify.app.toml` with production domain
- [x] Fixed API version consistency (2025-01)
- [x] Updated all redirect URLs

#### 🔧 **Step 2: SSL/TLS Certificate Setup (REQUIRED)**

**Option A: Cloudflare (Recommended)**
```bash
# 1. Add domain to Cloudflare
# 2. Update nameservers at domain registrar
# 3. Enable "Full (strict)" SSL/TLS encryption
# 4. Enable "Always Use HTTPS"
```

**Option B: Let's Encrypt (Free)**
```bash
# Using Certbot
sudo apt install certbot
sudo certbot --nginx -d returnsx.pk
```

**Option C: Cloud Provider SSL**
- AWS Certificate Manager
- Google Cloud SSL
- DigitalOcean Load Balancer SSL

#### 🌐 **Step 3: Hosting Setup**

**Recommended Platforms:**

**1. Vercel (Easiest)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod

# Set custom domain
vercel domains add returnsx.pk
```

**2. Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway link
railway up --detach
```

**3. DigitalOcean App Platform**
```bash
# Connect GitHub repo
# Set environment variables
# Configure custom domain
```

#### 🔐 **Step 4: Environment Variables**

**Required for Production:**
```env
# Shopify Configuration
SHOPIFY_API_KEY="379db999296fcd515d9c4d2613882c5a"
SHOPIFY_API_SECRET="your_production_secret"
SHOPIFY_SCOPES="read_orders,write_orders,read_customers,write_customers,read_fulfillments,write_script_tags,read_script_tags"
SHOPIFY_APP_URL="https://returnsx.pk"

# Security Keys (GENERATE NEW FOR PRODUCTION)
RETURNSX_ENCRYPTION_KEY="generate_new_64_char_key"
RETURNSX_HASH_SALT="generate_new_64_char_salt"
SESSION_SECRET="generate_new_64_char_secret"
SHOPIFY_WEBHOOK_SECRET="generate_new_webhook_secret"

# Database (Production)
DATABASE_URL="postgresql://user:password@host:5432/returnsx_production"

# Environment
NODE_ENV="production"
SESSION_SECURE="true"
LOG_LEVEL="info"

# Optional: WhatsApp (when ready)
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_WEBHOOK_VERIFY_TOKEN=""
```

#### 🛢️ **Step 5: Database Setup**

**Option A: Supabase (Recommended)**
```bash
# 1. Create account at supabase.com
# 2. Create new project
# 3. Get connection string
# 4. Update DATABASE_URL
```

**Option B: Railway PostgreSQL**
```bash
railway add postgresql
railway variables
# Copy DATABASE_URL
```

**Option C: DigitalOcean Managed Database**
```bash
# Create managed PostgreSQL cluster
# Add connection pooling
# Update DATABASE_URL
```

#### 🗃️ **Step 6: Database Migration**
```bash
# After setting DATABASE_URL
npx prisma generate
npx prisma db push

# Optional: Seed with test data
npm run setup-production-data
```

#### 🔗 **Step 7: DNS Configuration**

**A Record Setup:**
```
Type: A
Name: @
Value: [Your hosting IP]
TTL: 3600
```

**CNAME Setup (if using subdomain):**
```
Type: CNAME  
Name: www
Value: returnsx.pk
TTL: 3600
```

**For Cloudflare:**
```
Type: A
Name: @  
Value: [Hosting IP]
Proxy: Enabled (orange cloud)
```

#### 🧪 **Step 8: Testing Deployment**

**1. Domain Accessibility**
```bash
curl -I https://returnsx.pk
# Should return 200 OK with valid SSL
```

**2. App Authentication**
```bash
# Visit: https://returnsx.pk/auth
# Should redirect to Shopify OAuth
```

**3. Webhook Endpoints**
```bash
curl https://returnsx.pk/webhooks/orders/created
# Should return method not allowed (405) or authentication error
```

#### 📝 **Step 9: Update Shopify Partner Dashboard**

**1. App Setup → URLs**
```
App URL: https://returnsx.pk
Allowed redirection URLs:
- https://returnsx.pk/auth/callback
- https://returnsx.pk/auth/shopify/callback  
- https://returnsx.pk/api/auth/callback
```

**2. Webhooks → GDPR Compliance**
```
Customer data request: https://returnsx.pk/webhooks/customers/data_request
Customer redact: https://returnsx.pk/webhooks/customers/redact
Shop redact: https://returnsx.pk/webhooks/shop/redact
```

---

## 🎯 **RECOMMENDED DEPLOYMENT FLOW**

### **Phase 1: Quick Deploy (Today)**
1. **Vercel Deployment** (5 minutes)
   ```bash
   vercel --prod
   vercel domains add returnsx.pk
   ```

2. **Environment Variables** (10 minutes)
   - Set all required env vars in Vercel dashboard
   - Generate new production keys

3. **Database Setup** (15 minutes)
   - Create Supabase project
   - Update DATABASE_URL
   - Run migrations

### **Phase 2: DNS & SSL (Within 24 hours)**
1. **Cloudflare Setup**
   - Add domain to Cloudflare
   - Update nameservers
   - Enable SSL

2. **Domain Verification**
   - Test HTTPS access
   - Verify redirects work

### **Phase 3: Testing & Launch (Day 2)**
1. **End-to-End Testing**
   - Install app on test store
   - Test all webhook endpoints
   - Verify data processing

2. **Partner Dashboard Update**
   - Update all URLs
   - Configure GDPR webhooks
   - Request app review

---

## 🔧 **QUICK COMMANDS**

### **Generate Production Keys**
```bash
# Generate secure keys (run locally)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('HASH_SALT=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### **Test Domain Setup**
```bash
# Test SSL certificate
openssl s_client -connect returnsx.pk:443 -servername returnsx.pk

# Test HTTP to HTTPS redirect
curl -I http://returnsx.pk
```

### **Deploy with Vercel**
```bash
# One-time setup
npm i -g vercel
vercel login

# Deploy
vercel --prod
vercel alias [deployment-url] returnsx.pk
```

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### **SSL Certificate Issues**
```bash
# Problem: "NET::ERR_CERT_AUTHORITY_INVALID"
# Solution: Ensure SSL is "Full (strict)" in Cloudflare
```

### **CORS Errors**
```bash
# Problem: Cross-origin request blocked
# Solution: Verify SHOPIFY_APP_URL matches actual domain
```

### **Database Connection**
```bash
# Problem: Database connection refused
# Solution: Check DATABASE_URL and firewall settings
```

### **Webhook Verification Failures**
```bash
# Problem: "Invalid webhook signature"
# Solution: Ensure SHOPIFY_WEBHOOK_SECRET is set correctly
```

---

## 📊 **DEPLOYMENT TIMELINE**

| Task | Time Estimate | Dependencies |
|------|---------------|--------------|
| **Domain Configuration** | ✅ Complete | None |
| **Hosting Setup (Vercel)** | 15 minutes | Domain DNS |
| **SSL Certificate** | 1-24 hours | DNS propagation |
| **Database Setup** | 30 minutes | Hosting complete |
| **Environment Config** | 15 minutes | All secrets ready |
| **Testing & Verification** | 1 hour | Full deployment |
| **Partner Dashboard Update** | 30 minutes | Domain verified |

**Total: 2-3 hours active work + DNS propagation time**

---

## 🎉 **NEXT STEPS**

1. **Choose hosting platform** (Vercel recommended)
2. **Set up SSL/TLS** (Cloudflare recommended)
3. **Deploy application**
4. **Test all endpoints**
5. **Update Partner Dashboard**
6. **Submit for App Store review**

**Your `returnsx.pk` domain is a perfect choice - professional and brandable! 🚀**
