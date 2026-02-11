# Transparent Trust

AI-powered RFP response platform with full transparency. Answer security questionnaires, vendor assessments, and compliance requests at scale with complete visibility into how answers are generated.

## Quick Start

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .local/.env.local.example .env.local
# Edit .env.local with your API keys (DATABASE_URL instructions below)
```

### Database Options

**Option 1: AWS RDS (Recommended)** - Connect to production or dev RDS instance:
```bash
# Set DATABASE_URL to your RDS endpoint
export DATABASE_URL="postgresql://user:password@rds-instance.region.rds.amazonaws.com:5432/database"

# Run migrations (recommended)
./scripts/migrate-local.sh

# Or deploy migrations directly
npx prisma migrate deploy

npm run dev
```

**Option 2: Docker Compose** - Local PostgreSQL with Docker:
```bash
# Set DATABASE_URL to local Docker instance (port 55432)
docker compose up -d
export DATABASE_URL="postgresql://devuser:dev_password@localhost:55432/devuser?schema=public"
npx prisma migrate dev
npm run dev
```

See [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for migration management.

Open [http://localhost:3000](http://localhost:3000) to access the platform.

### AWS Deployment

The application deploys to AWS using Terraform. See [infrastructure/](infrastructure/) and [docs/runbooks/deploy.md](docs/runbooks/deploy.md) for deployment details.

## Features

### RFP Projects
Bulk questionnaire processing with Excel/CSV upload, multi-tab merge, AI-generated answers grounded in your knowledge base, per-question review workflow with Slack notifications, and export to original format.

### Knowledge Management
Build your response library with Skills (structured knowledge chunks), Documents (PDFs, Word, text), and URLs (auto-fetched web pages). AI auto-categorization, source tracking, and refresh capabilities with diff preview.

### Full Transparency
Every AI response includes confidence scores (High/Medium/Low), source citations (which skills/documents contributed), reasoning (how the answer was derived), and editable prompts via the Prompt Builder.

### Chat Interface
Conversational knowledge access with skill selection, customer context loading, instruction presets, and full conversation history audit trail.

### Contract Analysis
Extract key terms and obligations, identify risks and compliance concerns, generate summaries and recommendations.

## Tech Stack

Next.js 15, React 19, Claude API (Anthropic), PostgreSQL 16 with Prisma, NextAuth.js with Google/Okta OAuth, Tailwind CSS with shadcn/ui, React Query, Zustand, Upstash Redis (optional), Slack integration.

## Permissions

Capability-based system with `ASK_QUESTIONS`, `CREATE_PROJECTS`, `REVIEW_ANSWERS`, `MANAGE_KNOWLEDGE`, `MANAGE_PROMPTS`, `VIEW_ORG_DATA`, `MANAGE_USERS`, and `ADMIN`. Capabilities assigned via SSO group mappings (Okta, Azure AD, Google) or directly to users.

## Environment Variables

```bash
# Database (RDS for production/dev, local Docker for development)
DATABASE_URL="postgresql://user:password@rds-instance.region.rds.amazonaws.com:5432/database"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Rate Limiting (optional)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Slack Integration (optional)
SLACK_WEBHOOK_URL="your-slack-webhook-url"
```

See [.local/README.md](.local/README.md) for local database configuration details.

## Development

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # Run ESLint
npx prisma studio  # Open database GUI
```

## Project Structure

```
src/app/              # Next.js App Router (api, chat, contracts, knowledge, projects, admin)
src/components/       # React components + shadcn/ui
src/lib/              # Utilities (promptBlocks, auth, capabilities, prisma)
infrastructure/       # Terraform modules for AWS deployment
```

For AWS deployment details, see [docs/runbooks/deploy.md](docs/runbooks/deploy.md).

## Third-Party Integrations

The platform supports optional integrations with external systems:

| Integration | Purpose |
|-------------|---------|
| **Salesforce** | Customer data enrichment |
| **Google OAuth** | SSO + Slides template filling |
| **Snowflake** | GTM data queries |
| **Okta** | Enterprise SSO with group sync |
| **Slack** | Review notifications |

All integrations are **optional**. The platform works fully without any external integrations. See [docs/INTEGRATION_CREDENTIALS_SETUP.md](docs/INTEGRATION_CREDENTIALS_SETUP.md) for setup instructions.

## Documentation

- **Third-Party Integrations**: See [docs/INTEGRATION_CREDENTIALS_SETUP.md](docs/INTEGRATION_CREDENTIALS_SETUP.md) for Salesforce, Google, Snowflake, Okta, and Slack setup
- **AWS Deployment**: See [docs/runbooks/deploy.md](docs/runbooks/deploy.md) for deployment procedures
- **Database Migrations**: See [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for migration management
- **Prompt System**: See `/admin/prompt-blocks` for the composable prompt builder
- **API**: All routes documented in `/src/app/api/` with JSDoc comments
- **Database Schema**: See `prisma/schema.prisma` for data models

## License

MIT - See [LICENSE](LICENSE) for details.
