# Local Development Environment

This folder contains everything you need to run the application locally with a Docker-based PostgreSQL database.

## Prerequisites

Before you begin, make sure you have:

1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
   - After installing, make sure Docker is running (you should see the whale icon in your menu bar)

2. **Node.js v18+** - [Download here](https://nodejs.org/)
   - We recommend the LTS version

3. **An Anthropic API Key** - [Get one here](https://console.anthropic.com/)
   - Required for AI features

## Quick Start (One Command)

Run this single command from the project root to set up everything:

```bash
./.local/setup.sh
```

This will:
1. Check that Docker and Node.js are installed
2. Install npm dependencies
3. Create your `.env.local` file
4. Start PostgreSQL and Redis in Docker
5. Run database migrations
6. Get you ready to run the app

After setup completes, start the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Manual Setup (Step by Step)

If you prefer to run each step manually:

### 1. Start Docker Services

```bash
./.local/start.sh
```

### 2. Create Environment File

```bash
cp .local/.env.local.example .env.local
```

Then edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY="sk-ant-your-actual-key-here"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Database Migrations

```bash
npx prisma migrate dev
```

### 5. Start the App

```bash
npm run dev
```

---

## Services

When running, you'll have these services available:

| Service    | Port  | URL / Connection String |
|------------|-------|-------------------------|
| App        | 3000  | http://localhost:3000   |
| PostgreSQL | 55432 | `postgresql://devuser:dev_password@localhost:55432/devuser` |
| Redis      | 56379 | `redis://localhost:56379` |
| Adminer    | 58080 | http://localhost:58080 (optional, see below) |

---

## Common Commands

### Start/Stop Services

```bash
# Start PostgreSQL and Redis
./.local/start.sh

# Stop all services
./.local/stop.sh

# Reset database (WARNING: deletes all data)
./.local/reset.sh
```

### View Database with Adminer

Adminer is a simple web-based database viewer. To use it:

```bash
./.local/start.sh --with-tools
```

Then open http://localhost:58080 and log in with:
- **System:** PostgreSQL
- **Server:** postgres
- **Username:** devuser
- **Password:** dev_password
- **Database:** devuser

### View Logs

```bash
# PostgreSQL logs
cd .local && docker compose logs -f postgres

# All services
cd .local && docker compose logs -f
```

### Access Database Shell

```bash
cd .local && docker compose exec postgres psql -U devuser -d devuser
```

---

## Troubleshooting

### "Docker is not running"

Make sure Docker Desktop is open and running. You should see the Docker whale icon in your menu bar (Mac) or system tray (Windows).

### "Port already in use"

Another application is using one of the required ports. Either:
- Stop the other application, or
- Edit `.local/docker-compose.yml` to use different ports

### "Cannot connect to database"

1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep local-postgres
   ```

2. If not running, check the logs:
   ```bash
   cd .local && docker compose logs postgres
   ```

3. Try resetting:
   ```bash
   ./.local/reset.sh
   ```

### "Migration failed"

Make sure PostgreSQL is fully started before running migrations:
```bash
# Wait for PostgreSQL to be ready
cd .local && docker compose exec postgres pg_isready -U devuser -d devuser

# Then run migrations
npx prisma migrate dev
```

### Need to start fresh?

```bash
./.local/reset.sh
npx prisma migrate dev
```

---

## Making Yourself an Admin

After signing in for the first time, you'll need admin access to test most features. Run:

```bash
npx tsx .local/make-admin.ts
```

This will make all existing users in the local database admins.

To make a specific user admin (or create them if they don't exist):

```bash
npx tsx .local/make-admin.ts your@email.com
```

After running the script, refresh your browser to see admin features.

---

## Testing Integrations

To test integrations (Slack, Zendesk, Notion, etc.), add the relevant API keys to your `.env.local` file. See the comments in `.local/.env.local.example` for all available options.

---

## Homebrew Dependencies (macOS)

Install tools needed for RDS database access and AWS scripts:

```bash
./.local/brew-dependencies.sh
```

This installs `awscli`, `session-manager-plugin`, `libpq` (psql), and `jq`.
