/**
 * Rate Limiting Configuration for Production
 * Implements client-side rate limiting and abuse prevention
 */

class RateLimiter {
  constructor(config = {}) {
    this.config = {
      requests: config.requests || 100,
      window: config.window || 60000, // 1 minute
      burstLimit: config.burstLimit || 10,
      burstWindow: config.burstWindow || 1000, // 1 second
      ...config
    };
    
    this.requestCounts = new Map();
    this.burstCounts = new Map();
    this.blockedUntil = new Map();
    
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.config.window);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier = 'default') {
    const now = Date.now();
    
    // Check if currently blocked
    const blockedUntil = this.blockedUntil.get(identifier);
    if (blockedUntil && now < blockedUntil) {
      return {
        allowed: false,
        reason: 'rate_limited',
        retryAfter: Math.ceil((blockedUntil - now) / 1000)
      };
    }

    // Check burst limit
    if (!this.checkBurstLimit(identifier, now)) {
      this.blockedUntil.set(identifier, now + (this.config.burstWindow * 2));
      return {
        allowed: false,
        reason: 'burst_limit_exceeded',
        retryAfter: Math.ceil((this.config.burstWindow * 2) / 1000)
      };
    }

    // Check rate limit
    if (!this.checkRateLimit(identifier, now)) {
      this.blockedUntil.set(identifier, now + this.config.window);
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: Math.ceil(this.config.window / 1000)
      };
    }

    // Record the request
    this.recordRequest(identifier, now);
    
    return {
      allowed: true,
      remaining: this.getRemainingRequests(identifier, now)
    };
  }

  /**
   * Check burst limit (short-term)
   */
  checkBurstLimit(identifier, now) {
    const burstKey = `${identifier}:${Math.floor(now / this.config.burstWindow)}`;
    const currentBurstCount = this.burstCounts.get(burstKey) || 0;
    
    return currentBurstCount < this.config.burstLimit;
  }

  /**
   * Check rate limit (long-term)
   */
  checkRateLimit(identifier, now) {
    const windowStart = Math.floor(now / this.config.window) * this.config.window;
    const requests = this.requestCounts.get(identifier) || [];
    
    // Count requests in current window
    const requestsInWindow = requests.filter(timestamp => timestamp >= windowStart);
    
    return requestsInWindow.length < this.config.requests;
  }

  /**
   * Record a request
   */
  recordRequest(identifier, now) {
    // Record for rate limiting
    const requests = this.requestCounts.get(identifier) || [];
    requests.push(now);
    this.requestCounts.set(identifier, requests);

    // Record for burst limiting
    const burstKey = `${identifier}:${Math.floor(now / this.config.burstWindow)}`;
    const currentBurstCount = this.burstCounts.get(burstKey) || 0;
    this.burstCounts.set(burstKey, currentBurstCount + 1);
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(identifier, now) {
    const windowStart = Math.floor(now / this.config.window) * this.config.window;
    const requests = this.requestCounts.get(identifier) || [];
    const requestsInWindow = requests.filter(timestamp => timestamp >= windowStart);
    
    return Math.max(0, this.config.requests - requestsInWindow.length);
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.config.window;

    // Cleanup request counts
    for (const [identifier, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      if (validRequests.length === 0) {
        this.requestCounts.delete(identifier);
      } else {
        this.requestCounts.set(identifier, validRequests);
      }
    }

    // Cleanup burst counts
    const burstCutoff = now - this.config.burstWindow;
    for (const [key] of this.burstCounts.entries()) {
      const timestamp = parseInt(key.split(':')[1]) * this.config.burstWindow;
      if (timestamp < burstCutoff) {
        this.burstCounts.delete(key);
      }
    }

    // Cleanup blocked entries
    for (const [identifier, blockedUntil] of this.blockedUntil.entries()) {
      if (now >= blockedUntil) {
        this.blockedUntil.delete(identifier);
      }
    }
  }

  /**
   * Reset limits for identifier
   */
  reset(identifier) {
    this.requestCounts.delete(identifier);
    this.blockedUntil.delete(identifier);
    
    // Clean up burst counts for this identifier
    for (const [key] of this.burstCounts.entries()) {
      if (key.startsWith(`${identifier}:`)) {
        this.burstCounts.delete(key);
      }
    }
  }

  /**
   * Get current status for identifier
   */
  getStatus(identifier = 'default') {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.window) * this.config.window;
    const requests = this.requestCounts.get(identifier) || [];
    const requestsInWindow = requests.filter(timestamp => timestamp >= windowStart);
    
    const burstKey = `${identifier}:${Math.floor(now / this.config.burstWindow)}`;
    const burstCount = this.burstCounts.get(burstKey) || 0;
    
    const blockedUntil = this.blockedUntil.get(identifier);
    
    return {
      identifier,
      requests: {
        current: requestsInWindow.length,
        limit: this.config.requests,
        remaining: Math.max(0, this.config.requests - requestsInWindow.length),
        windowStart,
        windowEnd: windowStart + this.config.window
      },
      burst: {
        current: burstCount,
        limit: this.config.burstLimit,
        remaining: Math.max(0, this.config.burstLimit - burstCount)
      },
      blocked: blockedUntil ? {
        until: blockedUntil,
        remaining: Math.max(0, blockedUntil - now)
      } : null
    };
  }
}

