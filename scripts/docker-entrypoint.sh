#!/bin/sh
# Docker entrypoint script that constructs DATABASE_URL from DB_* components
# This runs BEFORE Node.js starts, ensuring DATABASE_URL is available when Prisma loads

set -e

# If DATABASE_URL is already set, use it as-is
if [ -n "$DATABASE_URL" ]; then
  echo "Using existing DATABASE_URL"
else
  # Construct DATABASE_URL from individual components (RDS-managed secret approach)
  if [ -n "$DB_HOST" ] && [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    DB_PORT="${DB_PORT:-5432}"
    DB_SSL="${DB_SSL:-true}"

    # URL-encode the password (handle special characters)
    ENCODED_PASSWORD=$(printf '%s' "$DB_PASSWORD" | node -e "process.stdout.write(encodeURIComponent(require('fs').readFileSync(0, 'utf8')))" 2>/dev/null || printf '%s' "$DB_PASSWORD")

    if [ "$DB_SSL" = "true" ]; then
      SSL_PARAM="?sslmode=require"
    else
      SSL_PARAM=""
    fi

    export DATABASE_URL="postgresql://${DB_USERNAME}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}${SSL_PARAM}"
    echo "Constructed DATABASE_URL from DB_* components"
  else
    echo "Warning: Neither DATABASE_URL nor complete DB_* components provided"
  fi
fi

# Execute the main command
exec "$@"
