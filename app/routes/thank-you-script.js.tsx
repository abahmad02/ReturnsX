import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Thank You Page Script for ReturnsX Risk Display
 * 
 * This script gets injected into Shopify's thank you page to display
 * customer risk information after order completion.
 */

export async function loader({ request }: LoaderFunctionArgs) {
    const script = `
(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    apiEndpoint: '${new URL(request.url).origin}/api/customer-risk',
    debug: false,
    retryAttempts: 3,
    retryDelay: 1000
  };

  // Utility functions
  function log(...args) {
    if (CONFIG.debug) console.log('[ReturnsX]', ...args);
  }

  function error(...args) {
    console.error('[ReturnsX Error]', ...args);
  }

  // Extract order and customer data from Shopify's thank you page
  function extractOrderData() {
    const data = {
      orderId: null,
      customerPhone: null,
      customerEmail: null,
      orderTotal: null,
      currency: null
    };

    try {
      // Try to get data from Shopify analytics object
      if (window.Shopify && window.Shopify.checkout) {
        const checkout = window.Shopify.checkout;
        data.orderId = checkout.order_id;
        data.customerPhone = checkout.phone;
        data.customerEmail = checkout.email;
        data.orderTotal = checkout.total_price;
        data.currency = checkout.currency;
      }

      // Fallback: extract from page elements
      if (!data.customerPhone || !data.customerEmail) {
        // Look for phone in various places
        const phoneElements = document.querySelectorAll('[data-phone], .phone, [class*="phone"]');
        phoneElements.forEach(el => {
          const text = el.textContent || el.getAttribute('data-phone') || '';
          const phoneMatch = text.match(/\\+?[0-9\\s\\-\\(\\)]{10,}/);
          if (phoneMatch && !data.customerPhone) {
            data.customerPhone = phoneMatch[0].replace(/\\D/g, '');
          }
        });

        // Look for email in various places
        const emailElements = document.querySelectorAll('[data-email], .email, [class*="email"]');
        emailElements.forEach(el => {
          const text = el.textContent || el.getAttribute('data-email') || '';
          const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
          if (emailMatch && !data.customerEmail) {
            data.customerEmail = emailMatch[0];
          }
        });
      }

      // Extract order ID from URL or page elements
      if (!data.orderId) {
        const urlMatch = window.location.pathname.match(/orders\\/([^\/\\?]+)/);
        if (urlMatch) data.orderId = urlMatch[1];
        
        // Try to find in page elements
        const orderElements = document.querySelectorAll('[data-order-id], .order-id, [class*="order"]');
        orderElements.forEach(el => {
          const text = el.textContent || el.getAttribute('data-order-id') || '';
          if (text && !data.orderId) {
            data.orderId = text.trim();
          }
        });
      }

      log('Extracted order data:', data);
      return data;
    } catch (err) {
      error('Error extracting order data:', err);
      return data;
    }
  }

  // Fetch customer risk data from ReturnsX API
  async function fetchRiskData(orderData, attempt = 1) {
    try {
      if (!orderData.customerPhone && !orderData.customerEmail) {
        throw new Error('No customer contact information available');
      }

      const params = new URLSearchParams();
      if (orderData.customerPhone) params.append('phone', orderData.customerPhone);
      if (orderData.customerEmail) params.append('email', orderData.customerEmail);
      if (orderData.orderId) params.append('orderId', orderData.orderId);

      const response = await fetch(\`\${CONFIG.apiEndpoint}?\${params.toString()}\`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }

      const riskData = await response.json();
      log('Risk data received:', riskData);
      return riskData;
    } catch (err) {
      error(\`Attempt \${attempt} failed:\`, err);
      
      if (attempt < CONFIG.retryAttempts) {
        log(\`Retrying in \${CONFIG.retryDelay}ms...\`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
        return fetchRiskData(orderData, attempt + 1);
      }
      
      throw err;
    }
  }

  // Create and inject the risk display widget
  function createRiskWidget(riskData, orderData) {
    const widget = document.createElement('div');
    widget.id = 'returnsx-risk-widget';
    widget.style.cssText = \`
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    \`;

    const { riskTier, riskScore, totalOrders, failedAttempts, message, recommendations } = riskData;
    
    // Calculate success rate
    const successRate = totalOrders > 0 ? 
      Math.round(((totalOrders - failedAttempts) / totalOrders) * 100) : 100;

    // Get risk display info
    const riskInfo = getRiskDisplayInfo(riskTier);

    widget.innerHTML = \`
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <span style="font-size: 24px; margin-right: 10px;">\${riskInfo.icon}</span>
        <h3 style="margin: 0; color: \${riskInfo.textColor}; font-size: 18px;">
          ReturnsX Customer Status: \${riskInfo.label}
        </h3>
      </div>
      
      <div style="background: \${riskInfo.bgColor}; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: bold; color: \${riskInfo.textColor};">\${riskInfo.label}</span>
          <span style="font-weight: bold;">Risk Score: \${parseFloat(riskScore).toFixed(1)}/100</span>
        </div>
        <p style="margin: 0; color: #333; line-height: 1.4;">\${message}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <strong>Total Orders:</strong> \${totalOrders}
        </div>
        <div>
          <strong>Success Rate:</strong> \${successRate}%
        </div>
      </div>

      \${failedAttempts > 0 ? \`
        <div style="margin-bottom: 15px; color: #666; font-size: 14px;">
          Failed Deliveries: \${failedAttempts}
        </div>
      \` : ''}

      <div style="border-top: 1px solid #e9ecef; padding-top: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #333;">How to Improve Your Score:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #666;">
          \${recommendations.map(rec => \`<li style="margin-bottom: 5px;">\${rec}</li>\`).join('')}
        </ul>
      </div>

      \${riskTier === 'HIGH_RISK' ? \`
        <div style="border-top: 1px solid #e9ecef; padding-top: 15px; margin-top: 15px;">
          <h4 style="margin: 0 0 10px 0; color: #d32f2f;">Need Help?</h4>
          <p style="margin: 0 0 10px 0; color: #666;">
            For faster service on future orders, contact us on WhatsApp:
          </p>
          <a href="https://wa.me/923001234567?text=Hi, I need help with my ReturnsX risk score. Order: \${orderData.orderId}" 
             target="_blank" 
             style="display: inline-block; background: #25d366; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            📱 Contact Support on WhatsApp
          </a>
        </div>
      \` : ''}

      <div style="border-top: 1px solid #e9ecef; padding-top: 15px; margin-top: 15px; text-align: center;">
        <small style="color: #999;">
          ReturnsX helps merchants reduce COD return rates through smart risk assessment
        </small>
      </div>
    \`;

    return widget;
  }

  // Get risk display information
  function getRiskDisplayInfo(riskTier) {
    switch (riskTier) {
      case 'ZERO_RISK':
        return {
          label: 'Zero Risk',
          icon: '✅',
          bgColor: '#e8f5e8',
          textColor: '#2e7d2e'
        };
      case 'MEDIUM_RISK':
        return {
          label: 'Medium Risk',
          icon: '⚠️',
          bgColor: '#fff8e1',
          textColor: '#f57c00'
        };
      case 'HIGH_RISK':
        return {
          label: 'High Risk',
          icon: '❌',
          bgColor: '#ffebee',
          textColor: '#d32f2f'
        };
      default:
        return {
          label: 'Unknown',
          icon: '❓',
          bgColor: '#f5f5f5',
          textColor: '#666666'
        };
    }
  }

  // Find the best insertion point on the thank you page
  function findInsertionPoint() {
    // Try various selectors for common thank you page elements
    const selectors = [
      '.main-content',
      '.content',
      '.order-confirmation',
      '.thank-you',
      '.checkout-step',
      'main',
      '.container',
      'body'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        log(\`Found insertion point: \${selector}\`);
        return element;
      }
    }

    return document.body;
  }

  // Main initialization function
  async function init() {
    try {
      log('ReturnsX Thank You Script initializing...');

      // Check if we're on a thank you page
      const isThankYouPage = window.location.pathname.includes('/thank_you') || 
                           window.location.pathname.includes('/orders/') ||
                           document.title.toLowerCase().includes('thank you') ||
                           document.querySelector('.thank-you, .order-confirmation');

      if (!isThankYouPage) {
        log('Not a thank you page, skipping...');
        return;
      }

      // Extract order data
      const orderData = extractOrderData();
      
      if (!orderData.customerPhone && !orderData.customerEmail) {
        error('No customer contact information found');
        return;
      }

      // Fetch risk data
      const riskData = await fetchRiskData(orderData);
      
      if (!riskData.success) {
        error('Failed to fetch risk data:', riskData.error);
        return;
      }

      // Create and insert widget
      const widget = createRiskWidget(riskData, orderData);
      const insertionPoint = findInsertionPoint();
      
      // Insert after the first child or at the beginning
      if (insertionPoint.firstElementChild) {
        insertionPoint.insertBefore(widget, insertionPoint.firstElementChild.nextSibling);
      } else {
        insertionPoint.appendChild(widget);
      }

      log('ReturnsX widget successfully inserted');

    } catch (err) {
      error('Failed to initialize ReturnsX widget:', err);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already ready
    setTimeout(init, 100); // Small delay to ensure page is fully rendered
  }

})();
`;

    return new Response(script, {
        headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
    });
}