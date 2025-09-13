import { logger } from './logger.server';

interface SessionTokenValidation {
  valid: boolean;
  authenticated: boolean;
  shopDomain?: string;
  customerId?: string;
  payload?: any;
}

/**
 * Validate Shopify session tokens from UI Extensions
 * 
 * UI Extensions use session tokens for authentication which contain:
 * - Shop domain
 * - Customer ID (if authenticated)
 * - Extension context
 */
export async function validateSessionToken(
  token: string, 
  request: Request
): Promise<SessionTokenValidation> {
  try {
    // Session tokens from UI Extensions are JWTs signed by Shopify
    // In a real implementation, you would need Shopify's public key
    // For now, we'll do basic validation and parsing
    
    // Decode the token (without verification for development)
    const decoded = parseSessionToken(token);
    
    if (!decoded) {
      return { valid: false, authenticated: false };
    }

    // Check token expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      logger.warn("Session token expired", {
        component: "sessionTokenValidator",
        exp: decoded.exp,
        now: Math.floor(Date.now() / 1000)
      });
      return { valid: false, authenticated: false };
    }

    // Extract shop domain
    const shopDomain = decoded.dest || decoded.iss;
    
    // Check if customer is authenticated
    const authenticated = !!decoded.sub && decoded.sub !== 'anonymous';
    const customerId = authenticated ? decoded.sub : undefined;

    logger.info("Session token validated", {
      component: "sessionTokenValidator",
      authenticated,
      shopDomain: shopDomain?.replace(/https?:\/\//, ''),
      hasCustomerId: !!customerId
    });

    return {
      valid: true,
      authenticated,
      shopDomain: shopDomain?.replace(/https?:\/\//, ''),
      customerId,
      payload: decoded
    };

  } catch (error) {
    logger.error("Session token validation failed", {
      component: "sessionTokenValidator",
      error: error instanceof Error ? error.message : String(error)
    });

    return { valid: false, authenticated: false };
  }
}

/**
 * Parse session token without verification (for development)
 * In production, use proper JWT verification with Shopify's public key
 */
function parseSessionToken(token: string): any {
  try {
    // Split JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64url)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
    
  } catch (error) {
    logger.warn("Failed to parse session token", {
      component: "sessionTokenValidator",
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Verify session token with Shopify's public key (production implementation)
 * For production use, implement proper JWT verification with Shopify's public key
 */
export async function verifySessionTokenWithShopify(token: string): Promise<any> {
  // Production implementation would:
  // 1. Get Shopify's public key from https://shopify.dev/docs/apps/auth/oauth/session-tokens
  // 2. Verify JWT signature using the public key
  // 3. Validate claims (aud, iss, exp, etc.)
  
  // For development, we use the parseSessionToken approach
  const parsed = parseSessionToken(token);
  if (!parsed) {
    throw new Error('Invalid session token format');
  }
  
  return parsed;
}

/**
 * Create a session token for testing purposes
 * Only use in development/testing
 */
export function createTestSessionToken(payload: {
  shopDomain: string;
  customerId?: string;
  authenticated?: boolean;
}): string {
  const tokenPayload = {
    iss: `https://${payload.shopDomain}`,
    dest: `https://${payload.shopDomain}`,
    aud: 'returnsx',
    sub: payload.customerId || (payload.authenticated ? 'customer_123' : 'anonymous'),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iat: Math.floor(Date.now() / 1000),
    jti: `test_${Date.now()}_${Math.random()}`
  };

  // Simple base64url encoding for testing
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  // In testing, we don't sign the token
  return `${header}.${payload64}.test_signature`;
}