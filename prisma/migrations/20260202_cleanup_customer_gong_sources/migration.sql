-- Clean Slate Migration: Remove existing customer-scoped Gong sources
-- Part of GTM-first Gong discovery with customer linking feature
--
-- This migration removes all Gong sources that have a customerId set,
-- as they will be replaced by the new linking workflow:
-- 1. Gong calls are discovered at GTM library level (customerId=null)
-- 2. Users link specific calls to customers via "Link to Customer" button
-- 3. Linked sources are copies with lazy content sync
--
-- Note: This is a data migration only. No schema changes.
-- The actual deletion is performed in migration.post.ts

-- This file intentionally left mostly empty
-- Data cleanup is handled in migration.post.ts for better error handling
SELECT 1;
