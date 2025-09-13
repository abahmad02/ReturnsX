/**
 * Backend API Stub for ReturnsX Risk Assessment
 * Node.js/Express example with session token verification
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Configuration
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const APP_SECRET = process.env.SHOPIFY_APP_SECRET; // Your app's client secret

/**
 * Middleware to verify Shopify session token
 */
const verifySessionToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const shopDomain = req.headers['x-shopify-shop-domain'];

    if (!shopDomain) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing shop domain header' 
      });
    }

    // For development, we'll do basic validation
    // In production, implement proper JWT verification with your app secret
    if (!token || token.length < 10) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid session token' 
      });
    }

    // Store validated info for the route
    req.shopDomain = shopDomain;
    req.sessionToken = token;
    
    next();

  } catch (error) {
    console.error('Session token verification error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Token verification failed' 
    });
  }
};

/**
 * Risk Profile API Endpoint
 * GET /api/risk-profile?phone=+923001234567
 */
app.get('/api/risk-profile', verifySessionToken, async (req, res) => {
  try {
    const { phone } = req.query;
    const shopDomain = req.shopDomain;

    console.log(`[Risk API] Request from ${shopDomain} for phone: ${phone?.slice(-4)}`);

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone parameter is required'
      });
    }

    // Simulate database lookup
    const riskProfile = await getRiskProfile(phone, shopDomain);

    return res.json({
      success: true,
      profile: riskProfile,
      timestamp: new Date().toISOString(),
      shop: shopDomain
    });

  } catch (error) {
    console.error('[Risk API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Mock function to simulate risk profile lookup
 * In production, this would query your actual database
 */
async function getRiskProfile(phone, shopDomain) {
  // Simulate different risk scenarios based on phone number patterns
  const phoneStr = phone.toString();
  
  // Mock data based on phone number ending
  const lastDigit = parseInt(phoneStr.slice(-1));
  
  let mockProfile;
  
  if (lastDigit >= 0 && lastDigit <= 2) {
    // High risk customer
    mockProfile = {
      riskTier: 'HIGH_RISK',
      riskScore: 25.5,
      totalOrders: 8,
      failedAttempts: 4,
      successfulDeliveries: 4,
      returnRate: 50.0,
      lastEventAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } else if (lastDigit >= 3 && lastDigit <= 6) {
    // Medium risk customer
    mockProfile = {
      riskTier: 'MEDIUM_RISK',
      riskScore: 65.8,
      totalOrders: 12,
      failedAttempts: 2,
      successfulDeliveries: 10,
      returnRate: 16.7,
      lastEventAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    };
  } else {
    // Low risk customer
    mockProfile = {
      riskTier: 'ZERO_RISK',
      riskScore: 92.3,
      totalOrders: 15,
      failedAttempts: 0,
      successfulDeliveries: 15,
      returnRate: 0.0,
      lastEventAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Add shop-specific data
  mockProfile.shopDomain = shopDomain;
  mockProfile.phone = phone.slice(-4); // Only store last 4 digits for privacy
  mockProfile.success = true;

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  return mockProfile;
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ReturnsX Risk API',
    version: '1.0.0'
  });
});

/**
 * Error handling middleware
 */
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ReturnsX Risk API server running on port ${PORT}`);
  console.log(`📊 Risk profile endpoint: http://localhost:${PORT}/api/risk-profile`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;