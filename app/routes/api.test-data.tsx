import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { hashEmail, hashPhoneNumber } from "../utils/crypto.server";
import { logger } from "../services/logger.server";

/**
 * API endpoint to create test customer data for ReturnsX testing
 * POST /api/test-data
 */

const TEST_CUSTOMERS = [
  // Zero Risk Customers (should see success messages)
  {
    email: 'good.customer@test.com',
    phone: '+923001234567',
    riskScore: 5,
    riskTier: 'ZERO_RISK',
    orderCount: 15,
    returnCount: 1,
    averageOrderValue: 85.50,
    notes: 'Excellent customer - always pays on time, minimal returns'
  },
  {
    email: 'ahmed.khan@test.com', 
    phone: '+923001234568',
    riskScore: 8,
    riskTier: 'ZERO_RISK',
    orderCount: 22,
    returnCount: 0,
    averageOrderValue: 120.00,
    notes: 'VIP customer - high value, zero returns'
  },
  {
    email: 'fatima.ali@test.com',
    phone: '+923001234569',
    riskScore: 12,
    riskTier: 'ZERO_RISK', 
    orderCount: 8,
    returnCount: 0,
    averageOrderValue: 65.00,
    notes: 'Reliable customer - consistent orders'
  },

  // Medium Risk Customers (should see warning messages)
  {
    email: 'medium.risk@test.com',
    phone: '+923005555555',
    riskScore: 45,
    riskTier: 'MEDIUM_RISK',
    orderCount: 12,
    returnCount: 3,
    averageOrderValue: 75.00,
    notes: 'Some returns but generally okay'
  },
  {
    email: 'bilal.hussain@test.com',
    phone: '+923009876544',
    riskScore: 52,
    riskTier: 'MEDIUM_RISK',
    orderCount: 6,
    returnCount: 2,
    averageOrderValue: 45.00,
    notes: 'Moderate risk - watch closely'
  },

  // High Risk Customers (should see COD restrictions)
  {
    email: 'risky.customer@test.com',
    phone: '+923009876543',
    riskScore: 85,
    riskTier: 'HIGH_RISK',
    orderCount: 10,
    returnCount: 7,
    averageOrderValue: 150.00,
    notes: 'High return rate - requires deposit for COD'
  },
  {
    email: 'problem.user@test.com',
    phone: '+923009999998',
    riskScore: 92,
    riskTier: 'HIGH_RISK',
    orderCount: 5,
    returnCount: 4,
    averageOrderValue: 200.00,
    notes: 'Multiple payment issues - high risk'
  },
  {
    email: 'fraud.alert@test.com',
    phone: '+923009999997',
    riskScore: 95,
    riskTier: 'HIGH_RISK',
    orderCount: 3,
    returnCount: 3,
    averageOrderValue: 300.00,
    notes: 'Suspected fraud - manual review required'
  }
];

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { action: actionType, shopDomain = 'returnsx123.myshopify.com' } = body;

    logger.info("Test data API called", {
      action: actionType,
      shopDomain,
      component: "testDataAPI"
    });

    switch (actionType) {
      case "create_customers":
        return await createTestCustomers(shopDomain);
      
      case "clear_test_data":
        return await clearTestData(shopDomain);
      
      case "get_test_data":
        return await getTestDataStatus(shopDomain);
      
      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    logger.error("Test data API error", {
      error: error instanceof Error ? error.message : String(error),
      component: "testDataAPI"
    });
    
    return json({ 
      error: "Failed to process request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};

async function createTestCustomers(shopDomain: string) {
  const created = [];
  const updated = [];
  const errors = [];

  for (const customer of TEST_CUSTOMERS) {
    try {
      const emailHash = await hashEmail(customer.email);
      const phoneHash = await hashPhoneNumber(customer.phone);
      
      // Calculate some realistic dates
      const daysAgo = Math.floor(Math.random() * 90) + 1;
      const lastOrderDaysAgo = Math.floor(Math.random() * 30) + 1;
      
      const customerData = {
        emailHash,
        phoneHash,
        riskScore: customer.riskScore,
        riskTier: customer.riskTier as 'ZERO_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK',
        totalOrders: customer.orderCount,
        returnRate: (customer.returnCount / customer.orderCount) * 100,
        lastEventAt: new Date(Date.now() - lastOrderDaysAgo * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      };

      // Try to create or update (check by phoneHash since it's unique)
      const existing = await db.customerProfile.findFirst({
        where: {
          phoneHash
        }
      });

      if (existing) {
        // Update existing
        await db.customerProfile.update({
          where: { id: existing.id },
          data: {
            emailHash: customerData.emailHash,
            riskScore: customerData.riskScore,
            riskTier: customerData.riskTier,
            totalOrders: customerData.totalOrders,
            returnRate: customerData.returnRate,
            lastEventAt: customerData.lastEventAt,
            updatedAt: customerData.updatedAt
          }
        });
        updated.push({ email: customer.email, riskTier: customer.riskTier });
      } else {
        // Create new
        await db.customerProfile.create({
          data: customerData
        });
        created.push({ email: customer.email, riskTier: customer.riskTier });
      }

      logger.info("Test customer processed", {
        email: customer.email,
        riskTier: customer.riskTier,
        action: existing ? 'updated' : 'created',
        component: "testDataAPI"
      });

    } catch (error) {
      logger.error("Failed to process test customer", {
        email: customer.email,
        error: error instanceof Error ? error.message : String(error),
        component: "testDataAPI"
      });
      errors.push({ 
        email: customer.email, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  return json({
    success: true,
    message: `Test customers processed successfully`,
    summary: {
      created: created.length,
      updated: updated.length,
      errors: errors.length,
      total: TEST_CUSTOMERS.length
    },
    details: {
      created,
      updated,
      errors
    }
  });
}

async function clearTestData(shopDomain: string) {
  try {
    // Delete test customer profiles by phone hashes
    const testPhones = TEST_CUSTOMERS.map(c => hashPhoneNumber(c.phone));
    const resolvedHashes = await Promise.all(testPhones);
    
    const deleted = await db.customerProfile.deleteMany({
      where: {
        phoneHash: {
          in: resolvedHashes
        }
      }
    });

    logger.info("Test data cleared", {
      shopDomain,
      deletedCount: deleted.count,
      component: "testDataAPI"
    });

    return json({
      success: true,
      message: `Cleared ${deleted.count} test customer profiles`,
      deletedCount: deleted.count
    });

  } catch (error) {
    logger.error("Failed to clear test data", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
      component: "testDataAPI"
    });

    return json({
      error: "Failed to clear test data",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function getTestDataStatus(shopDomain: string) {
  try {
    // Get test profiles by phone hashes
    const testPhones = TEST_CUSTOMERS.map(c => hashPhoneNumber(c.phone));
    const resolvedHashes = await Promise.all(testPhones);
    
    const testProfiles = await db.customerProfile.findMany({
      where: {
        phoneHash: {
          in: resolvedHashes
        }
      },
      select: {
        phoneHash: true,
        emailHash: true,
        riskTier: true,
        riskScore: true,
        totalOrders: true,
        returnRate: true,
        createdAt: true
      }
    });

    const riskDistribution = testProfiles.reduce((acc, profile) => {
      acc[profile.riskTier] = (acc[profile.riskTier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return json({
      success: true,
      testDataExists: testProfiles.length > 0,
      summary: {
        totalTestProfiles: testProfiles.length,
        riskDistribution,
        expectedProfiles: TEST_CUSTOMERS.length
      },
      profiles: testProfiles
    });

  } catch (error) {
    return json({
      error: "Failed to get test data status",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
