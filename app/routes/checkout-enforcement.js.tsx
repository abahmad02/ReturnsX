import type { LoaderFunctionArgs } from "@remix-run/node";
import { readFileSync } from "fs";
import { join } from "path";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Read the JavaScript file from the public directory
    const scriptPath = join(process.cwd(), "public", "checkout-enforcement.js");
    const scriptContent = readFileSync(scriptPath, "utf-8");

    // Return the JavaScript with proper headers
    return new Response(scriptContent, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    console.error("Error serving checkout enforcement script:", error);
    
    // Return a minimal error-handling script
    const fallbackScript = `
      console.warn('ReturnsX: Checkout enforcement script could not be loaded');
      window.ReturnsXCheckout = {
        init: function() { console.log('ReturnsX: Fallback mode - no enforcement'); },
        closeModal: function() {},
        switchToOnlinePayment: function() {}
      };
    `;

    return new Response(fallbackScript, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }
}; 