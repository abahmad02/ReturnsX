import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getCheckoutCorrelation } from "../services/checkoutCorrelation.server";
import { getCustomerProfileByPhone } from "../services/customerProfile.server";
import { logger } from "../services/logger.server";
import prisma from "../db.server";

// Import optimization services
import { requestDeduplicator, RequestParams } from "../services/requestDeduplicator.server";
import { EnhancedCircuitBreaker, CircuitBreakerError, DEFAULT_ENHANCED_CONFIG } from "../services/enhancedCircuitBreaker.server";
import { getCache } from "../services/intelligentCache.server";
import { securityValidator, ValidatedParams } from "../services/securityValidator.server";
import { responseFormatter, ResponseMetadata } from "../services/responseFormatter.server";
import { apiLogger } from "../services/apiLogger.server";
import { ErrorFactory, ApiError } from "../services/apiError.server";
import { randomUUID } from 'crypto';

// Initialize optimization services
const circuitBreaker = new EnhancedCircuitBreaker({
  ...DEFAULT_ENHANCED_CONFIG,
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  requestTimeout: 10000,   // 10 seconds
});

const cache = getCache({
  defaultTTL: 5 * 60 * 1000,        // 5 minutes
  maxSize: 500,                      // 500 entries
  backgroundRefreshThreshold: 0.2,   // Refresh when 20% TTL remaining
  compressionEnabled: true,
  compressionThreshold: 1024,        // 1KB
});

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
 * Handle non-GET requests (POST, PUT, DELETE, etc.)
 */
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return responseFormatter.options();
  }
  
  const requestId = randomUUID();
  const startTime = Date.now();
  
  apiLogger.logRequest(
    requestId,
    request.method,
    '/api/get-order-data',
    {},
    request.headers.get('user-agent') || undefined,
    request.headers.get('x-forwarded-for') || undefined
  );
  
  const metadata = responseFormatter.createMetadata(requestId, startTime);
  
  apiLogger.logResponse(requestId, 405, Date.now() - startTime);
  
  return responseFormatter.error(
    ErrorFactory.validation('Method not allowed', 'METHOD_NOT_ALLOWED'),
    metadata
  );
}

/**
 * Optimized API endpoint to get order data based on checkout token
 * Integrates deduplication, circuit breaker, caching, and comprehensive error handling
 * Used by the extension to fetch customer risk data
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const requestId = randomUUID();
  
  // Handle OPTIONS request for CORS preflight
  if (request.method === "OPTIONS") {
    return responseFormatter.options();
  }

  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || undefined;
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;

  // Log incoming request
  apiLogger.logRequest(
    requestId,
    request.method,
    '/api/get-order-data',
    Object.fromEntries(url.searchParams.entries()),
    userAgent,
    ipAddress
  );

  try {
    // Step 1: Input validation and sanitization
    const validationResult = securityValidator.validateInput(url.searchParams);
    
    if (!validationResult.isValid) {
      apiLogger.logValidationErrors(requestId, validationResult.errors);
      
      const metadata = responseFormatter.createMetadata(requestId, startTime);
      apiLogger.logResponse(requestId, 400, Date.now() - startTime);
      
      return responseFormatter.validationError(
        validationResult.errors,
        metadata
      );
    }

    const validatedParams = validationResult.sanitizedValue as ValidatedParams;
    
    // Step 2: Generate deduplication key
    const requestParams: RequestParams = {
      checkoutToken: validatedParams.checkoutToken,
      customerPhone: validatedParams.customerPhone,
      orderName: validatedParams.orderName,
      orderId: validatedParams.orderId
    };
    
    const deduplicationKey = requestDeduplicator.generateRequestKey(requestParams);
    
    // Step 3: Execute with deduplication and circuit breaker
    const result = await requestDeduplicator.registerRequest(
      deduplicationKey,
      () => executeOptimizedRequest(validatedParams, requestId, startTime),
      requestId
    );

    return result;

  } catch (error) {
    // Handle any unexpected errors
    apiLogger.logError(requestId, error instanceof Error ? error : new Error(String(error)));
    
    const metadata = responseFormatter.createMetadata(requestId, startTime);
    apiLogger.logResponse(requestId, 500, Date.now() - startTime, undefined, false, 0, 
      error instanceof Error ? error.message : String(error));
    
    if (error instanceof ApiError) {
      return responseFormatter.error(error, metadata);
    }
    
    return responseFormatter.internalError(
      metadata,
      'An unexpected error occurred'
    );
  }
}

/**
 * Execute optimized request with circuit breaker and caching
 */
