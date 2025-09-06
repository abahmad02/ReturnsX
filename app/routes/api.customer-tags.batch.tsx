import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { batchApplyRiskTags, getDefaultTaggingConfig } from "../services/customerTagging.server";
import { batchApplyDualRiskTags, getDefaultDualTaggingConfig } from "../services/dualTagging.server";
import { getHighRiskCustomers, getCustomerProfileStats } from "../services/customerProfile.server";

/**
 * API endpoint for batch applying risk tags to existing customers
 * This is useful when first setting up the tagging system
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session, admin } = await authenticate.admin(request);
    
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;
    const limit = parseInt(formData.get("limit") as string || "50");

    if (action === "apply_all_tags") {
      // Get all customers with risk assessments
      const customers = await getHighRiskCustomers(session.shop, limit);
      
      // Format for batch tagging (customers only - legacy method)
      const customerData = customers.map((customer: any) => ({
        riskTier: customer.riskTier,
        phone: customer.phone,
        email: customer.email,
      }));

      if (customerData.length === 0) {
        return json({
          success: true,
          message: "No customers found for tagging",
          successful: 0,
          failed: 0,
          total: 0,
        });
      }

      // Apply tags in batch (customers only)
      const result = await batchApplyRiskTags(
        admin,
        customerData,
        session.shop,
        getDefaultTaggingConfig(session.shop)
      );

      return json({
        success: true,
        message: `Batch customer tagging completed: ${result.successful} successful, ${result.failed} failed`,
        successful: result.successful,
        failed: result.failed,
        total: customerData.length,
        details: result.results.slice(0, 10), // First 10 results for debugging
      });

    } else if (action === "apply_dual_tags") {
      // Get recent orders from Shopify to tag both customers and orders
      const ordersResponse = await admin.graphql(
        `#graphql
          query getRecentOrders($first: Int!) {
            orders(first: $first, reverse: true) {
              edges {
                node {
                  id
                  name
                  customer {
                    phone
                    email
                  }
                  billingAddress {
                    phone
                  }
                  shippingAddress {
                    phone
                  }
                }
              }
            }
          }`,
        {
          variables: { first: Math.min(limit, 50) }
        }
      );

      const ordersData = await ordersResponse.json();
      const orders = ordersData.data?.orders?.edges || [];

      if (orders.length === 0) {
        return json({
          success: true,
          message: "No recent orders found for dual tagging",
          successful: 0,
          failed: 0,
          total: 0,
        });
      }

      // Format for dual tagging (both customers and orders)
      const dualTagData = orders.map((orderEdge: any) => {
        const order = orderEdge.node;
        const orderId = order.id.split('/').pop(); // Extract numeric ID from GraphQL ID
        const phone = order.customer?.phone || order.billingAddress?.phone || order.shippingAddress?.phone;
        const email = order.customer?.email;

        return {
          orderId,
          phone,
          email,
        };
      }).filter((item: any) => item.phone || item.email); // Only include orders with customer identifiers

      if (dualTagData.length === 0) {
        return json({
          success: true,
          message: "No orders with customer identifiers found for dual tagging",
          successful: 0,
          failed: 0,
          total: 0,
        });
      }

      // Apply dual tags in batch
      const result = await batchApplyDualRiskTags(
        admin,
        dualTagData,
        session.shop,
        getDefaultDualTaggingConfig(session.shop)
      );

      return json({
        success: true,
        message: `Batch dual tagging completed: ${result.successful} successful, ${result.failed} failed`,
        successful: result.successful,
        failed: result.failed,
        total: dualTagData.length,
        details: result.results.slice(0, 10), // First 10 results for debugging
      });

    } else if (action === "get_stats") {
      // Get customer statistics for the UI
      const stats = await getCustomerProfileStats(session.shop);
      
      return json({
        success: true,
        stats,
      });

    } else {
      return json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error in batch tagging API:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }, { status: 500 });
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    
    // Get current tagging configuration
    const config = getDefaultTaggingConfig(session.shop);
    
    return json({
      success: true,
      config,
      shopDomain: session.shop,
    });

  } catch (error) {
    console.error("Error loading tagging config:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }, { status: 500 });
  }
}
