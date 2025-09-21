import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getCheckoutCorrelation } from "../services/checkoutCorrelation.server";
import { getCustomerProfileByPhone } from "../services/customerProfile.server";
import { logger } from "../services/logger.server";
import prisma from "../db.server";

/**
 * Safely convert a value to a finite number or return a fallback
 * Handles null, undefined, NaN, Infinity, and non-numeric values
 */
function safeToNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  
  // Handle Decimal type (from Prisma) by converting to number first
  if (typeof value === 'object' && value.toNumber) {
    const decimalNum = value.toNumber();
    return Number.isFinite(decimalNum) ? decimalNum : fallback;
  }
  
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Safely convert a value to a string representation of a number or return a fallback
 * Handles null, undefined, NaN, Infinity, and non-numeric values
 */
function safeToNumberString(value: any, fallback: string = "0"): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  
  // Handle Decimal type (from Prisma) by converting to number first
  if (typeof value === 'object' && value.toNumber) {
    const decimalNum = value.toNumber();
    return Number.isFinite(decimalNum) ? String(decimalNum) : fallback;
  }
  
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : fallback;
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  
  return new Response("Method not allowed", { 
    status: 405,
    headers: getCorsHeaders()
  });
}

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
    }, { 
      status: 400,
      headers: getCorsHeaders()
    });
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

    // If no data yet and we have orderId, try to extract and lookup from internal database
    if (!customerData && !orderInfo && orderId) {
      // Extract numeric ID from Shopify GID (e.g., gid://shopify/OrderIdentity/5971448463430)
      const numericOrderId = orderId.includes('/') ? orderId.split('/').pop() : orderId;
      
      logger.info("Looking up order by numeric ID", { 
        component: "getOrderData",
        originalOrderId: orderId,
        extractedNumericOrderId: numericOrderId 
      });
      
      if (numericOrderId && numericOrderId !== '0' && Number.isFinite(Number(numericOrderId))) {
        try {
          // Look up order events in our database to find customer data
          const orderEvents = await prisma.orderEvent.findMany({
            where: {
              shopifyOrderId: numericOrderId
            },
            include: {
              customerProfile: true
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          });
          
          if (orderEvents.length > 0) {
            const orderEvent = orderEvents[0];
            const customer = orderEvent.customerProfile;
            
            // Build order info from database
            orderInfo = {
              orderId: numericOrderId,
              orderName: `#${numericOrderId.slice(-4)}`, // Use last 4 digits as order name
              totalAmount: safeToNumberString(orderEvent.orderValue),
              currency: orderEvent.currency || 'PKR',
              customerEmail: customer.email,
              customerPhone: customer.phone,
              customerId: customer.id
            };
            
            // Build customer data from our internal profile
            customerData = {
              id: customer.id,
              phone: customer.phone,
              email: customer.email,
              riskLevel: customer.riskTier,
              riskScore: safeToNumber(customer.riskScore, 0),
              riskFactors: [], // Would need to be calculated from order events
              orderCount: customer.totalOrders,
              totalSpent: 0, // Would need to be calculated from order events
              avgOrderValue: 0, // Would need to be calculated from order events
              returnRate: safeToNumber(customer.returnRate, 0),
              chargebackCount: 0, // Not in current schema
              fraudReports: 0, // Not in current schema
              lastOrderDate: customer.lastEventAt,
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt
            };
          } else {
            // Try to find checkout correlation data as fallback
            const correlations = await prisma.checkoutCorrelation.findMany({
              where: {
                orderId: numericOrderId
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            });
            
            if (correlations.length > 0) {
              const correlation = correlations[0];
              
              orderInfo = {
                orderId: numericOrderId,
                orderName: correlation.orderName,
                totalAmount: correlation.totalAmount,
                currency: correlation.currency,
                customerEmail: correlation.customerEmail,
                customerPhone: correlation.customerPhone,
                customerId: correlation.customerId
              };
              
              // Try to get customer profile by phone
              if (correlation.customerPhone) {
                customerData = await getCustomerProfileByPhone(correlation.customerPhone);
              }
            } else {
              logger.warn("Order not found in database", {
                component: "getOrderData",
                orderId: numericOrderId
              });
            }
          }
        } catch (error) {
          logger.error("Error fetching order from database", {
            component: "getOrderData",
            orderId: numericOrderId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
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
    }, { 
      status: 500,
      headers: getCorsHeaders()
    });
  }
}

/**
 * Get CORS headers for Shopify extensions
 */
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
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
  // Ensure we have customer identifiers either in customer data or orderInfo
  const finalCustomerPhone = customerData?.phone || orderInfo?.customerPhone || customerPhone;
  const finalCustomerEmail = customerData?.email || orderInfo?.customerEmail;

  // Create a guest customer fallback if we have no customer data but have identifiers
  let guestCustomerFallback = null;
  if (!customerData && (finalCustomerPhone || finalCustomerEmail)) {
    guestCustomerFallback = {
      id: null,
      phone: finalCustomerPhone,
      email: finalCustomerEmail,
      riskLevel: 'unknown',
      riskScore: 0,
      riskFactors: [],
      orderCount: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      returnRate: 0,
      chargebackCount: 0,
      fraudReports: 0,
      lastOrderDate: null,
      createdAt: null,
      updatedAt: null
    };
  }

  const responseData = {
    orderInfo: orderInfo ? {
      ...orderInfo,
      customerPhone: finalCustomerPhone,
      customerEmail: finalCustomerEmail
    } : null,
    customer: customerData ? {
      id: customerData.id,
      phone: finalCustomerPhone,
      email: finalCustomerEmail,
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
    } : guestCustomerFallback,
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

  // If no data found at all, provide informative message
  if (!customerData && !orderInfo && !guestCustomerFallback) {
    return json({
      ...responseData,
      message: "No customer data found for the provided identifiers. This may be a guest order or the order hasn't been processed by our webhooks yet."
    }, { 
      status: 404,
      headers: getCorsHeaders()
    });
  }

  return json(responseData, {
    headers: getCorsHeaders()
  });
}