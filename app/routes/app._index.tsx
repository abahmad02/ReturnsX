import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
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
  Badge,
  ProgressBar,
  DataTable,
  Icon,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { 
  AlertCircleIcon, 
  CheckCircleIcon, 
  ClockIcon,
  PersonIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { getCustomerProfileStats, getHighRiskCustomers } from "../services/customerProfile.server";
import { getRiskDistributionStats } from "../services/riskScoring.server";
import { getScriptTagStatus } from "../services/scriptTag.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    // Fetch dashboard data
    const [stats, highRiskCustomers, riskDistribution, scriptStatus] = await Promise.all([
      getCustomerProfileStats(session.shop),
      getHighRiskCustomers(session.shop, 10), // Get top 10 high-risk customers
      getRiskDistributionStats(session.shop),
      getScriptTagStatus((await authenticate.admin(request)).admin, session.shop),
    ]);

    return json({
      success: true,
      shopDomain: session.shop,
      stats,
      highRiskCustomers: highRiskCustomers.map((customer: any) => ({
        id: customer.id,
        phoneHash: customer.phoneHash.substring(0, 8) + "...",
        riskScore: Number(customer.riskScore),
        riskTier: customer.riskTier,
        totalOrders: customer.totalOrders,
        failedAttempts: customer.failedAttempts,
        lastEventAt: customer.lastEventAt,
      })),
      riskDistribution,
      scriptStatus,
    });

  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return json({
      success: false,
      error: "Failed to load dashboard data",
      shopDomain: session.shop,
      stats: { total: 0, distribution: { zeroRisk: 0, mediumRisk: 0, highRisk: 0 } },
      highRiskCustomers: [],
      riskDistribution: { total: 0, distribution: { zeroRisk: 0, mediumRisk: 0, highRisk: 0 } },
      scriptStatus: { hasCheckoutScript: false, scriptCount: 0, scripts: [] },
    });
  }
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const webhookFetcher = useFetcher();
  const importFetcher = useFetcher();
  const scriptFetcher = useFetcher();
  const shopify = useAppBridge();
  const [importProgress, setImportProgress] = useState<any>(null);

  useEffect(() => {
    if (webhookFetcher.data && (webhookFetcher.data as any).success) {
      shopify.toast.show("Webhooks registered successfully");
    }
    if (importFetcher.data && (importFetcher.data as any).success) {
      shopify.toast.show("Historical import completed");
      setImportProgress((importFetcher.data as any).progress);
    }
    if (scriptFetcher.data && (scriptFetcher.data as any).success) {
      shopify.toast.show((scriptFetcher.data as any).message);
      // Reload page to refresh script status
      window.location.reload();
    } else if (scriptFetcher.data && !(scriptFetcher.data as any).success) {
      shopify.toast.show((scriptFetcher.data as any).error, { isError: true });
    }
  }, [webhookFetcher.data, importFetcher.data, scriptFetcher.data, shopify]);

  const registerWebhooks = () => {
    webhookFetcher.submit({}, { method: "POST", action: "/api/webhooks/register" });
  };

  const startHistoricalImport = () => {
    importFetcher.submit({}, { method: "POST", action: "/api/import/historical" });
  };

  const enableCheckoutEnforcement = () => {
    scriptFetcher.submit({ action: "register" }, { method: "POST", action: "/api/scripts/checkout" });
  };

  const disableCheckoutEnforcement = () => {
    scriptFetcher.submit({ action: "remove" }, { method: "POST", action: "/api/scripts/checkout" });
  };

  if (!data.success) {
    return (
      <Page>
        <TitleBar title="ReturnsX - COD Risk Management" />
        <Banner tone="critical">
          <p>Failed to load dashboard data. Please try refreshing the page.</p>
        </Banner>
      </Page>
    );
  }

  const { stats, highRiskCustomers, riskDistribution, scriptStatus, shopDomain } = data;

  // Risk distribution percentages for visualization
  const total = riskDistribution.total || 1; // Avoid division by zero
  const zeroRiskPercent = Math.round((riskDistribution.distribution.zeroRisk / total) * 100);
  const mediumRiskPercent = Math.round((riskDistribution.distribution.mediumRisk / total) * 100);
  const highRiskPercent = Math.round((riskDistribution.distribution.highRisk / total) * 100);

  // Recent customers table data
  const customerTableRows = highRiskCustomers.map((customer: any) => [
    customer.phone || 'N/A',
    <Badge tone={customer.riskTier === "HIGH_RISK" ? "critical" : "attention"} key={customer.id}>
      {customer.riskTier.replace("_", " ")}
    </Badge>,
    (Number(customer.riskScore) || 0).toFixed(1),
    customer.totalOrders,
    customer.failedAttempts,
    new Date(customer.lastEventAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="ReturnsX - COD Risk Management">
        <Button 
          variant="primary" 
          onClick={registerWebhooks}
          loading={webhookFetcher.state === "submitting"}
        >
          Setup Webhooks
        </Button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Store Overview */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Store Overview
                  </Text>
                  <Badge tone="info">{shopDomain}</Badge>
                </InlineStack>
                
                <InlineStack gap="600">
                  <Box>
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="center">
                        <Icon source={PersonIcon} tone="base" />
                        <Text as="h3" variant="headingMd">
                          {stats.total.toLocaleString()}
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Total Customers Tracked
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box>
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="center">
                        <Icon source={CheckCircleIcon} tone="base" />
                        <Text as="h3" variant="headingMd">
                          {(Number((stats as any).averageRiskScore) || 0).toFixed(1)}
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Average Risk Score
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box>
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="center">
                        <Icon source={ClockIcon} tone="base" />
                        <Text as="h3" variant="headingMd">
                          {(stats as any).recentEvents || 0}
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Events (24h)
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Risk Distribution */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Risk Distribution
                </Text>
                
                <BlockStack gap="300">
                  {/* Zero Risk */}
                  <Box>
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" align="center">
                        <Icon source={CheckCircleIcon} tone="success" />
                        <Text variant="bodyMd">Zero Risk (Green)</Text>
                      </InlineStack>
                      <Text variant="bodyMd" fontWeight="semibold">
                        {riskDistribution.distribution.zeroRisk} ({zeroRiskPercent}%)
                      </Text>
                    </InlineStack>
                    <Box paddingBlockStart="200">
                      <ProgressBar 
                        progress={zeroRiskPercent} 
                        tone="success"
                        size="small"
                      />
                    </Box>
                  </Box>

                  {/* Medium Risk */}
                  <Box>
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" align="center">
                        <Icon source={AlertCircleIcon} tone="warning" />
                        <Text variant="bodyMd">Medium Risk (Yellow)</Text>
                      </InlineStack>
                      <Text variant="bodyMd" fontWeight="semibold">
                        {riskDistribution.distribution.mediumRisk} ({mediumRiskPercent}%)
                      </Text>
                    </InlineStack>
                    <Box paddingBlockStart="200">
                      <ProgressBar 
                        progress={mediumRiskPercent} 
                        tone="warning"
                        size="small"
                      />
                    </Box>
                  </Box>

                  {/* High Risk */}
                  <Box>
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" align="center">
                        <Icon source={AlertCircleIcon} tone="critical" />
                        <Text variant="bodyMd">High Risk (Red)</Text>
                      </InlineStack>
                      <Text variant="bodyMd" fontWeight="semibold">
                        {riskDistribution.distribution.highRisk} ({highRiskPercent}%)
                      </Text>
                    </InlineStack>
                    <Box paddingBlockStart="200">
                      <ProgressBar 
                        progress={highRiskPercent} 
                        tone="critical"
                        size="small"
                      />
                    </Box>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                
                <BlockStack gap="300">
                  {scriptStatus.hasCheckoutScript ? (
                    <Button 
                      onClick={disableCheckoutEnforcement}
                      loading={scriptFetcher.state === "submitting"}
                      tone="critical"
                      fullWidth
                    >
                      ✅ Disable Checkout Enforcement
                    </Button>
                  ) : (
                    <Button 
                      onClick={enableCheckoutEnforcement}
                      loading={scriptFetcher.state === "submitting"}
                      variant="primary"
                      fullWidth
                    >
                      🛡️ Enable Checkout Enforcement
                    </Button>
                  )}
                  
                  <Button 
                    onClick={startHistoricalImport}
                    loading={importFetcher.state === "submitting"}
                    fullWidth
                  >
                    Import Historical Data
                  </Button>
                  
                  <Button 
                    url="/app/customers"
                    fullWidth
                  >
                    View High-Risk Customers
                  </Button>
                  
                  <Button 
                    url="/app/settings"
                    fullWidth
                  >
                    Configure Risk Settings
                  </Button>
                </BlockStack>

                {importProgress && (
                  <Box paddingBlockStart="400">
                    <Banner tone="info">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="semibold">
                          Import Progress
                        </Text>
                        <Text variant="bodyMd">
                          Processed: {importProgress.processedOrders}/{importProgress.totalOrders} orders
                        </Text>
                        <Text variant="bodyMd">
                          Errors: {importProgress.errors?.length || 0}
                        </Text>
                      </BlockStack>
                    </Banner>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Recent High-Risk Customers */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Recent High-Risk Customers
                  </Text>
                  <Button url="/app/customers" variant="plain">
                    View All
                  </Button>
                </InlineStack>

                {customerTableRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text', 
                      'numeric',
                      'numeric',
                      'numeric',
                      'text',
                    ]}
                    headings={[
                      'Phone',
                      'Risk Tier',
                      'Risk Score', 
                      'Total Orders',
                      'Failed Attempts',
                      'Last Activity',
                    ]}
                    rows={customerTableRows}
                  />
                ) : (
                  <Box padding="600" background="bg-surface-secondary">
                    <InlineStack align="center">
                      <Text variant="bodyMd" tone="subdued">
                        No high-risk customers found. Great job! 🎉
                      </Text>
                    </InlineStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
