import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  InlineStack,
  Badge,
  DataTable,
  Select,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getRiskDistributionStats } from "../services/riskScoring.server";
import { getCustomerProfileStats } from "../services/customerProfile.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const [riskStats, profileStats] = await Promise.all([
      getRiskDistributionStats(session.shop),
      getCustomerProfileStats(session.shop),
    ]);

    // Calculate some additional analytics
    const totalCustomers = riskStats.total;
    const highRiskPercentage = totalCustomers > 0 
      ? Math.round((riskStats.distribution.highRisk / totalCustomers) * 100) 
      : 0;
    
    const avgRiskScore = Number(riskStats.averageRiskScore) || 0;

    return json({
      success: true,
      shopDomain: session.shop,
      analytics: {
        totalCustomers,
        highRiskPercentage,
        avgRiskScore,
        riskDistribution: riskStats.distribution,
        recentEvents: (profileStats as any).recentEvents || 0,
      },
    });

  } catch (error) {
    console.error("Error loading analytics:", error);
    return json({
      success: false,
      error: "Failed to load analytics data",
      analytics: {
        totalCustomers: 0,
        highRiskPercentage: 0,
        avgRiskScore: 0,
        riskDistribution: { zeroRisk: 0, mediumRisk: 0, highRisk: 0 },
        recentEvents: 0,
      },
    });
  }
};

export default function Analytics() {
  const data = useLoaderData<typeof loader>();
  const [timeRange, setTimeRange] = useState("30");

  const timeRangeOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
    { label: "All time", value: "all" },
  ];

  if (!data.success) {
    return (
      <Page>
        <TitleBar title="Analytics" />
        <Banner tone="critical">
          <p>Failed to load analytics data. Please try refreshing the page.</p>
        </Banner>
      </Page>
    );
  }

  const { analytics } = data;

  // Sample trend data (would be calculated from actual order events in production)
  const trendData = [
    ["Week 1", 15, 5, 2],
    ["Week 2", 18, 7, 3],
    ["Week 3", 22, 6, 4],
    ["Week 4", 25, 8, 5],
  ];

  return (
    <Page>
      <TitleBar title="Analytics & Insights" />

      <BlockStack gap="500">
        {/* Time Range Selector */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Time Range
                </Text>
                <Select
                  label=""
                  options={timeRangeOptions}
                  value={timeRange}
                  onChange={setTimeRange}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="twoThirds">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Key Metrics
                </Text>
                <InlineStack gap="400">
                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Total Customers
                      </Text>
                      <Text as="p" variant="headingLg">
                        {analytics.totalCustomers.toLocaleString()}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        High Risk Rate
                      </Text>
                      <Text as="p" variant="headingLg">
                        {analytics.highRiskPercentage}%
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Avg Risk Score
                      </Text>
                      <Text as="p" variant="headingLg">
                        {(analytics.avgRiskScore || 0).toFixed(1)}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Recent Events
                      </Text>
                      <Text as="p" variant="headingLg">
                        {analytics.recentEvents}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Risk Distribution Analysis */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Risk Distribution Analysis
                </Text>
                
                <InlineStack gap="400">
                  <Box minWidth="200px">
                    <BlockStack gap="200" align="center">
                      <Badge tone="success" size="large">
                        Zero Risk
                      </Badge>
                      <Text as="p" variant="headingLg">
                        {analytics.riskDistribution.zeroRisk}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {analytics.totalCustomers > 0 
                          ? Math.round((analytics.riskDistribution.zeroRisk / analytics.totalCustomers) * 100)
                          : 0}% of customers
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box minWidth="200px">
                    <BlockStack gap="200" align="center">
                      <Badge tone="attention" size="large">
                        Medium Risk
                      </Badge>
                      <Text as="p" variant="headingLg">
                        {analytics.riskDistribution.mediumRisk}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {analytics.totalCustomers > 0 
                          ? Math.round((analytics.riskDistribution.mediumRisk / analytics.totalCustomers) * 100)
                          : 0}% of customers
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box minWidth="200px">
                    <BlockStack gap="200" align="center">
                      <Badge tone="critical" size="large">
                        High Risk
                      </Badge>
                      <Text as="p" variant="headingLg">
                        {analytics.riskDistribution.highRisk}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {analytics.highRiskPercentage}% of customers
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>

                <Banner tone={analytics.highRiskPercentage > 15 ? "warning" : "success"}>
                  <p>
                    {analytics.highRiskPercentage > 15 
                      ? `Your high-risk customer rate of ${analytics.highRiskPercentage}% is above the recommended threshold. Consider reviewing your risk settings or implementing additional verification measures.`
                      : `Great job! Your high-risk customer rate of ${analytics.highRiskPercentage}% is within healthy limits. Your COD risk management is working effectively.`
                    }
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Trend Analysis */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Weekly Trend Analysis
                </Text>

                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={[
                    'Time Period',
                    'Zero Risk Customers',
                    'Medium Risk Customers', 
                    'High Risk Customers',
                  ]}
                  rows={trendData}
                />

                <Banner tone="info">
                  <p>
                    <strong>Coming Soon:</strong> Advanced analytics including trend charts, 
                    seasonal patterns, and predictive insights will be available in the next update.
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Insights & Recommendations */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Insights & Recommendations
                </Text>

                <BlockStack gap="300">
                  {analytics.highRiskPercentage > 20 && (
                    <Banner tone="warning">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          High Risk Rate Alert
                        </Text>
                        <Text as="p" variant="bodyMd">
                          Your high-risk customer rate ({analytics.highRiskPercentage}%) is elevated. 
                          Consider implementing stricter verification processes or adjusting risk thresholds.
                        </Text>
                      </BlockStack>
                    </Banner>
                  )}

                  {analytics.avgRiskScore > 50 && (
                    <Banner tone="attention">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Elevated Average Risk Score
                        </Text>
                        <Text as="p" variant="bodyMd">
                          Your average risk score ({(analytics.avgRiskScore || 0).toFixed(1)}) suggests increased COD risk. 
                          Review recent order patterns and consider enhanced customer verification.
                        </Text>
                      </BlockStack>
                    </Banner>
                  )}

                  {analytics.recentEvents < 10 && analytics.totalCustomers > 50 && (
                    <Banner tone="info">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Low Recent Activity
                        </Text>
                        <Text as="p" variant="bodyMd">
                          Recent order activity is lower than expected. Ensure webhooks are properly configured 
                          to capture all order events.
                        </Text>
                      </BlockStack>
                    </Banner>
                  )}

                  {analytics.highRiskPercentage < 5 && analytics.totalCustomers > 100 && (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Excellent Risk Management
                        </Text>
                        <Text as="p" variant="bodyMd">
                          Your low high-risk rate ({analytics.highRiskPercentage}%) indicates excellent 
                          customer quality and effective risk management practices.
                        </Text>
                      </BlockStack>
                    </Banner>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
} 