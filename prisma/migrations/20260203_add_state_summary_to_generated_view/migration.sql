-- Add stateSummary column to GeneratedView for historical audit comparison
-- Contains key metrics, risk levels, and top findings for quick diff between runs

ALTER TABLE "GeneratedView" ADD COLUMN "stateSummary" JSONB;
