import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  TextField,
  Form,
  FormLayout,
  Banner,
  Divider,
  Checkbox,
  RangeSlider,
  Badge,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getRiskConfig, recalculateAllRiskScores } from "../services/riskScoring.server";
import { updateRiskConfig } from "../services/customerProfile.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const riskConfig = await getRiskConfig(session.shop);

    return json({
      success: true,
      config: riskConfig,
      shopDomain: session.shop,
    });

  } catch (error) {
    console.error("Error loading risk configuration:", error);
    return json({
      success: false,
      error: "Failed to load configuration",
      config: {},
      shopDomain: session.shop,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const actionType = formData.get("_action") as string;

    if (actionType === "updateConfig") {
      // Parse form data for config update
      const configData = {
        zeroRiskMaxFailed: parseInt(formData.get("zeroRiskMaxFailed") as string),
        zeroRiskMaxReturnRate: parseFloat(formData.get("zeroRiskMaxReturnRate") as string),
        mediumRiskMaxFailed: parseInt(formData.get("mediumRiskMaxFailed") as string),
        mediumRiskMaxReturnRate: parseFloat(formData.get("mediumRiskMaxReturnRate") as string),
        highRiskThreshold: parseFloat(formData.get("highRiskThreshold") as string),
        enableCodRestriction: formData.get("enableCodRestriction") === "true",
        depositPercentage: parseFloat(formData.get("depositPercentage") as string),
        highValueThreshold: parseInt(formData.get("highValueThreshold") as string),
        timeDecayFactor: parseFloat(formData.get("timeDecayFactor") as string),
        newCustomerGracePeriod: parseInt(formData.get("newCustomerGracePeriod") as string),
        minimumOrdersForAssessment: parseInt(formData.get("minimumOrdersForAssessment") as string),
        notificationEmail: formData.get("notificationEmail") as string || null,
      };

      // Validate configuration
      if (configData.zeroRiskMaxReturnRate >= configData.mediumRiskMaxReturnRate ||
          configData.mediumRiskMaxReturnRate >= configData.highRiskThreshold) {
        return json({
          success: false,
          error: "Risk thresholds must be in ascending order",
        }, { status: 400 });
      }

      if (configData.depositPercentage < 0 || configData.depositPercentage > 100) {
        return json({
          success: false,
          error: "Deposit percentage must be between 0 and 100",
        }, { status: 400 });
      }

      await updateRiskConfig(session.shop, configData);

      return json({
        success: true,
        message: "Configuration updated successfully",
        action: "updateConfig",
      });

    } else if (actionType === "recalculate") {
      // Recalculate all risk scores
      const result = await recalculateAllRiskScores(session.shop);

      return json({
        success: true,
        message: `Recalculated ${result.processed} customer risk scores`,
        action: "recalculate",
        processed: result.processed,
        errors: result.errors,
      });
    }

    return json({
      success: false,
      error: "Invalid action",
    }, { status: 400 });

  } catch (error) {
    console.error("Error updating configuration:", error);
    return json({
      success: false,
      error: "Failed to update configuration",
    }, { status: 500 });
  }
};

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Form state
  const [config, setConfig] = useState(data.config);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "updateConfig") {
        shopify.toast.show("Configuration updated successfully");
        setHasChanges(false);
      } else if (fetcher.data.action === "recalculate") {
        shopify.toast.show(fetcher.data.message);
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const updateConfigValue = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveConfiguration = () => {
    const formData = new FormData();
    formData.append("_action", "updateConfig");
    
    Object.entries(config).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    fetcher.submit(formData, { method: "POST" });
  };

  const recalculateRiskScores = () => {
    const formData = new FormData();
    formData.append("_action", "recalculate");
    fetcher.submit(formData, { method: "POST" });
  };

  if (!data.success) {
    return (
      <Page>
        <TitleBar title="Risk Settings" />
        <Banner tone="critical">
          <p>Failed to load configuration. Please try refreshing the page.</p>
        </Banner>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Risk Settings">
        {hasChanges && (
          <Button
            variant="primary"
            onClick={saveConfiguration}
            loading={fetcher.state === "submitting" && fetcher.formData?.get("_action") === "updateConfig"}
          >
            Save Changes
          </Button>
        )}
      </TitleBar>

      <BlockStack gap="500">
        {/* Risk Tier Configuration */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Risk Tier Thresholds
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Configure the thresholds that determine how customers are classified into risk tiers.
                </Text>

                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Zero Risk - Max Failed Attempts"
                      type="number"
                      value={config.zeroRiskMaxFailed?.toString() || "2"}
                      onChange={(value) => updateConfigValue("zeroRiskMaxFailed", parseInt(value))}
                      helpText="Maximum failed attempts for zero risk customers"
                      autoComplete="off"
                    />
                    <TextField
                      label="Zero Risk - Max Return Rate (%)"
                      type="number"
                      value={config.zeroRiskMaxReturnRate?.toString() || "10"}
                      onChange={(value) => updateConfigValue("zeroRiskMaxReturnRate", parseFloat(value))}
                      helpText="Maximum return rate percentage for zero risk"
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <FormLayout.Group>
                    <TextField
                      label="Medium Risk - Max Failed Attempts"
                      type="number"
                      value={config.mediumRiskMaxFailed?.toString() || "5"}
                      onChange={(value) => updateConfigValue("mediumRiskMaxFailed", parseInt(value))}
                      helpText="Maximum failed attempts for medium risk customers"
                      autoComplete="off"
                    />
                    <TextField
                      label="Medium Risk - Max Return Rate (%)"
                      type="number"
                      value={config.mediumRiskMaxReturnRate?.toString() || "30"}
                      onChange={(value) => updateConfigValue("mediumRiskMaxReturnRate", parseFloat(value))}
                      helpText="Maximum return rate percentage for medium risk"
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <TextField
                    label="High Risk Threshold (%)"
                    type="number"
                    value={config.highRiskThreshold?.toString() || "30"}
                    onChange={(value) => updateConfigValue("highRiskThreshold", parseFloat(value))}
                    helpText="Return rate percentage that triggers high risk classification"
                    autoComplete="off"
                  />
                </FormLayout>

                <Banner tone="info">
                  <p>
                    <strong>Risk Tier Logic:</strong><br/>
                    • <Badge tone="success">Zero Risk</Badge>: Failed attempts &lt; {config.zeroRiskMaxFailed} AND return rate &lt; {config.zeroRiskMaxReturnRate}%<br/>
                    • <Badge tone="attention">Medium Risk</Badge>: Failed attempts &lt; {config.mediumRiskMaxFailed} AND return rate &lt; {config.mediumRiskMaxReturnRate}%<br/>
                    • <Badge tone="critical">High Risk</Badge>: Failed attempts ≥ {config.mediumRiskMaxFailed} OR return rate ≥ {config.highRiskThreshold}%
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* COD Restriction Settings */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  COD Restrictions
                </Text>
                
                <Checkbox
                  label="Enable COD restrictions for high-risk customers"
                  checked={config.enableCodRestriction || false}
                  onChange={(checked) => updateConfigValue("enableCodRestriction", checked)}
                  helpText="When enabled, high-risk customers will be required to pay a deposit"
                />

                <TextField
                  label="Required Deposit Percentage"
                  type="number"
                  value={config.depositPercentage?.toString() || "50"}
                  onChange={(value) => updateConfigValue("depositPercentage", parseFloat(value))}
                  suffix="%"
                  helpText="Percentage of order value required as deposit for high-risk customers"
                  disabled={!config.enableCodRestriction}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Advanced Settings
                </Text>

                <TextField
                  label="High-Value Order Threshold (PKR)"
                  type="number"
                  value={config.highValueThreshold?.toString() || "5000"}
                  onChange={(value) => updateConfigValue("highValueThreshold", parseInt(value))}
                  helpText="Orders above this amount get higher penalty weight"
                  autoComplete="off"
                />

                <TextField
                  label="Time Decay Factor"
                  type="number"
                  step="0.01"
                  value={config.timeDecayFactor?.toString() || "0.95"}
                  onChange={(value) => updateConfigValue("timeDecayFactor", parseFloat(value))}
                  helpText="Monthly reduction factor for old failures (0.95 = 5% reduction per month)"
                  autoComplete="off"
                />

                <TextField
                  label="New Customer Grace Period (days)"
                  type="number"
                  value={config.newCustomerGracePeriod?.toString() || "30"}
                  onChange={(value) => updateConfigValue("newCustomerGracePeriod", parseInt(value))}
                  helpText="Days to give new customers reduced risk penalties"
                  autoComplete="off"
                />

                <TextField
                  label="Minimum Orders for Assessment"
                  type="number"
                  value={config.minimumOrdersForAssessment?.toString() || "3"}
                  onChange={(value) => updateConfigValue("minimumOrdersForAssessment", parseInt(value))}
                  helpText="Minimum orders needed before applying full risk assessment"
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Notifications */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Notifications
                </Text>
                
                <TextField
                  label="Notification Email"
                  type="email"
                  value={config.notificationEmail || ""}
                  onChange={(value) => updateConfigValue("notificationEmail", value)}
                  placeholder="your-email@domain.com"
                  helpText="Email address to receive alerts about high-risk customers"
                  autoComplete="off"
                />

                <Banner tone="info">
                  <p>Email notifications are currently in development. This setting will be activated in a future update.</p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Checkout Enforcement */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Checkout Enforcement
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Configure how ReturnsX enforces COD restrictions during the checkout process.
                </Text>

                <FormLayout>
                  <Checkbox
                    label="Enable checkout enforcement script"
                    checked={config.enableCheckoutEnforcement || false}
                    onChange={(checked) => updateConfigValue("enableCheckoutEnforcement", checked)}
                    helpText="When enabled, customers will see risk-based restrictions during checkout"
                  />

                  <TextField
                    label="WhatsApp Support Number"
                    type="tel"
                    value={config.whatsappNumber || ""}
                    onChange={(value) => updateConfigValue("whatsappNumber", value)}
                    placeholder="+923001234567"
                    helpText="WhatsApp number for customer support (include country code)"
                    disabled={!config.enableCheckoutEnforcement}
                    autoComplete="off"
                  />

                  <TextField
                    label="Zero Risk Customer Message"
                    value={config.zeroRiskMessage || ""}
                    onChange={(value) => updateConfigValue("zeroRiskMessage", value)}
                    placeholder="Thank you for being a trusted customer!"
                    helpText="Optional message shown to zero-risk customers"
                    disabled={!config.enableCheckoutEnforcement}
                    autoComplete="off"
                  />

                  <TextField
                    label="Medium Risk Customer Message"
                    multiline={2}
                    value={config.mediumRiskMessage || ""}
                    onChange={(value) => updateConfigValue("mediumRiskMessage", value)}
                    placeholder="Your order may require additional verification before shipping."
                    helpText="Message shown to medium-risk customers"
                    disabled={!config.enableCheckoutEnforcement}
                    autoComplete="off"
                  />

                  <TextField
                    label="High Risk Customer Message"
                    multiline={3}
                    value={config.highRiskMessage || ""}
                    onChange={(value) => updateConfigValue("highRiskMessage", value)}
                    placeholder="To ensure secure delivery, we require advance payment for this order."
                    helpText="Message shown to high-risk customers before blocking COD"
                    disabled={!config.enableCheckoutEnforcement}
                    autoComplete="off"
                  />
                </FormLayout>

                <Banner tone="info">
                  <p>
                    The checkout enforcement script needs to be installed on your store. 
                    Use the "Enable Checkout Enforcement" button on the dashboard to install it.
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Bulk Actions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Bulk Actions
                </Text>
                
                <InlineStack gap="300">
                  <Button
                    onClick={recalculateRiskScores}
                    loading={fetcher.state === "submitting" && fetcher.formData?.get("_action") === "recalculate"}
                    tone="critical"
                  >
                    Recalculate All Risk Scores
                  </Button>
                </InlineStack>

                <Banner tone="warning">
                  <p>
                    <strong>Warning:</strong> Recalculating all risk scores will update every customer's 
                    risk assessment based on your current configuration. This action may take a few minutes 
                    for stores with many customers.
                  </p>
                </Banner>

                {fetcher.data?.action === "recalculate" && fetcher.data.success && (
                  <Banner tone="success">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Recalculation Complete
                      </Text>
                      <Text as="p" variant="bodyMd">
                        Processed: {fetcher.data.processed} customers
                      </Text>
                      <Text as="p" variant="bodyMd">
                        Errors: {fetcher.data.errors || 0}
                      </Text>
                    </BlockStack>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
} 