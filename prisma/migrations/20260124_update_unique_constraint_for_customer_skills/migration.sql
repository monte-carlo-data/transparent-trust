-- Migration: Update unique constraint to include customerId
-- This allows each customer to have their own slugs within the 'customers' library namespace.
-- For global skills (customerId=null): unique by [libraryId, slug]
-- For customer skills (libraryId='customers'): unique by [customerId, slug]

-- Drop the old unique constraint
DROP INDEX IF EXISTS "BuildingBlock_libraryId_slug_key";

-- Create the new unique constraint that includes customerId
CREATE UNIQUE INDEX "BuildingBlock_libraryId_customerId_slug_key" ON "BuildingBlock"("libraryId", "customerId", "slug");
