-- CreateTable QuestionCluster
-- Hierarchical clustering for RFP questions
-- Supports tab-level and section-level clustering with parent-child relationships

CREATE TABLE "QuestionCluster" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentClusterId" TEXT,
    "clusterType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "category" TEXT,
    "selectedSkillIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionCluster_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "QuestionCluster" ADD CONSTRAINT "QuestionCluster_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionCluster" ADD CONSTRAINT "QuestionCluster_parentClusterId_fkey"
    FOREIGN KEY ("parentClusterId") REFERENCES "QuestionCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add clusterId to BulkRow
ALTER TABLE "BulkRow" ADD COLUMN "clusterId" TEXT;

ALTER TABLE "BulkRow" ADD CONSTRAINT "BulkRow_clusterId_fkey"
    FOREIGN KEY ("clusterId") REFERENCES "QuestionCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE UNIQUE INDEX "QuestionCluster_projectId_clusterType_title_parentClusterId_key"
    ON "QuestionCluster"("projectId", "clusterType", "title", "parentClusterId");

CREATE INDEX "QuestionCluster_projectId_clusterType_idx"
    ON "QuestionCluster"("projectId", "clusterType");

CREATE INDEX "QuestionCluster_projectId_level_idx"
    ON "QuestionCluster"("projectId", "level");

CREATE INDEX "QuestionCluster_parentClusterId_idx"
    ON "QuestionCluster"("parentClusterId");

CREATE INDEX "QuestionCluster_matchingStatus_idx"
    ON "QuestionCluster"("matchingStatus");

CREATE INDEX "BulkRow_projectId_clusterId_idx"
    ON "BulkRow"("projectId", "clusterId");
