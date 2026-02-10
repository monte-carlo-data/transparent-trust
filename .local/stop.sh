#!/bin/bash
# Stop local development environment
# Usage: ./.local/stop.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Stopping local development environment..."
docker compose --profile tools down

echo "Local development environment stopped."