async function executeOptimizedRequest(
  validatedParams: ValidatedParams,
  requestId: string,
  startTime: number
): Promise<Response> {
  const queryStartTime = Date.now();
  let queryCount = 0;
  let cacheHit = false;
  let deduplicationHit = false;

  try {
    // Step 1: Check cache first
    const cacheKey = generateCacheKey(validatedParams);
    let cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      cacheHit = true;
      apiLogger.logCacheOperation(requestId, 'hit', cacheKey);
      
      const metadata = responseFormatter.createMetadata(requestId, startTime, {
        cacheHit: true,
        dataSource: 'cache',
        queryCount: 0,
        deduplicationHit
      });
      
      apiLogger.logResponse(requestId, 200, Date.now() - startTime, 
        JSON.stringify(cachedData).length, true, 0);
      
      return responseFormatter.success(cachedData, metadata);
    }

    apiLogger.logCacheOperation(requestId, 'miss', cacheKey);

    // Step 2: Execute database operations with circuit breaker
    const orderData = await circuitBreaker.execute(async () => {
      return await getOrderDataWithOptimization(validatedParams, requestId);
    }, 'getOrderData');

    queryCount = orderData.queryCount || 0;
    const queryTime = Date.now() - queryStartTime;

    // Step 3: Cache the result
    if (orderData.data) {
      await cache.set(cacheKey, orderData.data, 5 * 60 * 1000); // 5 minutes TTL
      apiLogger.logCacheOperation(requestId, 'set', cacheKey, 5 * 60 * 1000, 
        JSON.stringify(orderData.data).length);
    }

    // Step 4: Format and return response
    const metadata = responseFormatter.createMetadata(requestId, startTime, {
      cacheHit: false,
      dataSource: 'database',
      queryCount,
      deduplicationHit,
      circuitBreakerState: circuitBreaker.getState()
    });

    apiLogger.logPerformanceMetrics(requestId, {
      responseTime: Date.now() - startTime,
      queryTime,
      memoryUsage: process.memoryUsage().heapUsed
    });

    if (!orderData.data) {
      apiLogger.logResponse(requestId, 404, Date.now() - startTime, 0, false, queryCount);
      return responseFormatter.notFound(
        orderData.message || 'No customer data found for the provided identifiers',
        metadata,
        orderData.debug
      );
    }

    apiLogger.logResponse(requestId, 200, Date.now() - startTime, 
      JSON.stringify(orderData.data).length, false, queryCount);
    
    return responseFormatter.success(orderData.data, metadata, orderData.message, orderData.debug);

  } catch (error) {
    apiLogger.logError(requestId, error instanceof Error ? error : new Error(String(error)));
    
    if (error instanceof CircuitBreakerError) {
      apiLogger.logCircuitBreakerEvent(requestId, 'trip', circuitBreaker.getState());
      
      const metadata = responseFormatter.createMetadata(requestId, startTime, {
        circuitBreakerState: circuitBreaker.getState()
      });
      
      apiLogger.logResponse(requestId, 503, Date.now() - startTime, 0, false, queryCount);
      
      return responseFormatter.circuitBreakerOpen(metadata, error.retryAfter);
    }

    throw error;
  }
}

/**
 * Generate cache key for request parameters
 */
function generateCacheKey(params: ValidatedParams): string {
  const keyParts: string[] = [];
  
  if (params.checkoutToken) keyParts.push(`ct:${params.checkoutToken}`);
  if (params.customerPhone) keyParts.push(`ph:${params.customerPhone}`);
  if (params.orderName) keyParts.push(`on:${params.orderName}`);
  if (params.orderId) keyParts.push(`oi:${params.orderId}`);
  
  return `order-data:${keyParts.join('|')}`;
}

/**
 * Get order data with database optimization
 */
