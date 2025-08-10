import { test, expect } from '@playwright/test';

test.describe('ReturnsX Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/app');
  });

  test('should display dashboard overview', async ({ page }) => {
    // Check for main dashboard elements
    await expect(page.locator('h1')).toContainText('ReturnsX Dashboard');
    
    // Check for metrics cards
    await expect(page.locator('[data-testid="total-customers"]')).toBeVisible();
    await expect(page.locator('[data-testid="high-risk-customers"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-events"]')).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    // Click on settings link
    await page.click('[data-testid="settings-link"]');
    
    // Verify we're on the settings page
    await expect(page).toHaveURL('/app/settings');
    await expect(page.locator('h1')).toContainText('Risk Settings');
  });

  test('should display risk distribution', async ({ page }) => {
    // Check for risk distribution visualization
    await expect(page.locator('[data-testid="risk-distribution"]')).toBeVisible();
    
    // Check for risk tier indicators
    await expect(page.locator('[data-testid="zero-risk-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="medium-risk-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="high-risk-count"]')).toBeVisible();
  });

  test('should show quick actions', async ({ page }) => {
    // Check for webhook setup action
    await expect(page.locator('[data-testid="webhook-setup"]')).toBeVisible();
    
    // Check for historical import action
    await expect(page.locator('[data-testid="historical-import"]')).toBeVisible();
    
    // Check for checkout enforcement toggle
    await expect(page.locator('[data-testid="checkout-enforcement"]')).toBeVisible();
  });

  test('should display recent high-risk customers', async ({ page }) => {
    // Check for customer table
    await expect(page.locator('[data-testid="high-risk-customers-table"]')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('th')).toContainText(['Customer ID', 'Risk Score', 'Risk Tier', 'Last Event', 'Actions']);
  });
});

test.describe('Risk Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/settings');
  });

  test('should allow updating risk thresholds', async ({ page }) => {
    // Find and update zero risk threshold
    const zeroRiskInput = page.locator('[data-testid="zero-risk-threshold"]');
    await zeroRiskInput.fill('3');
    
    // Find and update medium risk threshold
    const mediumRiskInput = page.locator('[data-testid="medium-risk-threshold"]');
    await mediumRiskInput.fill('7');
    
    // Save changes
    await page.click('[data-testid="save-risk-config"]');
    
    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should toggle COD restriction setting', async ({ page }) => {
    // Find COD restriction toggle
    const codToggle = page.locator('[data-testid="cod-restriction-toggle"]');
    
    // Get initial state
    const initialState = await codToggle.isChecked();
    
    // Toggle the setting
    await codToggle.click();
    
    // Verify state changed
    expect(await codToggle.isChecked()).toBe(!initialState);
    
    // Save changes
    await page.click('[data-testid="save-risk-config"]');
    
    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should configure WhatsApp settings', async ({ page }) => {
    // Find WhatsApp number input
    const whatsappInput = page.locator('[data-testid="whatsapp-number"]');
    await whatsappInput.fill('+15551234567');
    
    // Configure zero risk message
    const zeroRiskMessage = page.locator('[data-testid="zero-risk-message"]');
    await zeroRiskMessage.fill('Thank you for your order! We\'ll process it quickly.');
    
    // Configure medium risk message
    const mediumRiskMessage = page.locator('[data-testid="medium-risk-message"]');
    await mediumRiskMessage.fill('Please confirm your order by replying YES.');
    
    // Configure high risk message
    const highRiskMessage = page.locator('[data-testid="high-risk-message"]');
    await highRiskMessage.fill('A deposit is required. Please visit our payment link.');
    
    // Save WhatsApp configuration
    await page.click('[data-testid="save-whatsapp-config"]');
    
    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/customers');
  });

  test('should display customer list', async ({ page }) => {
    // Check for customer table
    await expect(page.locator('[data-testid="customers-table"]')).toBeVisible();
    
    // Check for search functionality
    await expect(page.locator('[data-testid="customer-search"]')).toBeVisible();
    
    // Check for filter options
    await expect(page.locator('[data-testid="risk-filter"]')).toBeVisible();
  });

  test('should allow manual risk override', async ({ page }) => {
    // Find first customer in table
    const firstCustomer = page.locator('[data-testid="customer-row"]').first();
    
    // Click on manual override action
    await firstCustomer.locator('[data-testid="manual-override"]').click();
    
    // Select override type
    await page.selectOption('[data-testid="override-type"]', 'CHANGE_RISK_TIER');
    
    // Select new risk tier
    await page.selectOption('[data-testid="new-risk-tier"]', 'ZERO_RISK');
    
    // Add reason
    await page.fill('[data-testid="override-reason"]', 'Customer contacted support - verified legitimate');
    
    // Apply override
    await page.click('[data-testid="apply-override"]');
    
    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should send WhatsApp verification', async ({ page }) => {
    // Find a medium/high risk customer
    const riskCustomer = page.locator('[data-testid="customer-row"][data-risk="MEDIUM_RISK"]').first();
    
    // Click on WhatsApp verification action
    await riskCustomer.locator('[data-testid="whatsapp-verify"]').click();
    
    // Select message type
    await page.selectOption('[data-testid="message-type"]', 'verification_request');
    
    // Add custom message if needed
    await page.fill('[data-testid="custom-message"]', 'Please confirm your recent order.');
    
    // Send message
    await page.click('[data-testid="send-whatsapp"]');
    
    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/analytics');
  });

  test('should display analytics overview', async ({ page }) => {
    // Check for key metrics
    await expect(page.locator('[data-testid="total-customers-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="high-risk-rate-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-risk-score-metric"]')).toBeVisible();
    
    // Check for charts
    await expect(page.locator('[data-testid="risk-distribution-chart"]')).toBeVisible();
  });

  test('should filter analytics by date range', async ({ page }) => {
    // Select date range
    await page.click('[data-testid="date-range-picker"]');
    await page.click('[data-testid="last-30-days"]');
    
    // Wait for data to update
    await page.waitForTimeout(1000);
    
    // Verify metrics updated
    await expect(page.locator('[data-testid="date-range-label"]')).toContainText('Last 30 days');
  });
}); 