#!/bin/bash
# Homebrew dependencies for transparent-trust development
# Run: ./.local/brew-dependencies.sh
#
# This installs everything needed to run scripts/rds-query.sh

set -e

echo "Installing Homebrew dependencies for transparent-trust..."
echo ""

# AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    brew install awscli
else
    echo "AWS CLI already installed"
fi

# AWS Session Manager Plugin (required for SSM port forwarding)
if ! command -v session-manager-plugin &> /dev/null; then
    echo "Installing Session Manager Plugin..."
    brew install --cask session-manager-plugin
else
    echo "Session Manager Plugin already installed"
fi

# PostgreSQL client (for psql, pg_dump, etc.)
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL client..."
    brew install libpq
    brew link --force libpq
else
    echo "PostgreSQL client already installed"
fi

# jq for JSON parsing in scripts
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    brew install jq
else
    echo "jq already installed"
fi

echo ""
echo "=== Verification ==="
echo "aws:                    $(command -v aws || echo 'NOT FOUND')"
echo "session-manager-plugin: $(command -v session-manager-plugin || echo 'NOT FOUND')"
echo "psql:                   $(command -v psql || echo 'NOT FOUND')"
echo "jq:                     $(command -v jq || echo 'NOT FOUND')"
echo ""
echo "Done! You can now run: ./scripts/rds-query.sh"
