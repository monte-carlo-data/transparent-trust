-- Migration: Update StagedSource unique constraint to include customerId
-- This allows multiple customers to have the same external source ID without collisions.
-- The unique constraint now covers: [sourceType, externalId, libraryId, customerId]
-- For global sources (customerId=null): unique by [sourceType, externalId, libraryId, null]
-- For customer sources: unique by [sourceType, externalId, libraryId, customerId]

-- Drop the old unique constraint
DROP INDEX IF EXISTS "StagedSource_sourceType_externalId_libraryId_key";

-- Create the new unique constraint that includes customerId
CREATE UNIQUE INDEX "StagedSource_sourceType_externalId_libraryId_customerId_key" ON "StagedSource"("sourceType", "externalId", "libraryId", "customerId");
