import {
  BlockStack,
  Text,
  InlineLayout,
  View,
  Button,
  Link,
} from '@shopify/ui-extensions-react/checkout';
import { useOrder } from '@shopify/ui-extensions-react/checkout';
import { ExtensionConfig, RiskProfileResponse } from '../types';
import {
  generateWhatsAppUrl,
  openWhatsApp,
  copyToClipboard,
  createFallbackContactUrls,
  getDeviceCapabilities,
  validateWhatsAppConfig,
} from '../services/whatsappService';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsEventType } from '../services/analyticsService';

interface WhatsAppContactProps {
  config: ExtensionConfig;
  riskProfile: RiskProfileResponse;
  onContact?: () => void;
  compactMode: boolean;
}

/**
 * WhatsApp Contact Component
 * 
 * Provides WhatsApp integration for high-risk customers with:
 * - Pre-filled message templates with order context
 * - Order number and customer context integration
 * - Fallback contact methods when WhatsApp is not available
 * - Mobile-optimized touch targets and deep linking
 * - Desktop and mobile device compatibility
 */
export function WhatsAppContact({ 
  config, 
  riskProfile, 
  onContact, 
  compactMode 
}: WhatsAppContactProps) {
  const order = useOrder();
  
  // Initialize analytics
  const { trackUserInteraction } = useAnalytics({ config });
  
  // Validate WhatsApp configuration on component mount
  const configValidation = validateWhatsAppConfig(config);
  if (!configValidation.isValid) {
    console.error('WhatsApp configuration errors:', configValidation.errors);
  }
  if (configValidation.warnings.length > 0) {
    console.warn('WhatsApp configuration warnings:', configValidation.warnings);
  }

  // Get device capabilities for conditional rendering
  const deviceCapabilities = getDeviceCapabilities();

  // Generate WhatsApp URL with pre-filled message including order context
  const generateWhatsAppUrlWithContext = () => {
    // Get order context
    const orderContext = getOrderContext(order, riskProfile);
    
    // Generate message from template with context substitution
    const message = generateMessageFromTemplate(
      config.whatsapp_message_template,
      orderContext
    );
    
    // Use the service to generate URL with validation
    return generateWhatsAppUrl({
      phoneNumber: config.whatsapp_phone,
      message,
    });
  };

  // Handle WhatsApp contact with enhanced error handling and analytics
  const handleWhatsAppContact = async () => {
    const whatsappUrl = generateWhatsAppUrlWithContext();
    
    if (!whatsappUrl) {
      console.error('Failed to generate WhatsApp URL');
      return;
    }
    
    // Track WhatsApp click
    trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
      riskTier: riskProfile.riskTier,
      riskScore: riskProfile.riskScore,
      orderId: order?.id || order?.name,
      phoneNumber: config.whatsapp_phone,
      deviceType: deviceCapabilities.isMobile ? 'mobile' : 'desktop',
      hasWhatsApp: deviceCapabilities.hasWhatsApp,
      timestamp: Date.now()
    });
    
    // Call the callback if provided
    if (onContact) {
      onContact();
    }
    
    // Attempt to open WhatsApp using the service
    const success = await openWhatsApp(whatsappUrl);
    
    if (!success) {
      // Track fallback usage
      trackUserInteraction(AnalyticsEventType.WHATSAPP_CLICKED, {
        riskTier: riskProfile.riskTier,
        action: 'fallback_used',
        fallbackMethod: 'clipboard',
        timestamp: Date.now()
      });
      
      // Fallback to copying URL to clipboard
      handleWhatsAppFallback(whatsappUrl);
    }
  };

  // Handle WhatsApp fallback when direct opening fails
  const handleWhatsAppFallback = async (whatsappUrl: string) => {
    // Try to copy URL to clipboard
    const success = await copyToClipboard(whatsappUrl);
    if (success) {
      console.log('WhatsApp URL copied to clipboard as fallback');
    } else {
      console.log('Failed to copy WhatsApp URL to clipboard');
    }
  };

  // Enhanced alternative contact methods with better error handling
  const alternativeContactMethods = [
    {
      label: 'Call Support',
      action: () => {
        const orderContext = getOrderContext(order, riskProfile);
        const fallbackUrls = createFallbackContactUrls(config.whatsapp_phone, orderContext);
        try {
          if (typeof window !== 'undefined') {
            window.location.href = fallbackUrls.tel;
          }
        } catch (error) {
          console.error('Failed to initiate phone call:', error);
        }
      },
      icon: '📞',
      available: deviceCapabilities.canMakePhoneCalls,
    },
    {
      label: 'SMS Support',
      action: () => {
        const orderContext = getOrderContext(order, riskProfile);
        const fallbackUrls = createFallbackContactUrls(config.whatsapp_phone, orderContext);
        try {
          if (typeof window !== 'undefined') {
            window.location.href = fallbackUrls.sms;
          }
        } catch (error) {
          console.error('Failed to initiate SMS:', error);
        }
      },
      icon: '💬',
      available: deviceCapabilities.canSendSMS,
    },
    {
      label: 'Copy WhatsApp Link',
      action: async () => {
        const whatsappUrl = generateWhatsAppUrlWithContext();
        if (whatsappUrl) {
          const success = await copyToClipboard(whatsappUrl);
          if (success) {
            console.log('WhatsApp URL copied to clipboard');
          } else {
            console.log('Failed to copy WhatsApp URL');
          }
        }
      },
      icon: '📋',
      available: deviceCapabilities.hasClipboard,
    },
  ];

  return (
    <View>
      <BlockStack spacing={compactMode ? "tight" : "base"}>
        {/* Contact header */}
        <View
          border="base"
          cornerRadius="base"
          padding={compactMode ? "tight" : "base"}
        >
          <BlockStack spacing="tight">
            <InlineLayout 
              spacing="base" 
              columns={['auto', 'fill']}
              blockAlignment="center"
            >
              <Text size={compactMode ? "base" : "large"}>🚨</Text>
              <Text 
                size={compactMode ? "small" : "base"} 
                emphasis="bold"
                appearance="critical"
              >
                Need Delivery Assistance?
              </Text>
            </InlineLayout>
            
            <Text 
              size="small" 
              appearance="critical"
            >
              We recommend contacting our support team to ensure successful delivery of your order.
            </Text>
          </BlockStack>
        </View>

        {/* Primary WhatsApp contact */}
        <WhatsAppButton
          onPress={handleWhatsAppContact}
          compactMode={compactMode}
          phoneNumber={config.whatsapp_phone}
        />

        {/* Alternative contact methods */}
        {!compactMode && (
          <AlternativeContactMethods 
            methods={alternativeContactMethods}
            phoneNumber={config.whatsapp_phone}
          />
        )}

        {/* Contact benefits */}
        <ContactBenefits compactMode={compactMode} />
      </BlockStack>
    </View>
  );
}

