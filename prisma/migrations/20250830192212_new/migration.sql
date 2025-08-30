/*
  Warnings:

  - You are about to drop the column `address_hash` on the `customer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `email_hash` on the `customer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `phone_hash` on the `customer_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `customer_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopify_order_id,event_type,shop_domain,customer_profile_id]` on the table `order_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `customer_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "customer_profiles_address_hash_idx";

-- DropIndex
DROP INDEX "customer_profiles_email_hash_idx";

-- DropIndex
DROP INDEX "customer_profiles_phone_hash_idx";

-- DropIndex
DROP INDEX "customer_profiles_phone_hash_key";

-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "address_hash",
DROP COLUMN "email_hash",
DROP COLUMN "phone_hash",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "phone" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_phone_key" ON "customer_profiles"("phone");

-- CreateIndex
CREATE INDEX "customer_profiles_phone_idx" ON "customer_profiles"("phone");

-- CreateIndex
CREATE INDEX "customer_profiles_email_idx" ON "customer_profiles"("email");

-- CreateIndex
CREATE INDEX "customer_profiles_address_idx" ON "customer_profiles"("address");

-- CreateIndex
CREATE UNIQUE INDEX "order_events_shopify_order_id_event_type_shop_domain_custom_key" ON "order_events"("shopify_order_id", "event_type", "shop_domain", "customer_profile_id");
