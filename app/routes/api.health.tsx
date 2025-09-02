import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Health check endpoint for monitoring and testing
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    service: "ReturnsX"
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  return json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    service: "ReturnsX"
  });
};
