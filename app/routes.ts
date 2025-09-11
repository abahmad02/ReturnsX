import type { RouteConfig } from "@remix-run/route-config";
import { route, index, layout, prefix } from "@remix-run/route-config";

export default [
  // Root layout
  layout("root.tsx", [
    // Public routes
    index("routes/_index/route.tsx"),
    
    // Auth routes
    route("auth/login", "routes/auth.login/route.tsx"),
    route("auth/*", "routes/auth.$.tsx"),
    
    // App routes (requires authentication)
    layout("routes/app.tsx", [
      index("routes/app._index.tsx"),
      route("additional", "routes/app.additional.tsx"),
      route("analytics", "routes/app.analytics.tsx"),
      route("customers", "routes/app.customers.tsx"),
      route("settings", "routes/app.settings.tsx"),
    ]),
    
    // API routes
    ...prefix("api", [
      route("customer-profiles/:phone", "routes/api.customer-profiles.$phone.tsx"),
      route("high-risk-customers", "routes/api.high-risk-customers.tsx"),
      route("import/historical", "routes/api.import.historical.tsx"),
      route("orders/risk-assessment", "routes/api.orders.risk-assessment.tsx"),
      route("risk-config", "routes/api.risk-config.tsx"),
      route("scripts/checkout", "routes/api.scripts.checkout.tsx"),
      route("test-data", "routes/api.test-data.tsx"),
      route("webhooks/register", "routes/api.webhooks.register.tsx"),
      route("whatsapp/send", "routes/api.whatsapp.send.tsx"),
      route("whatsapp/webhook", "routes/api.whatsapp.webhook.tsx"),
      route("install-thank-you-script", "routes/api.install-thank-you-script.tsx"),
    ]),
    
    // Webhook routes
    ...prefix("webhooks", [
      route("app/scopes_update", "routes/webhooks.app.scopes_update.tsx"),
      route("app/uninstalled", "routes/webhooks.app.uninstalled.tsx"),
      route("customers/data_request", "routes/webhooks.customers.data_request.tsx"),
      route("customers/redact", "routes/webhooks.customers.redact.tsx"),
      route("shop/redact", "routes/webhooks.shop.redact.tsx"),
      route("orders/cancelled", "routes/webhooks.orders.cancelled.tsx"),
      route("orders/created", "routes/webhooks.orders.created.tsx"),
      route("orders/paid", "routes/webhooks.orders.paid.tsx"),
      route("orders/updated", "routes/webhooks.orders.updated.tsx"),
      route("orders/fulfilled", "routes/webhooks.orders.fulfilled.tsx"),
      route("refunds/created", "routes/webhooks.refunds.created.tsx"),
    ]),
    
    // Checkout enforcement script
    route("checkout-enforcement.js", "routes/checkout-enforcement.js.tsx"),
    
    // Thank you page script
    route("thank-you-script.js", "routes/thank-you-script.js.tsx"),
    
    // Test page for thank you script
    route("test-thank-you-script", "routes/test-thank-you-script.tsx"),
  ]),
] satisfies RouteConfig;
