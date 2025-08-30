import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticateWithRoles, Permission, hasPermission } from "../middleware/roleBasedAccess.server";
import { withRateLimit } from "../middleware/rateLimiting.server";
import { auditCustomerProfileAccess, auditAPIRequest } from "../services/auditLog.server";
import { getCustomerProfileByPhone, updateCustomerProfile } from "../services/customerProfile.server";
import { calculateRiskScore } from "../services/riskScoring.server";
import { getRiskConfig } from "../services/riskScoring.server";
import { logger } from "../services/logger.server";

export const loader = withRateLimit("customerProfile")(
  async ({ request, params }: LoaderFunctionArgs) => {
    const startTime = Date.now();
    
    try {
      const { session, userSession } = await authenticateWithRoles(request);
      
      // Check permissions
      if (!hasPermission(userSession, Permission.ACCESS_CUSTOMER_API)) {
        await auditAPIRequest(
          new URL(request.url).pathname,
          request.method,
          userSession.shopDomain,
          userSession.userId,
          userSession.role,
          (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
          request.headers.get("user-agent") || undefined,
          403,
          Date.now() - startTime
        );
        
        return json(
          { success: false, error: "Insufficient permissions" },
          { status: 403 }
        );
      }

      const { phone } = params;
      if (!phone) {
        return json(
          { success: false, error: "Phone number is required" },
          { status: 400 }
        );
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');

      // Get customer profile
      const customerProfile = await getCustomerProfileByPhone(normalizedPhone);
      
      if (!customerProfile) {
        await auditAPIRequest(
          new URL(request.url).pathname,
          request.method,
          userSession.shopDomain,
          userSession.userId,
          userSession.role,
          (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
          request.headers.get("user-agent") || undefined,
          404,
          Date.now() - startTime
        );
        
        return json(
          { success: false, error: "Customer profile not found" },
          { status: 404 }
        );
      }

      // Get risk configuration for the shop
      const riskConfig = await getRiskConfig(userSession.shopDomain);
      
      // Calculate current risk assessment
      const riskCalculation = await calculateRiskScore(customerProfile, userSession.shopDomain, riskConfig);

      // Base response data
      const responseData = {
        success: true,
        customerProfile: {
          id: customerProfile.id,
          phone: customerProfile.phone,
          email: customerProfile.email,
          address: customerProfile.address,
          totalOrders: customerProfile.totalOrders,
          failedAttempts: customerProfile.failedAttempts,
          successfulDeliveries: customerProfile.successfulDeliveries,
          returnRate: Number(customerProfile.returnRate),
          riskScore: Number(customerProfile.riskScore),
          riskTier: customerProfile.riskTier,
          lastEventAt: customerProfile.lastEventAt,
          createdAt: customerProfile.createdAt,
          updatedAt: customerProfile.updatedAt,
          currentRiskAssessment: riskCalculation,
          riskConfiguration: {
            zeroRiskThreshold: riskConfig.zeroRiskMaxFailed,
            mediumRiskThreshold: riskConfig.mediumRiskMaxFailed,
            highRiskThreshold: riskConfig.highRiskThreshold,
            enableCodRestriction: riskConfig.enableCodRestriction
          }
        }
      };

      await auditAPIRequest(
        new URL(request.url).pathname,
        request.method,
        userSession.shopDomain,
        userSession.userId,
        userSession.role,
        (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
        request.headers.get("user-agent") || undefined,
        200,
        Date.now() - startTime
      );

      logger.info("Customer profile API access", {
        component: "customerProfileAPI",
        phone: phone.substring(0, 3) + "***",
        riskTier: customerProfile.riskTier,
        userId: userSession.userId,
        userRole: userSession.role,
        shopDomain: userSession.shopDomain,
        responseTime: Date.now() - startTime
      });

      return json(responseData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Customer profile API error", {
        component: "customerProfileAPI",
        error: errorMessage,
        phone: params.phone?.substring(0, 3) + "***",
        responseTime: Date.now() - startTime
      });

      return json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

export const action = withRateLimit("customerProfile")(
  async ({ request, params }: ActionFunctionArgs) => {
    const startTime = Date.now();
    
    try {
      const { session, userSession } = await authenticateWithRoles(request);
      
      // Check permissions for customer management
      if (!hasPermission(userSession, Permission.MANAGE_CUSTOMERS)) {
        await auditAPIRequest(
          new URL(request.url).pathname,
          request.method,
          userSession.shopDomain,
          userSession.userId,
          userSession.role,
          (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) || undefined,
          request.headers.get("user-agent") || undefined,
          403,
          Date.now() - startTime
        );
        
        return json(
          { success: false, error: "Insufficient permissions to manage customers" },
          { status: 403 }
        );
      }

      const { phone } = params;
      if (!phone) {
        return json(
          { success: false, error: "Phone number is required" },
          { status: 400 }
        );
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      
      // Get customer profile
      const customerProfile = await getCustomerProfileByPhone(normalizedPhone);
      
      if (!customerProfile) {
        return json(
          { success: false, error: "Customer profile not found" },
          { status: 404 }
        );
      }

      const formData = await request.formData();
      const action = formData.get("action") as string;

      switch (action) {
        case "resetFailedAttempts": {
          const reason = formData.get("reason") as string;
          
          const updatedProfile = await updateCustomerProfile(customerProfile.id, {
            failedAttempts: 0,
          });

          await auditCustomerProfileAccess(
            customerProfile.id,
            "MANUAL_OVERRIDE_APPLIED",
            userSession.shopDomain,
            userSession.userId,
            { 
              action: "resetFailedAttempts", 
              reason,
              previousValue: customerProfile.failedAttempts,
              newValue: 0
            }
          );

          logger.info("Customer failed attempts reset", {
            component: "customerProfileAPI",
            customerId: customerProfile.id,
            phone: phone.substring(0, 3) + "***",
            previousFailedAttempts: customerProfile.failedAttempts,
            reason,
            adminUserId: userSession.userId,
            shopDomain: userSession.shopDomain
          });

          return json({
            success: true,
            message: "Failed attempts reset successfully",
            customerProfile: updatedProfile
          });
        }

        case "changeRiskTier": {
          const newRiskTier = formData.get("riskTier") as string;
          const reason = formData.get("reason") as string;

          if (!["ZERO_RISK", "MEDIUM_RISK", "HIGH_RISK"].includes(newRiskTier)) {
            return json(
              { success: false, error: "Invalid risk tier" },
              { status: 400 }
            );
          }

          const updatedProfile = await updateCustomerProfile(customerProfile.id, {
            riskTier: newRiskTier,
          });

          await auditCustomerProfileAccess(
            customerProfile.id,
            "RISK_TIER_CHANGED",
            userSession.shopDomain,
            userSession.userId,
            { 
              action: "changeRiskTier", 
              reason,
              previousValue: customerProfile.riskTier,
              newValue: newRiskTier
            }
          );

          logger.info("Customer risk tier changed", {
            component: "customerProfileAPI",
            customerId: customerProfile.id,
            phone: phone.substring(0, 3) + "***",
            previousRiskTier: customerProfile.riskTier,
            newRiskTier,
            reason,
            adminUserId: userSession.userId,
            shopDomain: userSession.shopDomain
          });

          return json({
            success: true,
            message: "Risk tier updated successfully",
            customerProfile: updatedProfile
          });
        }

        default:
          return json(
            { success: false, error: "Invalid action" },
            { status: 400 }
          );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Customer profile action error", {
        component: "customerProfileAPI",
        error: errorMessage,
        phone: params.phone?.substring(0, 3) + "***",
        responseTime: Date.now() - startTime
      });

      return json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
