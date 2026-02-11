#!/bin/bash
# Reset local development environment (destroys all data!)
# Usage: ./.local/reset.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "WARNING: This will destroy all local database data!"
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping and removing containers and volumes..."
    docker compose --profile tools down -v

    echo "Starting fresh environment..."
    docker compose up -d

    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    until docker compose exec -T postgres pg_isready -U devuser -d devuser > /dev/null 2>&1; do
        sleep 1
    done

    echo ""
    echo "Local development environment has been reset!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: npx prisma migrate dev"
    echo "  2. Run: npm run seed:customers (if needed)"
else
    echo "Reset cancelled."
fi
