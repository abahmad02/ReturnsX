/**
 * Example usage of IntelligentCache for API optimization
 * 
 * This file demonstrates how to integrate the IntelligentCache
 * into the API debugging and optimization system.
 */

import { getCache, type BackgroundRefreshFunction } from './intelligentCache.server';

// Example: Customer profile caching with background refresh
export class CustomerProfileCache {
  private cache = getCache({
    defaultTTL: 5 * 60 * 1000,        // 5 minutes
    maxSize: 1000,                     // 1000 customer profiles
    backgroundRefreshThreshold: 0.3,   // Refresh when 30% TTL remaining
    compressionEnabled: true,
    compressionThreshold: 1024,        // Compress profiles > 1KB
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB limit
  });

  constructor() {
    // Register background refresh function for customer profiles
    this.cache.registerRefreshFunction('customer:*', this.refreshCustomerProfile);
  }

  /**
   * Get customer profile with caching
   */
  async getCustomerProfile(customerId: string): Promise<any> {
    const cacheKey = `customer:${customerId}`;
    
    // Try to get from cache first
    let profile = this.cache.get(cacheKey);
    
    if (profile) {
      return profile;
    }

    // Cache miss - fetch from database
    profile = await this.fetchCustomerFromDatabase(customerId);
    
    if (profile) {
      // Store in cache with custom TTL based on customer tier
      const ttl = profile.tier === 'premium' ? 10 * 60 * 1000 : 5 * 60 * 1000;
      await this.cache.set(cacheKey, profile, ttl);
    }

    return profile;
  }

  /**
   * Background refresh function for customer profiles
   */
  private refreshCustomerProfile: BackgroundRefreshFunction<any> = async (key: string) => {
    const customerId = key.replace('customer:', '');
    console.log(`Background refreshing customer profile: ${customerId}`);
    
    try {
      const freshProfile = await this.fetchCustomerFromDatabase(customerId);
      return freshProfile;
    } catch (error) {
      console.warn(`Failed to refresh customer profile ${customerId}:`, error);
      throw error; // Let cache handle the error
    }
  };

  /**
   * Simulate database fetch (replace with actual implementation)
   */
  private async fetchCustomerFromDatabase(customerId: string): Promise<any> {
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: customerId,
      name: `Customer ${customerId}`,
      email: `customer${customerId}@example.com`,
      tier: Math.random() > 0.8 ? 'premium' : 'standard',
      riskScore: Math.random() * 100,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Invalidate customer profile cache
   */
  invalidateCustomer(customerId: string): void {
    this.cache.invalidate(`customer:${customerId}`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

// Example: Order data caching
export class OrderDataCache {
  private cache = getCache();

  /**
   * Cache order data with compression for large orders
   */
  async cacheOrderData(orderId: string, orderData: any): Promise<void> {
    const cacheKey = `order:${orderId}`;
    
    // Use shorter TTL for order data as it changes frequently
    const ttl = 2 * 60 * 1000; // 2 minutes
    
    await this.cache.set(cacheKey, orderData, ttl);
  }

  /**
   * Get cached order data
   */
  getCachedOrderData(orderId: string): any {
    return this.cache.get(`order:${orderId}`);
  }

  /**
   * Cache API response data
   */
  async cacheApiResponse(requestKey: string, responseData: any): Promise<void> {
    // Generate cache key based on request parameters
    const cacheKey = `api:${requestKey}`;
    
    // Cache API responses for 1 minute
    const ttl = 60 * 1000;
    
    await this.cache.set(cacheKey, responseData, ttl);
  }

  /**
   * Get cached API response
   */
  getCachedApiResponse(requestKey: string): any {
    return this.cache.get(`api:${requestKey}`);
  }
}

// Example: Integration with API route
export class ApiCacheManager {
  private customerCache = new CustomerProfileCache();
  private orderCache = new OrderDataCache();

  /**
   * Generate cache key for API requests
   */
  generateRequestKey(params: {
    checkoutToken?: string;
    customerPhone?: string;
    orderName?: string;
    orderId?: string;
  }): string {
    const keyParts = [
      params.checkoutToken && `token:${params.checkoutToken}`,
      params.customerPhone && `phone:${params.customerPhone}`,
      params.orderName && `order:${params.orderName}`,
      params.orderId && `id:${params.orderId}`
    ].filter(Boolean);

    return keyParts.join('|');
  }

  /**
   * Get or fetch order data with caching
   */
  async getOrderData(params: {
    checkoutToken?: string;
    customerPhone?: string;
    orderName?: string;
    orderId?: string;
  }): Promise<any> {
    const requestKey = this.generateRequestKey(params);
    
    // Try cache first
    let cachedResponse = this.orderCache.getCachedApiResponse(requestKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        metadata: {
          ...cachedResponse.metadata,
          cacheHit: true,
          source: 'cache'
        }
      };
    }

    // Cache miss - fetch fresh data
    const orderData = await this.fetchOrderData(params);
    
    // Cache the response
    await this.orderCache.cacheApiResponse(requestKey, {
      ...orderData,
      metadata: {
        cacheHit: false,
        source: 'database',
        cachedAt: new Date().toISOString()
      }
    });

    return orderData;
  }

  /**
   * Simulate order data fetching (replace with actual implementation)
   */
  private async fetchOrderData(params: any): Promise<any> {
    // Simulate database queries
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      orderId: params.orderId || 'unknown',
      customerProfile: await this.customerCache.getCustomerProfile('123'),
      orderStatus: 'completed',
      riskAssessment: {
        score: Math.random() * 100,
        factors: ['payment_method', 'order_history', 'location']
      },
      metadata: {
        processedAt: new Date().toISOString(),
        queryTime: 100
      }
    };
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats() {
    const stats = getCache().getStats();
    
    return {
      ...stats,
      performance: {
        hitRate: stats.hitRate,
        averageAccessTime: stats.averageAccessTime,
        compressionRatio: stats.compressionRatio
      },
      memory: {
        usage: stats.memoryUsage,
        usageFormatted: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`
      },
      operations: {
        hits: stats.hitCount,
        misses: stats.missCount,
        evictions: stats.evictionCount,
        backgroundRefreshes: stats.backgroundRefreshCount
      }
    };
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(): Promise<void> {
    console.log('Warming cache with frequently accessed data...');
    
    // Pre-load common customer profiles
    const commonCustomerIds = ['123', '456', '789'];
    for (const customerId of commonCustomerIds) {
      await this.customerCache.getCustomerProfile(customerId);
    }

    console.log('Cache warming completed');
  }

  /**
   * Clear all cache data
   */
  clearCache(): void {
    getCache().clear();
    console.log('Cache cleared');
  }
}

// Example usage in API route
export async function handleApiRequest(params: {
  checkoutToken?: string;
  customerPhone?: string;
  orderName?: string;
  orderId?: string;
}) {
  const cacheManager = new ApiCacheManager();
  
  try {
    // Get order data with caching
    const orderData = await cacheManager.getOrderData(params);
    
    // Log cache performance
    const stats = cacheManager.getCacheStats();
    console.log('Cache stats:', {
      hitRate: `${(stats.performance.hitRate * 100).toFixed(1)}%`,
      memoryUsage: stats.memory.usageFormatted,
      totalEntries: stats.totalEntries
    });

    return {
      success: true,
      data: orderData,
      cacheStats: stats.performance
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: 'Internal server error',
      cacheStats: cacheManager.getCacheStats().performance
    };
  }
}

// Export singleton instances for use across the application
export const customerProfileCache = new CustomerProfileCache();
export const orderDataCache = new OrderDataCache();
export const apiCacheManager = new ApiCacheManager();