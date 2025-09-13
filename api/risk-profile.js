/**
 * Vercel API Endpoint for ReturnsX Risk Assessment
 * Handles risk profile requests from Shopify extensions
 */

export default async function handler(req, res) {
  // Set CORS headers for Shopify extensions
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Shop-Domain');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { phone } = req.query;
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const authHeader = req.headers.authorization;

    console.log(`[Risk API] Request from ${shopDomain} for phone: ${phone?.slice(-4)}`);

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone parameter is required'
      });
    }

    // Basic auth validation (in production, implement proper JWT verification)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    // Get risk profile (mock implementation)
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
}

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
      lastEventAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      customerExists: true,
      isNewCustomer: false
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
      lastEventAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      customerExists: true,
      isNewCustomer: false
    };
  } else {
    // New customer - Low risk by default (as per your requirement)
    mockProfile = {
      riskTier: 'ZERO_RISK',
      riskScore: 92.3,
      totalOrders: 1, // This is their first order
      failedAttempts: 0,
      successfulDeliveries: 0, // None yet, as this is new
      returnRate: 0.0,
      lastEventAt: new Date().toISOString(), // Right now
      customerExists: false,
      isNewCustomer: true
    };
  }

  // Add shop-specific data
  mockProfile.shopDomain = shopDomain;
  mockProfile.phoneNumber = phone;
  
  return mockProfile;
}