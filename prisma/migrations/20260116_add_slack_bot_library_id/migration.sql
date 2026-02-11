-- Add libraryId column to SlackBotInteraction for multi-library bot support
ALTER TABLE "SlackBotInteraction" ADD COLUMN "libraryId" TEXT;

-- Create index for efficient queries by libraryId
CREATE INDEX "SlackBotInteraction_libraryId_idx" ON "SlackBotInteraction"("libraryId");
