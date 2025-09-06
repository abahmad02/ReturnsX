import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";
import prisma from "../db.server";

/**
 * Dual Tagging Service for ReturnsX
 * 
 * Tags BOTH customers and orders with risk-based tags using GraphQL
 * Fetches risk scores from database and applies appropriate tags
 */

export interface DualTaggingConfig {
  shopDomain: string;
  enableTagging: boolean;
  tagPrefix: string;
  riskTags: {
    zeroRisk: string;
    mediumRisk: string;
    highRisk: string;
  };
  removeOldTags: boolean;
}

export interface TaggingResult {
  success: boolean;
  customerTagged?: boolean;
  orderTagged?: boolean;
  customerId?: string;
  orderId?: string;
  appliedTag?: string;
  error?: string;
  details?: any;
}

/**
 * Get default dual tagging configuration
 */
export function getDefaultDualTaggingConfig(shopDomain: string): DualTaggingConfig {
  return {
    shopDomain,
    enableTagging: true,
    tagPrefix: "ReturnsX",
    riskTags: {
      zeroRisk: "ReturnsX: Zero Risk ✅",
      mediumRisk: "ReturnsX: Medium Risk ⚠️", 
      highRisk: "ReturnsX: High Risk ❌",
    },
    removeOldTags: true,
  };
}

/**
 * Find Shopify customer by phone or email using GraphQL
 */
