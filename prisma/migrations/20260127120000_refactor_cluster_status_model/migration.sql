-- Refactor QuestionCluster status model
-- Replace confusing dual-purpose 'matchingStatus' with clear state machine 'status'
-- Add progress tracking and timestamp fields

-- Step 1: Add new columns
ALTER TABLE "QuestionCluster" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "QuestionCluster" ADD COLUMN "completedRowCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuestionCluster" ADD COLUMN "errorRowCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuestionCluster" ADD COLUMN "totalRowCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuestionCluster" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "QuestionCluster" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "QuestionCluster" ADD COLUMN "processingCompletedAt" TIMESTAMP(3);

-- Step 2: Migrate data from matchingStatus to status (map old values to new state machine)
-- PENDING -> PENDING
-- MATCHED -> PENDING (was intermediate state, not used in final code)
-- APPROVED -> APPROVED
-- PROCESSING -> PENDING (will be set when processing actually starts)
-- ERROR -> ERROR
UPDATE "QuestionCluster"
SET "status" = CASE
  WHEN "matchingStatus" = 'APPROVED' THEN 'APPROVED'
  WHEN "matchingStatus" = 'ERROR' THEN 'ERROR'
  ELSE 'PENDING'
END;

-- Step 3: Create new index on [projectId, status] for better query performance
CREATE INDEX "QuestionCluster_projectId_status_idx" ON "QuestionCluster"("projectId", "status");

-- Step 4: Drop old index on matchingStatus
DROP INDEX "QuestionCluster_matchingStatus_idx";

-- Step 5: Drop old matchingStatus column
ALTER TABLE "QuestionCluster" DROP COLUMN "matchingStatus";
