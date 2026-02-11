#!/bin/bash
# One-command setup for local development
# Usage: ./.local/setup.sh
#
# This script will:
# 1. Check prerequisites (Docker, Node.js)
# 2. Install npm dependencies
# 3. Copy environment file (if needed)
# 4. Start Docker services (PostgreSQL, Redis)
# 5. Run database migrations
# 6. Optionally seed the database
# 7. Start the development server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================
print_step "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed."
    echo ""
    echo "Please install Docker Desktop:"
    echo "  Mac: https://docs.docker.com/desktop/install/mac-install/"
    echo "  Windows: https://docs.docker.com/desktop/install/windows-install/"
    echo ""
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running."
    echo ""
    echo "Please start Docker Desktop and try again."
    echo ""
    exit 1
fi
print_success "Docker is installed and running"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed."
    echo ""
    echo "Please install Node.js (v20 or later):"
    echo "  https://nodejs.org/en/download/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. You have: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi
print_success "npm $(npm -v) is installed"

# =============================================================================
# Step 2: Install Dependencies
# =============================================================================
print_step "Installing npm dependencies..."
cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
    npm install --legacy-peer-deps
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed (run 'npm install' to update)"
fi

# =============================================================================
# Step 3: Setup Environment File
# =============================================================================
print_step "Setting up environment file..."

if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    cp "$SCRIPT_DIR/.env.local.example" "$PROJECT_ROOT/.env.local"
    print_success "Created .env.local from template"
    print_warning "IMPORTANT: Edit .env.local and add your ANTHROPIC_API_KEY"
    echo ""
    echo "   Open .env.local and replace 'sk-ant-your-api-key-here' with your actual key."
    echo "   Get an API key at: https://console.anthropic.com/"
    echo ""
    read -p "Press Enter after you've added your API key (or Ctrl+C to exit and do it later)..."
else
    print_success ".env.local already exists"
fi

# =============================================================================
# Step 4: Start Docker Services
# =============================================================================
print_step "Starting Docker services (PostgreSQL, Redis)..."
cd "$SCRIPT_DIR"

docker compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U devuser -d devuser > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    sleep 1
    RETRIES=$((RETRIES-1))
done
echo ""

if [ $RETRIES -eq 0 ]; then
    print_error "PostgreSQL failed to start. Check logs with: cd .local && docker compose logs postgres"
    exit 1
fi

print_success "PostgreSQL is ready on localhost:55432"
print_success "Redis is ready on localhost:56379"

# =============================================================================
# Step 5: Run Database Migrations
# =============================================================================
print_step "Running database migrations..."
cd "$PROJECT_ROOT"

npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate dev
print_success "Database migrations complete"

# =============================================================================
# Step 6: Seed Database (Optional)
# =============================================================================
print_step "Checking for seed data..."

if npm run --silent 2>/dev/null | grep -q "seed:customers"; then
    read -p "Would you like to seed the database with sample data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run seed:customers 2>/dev/null || true
        print_success "Database seeded"
    else
        print_success "Skipped seeding"
    fi
fi

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Local environment is ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Services running:"
echo "  - PostgreSQL: localhost:55432"
echo "  - Redis:      localhost:56379"
echo ""
echo "To start the development server, run:"
echo ""
echo -e "  ${BLUE}npm run dev${NC}"
echo ""
echo "Then open http://localhost:3000 in your browser."
echo ""
echo "Other useful commands:"
echo "  - Stop services:  ./.local/stop.sh"
echo "  - Reset database: ./.local/reset.sh"
echo "  - View DB:        ./.local/start.sh --with-tools  (then visit http://localhost:58080)"
echo ""
