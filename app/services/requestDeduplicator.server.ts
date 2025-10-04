import { createHash, randomUUID } from 'crypto';

/**
 * Interface for request parameters used in deduplication
 */
export interface RequestParams {
  checkoutToken?: string;
  customerPhone?: string;
  orderName?: string;
  orderId?: string;
}

/**
 * Interface for pending request tracking
 */
interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  requestId: string;
}

/**
 * Request deduplication service to prevent duplicate API calls
 * Implements requirements 1.1, 1.4, and 1.5 from the specification
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private requestTimestamps = new Map<string, number>();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes TTL
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Generate unique key for request deduplication based on parameters
   * Uses SHA-256 hash of normalized parameters for consistent key generation
   */
  generateRequestKey(params: RequestParams): string {
    // Normalize parameters by sorting keys and handling undefined values
    const normalizedParams: Record<string, string> = {};
    
    if (params.checkoutToken) {
      normalizedParams.checkoutToken = params.checkoutToken.trim().toLowerCase();
    }
    if (params.customerPhone) {
      // Normalize phone number by removing spaces, dashes, and country codes
      normalizedParams.customerPhone = params.customerPhone
        .replace(/[\s\-\(\)]/g, '')
        .replace(/^\+?92/, '') // Remove Pakistan country code
        .replace(/^0/, ''); // Remove leading zero
    }
    if (params.orderName) {
      normalizedParams.orderName = params.orderName.trim();
    }
    if (params.orderId) {
      normalizedParams.orderId = params.orderId.toString().trim();
    }

    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(normalizedParams).sort();
    const keyString = sortedKeys
      .map(key => `${key}:${normalizedParams[key]}`)
      .join('|');

    // Generate SHA-256 hash for the key
    return createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Check if a request with the same parameters is already in progress
   */
  isDuplicateRequest(key: string): boolean {
    const pendingRequest = this.pendingRequests.get(key);
    if (!pendingRequest) {
      return false;
    }

    // Check if the request is still within the TTL window
    const now = Date.now();
    const isExpired = now - pendingRequest.timestamp > this.CLEANUP_INTERVAL;
    
    if (isExpired) {
      this.pendingRequests.delete(key);
      this.requestTimestamps.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Register a new request and return a promise that resolves when the request completes
   * If a duplicate request is detected, returns the existing promise
   */
  async registerRequest<T>(
    key: string, 
    requestFn: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    // Check if request is already pending
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      console.log(`[RequestDeduplicator] Duplicate request detected for key: ${key.substring(0, 8)}...`);
      return existingRequest.promise as Promise<T>;
    }

    // Generate unique request ID if not provided
    const reqId = requestId || randomUUID();
    const timestamp = Date.now();

    console.log(`[RequestDeduplicator] Registering new request: ${reqId} for key: ${key.substring(0, 8)}...`);

    // Create new request promise
    const promise = requestFn()
      .then((result) => {
        console.log(`[RequestDeduplicator] Request completed successfully: ${reqId}`);
        return result;
      })
      .catch((error) => {
        console.error(`[RequestDeduplicator] Request failed: ${reqId}`, error.message);
        throw error;
      })
      .finally(() => {
        // Clean up completed request
        this.pendingRequests.delete(key);
        this.requestTimestamps.set(key, timestamp);
        console.log(`[RequestDeduplicator] Cleaned up completed request: ${reqId}`);
      });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp,
      requestId: reqId
    });

    return promise;
  }

  /**
   * Get statistics about current deduplication state
   */
  getStats(): {
    pendingRequests: number;
    cachedTimestamps: number;
    oldestPendingRequest: number | null;
    newestPendingRequest: number | null;
  } {
    const now = Date.now();
    const pendingTimestamps = Array.from(this.pendingRequests.values())
      .map(req => req.timestamp);

    return {
      pendingRequests: this.pendingRequests.size,
      cachedTimestamps: this.requestTimestamps.size,
      oldestPendingRequest: pendingTimestamps.length > 0 ? Math.min(...pendingTimestamps) : null,
      newestPendingRequest: pendingTimestamps.length > 0 ? Math.max(...pendingTimestamps) : null,
    };
  }

  /**
   * Manual cleanup of expired requests and timestamps
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedPending = 0;
    let cleanedTimestamps = 0;

    // Clean up expired pending requests
    for (const [key, request] of Array.from(this.pendingRequests.entries())) {
      if (now - request.timestamp > this.CLEANUP_INTERVAL) {
        this.pendingRequests.delete(key);
        cleanedPending++;
      }
    }

    // Clean up old timestamps
    for (const [key, timestamp] of Array.from(this.requestTimestamps.entries())) {
      if (now - timestamp > this.CLEANUP_INTERVAL) {
        this.requestTimestamps.delete(key);
        cleanedTimestamps++;
      }
    }

    if (cleanedPending > 0 || cleanedTimestamps > 0) {
      console.log(`[RequestDeduplicator] Cleanup completed: ${cleanedPending} pending requests, ${cleanedTimestamps} timestamps`);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Run cleanup every minute
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Stop automatic cleanup timer (useful for testing or shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clear all pending requests and timestamps (useful for testing)
   */
  clear(): void {
    this.pendingRequests.clear();
    this.requestTimestamps.clear();
    console.log('[RequestDeduplicator] All requests and timestamps cleared');
  }

  /**
   * Get the remaining TTL for a request key in milliseconds
   */
  getRemainingTTL(key: string): number {
    const timestamp = this.requestTimestamps.get(key);
    if (!timestamp) {
      return 0;
    }

    const elapsed = Date.now() - timestamp;
    const remaining = this.CLEANUP_INTERVAL - elapsed;
    return Math.max(0, remaining);
  }
}

// Singleton instance for application-wide use
export const requestDeduplicator = new RequestDeduplicator();