import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { importHistoricalOrdersForAuthenticatedShop, getImportStatus } from "../services/historicalImport.server";

/**
 * POST /api/import/historical
 * 
 * Start historical order import for the authenticated shop
 * GET /api/import/historical
 * 
 * Get the status of historical import
 */

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Parse request body for import options
    const body = await request.json().catch(() => ({}));
    const {
      startDate,
      endDate,
      limitPerPage = 50,
    } = body;

    console.log("Starting historical import with options:", {
      startDate,
      endDate,
      limitPerPage
    });

    // Start the import process
    const importProgress = await importHistoricalOrdersForAuthenticatedShop(request, {
      startDate,
      endDate,
      limitPerPage,
    });

    return json({
      success: importProgress.isComplete && importProgress.errors.length === 0,
      progress: importProgress,
      message: importProgress.isComplete 
        ? `Import completed. Processed ${importProgress.processedOrders} orders with ${importProgress.errors.length} errors.`
        : "Import in progress...",
    });

  } catch (error) {
    console.error("Error in historical import endpoint:", error);
    return json(
      { 
        success: false,
        error: "Failed to start historical import",
        details: error?.toString() 
      },
      { status: 500 }
    );
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get import status for the authenticated shop
    const { session } = await authenticate.admin(request);
    
    const importStatus = await getImportStatus(session.shop);

    return json({
      importStatus,
      hasActiveImport: !!importStatus && !importStatus.isComplete,
    });

  } catch (error) {
    console.error("Error getting import status:", error);
    return json(
      { 
        error: "Failed to get import status",
        details: error?.toString() 
      },
      { status: 500 }
    );
  }
} 