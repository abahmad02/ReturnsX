-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderEventType" ADD VALUE 'ORDER_PAID';
ALTER TYPE "OrderEventType" ADD VALUE 'ORDER_RETURN_INITIATED';

-- CreateTable
CREATE TABLE "checkout_correlations" (
    "id" TEXT NOT NULL,
    "checkout_token" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "customer_id" TEXT,
    "order_id" TEXT,
    "order_name" TEXT,
    "total_amount" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "web_url" TEXT,
    "shop_domain" TEXT NOT NULL,
    "correlation_data" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_correlations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_correlations_checkout_token_key" ON "checkout_correlations"("checkout_token");

-- CreateIndex
CREATE INDEX "checkout_correlations_checkout_token_idx" ON "checkout_correlations"("checkout_token");

-- CreateIndex
CREATE INDEX "checkout_correlations_shop_domain_idx" ON "checkout_correlations"("shop_domain");

-- CreateIndex
CREATE INDEX "checkout_correlations_matched_idx" ON "checkout_correlations"("matched");
