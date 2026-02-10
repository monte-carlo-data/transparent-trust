-- ============================================================================
-- Part 1: BuildingBlock schema cleanup
-- ============================================================================

-- Add skillType column with default 'knowledge'
ALTER TABLE "BuildingBlock" ADD COLUMN "skillType" VARCHAR(50) NOT NULL DEFAULT 'knowledge';

-- Backfill foundational skills to 'intelligence'
-- Foundational skills are those with isFoundational=true AND customerId IS NULL
UPDATE "BuildingBlock"
SET "skillType" = 'intelligence'
WHERE "attributes"->>'isFoundational' = 'true'
  AND "customerId" IS NULL;

-- Change status default from 'DRAFT' to 'ACTIVE'
-- First update any existing DRAFT records to ACTIVE
UPDATE "BuildingBlock"
SET "status" = 'ACTIVE'
WHERE "status" = 'DRAFT';

-- Drop the status column and recreate with new default
ALTER TABLE "BuildingBlock" DROP COLUMN "status";
ALTER TABLE "BuildingBlock" ADD COLUMN "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- Drop unused columns
ALTER TABLE "BuildingBlock" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "BuildingBlock" DROP COLUMN IF EXISTS "tier";

-- Add index for skillType queries
CREATE INDEX "BuildingBlock_skillType_idx" ON "BuildingBlock"("skillType");

-- Add composite index for common queries (libraryId + skillType)
CREATE INDEX "BuildingBlock_libraryId_skillType_idx" ON "BuildingBlock"("libraryId", "skillType");

-- ============================================================================
-- Part 2: Remove unused QuestionCluster model
-- ============================================================================
-- QuestionCluster was designed for hierarchical RFP processing but was never
-- used in production. The simplified flat-question batch processing approach
-- is used instead. See ARCHITECTURE.md "RFP Batch Processing" section.

-- Step 1: Drop the foreign key from BulkRow to QuestionCluster
ALTER TABLE "BulkRow" DROP CONSTRAINT IF EXISTS "BulkRow_clusterId_fkey";

-- Step 2: Drop indexes on BulkRow.clusterId
DROP INDEX IF EXISTS "BulkRow_projectId_clusterId_idx";

-- Step 3: Drop the clusterId column from BulkRow
ALTER TABLE "BulkRow" DROP COLUMN IF EXISTS "clusterId";

-- Step 4: Drop all indexes on QuestionCluster
DROP INDEX IF EXISTS "QuestionCluster_projectId_clusterType_title_parentClusterId_key";
DROP INDEX IF EXISTS "QuestionCluster_projectId_clusterType_idx";
DROP INDEX IF EXISTS "QuestionCluster_projectId_level_idx";
DROP INDEX IF EXISTS "QuestionCluster_projectId_status_idx";
DROP INDEX IF EXISTS "QuestionCluster_parentClusterId_idx";

-- Step 5: Drop the QuestionCluster table
DROP TABLE IF EXISTS "QuestionCluster";