export async function findShopifyCustomerGraphQL(
  admin: any,
  phone?: string,
  email?: string
): Promise<{ id: string; tags: string[] } | null> {
  try {
    let query = "";
    
    if (phone) {
      // Normalize phone for search
      const normalizedPhone = phone.replace(/\D/g, '');
      query = `phone:*${normalizedPhone.slice(-10)}`; // Last 10 digits for better matching
    } else if (email) {
      query = `email:${email}`;
    } else {
      return null;
    }

    const response = await admin.graphql(
      `#graphql
        query findCustomer($query: String!) {
          customers(first: 5, query: $query) {
            edges {
              node {
                id
                phone
                email
                tags
              }
            }
          }
        }`,
      {
        variables: { query }
      }
    );

    const responseData = await response.json();
    
    logger.info("GraphQL customer search response", {
      query,
      hasData: !!responseData.data,
      hasCustomers: !!responseData.data?.customers,
      customerCount: responseData.data?.customers?.edges?.length || 0,
      errors: responseData.errors,
    });
    
    if (responseData.data?.customers?.edges?.length > 0) {
      const customer = responseData.data.customers.edges[0].node;
      
      logger.info("Found Shopify customer", {
        customerId: customer.id,
        hasPhone: !!customer.phone,
        hasEmail: !!customer.email,
        tagsType: typeof customer.tags,
        tagsValue: customer.tags,
      });
      
      return {
        id: customer.id,
        tags: customer.tags && typeof customer.tags === 'string' ? customer.tags.split(', ') : [],
      };
    }

    return null;

  } catch (error) {
    logger.error("Error finding Shopify customer via GraphQL", { 
      phone: phone?.substring(0, 3) + "***", 
      email 
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Update customer tags using GraphQL
 */
export async function updateCustomerTagsGraphQL(
  admin: any,
  customerId: string,
  newTags: string[],
  config: DualTaggingConfig
): Promise<{ success: boolean; previousTags?: string[]; newTags?: string[]; error?: string }> {
  try {
    // First get current customer data
    const response = await admin.graphql(
      `#graphql
        query getCustomer($id: ID!) {
          customer(id: $id) {
            id
            tags
          }
        }`,
      {
        variables: { id: customerId }
      }
    );

    const { data } = await response.json();
    if (!data?.customer) {
      return { success: false, error: "Customer not found" };
    }

    const currentTags = data.customer.tags && typeof data.customer.tags === 'string' ? data.customer.tags.split(', ') : [];
    let updatedTags = [...currentTags];

    // Remove old ReturnsX risk tags if configured
    if (config.removeOldTags) {
      const oldRiskTags = Object.values(config.riskTags);
      updatedTags = updatedTags.filter(tag => !oldRiskTags.includes(tag));
    }

    // Add new tags
    for (const newTag of newTags) {
      if (!updatedTags.includes(newTag)) {
        updatedTags.push(newTag);
      }
    }

    // Update customer with new tags
    const updateResponse = await admin.graphql(
      `#graphql
        mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: {
            id: customerId,
            tags: updatedTags.join(', ')
          }
        }
      }
    );

    const updateResult = await updateResponse.json();
    
    if (updateResult.data?.customerUpdate?.userErrors?.length > 0) {
      const errors = updateResult.data.customerUpdate.userErrors.map((err: any) => err.message).join(', ');
      return { success: false, error: `GraphQL error: ${errors}` };
    }

    return {
      success: true,
      previousTags: currentTags,
      newTags: updatedTags,
    };

  } catch (error) {
    logger.error("Error updating customer tags via GraphQL", { customerId }, error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Add tags to an order using GraphQL
 */
export async function addOrderTagsGraphQL(
  admin: any,
  orderId: string,
  newTags: string[],
  config: DualTaggingConfig
): Promise<{ success: boolean; previousTags?: string[]; newTags?: string[]; error?: string }> {
  try {
    // First get current order data
    const response = await admin.graphql(
      `#graphql
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            tags
          }
        }`,
      {
        variables: { id: `gid://shopify/Order/${orderId}` }
      }
    );

    const responseData = await response.json();
    
    logger.info("GraphQL order lookup response", {
      orderId,
      hasData: !!responseData.data,
      hasOrder: !!responseData.data?.order,
      errors: responseData.errors,
    });
    
    if (!responseData.data?.order) {
      return { success: false, error: "Order not found" };
    }

    const order = responseData.data.order;
    logger.info("Found Shopify order", {
      orderId: order.id,
      tagsType: typeof order.tags,
      tagsValue: order.tags,
    });

    const currentTags = order.tags && typeof order.tags === 'string' ? order.tags.split(', ') : [];
    let updatedTags = [...currentTags];

    // Remove old ReturnsX risk tags if configured
    if (config.removeOldTags) {
      const oldRiskTags = Object.values(config.riskTags);
      updatedTags = updatedTags.filter(tag => !oldRiskTags.includes(tag));
    }

    // Add new tags
    for (const newTag of newTags) {
      if (!updatedTags.includes(newTag)) {
        updatedTags.push(newTag);
      }
    }

    // Update order with new tags
    const updateResponse = await admin.graphql(
      `#graphql
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: {
            id: `gid://shopify/Order/${orderId}`,
            tags: updatedTags.join(', ')
          }
        }
      }
    );

    const updateResult = await updateResponse.json();
    
    if (updateResult.data?.orderUpdate?.userErrors?.length > 0) {
      const errors = updateResult.data.orderUpdate.userErrors.map((err: any) => err.message).join(', ');
      return { success: false, error: `GraphQL error: ${errors}` };
    }

    return {
      success: true,
      previousTags: currentTags,
      newTags: updatedTags,
    };

  } catch (error) {
    logger.error("Error updating order tags via GraphQL", { orderId }, error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get customer risk data from database
 */
export async function getCustomerRiskFromDatabase(
  phone?: string,
  email?: string
): Promise<{ riskTier: "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK"; riskScore: number } | null> {
  try {
    if (!phone && !email) {
      return null;
    }

    // Normalize phone for database lookup
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;

    // Find customer profile in database
    const profile = await (prisma as any).customerProfile.findFirst({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ]
      }
    });

    if (!profile) {
      // New customer - default to zero risk
      return { riskTier: "ZERO_RISK", riskScore: 0 };
    }

    return {
      riskTier: profile.riskTier,
      riskScore: parseFloat(profile.riskScore.toString()),
    };

  } catch (error) {
    logger.error("Error fetching customer risk from database", { 
      phone: phone?.substring(0, 3) + "***", 
      email 
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Apply risk tags to both customer and order
 */
export async function applyDualRiskTags(
  admin: any,
  customerData: { phone?: string; email?: string },
  orderId: string,
  shopDomain: string,
  config?: DualTaggingConfig
): Promise<TaggingResult> {
  try {
    const taggingConfig = config || getDefaultDualTaggingConfig(shopDomain);
    
    if (!taggingConfig.enableTagging) {
      return {
        success: true,
        error: "Tagging disabled for this shop",
      };
    }

    // Step 1: Get customer risk from database
    const riskData = await getCustomerRiskFromDatabase(customerData.phone, customerData.email);
    
    if (!riskData) {
      return {
        success: false,
        error: "Could not determine customer risk",
      };
    }

    // Step 2: Determine the appropriate tag
    let riskTag: string;
    switch (riskData.riskTier) {
      case "ZERO_RISK":
        riskTag = taggingConfig.riskTags.zeroRisk;
        break;
      case "MEDIUM_RISK":
        riskTag = taggingConfig.riskTags.mediumRisk;
        break;
      case "HIGH_RISK":
        riskTag = taggingConfig.riskTags.highRisk;
        break;
      default:
        riskTag = taggingConfig.riskTags.zeroRisk;
    }

    let customerTagged = false;
    let orderTagged = false;
    let shopifyCustomerId: string | undefined;

    // Step 3: Tag the customer
    try {
      const shopifyCustomer = await findShopifyCustomerGraphQL(
        admin,
        customerData.phone,
        customerData.email
      );

      if (shopifyCustomer) {
        const customerResult = await updateCustomerTagsGraphQL(
          admin,
          shopifyCustomer.id,
          [riskTag],
          taggingConfig
        );

        if (customerResult.success) {
          customerTagged = true;
          shopifyCustomerId = shopifyCustomer.id;
          
          logger.info("Customer risk tag applied successfully", {
            shopDomain,
            customerId: shopifyCustomer.id,
            riskTier: riskData.riskTier,
            riskScore: riskData.riskScore,
            appliedTag: riskTag,
          });
        } else {
          logger.warn("Failed to apply customer risk tag", {
            shopDomain,
            error: customerResult.error,
          });
        }
      } else {
        logger.info("Shopify customer not found for tagging", {
          shopDomain,
          hasPhone: !!customerData.phone,
          hasEmail: !!customerData.email,
        });
      }
    } catch (customerError) {
      logger.error("Error tagging customer", {
        shopDomain,
      }, customerError instanceof Error ? customerError : new Error(String(customerError)));
    }

    // Step 4: Tag the order
    try {
      const orderResult = await addOrderTagsGraphQL(
        admin,
        orderId,
        [riskTag],
        taggingConfig
      );

      if (orderResult.success) {
        orderTagged = true;
        
        logger.info("Order risk tag applied successfully", {
          shopDomain,
          orderId,
          riskTier: riskData.riskTier,
          riskScore: riskData.riskScore,
          appliedTag: riskTag,
        });
      } else {
        logger.warn("Failed to apply order risk tag", {
          shopDomain,
          orderId,
          error: orderResult.error,
        });
      }
    } catch (orderError) {
      logger.error("Error tagging order", {
        shopDomain,
        orderId,
      }, orderError instanceof Error ? orderError : new Error(String(orderError)));
    }

    // Step 5: Log the dual tagging action for audit
    if (customerTagged || orderTagged) {
      await createAuditLog({
        eventType: AuditEventType.CUSTOMER_PROFILE_UPDATED,
        userId: "system",
        shopDomain,
        details: {
          action: "dual_risk_tagging",
          customerId: shopifyCustomerId,
          orderId,
          customerPhone: customerData.phone?.substring(0, 3) + "***",
          riskTier: riskData.riskTier,
          riskScore: riskData.riskScore,
          appliedTag: riskTag,
          customerTagged,
          orderTagged,
        },
      });
    }

    return {
      success: customerTagged || orderTagged,
      customerTagged,
      orderTagged,
      customerId: shopifyCustomerId,
      orderId,
      appliedTag: riskTag,
      details: {
        riskTier: riskData.riskTier,
        riskScore: riskData.riskScore,
      },
    };

  } catch (error) {
    logger.error("Error applying dual risk tags", {
      shopDomain,
      orderId,
      hasPhone: !!customerData.phone,
      hasEmail: !!customerData.email,
    }, error instanceof Error ? error : new Error(String(error)));

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch apply dual risk tags to multiple orders
 */
export async function batchApplyDualRiskTags(
  admin: any,
  orders: Array<{
    orderId: string;
    phone?: string;
    email?: string;
  }>,
  shopDomain: string,
  config?: DualTaggingConfig
): Promise<{
  successful: number;
  failed: number;
  results: TaggingResult[];
}> {
  const results: TaggingResult[] = [];
  let successful = 0;
  let failed = 0;

  logger.info("Starting batch dual risk tag application", {
    shopDomain,
    orderCount: orders.length,
  });

  for (const order of orders) {
    try {
      const result = await applyDualRiskTags(
        admin,
        { phone: order.phone, email: order.email },
        order.orderId,
        shopDomain,
        config
      );

      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      failed++;
      results.push({
        success: false,
        orderId: order.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Batch dual risk tag application completed", {
    shopDomain,
    successful,
    failed,
    total: orders.length,
  });

  return {
    successful,
    failed,
    results,
  };
}
