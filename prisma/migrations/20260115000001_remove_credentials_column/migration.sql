-- Migration: Remove credentials column from IntegrationConnection
-- Credentials are now stored in AWS Secrets Manager for better security
-- This migration also standardizes library IDs

-- Step 1: Drop the credentials column (data is being migrated to Secrets Manager)
ALTER TABLE "IntegrationConnection" DROP COLUMN IF EXISTS "credentials";

-- Step 2: Standardize library IDs (skills -> knowledge, it-skills -> it)
-- Update Team.libraries array
UPDATE "Team" SET libraries = array_replace(libraries, 'skills', 'knowledge');
UPDATE "Team" SET libraries = array_replace(libraries, 'it-skills', 'it');

-- Update BuildingBlock.libraryId
UPDATE "BuildingBlock" SET "libraryId" = 'knowledge' WHERE "libraryId" = 'skills';
UPDATE "BuildingBlock" SET "libraryId" = 'it' WHERE "libraryId" = 'it-skills';

-- Update V2QuestionHistory.library
UPDATE "V2QuestionHistory" SET library = 'knowledge' WHERE library = 'skills';
UPDATE "V2QuestionHistory" SET library = 'it' WHERE library = 'it-skills';

-- Update StagedSource.libraryId
UPDATE "StagedSource" SET "libraryId" = 'knowledge' WHERE "libraryId" = 'skills';
UPDATE "StagedSource" SET "libraryId" = 'it' WHERE "libraryId" = 'it-skills';

-- Update IntegrationConnection references if any
UPDATE "IntegrationConnection" SET name = REPLACE(name, 'skills', 'knowledge') WHERE name LIKE '%skills%';
