import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getRiskConfig, recalculateAllRiskScores } from "../services/riskScoring.server";
import { updateRiskConfig } from "../services/customerProfile.server";
import { logger } from "../services/logger.server";

/**
 * GET /api/risk-config - Get current risk configuration
 * PUT /api/risk-config - Update risk configuration
 * POST /api/risk-config/recalculate - Recalculate all risk scores with new config
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);

    const riskConfig = await getRiskConfig(session.shop);

    return json({
      success: true,
      config: riskConfig,
    });

  } catch (error) {
    logger.error("Error fetching risk configuration", {
      error: error instanceof Error ? error.message : String(error),
    }, error instanceof Error ? error : new Error(String(error)));

    return json(
      { error: "Failed to fetch risk configuration" },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const method = request.method;

    if (method === "PUT") {
      // Update risk configuration
      const configData = await request.json();

      // Validate required fields
      const requiredFields = [
        'zeroRiskMaxFailed',
        'zeroRiskMaxReturnRate', 
        'mediumRiskMaxFailed',
        'mediumRiskMaxReturnRate',
        'highRiskThreshold',
        'depositPercentage'
      ];

      for (const field of requiredFields) {
        if (configData[field] === undefined || configData[field] === null) {
          return json(
            { error: `Missing required field: ${field}` },
            { status: 400 }
          );
        }
      }

      // Validate ranges
      if (configData.depositPercentage < 0 || configData.depositPercentage > 100) {
        return json(
          { error: "Deposit percentage must be between 0 and 100" },
          { status: 400 }
        );
      }

      if (configData.zeroRiskMaxReturnRate >= configData.mediumRiskMaxReturnRate ||
          configData.mediumRiskMaxReturnRate >= configData.highRiskThreshold) {
        return json(
          { error: "Risk thresholds must be in ascending order" },
          { status: 400 }
        );
      }

      const updatedConfig = await updateRiskConfig(session.shop, configData);

      logger.info("Risk configuration updated by merchant", {
        shopDomain: session.shop,
        updatedFields: Object.keys(configData),
      });

      return json({
        success: true,
        message: "Risk configuration updated successfully",
        config: updatedConfig,
      });

    } else if (method === "POST") {
      // Handle sub-actions based on path
      const url = new URL(request.url);
      const subAction = url.pathname.split('/').pop();

      if (subAction === "recalculate") {
        // Recalculate all risk scores with updated configuration
        logger.info("Starting bulk risk recalculation", {
          shopDomain: session.shop,
        });

        const result = await recalculateAllRiskScores(session.shop);

        return json({
          success: true,
          message: `Recalculated ${result.processed} customer risk scores`,
          processed: result.processed,
          errors: result.errors,
        });
      }

      return json(
        { error: "Invalid action" },
        { status: 400 }
      );

    } else {
      return json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

  } catch (error) {
    logger.error("Error in risk configuration API", {
      method: request.method,
    }, error instanceof Error ? error : new Error(String(error)));

    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 