/**
 * API Rate Limiter for ReturnsX API calls
 */
class APIRateLimiter extends RateLimiter {
  constructor() {
    super({
      requests: 100,      // 100 requests per minute
      window: 60000,      // 1 minute window
      burstLimit: 10,     // 10 requests per second
      burstWindow: 1000   // 1 second burst window
    });
  }

  /**
   * Get identifier for API rate limiting
   */
  getIdentifier(endpoint, method = 'GET') {
    // Create identifier based on endpoint and method
    const baseEndpoint = endpoint.split('?')[0]; // Remove query params
    return `api:${method}:${baseEndpoint}`;
  }

  /**
   * Check if API call is allowed
   */
  checkAPICall(endpoint, method = 'GET') {
    const identifier = this.getIdentifier(endpoint, method);
    return this.isAllowed(identifier);
  }
}

/**
 * User Action Rate Limiter for preventing abuse
 */
class UserActionRateLimiter extends RateLimiter {
  constructor() {
    super({
      requests: 50,       // 50 actions per minute
      window: 60000,      // 1 minute window
      burstLimit: 5,      // 5 actions per 10 seconds
      burstWindow: 10000  // 10 second burst window
    });
  }

  /**
   * Get identifier for user actions
   */
  getIdentifier(action, userId = 'anonymous') {
    return `user:${userId}:${action}`;
  }

  /**
   * Check if user action is allowed
   */
  checkUserAction(action, userId = 'anonymous') {
    const identifier = this.getIdentifier(action, userId);
    return this.isAllowed(identifier);
  }
}

/**
 * Abuse Prevention System
 */
class AbusePreventionSystem {
  constructor() {
    this.apiLimiter = new APIRateLimiter();
    this.userLimiter = new UserActionRateLimiter();
    this.suspiciousPatterns = new Map();
    this.blockedIPs = new Set();
    
    // Initialize monitoring
    this.initializeMonitoring();
  }

