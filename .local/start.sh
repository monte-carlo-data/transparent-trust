#!/bin/bash
# Start local development environment
# Usage: ./.local/start.sh [--with-tools]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start services
if [[ "$1" == "--with-tools" ]]; then
    echo "Starting with optional tools (Adminer)..."
    docker compose --profile tools up -d
else
    docker compose up -d
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U devuser -d devuser > /dev/null 2>&1; do
    sleep 1
done

echo ""
echo "Local development environment is ready!"
echo ""
echo "Services:"
echo "  PostgreSQL: localhost:55432"
echo "  Redis:      localhost:56379"
if [[ "$1" == "--with-tools" ]]; then
echo "  Adminer:    http://localhost:58080"
fi
echo ""
echo "Database connection string:"
echo "  postgresql://devuser:dev_password@localhost:55432/devuser"
echo ""
echo "Next steps:"
echo "  1. Copy .local/.env.local.example to .env.local (if not already done)"
echo "  2. Run: npx prisma migrate dev"
echo "  3. Run: npm run dev"
