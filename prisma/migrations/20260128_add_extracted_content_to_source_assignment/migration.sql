-- AlterTable SourceAssignment add extractedContent field
-- This field stores what content was extracted from each source for foundational skills
ALTER TABLE "SourceAssignment" ADD COLUMN "extractedContent" TEXT;
