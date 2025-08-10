import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Banner,
  Box,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function AdditionalPage() {
  return (
    <Page>
      <TitleBar title="About ReturnsX" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  ReturnsX - COD Risk Management Platform
                </Text>
                <Text as="p" variant="bodyMd">
                  ReturnsX is a comprehensive Cash-on-Delivery (COD) risk management solution designed 
                  specifically for Pakistan's e-commerce sector. Our platform helps merchants reduce 
                  COD return and refusal rates by providing advanced customer risk assessment and 
                  automated prevention measures.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Key Features
                </Text>
                <List type="bullet">
                  <List.Item>
                    <strong>Advanced Risk Scoring:</strong> Multi-factor algorithm that analyzes customer behavior patterns
                  </List.Item>
                  <List.Item>
                    <strong>Real-time Assessment:</strong> Instant risk evaluation during checkout process
                  </List.Item>
                  <List.Item>
                    <strong>Automated Prevention:</strong> Configurable COD restrictions and deposit requirements
                  </List.Item>
                  <List.Item>
                    <strong>Manual Overrides:</strong> Merchant controls for exceptional cases with audit trails
                  </List.Item>
                  <List.Item>
                    <strong>Privacy-First:</strong> All customer data is hashed and encrypted for maximum security
                  </List.Item>
                  <List.Item>
                    <strong>Analytics & Insights:</strong> Comprehensive reporting and trend analysis
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  How It Works
                </Text>
                <BlockStack gap="300">
                  <Box>
                    <InlineStack gap="300" align="start">
                      <Badge tone="info">1</Badge>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Data Collection
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Securely collect and hash customer identifiers (phone, email, address)
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>

                  <Box>
                    <InlineStack gap="300" align="start">
                      <Badge tone="info">2</Badge>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Risk Analysis
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Analyze order history, failed attempts, and return patterns
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>

                  <Box>
                    <InlineStack gap="300" align="start">
                      <Badge tone="info">3</Badge>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Smart Prevention
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Apply appropriate restrictions or require deposits for high-risk orders
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>

                  <Box>
                    <InlineStack gap="300" align="start">
                      <Badge tone="info">4</Badge>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Continuous Learning
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Update risk scores based on new order outcomes and merchant feedback
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Risk Tier System
                </Text>
                <InlineStack gap="400">
                  <Box>
                    <BlockStack gap="200">
                      <Badge tone="success" size="large">Zero Risk (Green)</Badge>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Reliable customers with good payment history. No restrictions applied.
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box>
                    <BlockStack gap="200">
                      <Badge tone="attention" size="large">Medium Risk (Yellow)</Badge>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Customers requiring monitoring. Manual verification recommended for high-value orders.
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box>
                    <BlockStack gap="200">
                      <Badge tone="critical" size="large">High Risk (Red)</Badge>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Customers with concerning patterns. COD restrictions and deposit requirements applied.
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  Privacy & Security Commitment
                </Text>
                <Text as="p" variant="bodyMd">
                  ReturnsX is built with privacy-first principles. All customer personally identifiable 
                  information (PII) is immediately hashed using SHA-256 encryption before storage. 
                  We never store raw customer data, ensuring maximum privacy protection while maintaining 
                  effective risk assessment capabilities.
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Getting Started
                </Text>
                <List type="number">
                  <List.Item>
                    Click "Setup Webhooks" on the dashboard to enable real-time order tracking
                  </List.Item>
                  <List.Item>
                    Import your historical order data to establish baseline risk assessments
                  </List.Item>
                  <List.Item>
                    Configure your risk thresholds and COD restriction preferences in Settings
                  </List.Item>
                  <List.Item>
                    Monitor your high-risk customers and apply manual overrides as needed
                  </List.Item>
                  <List.Item>
                    Review analytics to optimize your risk management strategy
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
