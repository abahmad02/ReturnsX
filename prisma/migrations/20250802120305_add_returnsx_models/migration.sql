-- CreateEnum
CREATE TYPE "public"."RiskTier" AS ENUM ('ZERO_RISK', 'MEDIUM_RISK', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "public"."OrderEventType" AS ENUM ('ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'ORDER_FULFILLED', 'ORDER_REFUNDED', 'ORDER_DELIVERED');

-- CreateEnum
CREATE TYPE "public"."OverrideType" AS ENUM ('RESET_FAILED_ATTEMPTS', 'CHANGE_RISK_TIER', 'FORGIVE_CUSTOMER', 'MANUAL_VERIFICATION');

-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."customer_profiles" (
    "id" TEXT NOT NULL,
    "phone_hash" VARCHAR(255) NOT NULL,
    "email_hash" VARCHAR(255),
    "address_hash" VARCHAR(255),
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "successful_deliveries" INTEGER NOT NULL DEFAULT 0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "risk_score" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "risk_tier" "public"."RiskTier" NOT NULL DEFAULT 'ZERO_RISK',
    "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_events" (
    "id" TEXT NOT NULL,
    "customer_profile_id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "shopify_order_id" TEXT NOT NULL,
    "event_type" "public"."OrderEventType" NOT NULL,
    "order_value" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "cancel_reason" TEXT,
    "fulfillment_status" TEXT,
    "refund_amount" DECIMAL(10,2),
    "event_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."manual_overrides" (
    "id" TEXT NOT NULL,
    "customer_profile_id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "admin_user_id" TEXT,
    "override_type" "public"."OverrideType" NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."risk_configs" (
    "id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "zero_risk_max_failed" INTEGER NOT NULL DEFAULT 2,
    "zero_risk_max_return_rate" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "medium_risk_max_failed" INTEGER NOT NULL DEFAULT 5,
    "medium_risk_max_return_rate" DECIMAL(5,2) NOT NULL DEFAULT 30.0,
    "high_risk_threshold" DECIMAL(5,2) NOT NULL DEFAULT 30.0,
    "enable_cod_restriction" BOOLEAN NOT NULL DEFAULT true,
    "deposit_percentage" DECIMAL(5,2) NOT NULL DEFAULT 50.0,
    "notification_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_phone_hash_key" ON "public"."customer_profiles"("phone_hash");

-- CreateIndex
CREATE INDEX "customer_profiles_phone_hash_idx" ON "public"."customer_profiles"("phone_hash");

-- CreateIndex
CREATE INDEX "customer_profiles_email_hash_idx" ON "public"."customer_profiles"("email_hash");

-- CreateIndex
CREATE INDEX "customer_profiles_address_hash_idx" ON "public"."customer_profiles"("address_hash");

-- CreateIndex
CREATE INDEX "customer_profiles_risk_tier_idx" ON "public"."customer_profiles"("risk_tier");

-- CreateIndex
CREATE INDEX "order_events_customer_profile_id_idx" ON "public"."order_events"("customer_profile_id");

-- CreateIndex
CREATE INDEX "order_events_shop_domain_idx" ON "public"."order_events"("shop_domain");

-- CreateIndex
CREATE INDEX "order_events_shopify_order_id_idx" ON "public"."order_events"("shopify_order_id");

-- CreateIndex
CREATE INDEX "order_events_event_type_idx" ON "public"."order_events"("event_type");

-- CreateIndex
CREATE INDEX "manual_overrides_customer_profile_id_idx" ON "public"."manual_overrides"("customer_profile_id");

-- CreateIndex
CREATE INDEX "manual_overrides_shop_domain_idx" ON "public"."manual_overrides"("shop_domain");

-- CreateIndex
CREATE UNIQUE INDEX "risk_configs_shop_domain_key" ON "public"."risk_configs"("shop_domain");

-- AddForeignKey
ALTER TABLE "public"."order_events" ADD CONSTRAINT "order_events_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."manual_overrides" ADD CONSTRAINT "manual_overrides_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
