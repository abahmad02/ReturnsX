import { logger } from "../services/logger.server";
import { auditAPIRequest } from "../services/auditLog.server";

export interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: Request) => string;
  message?: string;
  onLimitReached?: (request: Request, rateLimitInfo: RateLimitInfo) => void;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
}

export interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory rate limit store
 * In production, use Redis or similar for distributed rate limiting
 */
class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  
  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const entry = this.store[key];
    if (!entry) return null;
    
    // Clean up expired entries
    if (Date.now() > entry.resetTime) {
      delete this.store[key];
      return null;
    }
    
    return entry;
  }
  
  async set(key: string, count: number, resetTime: number): Promise<void> {
    this.store[key] = { count, resetTime };
  }
  
  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = await this.get(key);
    
    if (!existing) {
      const entry = { count: 1, resetTime: now + windowMs };
      await this.set(key, entry.count, entry.resetTime);
      return entry;
    }
    
    const newCount = existing.count + 1;
    await this.set(key, newCount, existing.resetTime);
    return { count: newCount, resetTime: existing.resetTime };
  }
  
  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }
}

const rateLimitStore = new MemoryRateLimitStore();

// Clean up expired entries every 5 minutes
setInterval(() => {
  rateLimitStore.cleanup();
}, 5 * 60 * 1000);

/**
 * Rate limiting configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // General API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: "Too many requests from this IP, please try again later"
  },
  
  // Authentication endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many authentication attempts, please try again later"
  },
  
  // Customer profile lookups (moderate)
  customerProfile: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30,
    message: "Too many customer profile requests, please slow down"
  },
  
  // WhatsApp messaging (strict to prevent spam)
  whatsapp: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many WhatsApp requests, please wait before sending more messages"
  },
  
  // Webhook endpoints (lenient for legitimate traffic)
  webhook: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Webhook rate limit exceeded"
  },
  
  // Risk calculation endpoints
  riskCalculation: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 50,
    message: "Too many risk calculation requests"
  },
  
  // Bulk operations (very strict)
  bulk: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: "Bulk operation rate limit exceeded, please try again later"
  },
  
  // Data export (very strict for privacy)
  export: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 3,
    message: "Daily data export limit exceeded"
  }
};

/**
 * Generate rate limit key based on request
 */
function generateRateLimitKey(request: Request, config: RateLimitConfig): string {
  if (config.keyGenerator) {
    return config.keyGenerator(request);
  }
  
  // Default: use IP address and user agent hash
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const url = new URL(request.url);
  
  // Create a hash to avoid storing full user agent strings
  const hash = btoa(`${ip}:${userAgent}`).substring(0, 16);
  
  return `${url.pathname}:${hash}`;
}

/**
 * Shop-specific rate limiting
 */
function generateShopRateLimitKey(request: Request, shopDomain: string, config: RateLimitConfig): string {
  if (config.keyGenerator) {
    return config.keyGenerator(request);
  }
  
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  const url = new URL(request.url);
  
  return `shop:${shopDomain}:${url.pathname}:${ip}`;
}

/**
 * User-specific rate limiting
 */
function generateUserRateLimitKey(request: Request, userId: string, config: RateLimitConfig): string {
  if (config.keyGenerator) {
    return config.keyGenerator(request);
  }
  
  const url = new URL(request.url);
  return `user:${userId}:${url.pathname}`;
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: Request, 
  config: RateLimitConfig,
  customKey?: string
): Promise<{
  allowed: boolean;
  rateLimitInfo: RateLimitInfo;
  headers: Record<string, string>;
}> {
  const key = customKey || generateRateLimitKey(request, config);
  
  try {
    const result = await rateLimitStore.increment(key, config.windowMs);
    
    const rateLimitInfo: RateLimitInfo = {
      limit: config.maxRequests,
      current: result.count,
      remaining: Math.max(0, config.maxRequests - result.count),
      resetTime: new Date(result.resetTime),
      windowMs: config.windowMs
    };
    
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": config.maxRequests.toString(),
      "X-RateLimit-Remaining": rateLimitInfo.remaining.toString(),
      "X-RateLimit-Reset": rateLimitInfo.resetTime.getTime().toString(),
      "X-RateLimit-Window": config.windowMs.toString()
    };
    
    const allowed = result.count <= config.maxRequests;
    
    if (!allowed && config.onLimitReached) {
      config.onLimitReached(request, rateLimitInfo);
    }
    
    // Log rate limit check
    logger.info("Rate limit check", {
      component: "rateLimiting",
      key,
      allowed,
      current: result.count,
      limit: config.maxRequests,
      remaining: rateLimitInfo.remaining,
      resetTime: rateLimitInfo.resetTime.toISOString()
    });
    
    return { allowed, rateLimitInfo, headers };
    
  } catch (error) {
    logger.error("Rate limit check failed", {
      component: "rateLimiting",
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // On error, allow the request but log the incident
    return {
      allowed: true,
      rateLimitInfo: {
        limit: config.maxRequests,
        current: 0,
        remaining: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs),
        windowMs: config.windowMs
      },
      headers: {}
    };
  }
}

/**
 * Rate limiting middleware creator
 */
