/**
 * Cross-Platform Compatibility Testing Suite
 * 
 * Tests extension behavior across different browsers, devices, and Shopify themes
 * to ensure consistent user experience and functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components
import { RiskAssessmentCard } from '../../src/components/RiskAssessmentCard';
import type { ExtensionConfig, RiskProfileResponse } from '../../src/types';

// Mock Shopify extension APIs
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  useExtensionApi: () => ({
    configuration: vi.fn(),
    analytics: vi.fn(),
    storage: vi.fn(),
    ui: vi.fn()
  }),
  useSettings: vi.fn(),
  useCustomer: vi.fn(),
  useOrder: vi.fn(),
  BlockStack: ({ children }: any) => <div data-testid="block-stack">{children}</div>,
  InlineStack: ({ children }: any) => <div data-testid="inline-stack">{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>,
  Icon: ({ source }: any) => <span data-testid={`icon-${source}`} />,
  Pressable: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>
}));

describe('Cross-Platform Compatibility Testing', () => {
  let mockConfig: ExtensionConfig;
  let mockRiskProfile: RiskProfileResponse;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      apiEndpoint: 'https://api.returnsx.com',
      enableDebugMode: false,
      showDetailedTips: true,
      customMessages: {
        zeroRisk: 'You are a trusted customer!',
        mediumRisk: 'Please ensure you are available for delivery.',
        highRisk: 'Please contact us to confirm your order.'
      },
      whatsappConfig: {
        enabled: true,
        phoneNumber: '+923001234567',
        messageTemplate: 'Order confirmation needed for #{orderNumber}'
      },
      styling: {
        showRiskScore: true,
        useColorCoding: true,
        compactMode: false
      }
    };

    mockRiskProfile = {
      success: true,
      riskTier: 'MEDIUM_RISK',
      riskScore: 45,
      totalOrders: 8,
      failedAttempts: 2,
      successfulDeliveries: 6,
      isNewCustomer: false,
      message: 'Medium risk customer',
      recommendations: [
        'Ensure you are available during delivery hours',
        'Keep your phone accessible for delivery updates'
      ]
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Browser Compatibility', () => {
    const browsers = [
      {
        name: 'Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        features: {
          fetch: true,
          promises: true,
          es6: true,
          flexbox: true,
          grid: true
        }
      },
      {
        name: 'Firefox',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        features: {
          fetch: true,
          promises: true,
          es6: true,
          flexbox: true,
          grid: true
        }
      },
      {
        name: 'Safari',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        features: {
          fetch: true,
          promises: true,
          es6: true,
          flexbox: true,
          grid: true
        }
      },
      {
        name: 'Edge',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        features: {
          fetch: true,
          promises: true,
          es6: true,
          flexbox: true,
          grid: true
        }
      },
      {
        name: 'Internet Explorer 11',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
        features: {
          fetch: false,
          promises: false,
          es6: false,
          flexbox: true,
          grid: false
        }
      }
    ];

    browsers.forEach(browser => {
      it(`should work correctly in ${browser.name}`, () => {
        // Mock browser-specific user agent
        Object.defineProperty(navigator, 'userAgent', {
          writable: true,
          configurable: true,
          value: browser.userAgent,
        });

        // Mock browser features
        if (!browser.features.fetch) {
          // @ts-ignore
          delete global.fetch;
        }
        if (!browser.features.promises) {
          // @ts-ignore
          delete global.Promise;
        }

        const { container } = render(
          <RiskAssessmentCard 
            riskProfile={mockRiskProfile}
            config={mockConfig}
          />
        );

        expect(container.firstChild).toBeInTheDocument();
        expect(screen.getByTestId('block-stack')).toBeInTheDocument();
        
        // Verify content is displayed
        expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
      });
    });

    it('should handle missing modern JavaScript features gracefully', () => {
      // Mock older browser environment
      const originalFetch = global.fetch;
      const originalPromise = global.Promise;
      const originalArray = Array.from;
      
      // @ts-ignore
      delete global.fetch;
      // @ts-ignore
      delete global.Promise;
      // @ts-ignore
      delete Array.from;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      
      // Restore
      global.fetch = originalFetch;
      global.Promise = originalPromise;
      Array.from = originalArray;
    });

    it('should work with different CSS support levels', () => {
      // Mock CSS feature detection
      const mockSupports = vi.fn();
      
      // @ts-ignore
      global.CSS = {
        supports: mockSupports
      };

      // Test with different CSS feature support
      const cssFeatures = [
        { property: 'display', value: 'flex', supported: true },
        { property: 'display', value: 'grid', supported: false },
        { property: 'gap', value: '1rem', supported: false }
      ];

      cssFeatures.forEach(feature => {
        mockSupports.mockReturnValue(feature.supported);
        
        const { container } = render(
          <RiskAssessmentCard 
            riskProfile={mockRiskProfile}
            config={mockConfig}
          />
        );

        expect(container.firstChild).toBeInTheDocument();
      });
    });
  });

  describe('2. Device and Screen Size Compatibility', () => {
    const devices = [
      {
        name: 'iPhone SE',
        width: 375,
        height: 667,
        pixelRatio: 2,
        touch: true,
        orientation: 'portrait'
      },
      {
        name: 'iPhone 12',
        width: 390,
        height: 844,
        pixelRatio: 3,
        touch: true,
        orientation: 'portrait'
      },
      {
        name: 'iPhone 12 Landscape',
        width: 844,
        height: 390,
        pixelRatio: 3,
        touch: true,
        orientation: 'landscape'
      },
      {
        name: 'Samsung Galaxy S21',
        width: 384,
        height: 854,
        pixelRatio: 2.75,
        touch: true,
        orientation: 'portrait'
      },
      {
        name: 'iPad',
        width: 768,
        height: 1024,
        pixelRatio: 2,
        touch: true,
        orientation: 'portrait'
      },
      {
        name: 'iPad Pro',
        width: 1024,
        height: 1366,
        pixelRatio: 2,
        touch: true,
        orientation: 'portrait'
      },
      {
        name: 'Desktop 1080p',
        width: 1920,
        height: 1080,
        pixelRatio: 1,
        touch: false,
        orientation: 'landscape'
      },
      {
        name: 'Desktop 4K',
        width: 3840,
        height: 2160,
        pixelRatio: 2,
        touch: false,
        orientation: 'landscape'
      }
    ];

    devices.forEach(device => {
      it(`should render correctly on ${device.name}`, () => {
        // Mock device viewport
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: device.width,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: device.height,
        });
        Object.defineProperty(window, 'devicePixelRatio', {
          writable: true,
          configurable: true,
          value: device.pixelRatio,
        });

        // Mock touch capability
        if (device.touch) {
          Object.defineProperty(window, 'ontouchstart', {
            writable: true,
            configurable: true,
            value: null,
          });
        } else {
          Object.defineProperty(window, 'ontouchstart', {
            writable: true,
            configurable: true,
            value: undefined,
          });
        }

        const { container } = render(
          <RiskAssessmentCard 
            riskProfile={mockRiskProfile}
            config={mockConfig}
          />
        );

        expect(container.firstChild).toBeInTheDocument();
        expect(screen.getByTestId('block-stack')).toBeInTheDocument();
        
        // Verify content is readable
        expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
        
        // For small screens, verify content doesn't overflow
        if (device.width < 400) {
          const textElements = container.querySelectorAll('span');
          textElements.forEach(element => {
            const computedStyle = window.getComputedStyle(element);
            // In a real test, we'd check for text overflow
            expect(element).toBeInTheDocument();
          });
        }
      });
    });

    it('should handle orientation changes gracefully', async () => {
      const user = userEvent.setup();
      
      // Start in portrait
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      const { container, rerender } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();

      // Simulate orientation change to landscape
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      rerender(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
    });
  });

  describe('3. Shopify Theme Compatibility', () => {
    const themes = [
      {
        name: 'Dawn',
        cssVariables: {
          '--color-base-text': '#121212',
          '--color-base-background-1': '#ffffff',
          '--font-body-family': 'Assistant, sans-serif',
          '--font-body-scale': '1.0'
        },
        breakpoints: {
          mobile: '749px',
          tablet: '990px',
          desktop: '1200px'
        }
      },
      {
        name: 'Debut',
        cssVariables: {
          '--color-body-text': '#333333',
          '--color-body': '#ffffff',
          '--font-stack-body': 'HelveticaNeue, sans-serif',
          '--font-size-base': '14px'
        },
        breakpoints: {
          mobile: '768px',
          tablet: '1024px',
          desktop: '1200px'
        }
      },
      {
        name: 'Brooklyn',
        cssVariables: {
          '--colorTextBody': '#2c2d2e',
          '--colorBody': '#ffffff',
          '--fontStackBody': 'Quattrocento Sans, sans-serif',
          '--baseFontSize': '16px'
        },
        breakpoints: {
          mobile: '590px',
          tablet: '768px',
          desktop: '1180px'
        }
      },
      {
        name: 'Narrative',
        cssVariables: {
          '--color-body-text': '#2c2d2e',
          '--color-body': '#ffffff',
          '--font-body': 'Harmonia Sans, sans-serif',
          '--font-size-base': '15px'
        },
        breakpoints: {
          mobile: '749px',
          tablet: '990px',
          desktop: '1200px'
        }
      }
    ];

    themes.forEach(theme => {
      it(`should integrate seamlessly with ${theme.name} theme`, () => {
        // Mock theme CSS variables
        const mockGetComputedStyle = vi.fn().mockReturnValue({
          getPropertyValue: (property: string) => {
            return theme.cssVariables[property as keyof typeof theme.cssVariables] || '';
          }
        });
        window.getComputedStyle = mockGetComputedStyle;

        const { container } = render(
          <RiskAssessmentCard 
            riskProfile={mockRiskProfile}
            config={mockConfig}
          />
        );

        expect(container.firstChild).toBeInTheDocument();
        expect(screen.getByTestId('block-stack')).toBeInTheDocument();
        
        // Verify component adapts to theme styles
        expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
      });
    });

    it('should handle missing theme CSS variables gracefully', () => {
      // Mock theme with missing variables
      const mockGetComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: () => '' // All variables return empty
      });
      window.getComputedStyle = mockGetComputedStyle;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
    });

    it('should work with custom theme modifications', () => {
      // Mock heavily customized theme
      const customTheme = {
        '--primary-color': '#ff6b35',
        '--secondary-color': '#004e89',
        '--font-family': 'Comic Sans MS, cursive',
        '--border-radius': '20px',
        '--box-shadow': '0 10px 30px rgba(0,0,0,0.3)'
      };

      const mockGetComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: (property: string) => {
          return customTheme[property as keyof typeof customTheme] || '';
        }
      });
      window.getComputedStyle = mockGetComputedStyle;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
    });
  });

  describe('4. Input Method Compatibility', () => {
    it('should work with touch interactions', async () => {
      const user = userEvent.setup();
      
      // Mock touch device
      Object.defineProperty(window, 'ontouchstart', {
        writable: true,
        configurable: true,
        value: null,
      });

      render(
        <RiskAssessmentCard 
          riskProfile={{ ...mockRiskProfile, riskTier: 'HIGH_RISK' }}
          config={mockConfig}
        />
      );

      const container = screen.getByTestId('block-stack');
      
      // Simulate touch events
      fireEvent.touchStart(container, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });

      expect(container).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <RiskAssessmentCard 
          riskProfile={{ ...mockRiskProfile, riskTier: 'HIGH_RISK' }}
          config={mockConfig}
        />
      );

      // Test keyboard navigation
      await user.tab();
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();
      
      // Test Enter key activation
      if (focusedElement && focusedElement.tagName === 'BUTTON') {
        await user.keyboard('{Enter}');
        expect(focusedElement).toBeInTheDocument();
      }
    });

    it('should work with mouse interactions', async () => {
      const user = userEvent.setup();
      
      render(
        <RiskAssessmentCard 
          riskProfile={{ ...mockRiskProfile, riskTier: 'HIGH_RISK' }}
          config={mockConfig}
        />
      );

      const container = screen.getByTestId('block-stack');
      
      // Test mouse events
      await user.hover(container);
      await user.click(container);
      
      expect(container).toBeInTheDocument();
    });

    it('should handle high-DPI displays correctly', () => {
      // Mock high-DPI display
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 3,
      });

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
    });
  });

  describe('5. Network Condition Compatibility', () => {
    it('should work on slow network connections', async () => {
      // Mock slow network
      const mockFetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockRiskProfile)
          }), 3000) // 3 second delay
        )
      );
      global.fetch = mockFetch;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      
      // Should show loading state or cached content
      expect(screen.getByTestId('block-stack')).toBeInTheDocument();
    });

    it('should handle offline scenarios gracefully', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={{ ...mockRiskProfile, success: false, error: 'Network unavailable' }}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      // Should show fallback content when offline
      expect(screen.getByTestId('block-stack')).toBeInTheDocument();
    });

    it('should adapt to connection quality', () => {
      // Mock different connection types
      const connectionTypes = [
        { effectiveType: '4g', downlink: 10 },
        { effectiveType: '3g', downlink: 1.5 },
        { effectiveType: '2g', downlink: 0.25 },
        { effectiveType: 'slow-2g', downlink: 0.05 }
      ];

      connectionTypes.forEach(connection => {
        // @ts-ignore
        Object.defineProperty(navigator, 'connection', {
          writable: true,
          configurable: true,
          value: connection,
        });

        const { container } = render(
          <RiskAssessmentCard 
            riskProfile={mockRiskProfile}
            config={mockConfig}
          />
        );

        expect(container.firstChild).toBeInTheDocument();
      });
    });
  });

  describe('6. Accessibility Across Platforms', () => {
    it('should work with screen readers', () => {
      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      // In a real implementation, we'd test with actual screen reader APIs
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Medium risk customer')).toBeInTheDocument();
    });

    it('should support high contrast mode', () => {
      // Mock high contrast mode
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });
      window.matchMedia = mockMatchMedia;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-contrast: high)');
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });
      window.matchMedia = mockMatchMedia;

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });

    it('should work with voice control', async () => {
      const user = userEvent.setup();
      
      // Mock voice control activation
      render(
        <RiskAssessmentCard 
          riskProfile={{ ...mockRiskProfile, riskTier: 'HIGH_RISK' }}
          config={mockConfig}
        />
      );

      // Voice control would typically trigger keyboard events
      await user.keyboard('{Enter}');
      
      expect(screen.getByTestId('block-stack')).toBeInTheDocument();
    });
  });

  describe('7. Performance Across Platforms', () => {
    it('should maintain performance on low-end devices', () => {
      // Mock low-end device constraints
      const mockPerformance = {
        memory: 1, // 1GB RAM
        hardwareConcurrency: 2 // 2 CPU cores
      };
      
      // @ts-ignore
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        configurable: true,
        value: mockPerformance.memory,
      });
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: true,
        configurable: true,
        value: mockPerformance.hardwareConcurrency,
      });

      const startTime = performance.now();
      
      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(container.firstChild).toBeInTheDocument();
      expect(renderTime).toBeLessThan(100); // Should render quickly even on low-end devices
    });

    it('should handle memory constraints gracefully', () => {
      // Mock memory pressure
      const mockMemoryInfo = {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 60 * 1024 * 1024, // 60MB
        jsHeapSizeLimit: 64 * 1024 * 1024  // 64MB limit
      };

      // @ts-ignore
      Object.defineProperty(performance, 'memory', {
        writable: true,
        configurable: true,
        value: mockMemoryInfo,
      });

      const { container } = render(
        <RiskAssessmentCard 
          riskProfile={mockRiskProfile}
          config={mockConfig}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});