async function getOrderDataWithOptimization(
  params: ValidatedParams,
  requestId: string
): Promise<{
  data?: any;
  message?: string;
  debug?: any;
  queryCount: number;
}> {
  let queryCount = 0;
  let customerData = null;
  let orderInfo = null;

  try {
    // Try to get correlation data by checkout token first
    if (params.checkoutToken) {
      queryCount++;
      const correlation = await getCheckoutCorrelation(params.checkoutToken);
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
          try {
            queryCount++;
            customerData = await getCustomerProfileByPhone(correlation.customerPhone);
          } catch (error) {
            // Customer lookup failed - log but don't throw
            apiLogger.logWarning(requestId, "Customer lookup failed in checkout correlation", {
              phone: correlation.customerPhone.substring(0, 3) + "***",
              error: error instanceof Error ? error.message : String(error)
            });
            customerData = null;
          }
        }
      }
    }

    // If no data yet and we have orderId, try to extract and lookup from internal database
    if (!customerData && !orderInfo && params.orderId) {
      const numericOrderId = params.orderId;
      
      apiLogger.logInfo(requestId, "Looking up order by numeric ID", { 
        originalOrderId: params.orderId,
        extractedNumericOrderId: numericOrderId 
      });
      
      if (numericOrderId && numericOrderId !== '0' && Number.isFinite(Number(numericOrderId))) {
        try {
          // Look up order events in our database to find customer data
          queryCount++;
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
            queryCount++;
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
                try {
                  queryCount++;
                  customerData = await getCustomerProfileByPhone(correlation.customerPhone);
                } catch (error) {
                  // Customer lookup failed - log but don't throw
                  apiLogger.logWarning(requestId, "Customer lookup failed in correlation", {
                    phone: correlation.customerPhone.substring(0, 3) + "***",
                    error: error instanceof Error ? error.message : String(error)
                  });
                  customerData = null;
                }
              }
            } else {
              apiLogger.logWarning(requestId, "Order not found in database", {
                orderId: numericOrderId
              });
            }
          }
        } catch (error) {
          apiLogger.logError(requestId, error instanceof Error ? error : new Error(String(error)), {
            orderId: numericOrderId,
            operation: 'database_lookup'
          });
          
          // Check if this is a database connection error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Authentication failed') || 
              errorMessage.includes('Connection refused') ||
              errorMessage.includes('database server') ||
              errorMessage.includes('ECONNREFUSED')) {
            // For database connection issues, return 404 instead of 500
            // This allows the API to degrade gracefully
            apiLogger.logWarning(requestId, "Database unavailable, returning not found", {
              orderId: numericOrderId,
              error: errorMessage
            });
            // Don't throw - just continue without database data
          } else {
            // For other database errors, still throw
            throw ErrorFactory.database('Error fetching order from database', true, {
              requestId,
              orderId: numericOrderId
            });
          }
        }
      }
    }

    // If no data yet and we have customerPhone, try direct customer lookup
    if (!customerData && params.customerPhone) {
      try {
        queryCount++;
        customerData = await getCustomerProfileByPhone(params.customerPhone);
      } catch (error) {
        // Customer lookup failed - log but don't throw
        apiLogger.logWarning(requestId, "Customer lookup failed, continuing without data", {
          phone: params.customerPhone.substring(0, 3) + "***",
          error: error instanceof Error ? error.message : String(error)
        });
        customerData = null;
      }
    }

    return formatOptimizedResponse(orderInfo, customerData, params, queryCount);

  } catch (error) {
    apiLogger.logError(requestId, error instanceof Error ? error : new Error(String(error)), {
      operation: 'getOrderDataWithOptimization',
      params: securityValidator.sanitizeForLogging(params)
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw ErrorFactory.database('Database operation failed', true, {
      requestId,
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Format the optimized API response data
 */
function formatOptimizedResponse(
  orderInfo: any, 
  customerData: any, 
  params: ValidatedParams,
  queryCount: number
): {
  data?: any;
  message?: string;
  debug?: any;
  queryCount: number;
} {
  // Ensure we have customer identifiers either in customer data or orderInfo
  const finalCustomerPhone = customerData?.phone || orderInfo?.customerPhone || params.customerPhone;
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
    } : guestCustomerFallback
  };

  const debug = {
    searchParams: securityValidator.sanitizeForLogging({
      checkoutToken: params.checkoutToken,
      customerPhone: params.customerPhone,
      orderName: params.orderName,
      orderId: params.orderId
    }),
    foundCorrelation: !!orderInfo,
    foundCustomer: !!customerData,
    timestamp: new Date().toISOString(),
    queryCount
  };

  // If no data found at all, return not found
  if (!customerData && !orderInfo && !guestCustomerFallback) {
    return {
      message: "No customer data found for the provided identifiers. This may be a guest order or the order hasn't been processed by our webhooks yet.",
      debug,
      queryCount
    };
  }

  return {
    data: responseData,
    debug,
    queryCount
  };
}