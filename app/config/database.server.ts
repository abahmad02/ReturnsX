/**
 * Database Configuration for Optimized Connection Pooling
 * 
 * This configuration provides optimal settings for PostgreSQL connection pooling
 * based on the ReturnsX application's expected load patterns and performance requirements.
 */

export interface DatabaseConfig {
  // Connection Pool Settings
  connectionLimit: number;
  poolTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  
  // Query Performance Settings
  statementTimeout: number;
  queryTimeout: number;
  connectionTimeout: number;
  
  // Monitoring Settings
  slowQueryThreshold: number;
  enableQueryLogging: boolean;
  enablePerformanceMonitoring: boolean;
  
  // Optimization Settings
  enablePreparedStatements: boolean;
  enableQueryCache: boolean;
  batchSize: number;
}

/**
 * Production-optimized database configuration
 */
export const productionDatabaseConfig: DatabaseConfig = {
  // Connection Pool Settings
  connectionLimit: 20,           // Maximum concurrent connections
  poolTimeout: 30000,           // 30 seconds to acquire connection
  idleTimeout: 300000,          // 5 minutes idle timeout
  maxLifetime: 1800000,         // 30 minutes max connection lifetime
  
  // Query Performance Settings
  statementTimeout: 30000,      // 30 seconds statement timeout
  queryTimeout: 10000,          // 10 seconds query timeout
  connectionTimeout: 5000,      // 5 seconds connection timeout
  
  // Monitoring Settings
  slowQueryThreshold: 1000,     // 1 second slow query threshold
  enableQueryLogging: false,    // Disable in production for performance
  enablePerformanceMonitoring: true,
  
  // Optimization Settings
  enablePreparedStatements: true,
  enableQueryCache: true,
  batchSize: 100,              // Batch size for bulk operations
};

/**
 * Development-optimized database configuration
 */
export const developmentDatabaseConfig: DatabaseConfig = {
  // Connection Pool Settings
  connectionLimit: 10,          // Fewer connections for development
  poolTimeout: 10000,          // 10 seconds to acquire connection
  idleTimeout: 60000,          // 1 minute idle timeout
  maxLifetime: 600000,         // 10 minutes max connection lifetime
  
  // Query Performance Settings
  statementTimeout: 60000,     // 60 seconds statement timeout (more lenient)
  queryTimeout: 30000,         // 30 seconds query timeout
  connectionTimeout: 10000,    // 10 seconds connection timeout
  
  // Monitoring Settings
  slowQueryThreshold: 500,     // 500ms slow query threshold
  enableQueryLogging: true,    // Enable for debugging
  enablePerformanceMonitoring: true,
  
  // Optimization Settings
  enablePreparedStatements: true,
  enableQueryCache: true,
  batchSize: 50,              // Smaller batch size for development
};

/**
 * Test environment database configuration
 */
export const testDatabaseConfig: DatabaseConfig = {
  // Connection Pool Settings
  connectionLimit: 5,          // Minimal connections for testing
  poolTimeout: 5000,          // 5 seconds to acquire connection
  idleTimeout: 30000,         // 30 seconds idle timeout
  maxLifetime: 300000,        // 5 minutes max connection lifetime
  
  // Query Performance Settings
  statementTimeout: 10000,    // 10 seconds statement timeout
  queryTimeout: 5000,         // 5 seconds query timeout
  connectionTimeout: 3000,    // 3 seconds connection timeout
  
  // Monitoring Settings
  slowQueryThreshold: 100,    // 100ms slow query threshold (strict for tests)
  enableQueryLogging: false,  // Disable to speed up tests
  enablePerformanceMonitoring: false,
  
  // Optimization Settings
  enablePreparedStatements: false, // Disable for test simplicity
  enableQueryCache: false,    // Disable for test isolation
  batchSize: 10,             // Small batch size for tests
};

/**
 * Get database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionDatabaseConfig;
    case 'test':
      return testDatabaseConfig;
    case 'development':
    default:
      return developmentDatabaseConfig;
  }
}

/**
 * Generate optimized DATABASE_URL with connection pool parameters
 */
