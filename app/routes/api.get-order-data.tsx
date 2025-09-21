import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getCheckoutCorrelation } from "../services/checkoutCorrelation.server";
import { getCustomerProfileByPhone } from "../services/customerProfile.server";
import { logger } from "../services/logger.server";

/**
 * API endpoint to get order data based on checkout token
 * Used by the extension to fetch customer risk data
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const checkoutToken = url.searchParams.get("checkoutToken");
  const customerPhone = url.searchParams.get("customerPhone");
  const orderName = url.searchParams.get("orderName");
  const orderId = url.searchParams.get("orderId");

  logger.info("API: Getting order data", {
    component: "getOrderData",
    checkoutToken: checkoutToken ? `${checkoutToken.slice(0, 8)}...` : "none",
    customerPhone: customerPhone ? `${customerPhone.slice(0, 3)}***` : "none",
    orderName,
    orderId: orderId ? `${orderId.slice(0, 20)}...` : "none"
  });

  // If no identifiers provided, return error
  if (!checkoutToken && !customerPhone && !orderName && !orderId) {
    return json({
      error: "Missing required parameter: checkoutToken, customerPhone, orderName, or orderId"
    }, { status: 400 });
  }

  return await getOrderDataInternal(checkoutToken, customerPhone, orderName, orderId);
}

/**
 * Internal function to get order data
 * Separated for reduced complexity
 */
async function getOrderDataInternal(
  checkoutToken: string | null, 
  customerPhone: string | null, 
  orderName: string | null,
  orderId: string | null
) {
  try {
    let customerData = null;
    let orderInfo = null;

    // Try to get correlation data by checkout token first
    if (checkoutToken) {
      const correlation = await getCheckoutCorrelation(checkoutToken);
      if (correlation) {
        orderInfo = {
          orderId: correlation.orderId,
          orderName: correlation.orderName,
          totalAmount: correlation.totalAmount,
          currency: correlation.currency,
          customerEmail: correlation.customerEmail,
          customerPhone: correlation.customerPhone,
          customerId: correlation.customerId
        };
        
        // If we have customer phone from correlation, fetch their profile
        if (correlation.customerPhone) {
          customerData = await getCustomerProfileByPhone(correlation.customerPhone);
        }
      }
    }

    // If no data yet and we have orderId, try to extract and lookup
    if (!customerData && !orderInfo && orderId) {
      // Extract numeric ID from Shopify GID (e.g., gid://shopify/OrderIdentity/5971448463430)
      const numericOrderId = orderId.includes('/') ? orderId.split('/').pop() : orderId;
      if (numericOrderId) {
        // Look up order data by numeric ID (you may need to implement this lookup)
        logger.info("Looking up order by numeric ID", { 
          component: "getOrderData",
          numericOrderId 
        });
        
        // For now, create a basic order info structure
        // In a full implementation, you'd query your database for this order
        orderInfo = {
          orderId: numericOrderId,
          orderName: null, // Would be populated from database
          totalAmount: null,
          currency: null,
          customerEmail: null,
          customerPhone: null,
          customerId: null
        };
      }
    }

    // If no data yet and we have customerPhone, try direct customer lookup
    if (!customerData && customerPhone) {
      customerData = await getCustomerProfileByPhone(customerPhone);
    }

    return formatResponse(orderInfo, customerData, checkoutToken, customerPhone, orderName, orderId);

  } catch (error) {
    logger.error("Error in get-order-data API", {
      component: "getOrderData",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return json({
      error: "Internal server error",
      debug: {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 });
  }
}

/**
 * Format the API response data
 */
function formatResponse(
  orderInfo: any, 
  customerData: any, 
  checkoutToken: string | null,
  customerPhone: string | null,
  orderName: string | null,
  orderId: string | null
) {
  const responseData = {
    orderInfo,
    customer: customerData ? {
      id: customerData.id,
      phone: customerData.phone || orderInfo?.customerPhone,
      email: customerData.email || orderInfo?.customerEmail,
      riskLevel: customerData.riskLevel || 'unknown',
      riskScore: customerData.riskScore || 0,
      riskFactors: customerData.riskFactors || [],
      orderCount: customerData.orderCount || 0,
      totalSpent: customerData.totalSpent || 0,
      avgOrderValue: customerData.avgOrderValue || 0,
      returnRate: customerData.returnRate || 0,
      chargebackCount: customerData.chargebackCount || 0,
      fraudReports: customerData.fraudReports || 0,
      lastOrderDate: customerData.lastOrderDate,
      createdAt: customerData.createdAt,
      updatedAt: customerData.updatedAt
    } : null,
    debug: {
      searchParams: {
        checkoutToken: checkoutToken ? `${checkoutToken.slice(0, 8)}...` : null,
        customerPhone: customerPhone ? `${customerPhone.slice(0, 3)}***` : null,
        orderName,
        orderId: orderId ? `${orderId.slice(0, 20)}...` : null
      },
      foundCorrelation: !!orderInfo,
      foundCustomer: !!customerData,
      timestamp: new Date().toISOString()
    }
  };

  // If no data found at all, return appropriate response
  if (!customerData && !orderInfo) {
    return json({
      ...responseData,
      message: "No customer data found for the provided identifiers"
    }, { status: 404 });
  }

  return json(responseData);
}