-- Add fileContext and fileContextTokens columns to BulkProject table
ALTER TABLE "BulkProject" ADD COLUMN "fileContext" TEXT;
ALTER TABLE "BulkProject" ADD COLUMN "fileContextTokens" INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "BulkProject_fileContextTokens_idx" ON "BulkProject"("fileContextTokens");
