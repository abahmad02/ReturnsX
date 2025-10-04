import { gzip, gunzip, gzipSync, gunzipSync } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  compressed: boolean;
  originalSize?: number;
  compressedSize?: number;
}

export interface CacheConfig {
  defaultTTL: number;           // Default time-to-live in milliseconds
  maxSize: number;              // Maximum cache entries
  backgroundRefreshThreshold: number; // Refresh when TTL < threshold (0-1)
  compressionEnabled: boolean;   // Enable data compression
  compressionThreshold: number;  // Compress data larger than this size (bytes)
  maxMemoryUsage: number;       // Maximum memory usage in bytes
  cleanupInterval: number;      // Cleanup interval in milliseconds
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  compressionRatio: number;
  backgroundRefreshCount: number;
  averageAccessTime: number;
  hitRate: number;
  evictionRate: number;
}

export interface BackgroundRefreshFunction<T> {
  (key: string): Promise<T>;
}

export class IntelligentCache {
  private cache: Map<string, CacheEntry<any>>;
  private config: CacheConfig;
  private backgroundRefreshQueue: Set<string>;
  private refreshFunctions: Map<string, BackgroundRefreshFunction<any>>;
  private stats: {
    hitCount: number;
    missCount: number;
    evictionCount: number;
    backgroundRefreshCount: number;
    totalAccessTime: number;
    accessCount: number;
  };
  private cleanupTimer: NodeJS.Timeout | null;
  private memoryUsage: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000,        // 5 minutes
      maxSize: 1000,                     // 1000 entries
      backgroundRefreshThreshold: 0.2,   // Refresh when 20% TTL remaining
      compressionEnabled: true,
      compressionThreshold: 1024,        // 1KB
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      cleanupInterval: 60 * 1000,        // 1 minute
      ...config
    };

    this.cache = new Map();
    this.backgroundRefreshQueue = new Set();
    this.refreshFunctions = new Map();
    this.stats = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      backgroundRefreshCount: 0,
      totalAccessTime: 0,
      accessCount: 0
    };
    this.cleanupTimer = null;
    this.memoryUsage = 0;

    this.startCleanupTimer();
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.missCount++;
        return null;
      }

      const now = Date.now();
      const age = now - entry.timestamp;
      
      // Check if entry has expired
      if (age > entry.ttl) {
        this.cache.delete(key);
        this.updateMemoryUsage();
        this.stats.missCount++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;
      this.stats.hitCount++;

      // Check if background refresh is needed
      const remainingTTL = (entry.ttl - age) / entry.ttl;
      if (remainingTTL < this.config.backgroundRefreshThreshold) {
        this.scheduleBackgroundRefresh(key);
      }

      // Decompress data if needed
      let data = entry.data;
      if (entry.compressed && Buffer.isBuffer(entry.data)) {
        data = this.decompressData(entry.data);
      }

      return data;
    } finally {
      const accessTime = Date.now() - startTime;
      this.stats.totalAccessTime += accessTime;
      this.stats.accessCount++;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, customTTL?: number): Promise<void> {
    const ttl = customTTL || this.config.defaultTTL;
    const now = Date.now();
    
    // Prepare data for storage
    let processedData = data;
    let compressed = false;
    let originalSize = 0;
    let compressedSize = 0;

    // Calculate original size
    const serializedData = JSON.stringify(data);
    originalSize = Buffer.byteLength(serializedData, 'utf8');

    // Compress if enabled and data is large enough
    if (this.config.compressionEnabled && originalSize > this.config.compressionThreshold) {
      try {
        const compressedBuffer = await gzipAsync(Buffer.from(serializedData, 'utf8'));
        compressedSize = compressedBuffer.length;
        
        // Only use compression if it actually reduces size
        if (compressedSize < originalSize * 0.9) {
          processedData = compressedBuffer as any;
          compressed = true;
        }
      } catch (error) {
        console.warn('Cache compression failed:', error);
        // Fall back to uncompressed data
        compressedSize = originalSize;
      }
    }

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now,
      compressed,
      originalSize,
      compressedSize: compressed ? compressedSize : originalSize
    };

    // Check if we need to evict entries
    await this.ensureCapacity();

    // Store the entry
    this.cache.set(key, entry);
    this.updateMemoryUsage();
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      this.updateMemoryUsage();
    }
    this.backgroundRefreshQueue.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.backgroundRefreshQueue.clear();
    this.memoryUsage = 0;
  }

  /**
   * Register a background refresh function for a key pattern
   */
  registerRefreshFunction<T>(keyPattern: string, refreshFn: BackgroundRefreshFunction<T>): void {
    this.refreshFunctions.set(keyPattern, refreshFn);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;
    const evictionRate = this.stats.evictionCount / Math.max(this.cache.size, 1);
    
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    
    for (const entry of Array.from(this.cache.values())) {
      totalOriginalSize += entry.originalSize || 0;
      totalCompressedSize += entry.compressedSize || entry.originalSize || 0;
    }
    
    const compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
    const averageAccessTime = this.stats.accessCount > 0 ? 
      this.stats.totalAccessTime / this.stats.accessCount : 0;

    return {
      totalEntries: this.cache.size,
      memoryUsage: this.memoryUsage,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      compressionRatio,
      backgroundRefreshCount: this.stats.backgroundRefreshCount,
      averageAccessTime,
      hitRate,
      evictionRate
    };
  }

  /**
   * Get cache entry information (for debugging)
   */
  getEntryInfo(key: string): Partial<CacheEntry<any>> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      compressed: entry.compressed,
      originalSize: entry.originalSize,
      compressedSize: entry.compressedSize
    };
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    this.updateMemoryUsage();
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  /**
   * Schedule background refresh for a key
   */
  private scheduleBackgroundRefresh(key: string): void {
    if (this.backgroundRefreshQueue.has(key)) {
      return; // Already scheduled
    }

    this.backgroundRefreshQueue.add(key);
    
    // Execute refresh asynchronously
    setImmediate(async () => {
      try {
        await this.performBackgroundRefresh(key);
      } catch (error) {
        console.warn(`Background refresh failed for key ${key}:`, error);
      } finally {
        this.backgroundRefreshQueue.delete(key);
      }
    });
  }

  /**
   * Perform background refresh for a key
   */
  private async performBackgroundRefresh(key: string): Promise<void> {
    // Find matching refresh function
    let refreshFn: BackgroundRefreshFunction<any> | undefined;
    
    for (const [pattern, fn] of Array.from(this.refreshFunctions.entries())) {
      if (this.matchesPattern(key, pattern)) {
        refreshFn = fn;
        break;
      }
    }

    if (!refreshFn) {
      return; // No refresh function available
    }

    try {
      const newData = await refreshFn(key);
      
      // Get current entry to preserve TTL
      const currentEntry = this.cache.get(key);
      const ttl = currentEntry?.ttl || this.config.defaultTTL;
      
      await this.set(key, newData, ttl);
      this.stats.backgroundRefreshCount++;
    } catch (error) {
      console.warn(`Background refresh failed for key ${key}:`, error);
    }
  }

  /**
   * Check if key matches pattern (simple wildcard matching)
   */
  private matchesPattern(key: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    }
    return key === pattern;
  }

  /**
   * Ensure cache capacity by evicting entries if needed
   */
  private async ensureCapacity(): Promise<void> {
    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      await this.evictLRU();
    }

    // Check memory limit
    if (this.memoryUsage > this.config.maxMemoryUsage) {
      await this.evictByMemoryPressure();
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) return;
    
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Evict oldest 10% or at least 1 entry, but not more than half the cache
    const evictCount = Math.min(
      Math.max(1, Math.floor(entries.length * 0.1)),
      Math.floor(entries.length * 0.5)
    );
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.stats.evictionCount++;
    }

    this.updateMemoryUsage();
  }

  /**
   * Evict entries to reduce memory pressure
   */
  private async evictByMemoryPressure(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Sort by memory usage (largest first) and access frequency (least accessed first)
    entries.sort((a, b) => {
      const sizeA = a[1].compressedSize || a[1].originalSize || 0;
      const sizeB = b[1].compressedSize || b[1].originalSize || 0;
      const accessA = a[1].accessCount;
      const accessB = b[1].accessCount;
      
      // Prioritize large, infrequently accessed items
      const scoreA = sizeA / (accessA + 1);
      const scoreB = sizeB / (accessB + 1);
      
      return scoreB - scoreA;
    });
    
    // Evict until memory usage is under limit
    let evicted = 0;
    for (const [key] of entries) {
      if (this.memoryUsage <= this.config.maxMemoryUsage * 0.8) {
        break; // Reduce to 80% of limit
      }
      
      this.cache.delete(key);
      this.stats.evictionCount++;
      evicted++;
      this.updateMemoryUsage();
    }
  }

  /**
   * Update memory usage calculation
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    
    for (const entry of Array.from(this.cache.values())) {
      // Estimate memory usage including metadata
      const dataSize = entry.compressedSize || entry.originalSize || 0;
      const metadataSize = 200; // Approximate overhead for entry metadata
      totalSize += dataSize + metadataSize;
    }
    
    this.memoryUsage = totalSize;
  }

  /**
   * Decompress data
   */
  private decompressData(compressedData: Buffer): any {
    try {
      const decompressed = gunzipSync(compressedData);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      console.warn('Cache decompression failed:', error);
      return null;
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

// Singleton instance for application-wide use
let cacheInstance: IntelligentCache | null = null;

export function getCache(config?: Partial<CacheConfig>): IntelligentCache {
  if (!cacheInstance) {
    cacheInstance = new IntelligentCache(config);
  }
  return cacheInstance;
}

export function destroyCache(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}