#!/bin/bash
# Local migration script - runs migrations using local DATABASE_URL
#
# Usage:
#   ./scripts/migrate-local.sh
#
# Prerequisites:
#   - DATABASE_URL environment variable set
#   - Node.js and npm installed
#   - Prisma CLI available

set -e

echo "=== Local Database Migration ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo ""
  echo "Please set DATABASE_URL:"
  echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
  echo ""
  exit 1
fi

# Mask password in output
MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
echo "Database: $MASKED_URL"
echo ""

# Run migrations
echo "Running migrations..."
node scripts/run-migrations.js

echo ""
echo "✅ Migration complete!"
