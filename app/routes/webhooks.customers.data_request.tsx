import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logger } from "../services/logger.server";

/**
 * Webhook handler for customers/data_request
 * 
 * This webhook is triggered when a customer requests their data.
 * Required for GDPR and privacy law compliance.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CUSTOMERS_DATA_REQUEST") {
      return new Response("Webhook topic not supported", { status: 404 });
    }

    logger.info("Customer data request received", {
      shopDomain: shop,
      customerId: payload.customer?.id,
      dataRequestId: payload.data_request?.id,
      component: "privacyCompliance"
    });

    // Handle the data request
    await handleCustomerDataRequest(payload, shop);

    return new Response("OK", { status: 200 });

  } catch (error) {
    logger.error("Failed to process customer data request", {
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    
    return new Response("Internal Server Error", { status: 500 });
  }
};

/**
 * Handle customer data request
 */
async function handleCustomerDataRequest(payload: any, shopDomain: string) {
  const { customer, orders_requested, data_request } = payload;

  try {
    // For ReturnsX, we need to:
    // 1. Find customer profiles by phone/email (remember, we hash these)
    // 2. Collect all data we have for this customer
    // 3. Prepare data package for the merchant

    const customerData = {
      customerId: customer.id,
      email: customer.email,
      phone: customer.phone,
      ordersRequested: orders_requested,
      dataRequestId: data_request.id,
      
      // ReturnsX-specific data
      riskProfiles: [], // We'll populate this with customer risk data
      orderEvents: [],  // Order events we've tracked
      fraudScores: [],  // Historical fraud scores
    };

    // TODO: Implement actual data collection
    // Since we hash customer identifiers, we need to:
    // 1. Hash the provided email/phone with our salt
    // 2. Look up profiles by the hash
    // 3. Collect all associated data
    
    logger.info("Customer data request processed", {
      shopDomain,
      customerId: customer.id,
      dataRequestId: data_request.id,
      component: "privacyCompliance"
    });

    // Note: The actual data should be provided to the merchant
    // through their admin interface or via email, not returned here

  } catch (error) {
    logger.error("Error processing customer data request", {
      shopDomain,
      customerId: customer?.id,
      error: error instanceof Error ? error.message : String(error),
      component: "privacyCompliance"
    });
    throw error;
  }
}
