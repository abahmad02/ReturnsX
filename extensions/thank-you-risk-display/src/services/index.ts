export { ReturnsXApiClient, createApiClient, DEFAULT_API_CONFIG } from './apiClient';
export {
  validateWhatsAppConfig,
  validatePhoneNumber,
  validateMessageTemplate,
  generateWhatsAppUrl,
  getDeviceCapabilities,
  openWhatsApp,
  copyToClipboard,
  createFallbackContactUrls,
} from './whatsappService';
export { generatePersonalizedMessage, generatePersonalizedRecommendations } from './messageGenerator';
export { CircuitBreaker, CircuitState, createCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuitBreaker';
export { SessionCache, createCacheKey, extensionCache } from './cacheService';
export { PerformanceMonitor, globalPerformanceMonitor, usePerformanceMonitor, withPerformanceMonitoring } from './performanceMonitor';
export {
  AnalyticsService,
  AnalyticsEventType,
  AnalyticsConfig,
  PerformanceMetrics,
  ErrorTrackingData,
  createAnalyticsService,
  getAnalyticsService,
  defaultAnalyticsConfig
} from './analyticsService';