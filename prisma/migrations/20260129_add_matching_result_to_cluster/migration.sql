-- Add matchingResult column to QuestionCluster
-- Stores full LLM matching results with confidence levels

ALTER TABLE "QuestionCluster" ADD COLUMN "matchingResult" JSONB;
