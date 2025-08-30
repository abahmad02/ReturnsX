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
  Badge,
  DataTable,
  Modal,
  TextField,
  Select,
  Form,
  FormLayout,
  Banner,
  Spinner,
  Divider,
  ButtonGroup,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getHighRiskCustomers, applyManualOverride } from "../services/customerProfile.server";
import { getRiskDistributionStats } from "../services/riskScoring.server";
import { getWhatsAppStatus } from "../services/whatsapp.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const [highRiskCustomers, riskStats, whatsappStatus] = await Promise.all([
      getHighRiskCustomers(session.shop, limit),
      getRiskDistributionStats(session.shop),
      getWhatsAppStatus(),
    ]);

    // Format customer data for display
    const formattedCustomers = highRiskCustomers.map((customer: any) => ({
      id: customer.id,
      phone: customer.phone || 'N/A',
      email: customer.email || 'N/A',
      riskScore: Number(customer.riskScore) || 0,
      riskTier: customer.riskTier,
      totalOrders: customer.totalOrders || 0,
      failedAttempts: customer.failedAttempts || 0,
      successfulDeliveries: customer.successfulDeliveries || 0,
      returnRate: Number(customer.returnRate) || 0,
      lastEventAt: customer.lastEventAt,
      recentEvents: customer.orderEvents?.slice(0, 5).map((event: any) => ({
        eventType: event.eventType,
        orderValue: event.orderValue,
        currency: event.currency,
        cancelReason: event.cancelReason,
        createdAt: event.createdAt,
      })) || [],
    }));

    return json({
      success: true,
      customers: formattedCustomers,
      stats: riskStats,
      shopDomain: session.shop,
      whatsappStatus,
    });

  } catch (error) {
    console.error("Error loading high-risk customers:", error);
    return json({
      success: false,
      error: "Failed to load customer data",
      customers: [],
      stats: { total: 0, distribution: { zeroRisk: 0, mediumRisk: 0, highRisk: 0 } },
      shopDomain: session.shop,
      whatsappStatus: { isConfigured: false, status: "needs_configuration" },
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    if (actionType === "manual_override") {
      const customerProfileId = formData.get("customerProfileId") as string;
      const overrideType = formData.get("overrideType") as string;
      const newValue = formData.get("newValue") as string;
      const reason = formData.get("reason") as string;

      if (!customerProfileId || !overrideType) {
        return json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      await applyManualOverride(
        customerProfileId,
        session.shop,
        overrideType,
        newValue,
        session.id,
        reason
      );

      return json({ success: true, message: "Override applied successfully", actionType });

    } else if (actionType === "send_whatsapp") {
      // WhatsApp message sending will be handled by the WhatsApp API endpoint
      return json({ 
        success: true, 
        message: "WhatsApp message request processed",
        actionType 
      });
    }

    return json(
      { success: false, error: "Invalid action type" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error processing customer action:", error);
    return json(
      { success: false, error: "Failed to process action" },
      { status: 500 }
    );
  }
};

export default function HighRiskCustomers() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const whatsappFetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrideType, setOverrideType] = useState("RESET_FAILED_ATTEMPTS");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.actionType === "manual_override") {
      shopify.toast.show("Override applied successfully");
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setReason("");
      setNewValue("");
      window.location.reload();
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }

    if (whatsappFetcher.data?.success) {
      shopify.toast.show("WhatsApp message sent successfully");
    } else if (whatsappFetcher.data?.error) {
      shopify.toast.show(whatsappFetcher.data.error, { isError: true });
    }
  }, [fetcher.data, whatsappFetcher.data, shopify]);

  const sendWhatsAppVerification = (customer: any, messageType: string) => {
    // This would need actual customer phone number and order details
    // For now, using placeholder data
    whatsappFetcher.submit({
      type: messageType,
      phone: "+923001234567", // Placeholder - would get from customer data
      orderNumber: "12345", // Placeholder - would get from recent order
      customerName: "Customer", // Placeholder
    }, {
      method: "POST",
      action: "/api/whatsapp/send"
    });
  };

  if (!data.success) {
    return (
      <Page>
        <TitleBar title="High-Risk Customers" />
        <Banner tone="critical">
          <p>Failed to load customer data. Please try refreshing the page.</p>
        </Banner>
      </Page>
    );
  }

  const { customers, stats, whatsappStatus } = data;

  // Customer table data with WhatsApp actions
  const customerTableRows = customers.map((customer: any) => [
    customer.phone || 'N/A',
    customer.email || 'N/A',
    <Badge 
      tone={customer.riskTier === "HIGH_RISK" ? "critical" : "attention"} 
      key={customer.id}
    >
      {customer.riskTier.replace("_", " ")}
    </Badge>,
    (customer.riskScore || 0).toFixed(1),
    customer.totalOrders,
    customer.failedAttempts,
    customer.successfulDeliveries,
    (customer.returnRate || 0).toFixed(1) + "%",
    new Date(customer.lastEventAt).toLocaleDateString(),
    <ButtonGroup key={`actions-${customer.id}`}>
      <Button
        size="slim"
        onClick={() => {
          setSelectedCustomer(customer);
          setIsModalOpen(true);
        }}
      >
        View Details
      </Button>
      {whatsappStatus.isConfigured && (
        <Button
          size="slim"
          onClick={() => sendWhatsAppVerification(customer, "verification_request")}
          loading={whatsappFetcher.state === "submitting"}
        >
          📱 Verify
        </Button>
      )}
    </ButtonGroup>,
  ]);

  const overrideOptions = [
    { label: "Reset Failed Attempts", value: "RESET_FAILED_ATTEMPTS" },
    { label: "Change Risk Tier", value: "CHANGE_RISK_TIER" },
    { label: "Forgive Customer", value: "FORGIVE_CUSTOMER" },
  ];

  const riskTierOptions = [
    { label: "Zero Risk", value: "ZERO_RISK" },
    { label: "Medium Risk", value: "MEDIUM_RISK" },
    { label: "High Risk", value: "HIGH_RISK" },
  ];

  return (
    <Page>
      <TitleBar title="High-Risk Customers" />

      <BlockStack gap="500">
        {/* WhatsApp Status */}
        {!whatsappStatus.isConfigured && (
          <Banner tone="info">
            <p>
              <strong>WhatsApp Integration:</strong> Configure your Twilio WhatsApp credentials to enable 
              automated customer verification and communication features.
            </p>
          </Banner>
        )}

        {/* Statistics Overview */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Risk Distribution
                </Text>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">High Risk</Text>
                  <Badge tone="critical">
                    {`${stats.distribution.highRisk} customers`}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Medium Risk</Text>
                  <Badge tone="attention">
                    {`${stats.distribution.mediumRisk} customers`}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Zero Risk</Text>
                  <Badge tone="success">
                    {`${stats.distribution.zeroRisk} customers`}
                  </Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="twoThirds">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Customer Management & WhatsApp
                </Text>
                <Text as="p" variant="bodyMd">
                  Review and manage customers with high COD risk scores. 
                  {whatsappStatus.isConfigured ? 
                    " Send WhatsApp verification messages and apply manual overrides based on your business knowledge." :
                    " Configure WhatsApp to enable automated customer communication."
                  }
                </Text>
                
                {whatsappStatus.isConfigured && (
                  <InlineStack gap="300">
                    <Badge tone="success">WhatsApp Ready</Badge>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      Business: {whatsappStatus.businessName}
                    </Text>
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Customer List */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    High-Risk Customer List ({customers.length})
                  </Text>
                </InlineStack>

                {customers.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      'text',    // Phone Hash
                      'text',    // Email Hash
                      'text',    // Risk Tier
                      'numeric', // Risk Score
                      'numeric', // Total Orders
                      'numeric', // Failed Attempts
                      'numeric', // Successful Deliveries
                      'text',    // Return Rate
                      'text',    // Last Activity
                      'text',    // Actions
                    ]}
                    headings={[
                      'Phone',
                      'Email',
                      'Risk Tier',
                      'Risk Score',
                      'Total Orders',
                      'Failed Attempts',
                      'Successful Deliveries',
                      'Return Rate',
                      'Last Activity',
                      'Actions',
                    ]}
                    rows={customerTableRows}
                  />
                ) : (
                  <Box padding="600" background="bg-surface-secondary">
                    <InlineStack align="center">
                      <Text as="p" variant="bodyMd" tone="subdued">
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

      {/* Customer Detail Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCustomer(null);
          setReason("");
          setNewValue("");
        }}
        title="Customer Risk Profile"
        primaryAction={{
          content: "Apply Override",
          onAction: () => {
            fetcher.submit(
              {
                actionType: "manual_override",
                customerProfileId: selectedCustomer?.id,
                overrideType,
                newValue,
                reason,
              },
              { method: "POST" }
            );
          },
          loading: fetcher.state === "submitting",
          disabled: !reason.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setIsModalOpen(false);
              setSelectedCustomer(null);
            },
          },
        ]}
      >
        {selectedCustomer && (
          <Modal.Section>
            <BlockStack gap="400">
              {/* Customer Overview */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Customer Overview
                  </Text>
                  <InlineStack gap="400">
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Risk Score
                        </Text>
                        <Text as="p" variant="headingLg">
                          {(selectedCustomer.riskScore || 0).toFixed(1)}
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Risk Tier
                        </Text>
                        <Badge 
                          tone={selectedCustomer.riskTier === "HIGH_RISK" ? "critical" : "attention"}
                        >
                          {selectedCustomer.riskTier.replace("_", " ")}
                        </Badge>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                  
                  <InlineStack gap="400">
                    <Text as="p" variant="bodyMd">
                      <strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Email:</strong> {selectedCustomer.email || 'N/A'}
                    </Text>
                  </InlineStack>

                  <InlineStack gap="400">
                    <Text as="p" variant="bodyMd">
                      <strong>Total Orders:</strong> {selectedCustomer.totalOrders}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Failed Attempts:</strong> {selectedCustomer.failedAttempts}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Successful Deliveries:</strong> {selectedCustomer.successfulDeliveries}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Return Rate:</strong> {(selectedCustomer.returnRate || 0).toFixed(1)}%
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* WhatsApp Actions */}
              {whatsappStatus.isConfigured && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      WhatsApp Communication
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Send verification or support messages directly to this customer.
                    </Text>
                    
                    <InlineStack gap="300">
                      <Button
                        onClick={() => sendWhatsAppVerification(selectedCustomer, "verification_request")}
                        loading={whatsappFetcher.state === "submitting"}
                      >
                        📱 Send Verification
                      </Button>
                      
                      {selectedCustomer.riskTier === "HIGH_RISK" && (
                        <Button
                          onClick={() => sendWhatsAppVerification(selectedCustomer, "deposit_request")}
                          loading={whatsappFetcher.state === "submitting"}
                        >
                          💳 Request Deposit
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => sendWhatsAppVerification(selectedCustomer, "custom")}
                        loading={whatsappFetcher.state === "submitting"}
                        variant="plain"
                      >
                        💬 Custom Message
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}

              {/* Recent Order Events */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Recent Order Events
                  </Text>
                  {selectedCustomer.recentEvents.length > 0 ? (
                    <BlockStack gap="200">
                      {selectedCustomer.recentEvents.map((event: any, index: number) => (
                        <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="200">
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyMd" fontWeight="semibold">
                                {event.eventType.replace("_", " ")}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                {event.orderValue ? `${event.currency} ${event.orderValue}` : "N/A"}
                                {event.cancelReason && ` • ${event.cancelReason}`}
                              </Text>
                            </BlockStack>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {new Date(event.createdAt).toLocaleDateString()}
                            </Text>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No recent events found.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Divider />

              {/* Manual Override Form */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Manual Override
                  </Text>
                  
                  <FormLayout>
                    <Select
                      label="Override Type"
                      options={overrideOptions}
                      value={overrideType}
                      onChange={(value) => {
                        setOverrideType(value);
                        setNewValue("");
                      }}
                    />

                    {overrideType === "CHANGE_RISK_TIER" && (
                      <Select
                        label="New Risk Tier"
                        options={riskTierOptions}
                        value={newValue}
                        onChange={setNewValue}
                      />
                    )}

                    <TextField
                      label="Reason for Override"
                      value={reason}
                      onChange={setReason}
                      multiline={3}
                      placeholder="Please provide a detailed reason for this manual override..."
                      helpText="This will be logged for audit purposes."
                      autoComplete="off"
                    />
                  </FormLayout>

                  <Banner tone="info">
                    <p>
                      <strong>Note:</strong> Manual overrides are logged for audit purposes. 
                      All changes will be immediately reflected in the risk assessment system.
                    </p>
                  </Banner>
                </BlockStack>
              </Card>
            </BlockStack>
          </Modal.Section>
        )}
      </Modal>
    </Page>
  );
} 