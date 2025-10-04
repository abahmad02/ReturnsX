-- Optimized indexes for customer_profiles table
-- Composite index for phone-based lookups with risk assessment
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_risk 
ON customer_profiles (phone, risk_tier, last_event_at DESC);

-- Composite index for email-based lookups with risk assessment
CREATE INDEX IF NOT EXISTS idx_customer_profiles_email_risk 
ON customer_profiles (email, risk_tier, last_event_at DESC) 
WHERE email IS NOT NULL;

-- Index for risk tier filtering with performance metrics
CREATE INDEX IF NOT EXISTS idx_customer_profiles_risk_performance 
ON customer_profiles (risk_tier, return_rate, total_orders DESC);

-- Index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_customer_profiles_recent_activity 
ON customer_profiles (last_event_at DESC, risk_tier) 
WHERE last_event_at > NOW() - INTERVAL '30 days';

-- Optimized indexes for order_events table
-- Primary lookup index for customer order history
CREATE INDEX IF NOT EXISTS idx_order_events_customer_timeline 
ON order_events (customer_profile_id, created_at DESC, event_type);

-- Index for Shopify order ID lookups with shop domain
CREATE INDEX IF NOT EXISTS idx_order_events_shopify_order_shop 
ON order_events (shopify_order_id, shop_domain, event_type);

-- Index for event type analysis and reporting
CREATE INDEX IF NOT EXISTS idx_order_events_type_analysis 
ON order_events (event_type, created_at DESC, shop_domain);

-- Index for order value analysis
CREATE INDEX IF NOT EXISTS idx_order_events_value_analysis 
ON order_events (order_value DESC, currency, event_type) 
WHERE order_value IS NOT NULL;

-- Optimized indexes for checkout_correlations table
-- Primary lookup index for checkout token matching
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_token_shop 
ON checkout_correlations (checkout_token, shop_domain, matched);

-- Index for customer phone correlation
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_phone_match 
ON checkout_correlations (customer_phone, shop_domain, created_at DESC) 
WHERE customer_phone IS NOT NULL;

-- Index for customer email correlation
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_email_match 
ON checkout_correlations (customer_email, shop_domain, created_at DESC) 
WHERE customer_email IS NOT NULL;

-- Index for order correlation lookups
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_order_lookup 
ON checkout_correlations (order_id, order_name, shop_domain) 
WHERE order_id IS NOT NULL;

-- Index for unmatched correlations cleanup
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_cleanup 
ON checkout_correlations (matched, created_at) 
WHERE matched = false;

-- Partial index for recent correlations (performance optimization)
CREATE INDEX IF NOT EXISTS idx_checkout_correlations_recent 
ON checkout_correlations (created_at DESC, shop_domain) 
WHERE created_at > NOW() - INTERVAL '7 days';

-- Additional performance indexes
-- Index for manual overrides by customer and shop
CREATE INDEX IF NOT EXISTS idx_manual_overrides_customer_shop 
ON manual_overrides (customer_profile_id, shop_domain, created_at DESC);

-- Index for risk config lookups
CREATE INDEX IF NOT EXISTS idx_risk_configs_shop_updated 
ON risk_configs (shop_domain, updated_at DESC);