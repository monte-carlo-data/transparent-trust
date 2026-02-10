-- Add customer linking to BulkProject (for RFPs and Contracts)
ALTER TABLE "BulkProject" ADD COLUMN "customerId" TEXT;

-- Add customer linking to ChatSession (for Chat and Collateral)
ALTER TABLE "ChatSession" ADD COLUMN "customerId" TEXT;

-- Update sessionType default from 'general' to 'chat'
ALTER TABLE "ChatSession" ALTER COLUMN "sessionType" SET DEFAULT 'chat';

-- Add foreign key constraints
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for efficient querying
CREATE INDEX "BulkProject_customerId_idx" ON "BulkProject"("customerId");
CREATE INDEX "ChatSession_customerId_idx" ON "ChatSession"("customerId");
