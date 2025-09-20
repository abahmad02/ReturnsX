// Extension configuration interface
export interface ExtensionConfig {
  // Core API settings
  api_endpoint: string;
  auth_token: string;
  api_timeout: number;
  enable_caching: boolean;
  
  // Debug and display settings
  enable_debug_mode: boolean;
  show_detailed_tips: boolean;
  show_recommendations: boolean;
  show_risk_score: boolean;
  use_color_coding: boolean;
  compact_mode: boolean;
  
  // Custom messages
  zero_risk_message: string;
  medium_risk_message: string;
  high_risk_message: string;
  new_customer_message: string;
  error_message: string;
  
  // WhatsApp integration
  whatsapp_enabled: boolean;
  whatsapp_phone: string;
  whatsapp_message_template: string;
  fallback_contact_method: string;
  
  // Advanced display options
  display_position: 'top' | 'middle' | 'bottom';
  animation_enabled: boolean;
  hide_for_prepaid: boolean;
  minimum_risk_threshold: 'all' | 'medium' | 'high';
  custom_css_classes: string;
  merchant_branding_enabled: boolean;
  data_retention_notice: string;
  
  // Analytics and monitoring settings
  analytics_enabled: boolean;
  analytics_endpoint: string;
  performance_tracking_enabled: boolean;
  error_reporting_enabled: boolean;
  user_interaction_tracking_enabled: boolean;
  analytics_debug_mode: boolean;
}

// Customer data interface for API requests
export interface CustomerData {
  phone?: string;
  email?: string;
  orderId?: string;
  checkoutToken?: string;
}

// Component props interfaces
export interface RiskAssessmentCardProps {
  riskProfile: RiskProfileResponse;
  config: ExtensionConfig;
  onWhatsAppContact?: () => void;
}

export interface RiskTierIndicatorProps {
  riskTier: 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  riskScore?: number;
  showScore: boolean;
  useColorCoding: boolean;
}

export interface RecommendationsListProps {
  recommendations: string[];
  riskTier: string;
  compactMode: boolean;
}

// Loading and error state interfaces
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ExtensionState {
  config: ExtensionConfig | null;
  riskProfile: RiskProfileResponse | null;
  loading: LoadingState;
  error: ErrorState | null;
}

// Risk profile API interfaces
export interface RiskProfileRequest {
  phone?: string;
  email?: string;
  orderId?: string;
  checkoutToken?: string;
}

export interface RiskProfileResponse {
  success: boolean;
  riskTier: 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  riskScore: number;
  totalOrders: number;
  failedAttempts: number;
  successfulDeliveries: number;
  isNewCustomer: boolean;
  message: string;
  recommendations?: string[];
  whatsappContact?: {
    enabled: boolean;
    phoneNumber: string;
    messageTemplate: string;
  };
  error?: string;
}

// Error handling types
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export interface ErrorState {
  type: ErrorType;
  message: string;
  retryable: boolean;
  fallbackData?: Partial<RiskProfileResponse>;
}