  /**
   * Initialize abuse monitoring
   */
  initializeMonitoring() {
    // Monitor for suspicious patterns
    setInterval(() => {
      this.analyzeSuspiciousPatterns();
    }, 30000); // Check every 30 seconds

    // Cleanup old data
    setInterval(() => {
      this.cleanup();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Check if request should be allowed
   */
  checkRequest(type, identifier, metadata = {}) {
    // Check if IP is blocked
    if (this.isIPBlocked(metadata.ip)) {
      return {
        allowed: false,
        reason: 'ip_blocked',
        message: 'Your IP address has been temporarily blocked due to suspicious activity'
      };
    }

    // Check rate limits based on type
    let result;
    if (type === 'api') {
      result = this.apiLimiter.checkAPICall(identifier, metadata.method);
    } else if (type === 'user_action') {
      result = this.userLimiter.checkUserAction(identifier, metadata.userId);
    } else {
      return { allowed: true };
    }

    // Record request for pattern analysis
    this.recordRequestPattern(type, identifier, metadata, result);

    return result;
  }

  /**
   * Record request pattern for analysis
   */
  recordRequestPattern(type, identifier, metadata, result) {
    const pattern = {
      type,
      identifier,
      metadata,
      result,
      timestamp: Date.now(),
      ip: metadata.ip,
      userAgent: metadata.userAgent
    };

    const key = metadata.ip || 'unknown';
    const patterns = this.suspiciousPatterns.get(key) || [];
    patterns.push(pattern);
    
    // Keep only last 100 patterns per IP
    if (patterns.length > 100) {
      patterns.shift();
    }
    
    this.suspiciousPatterns.set(key, patterns);
  }

  /**
   * Analyze suspicious patterns
   */
  analyzeSuspiciousPatterns() {
    const now = Date.now();
    const analysisWindow = 300000; // 5 minutes

    for (const [ip, patterns] of this.suspiciousPatterns.entries()) {
      const recentPatterns = patterns.filter(p => now - p.timestamp < analysisWindow);
      
      if (this.isSuspiciousActivity(recentPatterns)) {
        this.blockIP(ip, 'suspicious_activity');
      }
    }
  }

  /**
   * Check if activity patterns are suspicious
   */
  isSuspiciousActivity(patterns) {
    if (patterns.length < 10) return false;

    const now = Date.now();
    const shortWindow = 60000; // 1 minute
    const recentPatterns = patterns.filter(p => now - p.timestamp < shortWindow);

    // High frequency of blocked requests
    const blockedRequests = recentPatterns.filter(p => !p.result.allowed);
    if (blockedRequests.length > 20) {
      return true;
    }

    // Rapid-fire requests from same IP
    if (recentPatterns.length > 50) {
      return true;
    }

    // Multiple different user agents from same IP
    const userAgents = new Set(patterns.map(p => p.metadata.userAgent));
    if (userAgents.size > 5) {
      return true;
    }

    // Scanning behavior (many different endpoints)
    const endpoints = new Set(patterns.map(p => p.identifier));
    if (endpoints.size > 20) {
      return true;
    }

    return false;
  }

  /**
   * Block IP address
   */
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    
    // Log the blocking
    console.warn(`Blocked IP ${ip} for reason: ${reason}`);
    
    // Report to monitoring system
    if (window.ReturnsXMonitoring) {
      window.ReturnsXMonitoring.createErrorReport(
        new Error(`IP blocked: ${ip}`),
        { reason, ip, timestamp: new Date().toISOString() }
      );
    }

    // Auto-unblock after 1 hour
    setTimeout(() => {
      this.unblockIP(ip);
    }, 3600000);
  }

  /**
   * Unblock IP address
   */
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    console.log(`Unblocked IP ${ip}`);
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour

    // Cleanup suspicious patterns
    for (const [ip, patterns] of this.suspiciousPatterns.entries()) {
      const validPatterns = patterns.filter(p => p.timestamp > cutoff);
      if (validPatterns.length === 0) {
        this.suspiciousPatterns.delete(ip);
      } else {
        this.suspiciousPatterns.set(ip, validPatterns);
      }
    }
  }

  /**
   * Get abuse prevention status
   */
  getStatus() {
    return {
      blockedIPs: Array.from(this.blockedIPs),
      suspiciousPatterns: this.suspiciousPatterns.size,
      apiLimiter: this.apiLimiter.getStatus('api:default'),
      userLimiter: this.userLimiter.getStatus('user:default')
    };
  }
}

// Create global abuse prevention system
const abusePreventionSystem = new AbusePreventionSystem();

// Export for use in extension
window.ReturnsXRateLimit = {
  APIRateLimiter,
  UserActionRateLimiter,
  AbusePreventionSystem,
  abusePreventionSystem
};

module.exports = {
  RateLimiter,
  APIRateLimiter,
  UserActionRateLimiter,
  AbusePreventionSystem,
  abusePreventionSystem
};