export function createRateLimitMiddleware(configKey: string, customConfig?: Partial<RateLimitConfig>) {
  const config = { ...RATE_LIMIT_CONFIGS[configKey], ...customConfig };
  
  if (!config) {
    throw new Error(`Rate limit configuration not found: ${configKey}`);
  }
  
  return async function rateLimitMiddleware(request: Request): Promise<Response | null> {
    const { allowed, rateLimitInfo, headers } = await checkRateLimit(request, config);
    
    if (!allowed) {
      // Audit the rate limit violation
             await auditAPIRequest(
         new URL(request.url).pathname,
         request.method,
         "unknown", // Shop domain not available at middleware level
         undefined,
         undefined,
         (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
         request.headers.get("user-agent") || undefined,
         429,
         undefined,
         true // rateLimitExceeded
       );
      
      logger.warn("Rate limit exceeded", {
        component: "rateLimiting",
        configKey,
        url: request.url,
        method: request.method,
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        current: rateLimitInfo.current,
        limit: rateLimitInfo.limit
      });
      
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: config.message || "Too many requests",
          rateLimitInfo: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            resetTime: rateLimitInfo.resetTime.toISOString()
          }
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(config.windowMs / 1000).toString(),
            ...headers
          }
        }
      );
    }
    
    // Request allowed, add rate limit headers for transparency
    return null; // Continue processing
  };
}

/**
 * Shop-specific rate limiting middleware
 */
export function createShopRateLimitMiddleware(configKey: string, shopDomain: string) {
  const config = RATE_LIMIT_CONFIGS[configKey];
  
  return async function shopRateLimitMiddleware(request: Request): Promise<Response | null> {
    const customKey = generateShopRateLimitKey(request, shopDomain, config);
    const { allowed, rateLimitInfo, headers } = await checkRateLimit(request, config, customKey);
    
    if (!allowed) {
             await auditAPIRequest(
         new URL(request.url).pathname,
         request.method,
         shopDomain,
         undefined,
         undefined,
         (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
         request.headers.get("user-agent") || undefined,
         429,
         undefined,
         true
       );
      
      return new Response(
        JSON.stringify({
          error: "Shop rate limit exceeded",
          message: config.message,
          rateLimitInfo: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            resetTime: rateLimitInfo.resetTime.toISOString()
          }
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(config.windowMs / 1000).toString(),
            ...headers
          }
        }
      );
    }
    
    return null;
  };
}

/**
 * User-specific rate limiting middleware
 */
export function createUserRateLimitMiddleware(configKey: string, userId: string) {
  const config = RATE_LIMIT_CONFIGS[configKey];
  
  return async function userRateLimitMiddleware(request: Request): Promise<Response | null> {
    const customKey = generateUserRateLimitKey(request, userId, config);
    const { allowed, rateLimitInfo, headers } = await checkRateLimit(request, config, customKey);
    
    if (!allowed) {
             await auditAPIRequest(
         new URL(request.url).pathname,
         request.method,
         "unknown",
         userId,
         undefined,
         (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
         request.headers.get("user-agent") || undefined,
         429,
         undefined,
         true
       );
      
      return new Response(
        JSON.stringify({
          error: "User rate limit exceeded",
          message: config.message,
          rateLimitInfo: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            resetTime: rateLimitInfo.resetTime.toISOString()
          }
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(config.windowMs / 1000).toString(),
            ...headers
          }
        }
      );
    }
    
    return null;
  };
}

/**
 * Apply rate limiting to API routes
 */
export function withRateLimit(configKey: string, customConfig?: Partial<RateLimitConfig>) {
  const middleware = createRateLimitMiddleware(configKey, customConfig);
  
  return function(handler: Function) {
    return async function(request: Request, ...args: any[]) {
      const rateLimitResult = await middleware(request);
      
      if (rateLimitResult) {
        return rateLimitResult; // Rate limit exceeded
      }
      
      return handler(request, ...args);
    };
  };
}

/**
 * Get current rate limit status for a key
 */
export async function getRateLimitStatus(
  request: Request,
  configKey: string,
  customKey?: string
): Promise<RateLimitInfo> {
  const config = RATE_LIMIT_CONFIGS[configKey];
  const key = customKey || generateRateLimitKey(request, config);
  
  const current = await rateLimitStore.get(key);
  
  return {
    limit: config.maxRequests,
    current: current?.count || 0,
    remaining: Math.max(0, config.maxRequests - (current?.count || 0)),
    resetTime: current ? new Date(current.resetTime) : new Date(Date.now() + config.windowMs),
    windowMs: config.windowMs
  };
}

/**
 * Clear rate limit for a specific key (admin function)
 */
export async function clearRateLimit(key: string): Promise<void> {
  delete (rateLimitStore as any).store[key];
  
  logger.info("Rate limit cleared", {
    component: "rateLimiting",
    key,
    action: "ADMIN_CLEAR_RATE_LIMIT"
  });
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(): Promise<{
  totalKeys: number;
  activeWindows: number;
  topRequesters: Array<{ key: string; count: number; resetTime: Date }>;
}> {
  const store = (rateLimitStore as any).store;
  const now = Date.now();
  const activeEntries = Object.entries(store).filter(([_, entry]: [string, any]) => entry.resetTime > now);
  
  const topRequesters = activeEntries
    .map(([key, entry]: [string, any]) => ({
      key: key.substring(0, 50) + "...", // Truncate for privacy
      count: entry.count,
      resetTime: new Date(entry.resetTime)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalKeys: Object.keys(store).length,
    activeWindows: activeEntries.length,
    topRequesters
  };
} 