-- Migration: Remove deprecated parentCustomerId field
-- This completes the V2 migration by removing the old field now that all data is migrated to customerId

-- Remove the index first (if it exists)
DROP INDEX IF EXISTS "BuildingBlock_parentCustomerId_idx";

-- Remove the deprecated parentCustomerId column
ALTER TABLE "BuildingBlock" DROP COLUMN IF EXISTS "parentCustomerId";
