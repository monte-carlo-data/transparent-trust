-- Add source field to V2QuestionHistory to distinguish RFP from single questions
ALTER TABLE "V2QuestionHistory" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'quick';

-- Create index for faster filtering by source
CREATE INDEX "V2QuestionHistory_source_idx" ON "V2QuestionHistory"("source");
