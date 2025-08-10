import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticateWithRoles, Permission, hasPermission } from "../middleware/roleBasedAccess.server";
import { withRateLimit } from "../middleware/rateLimiting.server";
import { auditCustomerProfileAccess, auditAPIRequest } from "../services/auditLog.server";
import { getCustomerProfileByPhoneHash, updateCustomerProfile } from "../services/customerProfile.server";
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
          { success: false, error: "Insufficient permissions to access customer API" },
          { status: 403 }
        );
      }

      const { phoneHash } = params;
      
      if (!phoneHash) {
        return json(
          { success: false, error: "Phone hash parameter is required" },
          { status: 400 }
        );
      }

      // Get customer profile
      const customerProfile = await getCustomerProfileByPhoneHash(phoneHash);
      
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

      // Audit customer profile access
      await auditCustomerProfileAccess(
        customerProfile.id,
        "PROFILE_VIEWED",
        userSession.shopDomain,
        userSession.userId,
        userSession.role,
        { 
          requestSource: "API",
          phoneHash: phoneHash.substring(0, 8) + "...",
          riskTier: customerProfile.riskTier
        }
      );

      // Calculate current risk score
      const riskCalculation = await calculateRiskScore(customerProfile, session.shop, {});
      
      // Get risk configuration for additional context
      const riskConfig = await getRiskConfig(session.shop);

      // Filter response data based on user role
      const responseData = {
        success: true,
        customerProfile: {
          id: customerProfile.id,
          riskTier: riskCalculation.riskTier,
          riskScore: riskCalculation.riskScore,
          confidence: riskCalculation.confidence,
          recommendation: riskCalculation.recommendation,
          totalOrders: customerProfile.totalOrders,
          failedAttempts: customerProfile.failedAttempts,
          successfulDeliveries: customerProfile.successfulDeliveries,
          returnRate: customerProfile.returnRate,
          lastEventAt: customerProfile.lastEventAt,
          createdAt: customerProfile.createdAt,
          updatedAt: customerProfile.updatedAt
        },
        riskConfig: {
          zeroRiskMaxFailed: riskConfig.zeroRiskMaxFailed,
          zeroRiskMaxReturnRate: riskConfig.zeroRiskMaxReturnRate,
          mediumRiskMaxFailed: riskConfig.mediumRiskMaxFailed,
          mediumRiskMaxReturnRate: riskConfig.mediumRiskMaxReturnRate,
          highRiskThreshold: riskConfig.highRiskThreshold,
          enableCodRestriction: riskConfig.enableCodRestriction
        }
      };

      // Add additional fields based on permissions
      if (hasPermission(userSession, Permission.MANAGE_CUSTOMERS)) {
        (responseData.customerProfile as any).phoneHash = customerProfile.phoneHash;
        (responseData.customerProfile as any).emailHash = customerProfile.emailHash;
        (responseData.customerProfile as any).addressHash = customerProfile.addressHash;
      }

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
        phoneHash: phoneHash.substring(0, 8) + "...",
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
        phoneHash: params.phoneHash?.substring(0, 8) + "...",
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

      const { phoneHash } = params;
      
      if (!phoneHash) {
        return json(
          { success: false, error: "Phone hash parameter is required" },
          { status: 400 }
        );
      }

      // Get existing customer profile
      const existingProfile = await getCustomerProfileByPhoneHash(phoneHash);
      
      if (!existingProfile) {
        return json(
          { success: false, error: "Customer profile not found" },
          { status: 404 }
        );
      }

      const formData = await request.formData();
      const updateType = formData.get("updateType") as string;
      
      let updateData: any = {};
      let auditDetails: any = { updateType };

      switch (updateType) {
        case "recalculate_risk":
          // Trigger risk score recalculation
          const riskCalculation = await calculateRiskScore(existingProfile, session.shop, {});
          
          updateData = {
            riskScore: riskCalculation.riskScore,
            riskTier: riskCalculation.riskTier
          };
          
          auditDetails.riskRecalculation = {
            previousScore: existingProfile.riskScore,
            newScore: riskCalculation.riskScore,
            previousTier: existingProfile.riskTier,
            newTier: riskCalculation.riskTier
          };
          break;

        default:
          return json(
            { success: false, error: "Invalid update type" },
            { status: 400 }
          );
      }

      // Update customer profile
      const updatedProfile = await updateCustomerProfile(existingProfile.id, updateData);

      // Audit the update
      await auditCustomerProfileAccess(
        existingProfile.id,
        "PROFILE_UPDATED",
        userSession.shopDomain,
        userSession.userId,
        userSession.role,
        auditDetails
      );

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

      logger.info("Customer profile updated via API", {
        component: "customerProfileAPI",
        customerId: existingProfile.id,
        updateType,
        userId: userSession.userId,
        userRole: userSession.role,
        shopDomain: userSession.shopDomain,
        responseTime: Date.now() - startTime
      });

      return json({
        success: true,
        message: "Customer profile updated successfully",
        customerProfile: {
          id: updatedProfile.id,
          riskTier: updatedProfile.riskTier,
          riskScore: updatedProfile.riskScore,
          totalOrders: updatedProfile.totalOrders,
          failedAttempts: updatedProfile.failedAttempts,
          successfulDeliveries: updatedProfile.successfulDeliveries,
          returnRate: updatedProfile.returnRate,
          lastEventAt: updatedProfile.lastEventAt,
          updatedAt: updatedProfile.updatedAt
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Customer profile API action error", {
        component: "customerProfileAPI",
        error: errorMessage,
        phoneHash: params.phoneHash?.substring(0, 8) + "...",
        responseTime: Date.now() - startTime
      });

      return json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }
); 