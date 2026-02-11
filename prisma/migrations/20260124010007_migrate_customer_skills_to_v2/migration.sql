-- Migration: Migrate customer skills from parentCustomerId to customerId (V2)
-- Clear orphaned parentCustomerId values (test data with no matching Customer records).
-- This prepares the table for the removal of the deprecated parentCustomerId field.

-- Clear orphaned parentCustomerId values - they have no matching Customer records
UPDATE "BuildingBlock"
SET "parentCustomerId" = NULL
WHERE "parentCustomerId" IS NOT NULL;
