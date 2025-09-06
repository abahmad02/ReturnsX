import { logger } from "./logger.server";
import { createAuditLog, AuditEventType } from "./auditLog.server";

/**
 * Customer Tagging Service for ReturnsX
 * 
 * Automatically applies risk-based tags to Shopify customers
 * so merchants can see risk levels directly in their admin dashboard
 */

export interface CustomerTaggingConfig {
  shopDomain: string;
  enableTagging: boolean;
  tagPrefix: string; // e.g., "ReturnsX" -> "ReturnsX: High Risk"
  riskTags: {
    zeroRisk: string;
    mediumRisk: string;
    highRisk: string;
  };
  removeOldTags: boolean; // Whether to remove previous risk tags when updating
}

export interface ShopifyCustomer {
  id: string;
  phone?: string;
  email?: string;
  tags?: string;
}

export interface TaggingResult {
  success: boolean;
  customerId?: string;
  previousTags?: string[];
  newTags?: string[];
  error?: string;
}

/**
 * Get default tagging configuration
 */
export function getDefaultTaggingConfig(shopDomain: string): CustomerTaggingConfig {
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
 * Find Shopify customer by phone or email
 */
export async function findShopifyCustomer(
  admin: any,
  phone?: string,
  email?: string
): Promise<ShopifyCustomer | null> {
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

    const { data } = await response.json();
    
    if (data?.customers?.edges?.length > 0) {
      // Return the first matching customer
      const customer = data.customers.edges[0].node;
      return {
        id: customer.id,
        phone: customer.phone,
        email: customer.email,
        tags: customer.tags,
      };
    }

    return null;

  } catch (error) {
    logger.error("Error finding Shopify customer", { phone: phone?.substring(0, 3) + "***", email }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Update customer tags in Shopify
 */
export async function updateCustomerTags(
  admin: any,
  customerId: string,
  newTags: string[],
  config: CustomerTaggingConfig
): Promise<TaggingResult> {
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
      return {
        success: false,
        error: "Customer not found",
      };
    }

    const currentTags = data.customer.tags ? data.customer.tags.split(', ') : [];
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
      return {
        success: false,
        error: `Shopify API error: ${errors}`,
      };
    }

    return {
      success: true,
      customerId,
      previousTags: currentTags,
      newTags: updatedTags,
    };

  } catch (error) {
    logger.error("Error updating customer tags", { customerId }, error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      customerId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply risk-based tag to a customer
 */
export async function applyRiskTag(
  admin: any,
  riskTier: "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK",
  customerData: { phone?: string; email?: string },
  shopDomain: string,
  config?: CustomerTaggingConfig
): Promise<TaggingResult> {
  try {
    const taggingConfig = config || getDefaultTaggingConfig(shopDomain);
    
    if (!taggingConfig.enableTagging) {
      return {
        success: true,
        error: "Tagging disabled for this shop",
      };
    }

    // Find the Shopify customer
    const shopifyCustomer = await findShopifyCustomer(
      admin,
      customerData.phone,
      customerData.email
    );

    if (!shopifyCustomer) {
      logger.info("Shopify customer not found for tagging", {
        shopDomain,
        hasPhone: !!customerData.phone,
        hasEmail: !!customerData.email,
      });
      return {
        success: false,
        error: "Shopify customer not found",
      };
    }

    // Determine the appropriate tag
    let riskTag: string;
    switch (riskTier) {
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

    // Update the customer tags
    const result = await updateCustomerTags(
      admin,
      shopifyCustomer.id,
      [riskTag],
      taggingConfig
    );

    if (result.success) {
      // Log the tagging action for audit
      await createAuditLog({
        eventType: AuditEventType.CUSTOMER_PROFILE_UPDATED,
        userId: "system",
        shopDomain,
        details: {
          action: "risk_tag_applied",
          customerId: shopifyCustomer.id,
          customerPhone: customerData.phone?.substring(0, 3) + "***",
          riskTier,
          appliedTag: riskTag,
          previousTags: result.previousTags,
          newTags: result.newTags,
        },
      });

      logger.info("Risk tag applied successfully", {
        shopDomain,
        customerId: shopifyCustomer.id,
        riskTier,
        appliedTag: riskTag,
      });
    }

    return result;

  } catch (error) {
    logger.error("Error applying risk tag", {
      shopDomain,
      riskTier,
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
 * Batch apply risk tags to multiple customers
 */
export async function batchApplyRiskTags(
  admin: any,
  customers: Array<{
    riskTier: "ZERO_RISK" | "MEDIUM_RISK" | "HIGH_RISK";
    phone?: string;
    email?: string;
  }>,
  shopDomain: string,
  config?: CustomerTaggingConfig
): Promise<{
  successful: number;
  failed: number;
  results: TaggingResult[];
}> {
  const results: TaggingResult[] = [];
  let successful = 0;
  let failed = 0;

  logger.info("Starting batch risk tag application", {
    shopDomain,
    customerCount: customers.length,
  });

  for (const customer of customers) {
    try {
      const result = await applyRiskTag(
        admin,
        customer.riskTier,
        { phone: customer.phone, email: customer.email },
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
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      failed++;
      results.push({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Batch risk tag application completed", {
    shopDomain,
    successful,
    failed,
    total: customers.length,
  });

  return {
    successful,
    failed,
    results,
  };
}

/**
 * Remove all ReturnsX tags from a customer
 */
export async function removeRiskTags(
  admin: any,
  customerData: { phone?: string; email?: string },
  shopDomain: string,
  config?: CustomerTaggingConfig
): Promise<TaggingResult> {
  try {
    const taggingConfig = config || getDefaultTaggingConfig(shopDomain);
    
    // Find the Shopify customer
    const shopifyCustomer = await findShopifyCustomer(
      admin,
      customerData.phone,
      customerData.email
    );

    if (!shopifyCustomer) {
      return {
        success: false,
        error: "Shopify customer not found",
      };
    }

    // Get current tags and remove ReturnsX risk tags
    const currentTags = shopifyCustomer.tags ? shopifyCustomer.tags.split(', ') : [];
    const riskTags = Object.values(taggingConfig.riskTags);
    const updatedTags = currentTags.filter(tag => !riskTags.includes(tag));

    // Update customer with filtered tags
    const result = await updateCustomerTags(
      admin,
      shopifyCustomer.id,
      updatedTags,
      { ...taggingConfig, removeOldTags: false } // Don't double-filter
    );

    if (result.success) {
      await createAuditLog({
        eventType: AuditEventType.CUSTOMER_PROFILE_UPDATED,
        userId: "system",
        shopDomain,
        details: {
          action: "risk_tags_removed",
          customerId: shopifyCustomer.id,
          customerPhone: customerData.phone?.substring(0, 3) + "***",
          removedTags: riskTags,
        },
      });
    }

    return result;

  } catch (error) {
    logger.error("Error removing risk tags", {
      shopDomain,
      hasPhone: !!customerData.phone,
      hasEmail: !!customerData.email,
    }, error instanceof Error ? error : new Error(String(error)));

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
