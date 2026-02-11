#!/bin/bash
# ECS migration script - runs migrations in AWS ECS environment
#
# This script:
# 1. Fetches database credentials from Secrets Manager
# 2. Constructs DATABASE_URL from RDS endpoint and secret
# 3. Runs Prisma migrations
#
# Usage:
#   ./scripts/migrate-ecs.sh
#
# Environment variables (set by ECS task definition):
#   AWS_REGION - AWS region (default: us-east-1)
#   DB_SECRET_NAME - Name of database secret in Secrets Manager
#   DB_ENDPOINT - RDS endpoint hostname
#   DB_PORT - Database port (default: 5432)
#   DB_NAME - Database name

set -e

echo "=== ECS Database Migration ==="
echo ""

# Default values
AWS_REGION=${AWS_REGION:-us-east-1}
DB_PORT=${DB_PORT:-5432}

# Check required environment variables
if [ -z "$DB_SECRET_NAME" ]; then
  echo "❌ ERROR: DB_SECRET_NAME not set"
  exit 1
fi

if [ -z "$DB_ENDPOINT" ]; then
  echo "❌ ERROR: DB_ENDPOINT not set"
  exit 1
fi

if [ -z "$DB_NAME" ]; then
  echo "❌ ERROR: DB_NAME not set"
  exit 1
fi

echo "Fetching database credentials from Secrets Manager..."
echo "Secret: $DB_SECRET_NAME"
echo "Region: $AWS_REGION"
echo ""

# Fetch secret from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$DB_SECRET_NAME" \
  --query 'SecretString' \
  --output text)

if [ -z "$SECRET_JSON" ]; then
  echo "❌ ERROR: Failed to fetch secret from Secrets Manager"
  exit 1
fi

# Extract credentials from JSON
DB_USERNAME=$(echo "$SECRET_JSON" | jq -r '.username')
DB_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.password')

if [ -z "$DB_USERNAME" ] || [ -z "$DB_PASSWORD" ]; then
  echo "❌ ERROR: Could not parse username/password from secret"
  exit 1
fi

echo "✅ Credentials fetched successfully"
echo "Username: $DB_USERNAME"
echo "Endpoint: $DB_ENDPOINT"
echo "Database: $DB_NAME"
echo ""

# URL encode password for special characters
DB_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('$DB_PASSWORD'))")

# Construct DATABASE_URL
export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}"

# Run migrations
node scripts/run-migrations.js

echo ""
echo "✅ ECS migration complete!"