export function generateOptimizedDatabaseUrl(baseUrl: string, config: DatabaseConfig): string {
  const url = new URL(baseUrl);
  
  // Add connection pool parameters
  url.searchParams.set('connection_limit', config.connectionLimit.toString());
  url.searchParams.set('pool_timeout', Math.floor(config.poolTimeout / 1000).toString());
  url.searchParams.set('connect_timeout', Math.floor(config.connectionTimeout / 1000).toString());
  
  // Add PostgreSQL-specific optimizations
  url.searchParams.set('application_name', 'ReturnsX');
  url.searchParams.set('statement_timeout', config.statementTimeout.toString());
  
  // Add performance optimizations
  if (config.enablePreparedStatements) {
    url.searchParams.set('prepared_statements', 'true');
  }
  
  // Add schema if not specified
  if (!url.searchParams.has('schema')) {
    url.searchParams.set('schema', 'public');
  }
  
  return url.toString();
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate connection pool settings
  if (config.connectionLimit < 1 || config.connectionLimit > 100) {
    errors.push('Connection limit must be between 1 and 100');
  }
  
  if (config.poolTimeout < 1000 || config.poolTimeout > 60000) {
    errors.push('Pool timeout must be between 1 and 60 seconds');
  }
  
  if (config.idleTimeout < 10000 || config.idleTimeout > 3600000) {
    errors.push('Idle timeout must be between 10 seconds and 1 hour');
  }
  
  // Validate query performance settings
  if (config.queryTimeout < 1000 || config.queryTimeout > 300000) {
    errors.push('Query timeout must be between 1 second and 5 minutes');
  }
  
  if (config.slowQueryThreshold < 50 || config.slowQueryThreshold > 10000) {
    errors.push('Slow query threshold must be between 50ms and 10 seconds');
  }
  
  // Validate batch size
  if (config.batchSize < 1 || config.batchSize > 1000) {
    errors.push('Batch size must be between 1 and 1000');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Database health check configuration
 */
export interface DatabaseHealthConfig {
  checkInterval: number;        // Health check interval in milliseconds
  timeout: number;             // Health check timeout
  retryAttempts: number;       // Number of retry attempts
  retryDelay: number;          // Delay between retries
}

export const databaseHealthConfig: DatabaseHealthConfig = {
  checkInterval: 30000,        // Check every 30 seconds
  timeout: 5000,              // 5 second timeout
  retryAttempts: 3,           // 3 retry attempts
  retryDelay: 1000,           // 1 second delay between retries
};

/**
 * Index optimization recommendations
 */
export const indexOptimizationRecommendations = {
  customerProfiles: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_profiles_phone_risk ON customer_profiles (phone, risk_tier, last_event_at DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_profiles_email_risk ON customer_profiles (email, risk_tier, last_event_at DESC) WHERE email IS NOT NULL;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_profiles_risk_performance ON customer_profiles (risk_tier, return_rate, total_orders DESC);'
  ],
  orderEvents: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_events_customer_timeline ON order_events (customer_profile_id, created_at DESC, event_type);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_events_shopify_order_shop ON order_events (shopify_order_id, shop_domain, event_type);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_events_type_analysis ON order_events (event_type, created_at DESC, shop_domain);'
  ],
  checkoutCorrelations: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkout_correlations_token_shop ON checkout_correlations (checkout_token, shop_domain, matched);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkout_correlations_phone_match ON checkout_correlations (customer_phone, shop_domain, created_at DESC) WHERE customer_phone IS NOT NULL;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkout_correlations_order_lookup ON checkout_correlations (order_id, order_name, shop_domain) WHERE order_id IS NOT NULL;'
  ]
};

/**
 * Query optimization patterns
 */
export const queryOptimizationPatterns = {
  // Use LIMIT for pagination instead of OFFSET for large datasets
  pagination: 'Use cursor-based pagination with LIMIT instead of OFFSET for better performance',
  
  // Use EXISTS instead of IN for subqueries
  subqueries: 'Use EXISTS instead of IN for better performance with subqueries',
  
  // Use partial indexes for filtered queries
  partialIndexes: 'Create partial indexes for frequently filtered columns',
  
  // Use composite indexes for multi-column queries
  compositeIndexes: 'Create composite indexes for queries filtering on multiple columns',
  
  // Use covering indexes to avoid table lookups
  coveringIndexes: 'Include frequently selected columns in indexes to create covering indexes'
};