-- Enable commonly used PostgreSQL extensions for local development
-- This script runs automatically when the container is first created

-- UUID generation (if not using Prisma's default cuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search improvements
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "citext";

-- Print confirmation
DO $$
BEGIN
  RAISE NOTICE 'Local development database initialized with extensions';
END $$;
