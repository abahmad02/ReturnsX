-- Manual Migration: Remove Hashing and Convert to Raw Data
-- WARNING: This migration will permanently change how customer data is stored
-- Make sure to backup your data before running this migration

-- Step 1: Add new columns for raw data
ALTER TABLE "public"."customer_profiles" 
ADD COLUMN "phone" VARCHAR(50),
ADD COLUMN "email" VARCHAR(255),
ADD COLUMN "address" TEXT;

-- Step 2: Note - Since we cannot reverse hash existing data, 
-- you will need to either:
-- 1. Clear existing data and start fresh, OR
-- 2. Import fresh data from Shopify with the new system

-- Step 3: Drop old hash columns (after data migration)
-- ONLY run this after you've migrated or cleared your data
-- ALTER TABLE "public"."customer_profiles" DROP COLUMN "phone_hash";
-- ALTER TABLE "public"."customer_profiles" DROP COLUMN "email_hash";
-- ALTER TABLE "public"."customer_profiles" DROP COLUMN "address_hash";

-- Step 4: Update indexes
DROP INDEX IF EXISTS "customer_profiles_phone_hash_idx";
DROP INDEX IF EXISTS "customer_profiles_email_hash_idx";
DROP INDEX IF EXISTS "customer_profiles_address_hash_idx";
DROP INDEX IF EXISTS "customer_profiles_phone_hash_key";

CREATE INDEX "customer_profiles_phone_idx" ON "public"."customer_profiles"("phone");
CREATE INDEX "customer_profiles_email_idx" ON "public"."customer_profiles"("email");
CREATE INDEX "customer_profiles_address_idx" ON "public"."customer_profiles"("address");

-- Step 5: Add unique constraint on phone (after old data is removed)
-- ALTER TABLE "public"."customer_profiles" ADD CONSTRAINT "customer_profiles_phone_key" UNIQUE ("phone");

-- Step 6: Make phone column NOT NULL (after migration is complete)
-- ALTER TABLE "public"."customer_profiles" ALTER COLUMN "phone" SET NOT NULL;

-- Instructions for completing the migration:
-- 1. Run steps 1-4 above
-- 2. Clear existing customer data: DELETE FROM "public"."customer_profiles";
-- 3. Clear existing order events: DELETE FROM "public"."order_events";
-- 4. Run steps 5-6 above
-- 5. Re-import data using the new webhook system or historical import
