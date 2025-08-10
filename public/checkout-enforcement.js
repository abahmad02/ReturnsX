(function() {
  'use strict';

  // ReturnsX Checkout Enforcement Script
  // This script enforces COD restrictions based on customer risk scores

  const RETURNSX_CONFIG = {
    apiBaseUrl: window.location.origin,
    checkoutSelectors: {
      phoneField: 'input[name="checkout[shipping_address][phone]"], input[name="checkout[billing_address][phone]"]',
      emailField: 'input[name="checkout[email]"]',
      paymentMethods: '[data-gateway-name="cash_on_delivery"], [data-gateway-name="cod"], input[value*="cash"], input[value*="cod"]',
      checkoutForm: 'form[action*="checkout"]'
    },
    messages: {
      zeroRisk: {
        title: '✨ Valued Customer',
        message: 'Thank you for being a trusted customer! Your order will be processed with priority.',
        type: 'success'
      },
      mediumRisk: {
        title: '⚠️ Order Verification',
        message: 'Your order may require additional verification before shipping. Our team will contact you if needed.',
        type: 'warning'
      },
      highRisk: {
        title: '💳 Payment Required',
        message: 'To ensure secure delivery, we require a 50% advance payment for this order. Please choose an online payment method or contact us for assistance.',
        type: 'error'
      }
    }
  };

  // Client-side hashing utility (simplified version of server-side)
  async function createHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Normalize phone number for consistent hashing
  function normalizePhoneNumber(phone) {
    if (!phone) return '';
    // Remove all non-digit characters and normalize Pakistani numbers
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('92')) {
      return '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      return '+92' + cleaned.substring(1);
    }
    return cleaned.length >= 10 ? '+92' + cleaned : cleaned;
  }

  // Normalize email for consistent hashing
  function normalizeEmail(email) {
    if (!email) return '';
    return email.toLowerCase().trim();
  }

  // API call to get customer risk assessment
  async function getCustomerRiskAssessment(phoneHash, emailHash) {
    try {
      const identifier = phoneHash || emailHash;
      if (!identifier) return null;

      const response = await fetch(`${RETURNSX_CONFIG.apiBaseUrl}/api/customer-profiles/${identifier}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn('ReturnsX: Risk assessment API unavailable:', error);
      return null;
    }
  }

  // Create and show notification banner
  function createNotificationBanner(config, riskData) {
    const existingBanner = document.getElementById('returnsx-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.id = 'returnsx-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      padding: 15px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: white;
      background: ${config.type === 'success' ? '#28a745' : config.type === 'warning' ? '#ffc107' : '#dc3545'};
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      animation: slideDown 0.3s ease-out;
    `;

    banner.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <strong>${config.title}</strong>
          <div style="margin-top: 5px; opacity: 0.9;">${config.message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none; 
          border: none; 
          color: white; 
          font-size: 18px; 
          cursor: pointer; 
          padding: 5px;
          opacity: 0.8;
        ">×</button>
      </div>
    `;

    // Add CSS animation
    if (!document.getElementById('returnsx-styles')) {
      const styles = document.createElement('style');
      styles.id = 'returnsx-styles';
      styles.textContent = `
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        .returnsx-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 20000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .returnsx-modal {
          background: white;
          border-radius: 8px;
          padding: 30px;
          max-width: 500px;
          margin: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          text-align: center;
        }
        .returnsx-modal h3 {
          margin: 0 0 15px 0;
          color: #dc3545;
          font-size: 18px;
        }
        .returnsx-modal p {
          margin: 0 0 20px 0;
          color: #333;
          line-height: 1.5;
        }
        .returnsx-modal-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .returnsx-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: all 0.2s;
        }
        .returnsx-btn-primary {
          background: #007bff;
          color: white;
        }
        .returnsx-btn-primary:hover {
          background: #0056b3;
        }
        .returnsx-btn-success {
          background: #28a745;
          color: white;
        }
        .returnsx-btn-success:hover {
          background: #1e7e34;
        }
        .returnsx-btn-secondary {
          background: #6c757d;
          color: white;
        }
        .returnsx-btn-secondary:hover {
          background: #545b62;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(banner);

    // Auto-hide success banners after 5 seconds
    if (config.type === 'success') {
      setTimeout(() => {
        if (banner && banner.parentElement) {
          banner.remove();
        }
      }, 5000);
    }
  }

  // Create high-risk COD restriction modal
  function createCODRestrictionModal(riskData) {
    const existingModal = document.getElementById('returnsx-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    const config = riskData?.config || {};
    const depositPercentage = config.depositPercentage || 50;
    const whatsappNumber = config.whatsappNumber || '+923001234567'; // Default placeholder

    const modal = document.createElement('div');
    modal.id = 'returnsx-modal-overlay';
    modal.className = 'returnsx-modal-overlay';
    modal.innerHTML = `
      <div class="returnsx-modal">
        <h3>💳 Advance Payment Required</h3>
        <p>
          To ensure secure delivery and reduce risks, we require a <strong>${depositPercentage}% advance payment</strong> 
          for Cash on Delivery orders. This helps us provide better service to all customers.
        </p>
        <p>
          <strong>Your options:</strong>
        </p>
        <div class="returnsx-modal-buttons">
          <button class="returnsx-btn returnsx-btn-primary" onclick="ReturnsXCheckout.switchToOnlinePayment()">
            💳 Pay Online
          </button>
          <a href="https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=Hi, I need help with my order payment and deposit requirement." 
             target="_blank" 
             class="returnsx-btn returnsx-btn-success">
            💬 WhatsApp Support
          </a>
          <button class="returnsx-btn returnsx-btn-secondary" onclick="ReturnsXCheckout.closeModal()">
            ← Back to Checkout
          </button>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #6c757d;">
          <strong>Why do we require this?</strong><br>
          This policy helps us maintain competitive prices and ensures reliable delivery for all customers.
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Main checkout enforcement logic
  const ReturnsXCheckout = {
    currentRiskData: null,
    codPaymentBlocked: false,

    init: function() {
      console.log('ReturnsX: Initializing checkout enforcement...');
      this.attachEventListeners();
      this.checkCustomerRisk();
    },

    attachEventListeners: function() {
      // Monitor form changes for risk assessment
      const form = document.querySelector(RETURNSX_CONFIG.checkoutSelectors.checkoutForm);
      if (form) {
        form.addEventListener('change', this.debounce(this.checkCustomerRisk.bind(this), 1000));
        form.addEventListener('input', this.debounce(this.checkCustomerRisk.bind(this), 1500));
      }

      // Monitor payment method selection
      document.addEventListener('change', (e) => {
        if (this.isCODPaymentMethod(e.target)) {
          this.handleCODSelection();
        }
      });

      // Monitor click events on payment methods
      document.addEventListener('click', (e) => {
        if (this.isCODPaymentMethod(e.target)) {
          setTimeout(() => this.handleCODSelection(), 100);
        }
      });
    },

    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    isCODPaymentMethod: function(element) {
      if (!element) return false;
      const selectors = RETURNSX_CONFIG.checkoutSelectors.paymentMethods;
      return element.matches && element.matches(selectors);
    },

    async checkCustomerRisk() {
      const phoneField = document.querySelector(RETURNSX_CONFIG.checkoutSelectors.phoneField);
      const emailField = document.querySelector(RETURNSX_CONFIG.checkoutSelectors.emailField);

      const phone = phoneField ? phoneField.value.trim() : '';
      const email = emailField ? emailField.value.trim() : '';

      if (!phone && !email) {
        this.currentRiskData = null;
        return;
      }

      try {
        const phoneHash = phone ? await createHash(normalizePhoneNumber(phone)) : null;
        const emailHash = email ? await createHash(normalizeEmail(email)) : null;

        const riskData = await getCustomerRiskAssessment(phoneHash, emailHash);
        this.currentRiskData = riskData;

        if (riskData && riskData.success) {
          this.applyRiskBasedRestrictions(riskData);
        }
      } catch (error) {
        console.warn('ReturnsX: Error checking customer risk:', error);
      }
    },

    applyRiskBasedRestrictions: function(riskData) {
      const riskTier = riskData.riskTier;
      
      switch (riskTier) {
        case 'ZERO_RISK':
          this.showZeroRiskMessage(riskData);
          break;
        case 'MEDIUM_RISK':
          this.showMediumRiskMessage(riskData);
          break;
        case 'HIGH_RISK':
          this.showHighRiskMessage(riskData);
          this.blockCODIfSelected();
          break;
        default:
          // Unknown risk tier, no action
          break;
      }
    },

    showZeroRiskMessage: function(riskData) {
      createNotificationBanner(RETURNSX_CONFIG.messages.zeroRisk, riskData);
    },

    showMediumRiskMessage: function(riskData) {
      createNotificationBanner(RETURNSX_CONFIG.messages.mediumRisk, riskData);
    },

    showHighRiskMessage: function(riskData) {
      createNotificationBanner(RETURNSX_CONFIG.messages.highRisk, riskData);
    },

    blockCODIfSelected: function() {
      const codElements = document.querySelectorAll(RETURNSX_CONFIG.checkoutSelectors.paymentMethods);
      codElements.forEach(element => {
        if (element.checked || element.selected) {
          this.handleCODSelection();
        }
      });
    },

    handleCODSelection: function() {
      if (this.currentRiskData && this.currentRiskData.riskTier === 'HIGH_RISK') {
        // Slight delay to allow the selection to register
        setTimeout(() => {
          createCODRestrictionModal(this.currentRiskData);
        }, 200);
      }
    },

    switchToOnlinePayment: function() {
      this.closeModal();
      
      // Try to focus on first available online payment method
      const onlinePaymentMethods = document.querySelectorAll('input[type="radio"][name*="payment"], input[type="radio"][data-gateway-name]:not([data-gateway-name*="cod"]):not([data-gateway-name*="cash"])');
      if (onlinePaymentMethods.length > 0) {
        onlinePaymentMethods[0].click();
        onlinePaymentMethods[0].focus();
      }

      // Show guidance message
      setTimeout(() => {
        createNotificationBanner({
          title: '✅ Great Choice!',
          message: 'Please select your preferred online payment method below to continue.',
          type: 'success'
        });
      }, 500);
    },

    closeModal: function() {
      const modal = document.getElementById('returnsx-modal-overlay');
      if (modal) {
        modal.remove();
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReturnsXCheckout.init());
  } else {
    ReturnsXCheckout.init();
  }

  // Make ReturnsXCheckout globally available for modal buttons
  window.ReturnsXCheckout = ReturnsXCheckout;

  console.log('ReturnsX: Checkout enforcement script loaded successfully');
})(); 