/**
 * Primary WhatsApp contact button
 */
function WhatsAppButton({ 
  onPress, 
  compactMode, 
  phoneNumber 
}: { 
  onPress: () => void; 
  compactMode: boolean; 
  phoneNumber: string; 
}) {
  return (
    <Button
      onPress={onPress}
      kind="primary"
      accessibilityLabel={`Contact support via WhatsApp at ${phoneNumber}`}
    >
      <InlineLayout spacing="tight" columns={['auto', 'fill']} blockAlignment="center">
        <Text size={compactMode ? "base" : "large"}>📱</Text>
        <Text size={compactMode ? "small" : "base"} emphasis="bold">
          Contact via WhatsApp
        </Text>
      </InlineLayout>
    </Button>
  );
}

/**
 * Alternative contact methods for fallback
 */
function AlternativeContactMethods({ 
  methods, 
  phoneNumber 
}: { 
  methods: Array<{
    label: string;
    action: () => void;
    icon: string;
    available: boolean;
  }>; 
  phoneNumber: string; 
}) {
  // Filter to only show available methods
  const availableMethods = methods.filter(method => method.available);
  
  if (availableMethods.length === 0) {
    return null;
  }

  return (
    <View>
      <BlockStack spacing="tight">
        <Text size="small" appearance="subdued" emphasis="bold">
          Other Ways to Contact Us:
        </Text>
        
        <BlockStack spacing="tight">
          {availableMethods.map((method, index) => (
            <Button
              key={index}
              kind="secondary"
              onPress={method.action}
              accessibilityLabel={`${method.label} at ${phoneNumber}`}
            >
              <InlineLayout spacing="tight" columns={['auto', 'fill']} blockAlignment="center">
                <Text size="base">{method.icon}</Text>
                <Text size="small">{method.label}</Text>
              </InlineLayout>
            </Button>
          ))}
        </BlockStack>
      </BlockStack>
    </View>
  );
}

/**
 * Benefits of contacting support
 */
function ContactBenefits({ compactMode }: { compactMode: boolean }) {
  const benefits = [
    'Confirm delivery address and timing',
    'Arrange alternative delivery options',
    'Get real-time order tracking updates',
  ];

  if (compactMode) {
    return (
      <Text size="extraSmall" appearance="subdued">
        💡 Contact us to confirm delivery details and improve success rate
      </Text>
    );
  }

  return (
    <View
      border="base"
      cornerRadius="base"
      padding="tight"
    >
      <BlockStack spacing="tight">
        <Text size="small" emphasis="bold" appearance="subdued">
          How We Can Help:
        </Text>
        
        <BlockStack spacing="extraTight">
          {benefits.map((benefit, index) => (
            <InlineLayout 
              key={index}
              spacing="tight" 
              columns={['auto', 'fill']}
              blockAlignment="start"
            >
              <Text size="small" appearance="subdued">✓</Text>
              <Text size="small" appearance="subdued">{benefit}</Text>
            </InlineLayout>
          ))}
        </BlockStack>
      </BlockStack>
    </View>
  );
}

// Utility Functions

/**
 * Extracts order context for message templates
 */
function getOrderContext(order: any, riskProfile: RiskProfileResponse) {
  return {
    orderNumber: order?.id || order?.name || 'N/A',
    orderName: order?.name || order?.id || 'N/A',
    riskTier: riskProfile.riskTier,
    riskScore: riskProfile.riskScore,
    failedAttempts: riskProfile.failedAttempts,
    totalOrders: riskProfile.totalOrders,
    customerType: riskProfile.isNewCustomer ? 'new' : 'existing',
  };
}

/**
 * Generates message from template with context substitution
 */
function generateMessageFromTemplate(
  template: string | undefined,
  context: ReturnType<typeof getOrderContext>
): string {
  const defaultTemplate = 
    'Hi, I need help with my order {orderNumber}. I have a high-risk delivery profile ({failedAttempts} failed deliveries) and want to ensure successful delivery. Please contact me to confirm delivery details.';
  
  const messageTemplate = template || defaultTemplate;
  
  // Replace template variables with actual values
  return messageTemplate
    .replace(/{orderNumber}/g, context.orderNumber)
    .replace(/{orderName}/g, context.orderName)
    .replace(/{riskTier}/g, context.riskTier)
    .replace(/{riskScore}/g, context.riskScore.toString())
    .replace(/{failedAttempts}/g, context.failedAttempts.toString())
    .replace(/{totalOrders}/g, context.totalOrders.toString())
    .replace(/{customerType}/g, context.customerType);
}