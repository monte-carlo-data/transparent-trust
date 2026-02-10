# Integration Credentials Setup Guide

Store Slack, Zendesk, and Notion credentials in AWS Secrets Manager (via PR #12 infrastructure). Adapters read directly from Secrets Manager when needed.

## Credentials to Create

Create secrets in AWS Secrets Manager by library (support multiple bots):

| Integration | Library/Purpose | Secret Name | Value |
|---|---|---|---|
| **Slack** | IT | `transparent-trust-slack-bot-token-it` | Bot User OAuth Token (xoxb-...) |
| **Slack** | Knowledge | `transparent-trust-slack-bot-token-knowledge` | Bot User OAuth Token (xoxb-...) |
| **Slack** | GTM | `transparent-trust-slack-bot-token-gtm` | Bot User OAuth Token (xoxb-...) |
| **Slack** | Customer Profiles | `transparent-trust-slack-bot-token-customers` | Bot User OAuth Token (xoxb-...) |
| **Salesforce** | Customer Profiles | `transparent-trust-salesforce-client-id` | OAuth Client ID |
| **Salesforce** | Customer Profiles | `transparent-trust-salesforce-client-secret` | OAuth Client Secret |
| **Salesforce** | Customer Profiles | `transparent-trust-salesforce-refresh-token` | OAuth Refresh Token |
| **Salesforce** | Customer Profiles | `transparent-trust-salesforce-instance-url` | Instance URL (https://company.salesforce.com) |
| **Zendesk** | Internal | `transparent-trust-zendesk-internal-subdomain` | Account subdomain (e.g., mycompany) |
| **Zendesk** | Internal | `transparent-trust-zendesk-internal-email` | API user email |
| **Zendesk** | Internal | `transparent-trust-zendesk-internal-api-token` | API token |
| **Zendesk** | Support (future) | `transparent-trust-zendesk-support-subdomain` | Account subdomain |
| **Zendesk** | Support (future) | `transparent-trust-zendesk-support-email` | API user email |
| **Zendesk** | Support (future) | `transparent-trust-zendesk-support-api-token` | API token |
| **Notion** | IT & Knowledge | `transparent-trust-notion-api-token` | Internal Integration token (secret_...) |

*Create credentials for integrations you're using. Slack tokens are per-library. Salesforce and Zendesk credentials are shared. Notion uses a single shared token.*

## Step 1: Integration Secrets via Terraform

Integration secrets are managed via Terraform in `infrastructure/integrations-secrets.tf`. Variables are defined in each environment's variables file (e.g., `infrastructure/env/example/variables.tf`).

**To create the secrets during deployment, pass credential values to terraform apply:**

```bash
terraform apply \
  -var="slack_bot_token_it=xoxb-..." \
  -var="slack_bot_token_knowledge=xoxb-..." \
  -var="slack_bot_token_gtm=xoxb-..." \
  -var="slack_bot_token_customers=xoxb-..." \
  -var="salesforce_client_id=..." \
  -var="salesforce_client_secret=..." \
  -var="salesforce_refresh_token=..." \
  -var="salesforce_instance_url=https://company.salesforce.com" \
  -var="zendesk_internal_subdomain=mycompany" \
  -var="zendesk_internal_email=api@company.com" \
  -var="zendesk_internal_api_token=..." \
  -var="notion_api_token=secret_..."
```

Or use a `.tfvars` file:
```bash
terraform apply -var-file="prod.tfvars"
```

**prod.tfvars example:**
```hcl
slack_bot_token_it = "xoxb-..."
slack_bot_token_knowledge = "xoxb-..."
slack_bot_token_gtm = "xoxb-..."
slack_bot_token_customers = "xoxb-..."
salesforce_client_id = "..."
salesforce_client_secret = "..."
salesforce_refresh_token = "..."
salesforce_instance_url = "https://company.salesforce.com"
zendesk_internal_subdomain = "mycompany"
zendesk_internal_email = "api@company.com"
zendesk_internal_api_token = "..."
notion_api_token = "secret_..."
```

The Terraform file creates each secret only if a non-empty value is provided (using `count` logic). Secrets are stored in AWS Secrets Manager with the naming pattern:
- `{ENVIRONMENT}/{project_name}-{secret_name}`

## Step 2: Integration Adapters (Already Updated)

Adapters have been updated to read from Secrets Manager instead of the database. They fetch credentials at runtime using the library ID:

**Slack Adapter** (`src/lib/v2/sources/adapters/slack-adapter.ts`):
```typescript
private async loadCredentials(options: DiscoveryOptions): Promise<SlackCredentials> {
  if (this.credentials) return this.credentials;

  // Load from Secrets Manager based on library ID
  const { getSecret } = await import('@/lib/secrets');

  const secretName = `transparent-trust-slack-bot-token-${options.libraryId}`;
  const secretValue = await getSecret(secretName);
  const botToken = typeof secretValue === 'string' ? secretValue : secretValue.botToken;

  if (!botToken) {
    throw new Error(`Slack bot token not configured in Secrets Manager (${secretName})`);
  }

  this.credentials = { botToken };
  return this.credentials;
}

// Update discover method to pass options to loadCredentials
async discover(options: DiscoveryOptions): Promise<DiscoveredSource<SlackStagedSource>[]> {
  await this.loadCredentials(options);  // Pass options instead of connectionId
  // ... rest of discover method
}
```

**Zendesk Adapter** (`src/lib/v2/sources/adapters/zendesk-adapter.ts`):
```typescript
private async loadCredentials(options: DiscoveryOptions): Promise<ZendeskCredentials> {
  if (this.credentials) return this.credentials;

  const { getSecret } = await import('@/lib/secrets');

  // Zendesk credentials are shared (not per-library)
  const subdomain = await getSecret('transparent-trust-zendesk-subdomain');
  const email = await getSecret('transparent-trust-zendesk-email');
  const apiToken = await getSecret('transparent-trust-zendesk-api-token');

  if (!subdomain || !email || !apiToken) {
    throw new Error('Zendesk credentials not configured in Secrets Manager');
  }

  this.credentials = {
    subdomain: typeof subdomain === 'string' ? subdomain : subdomain.value,
    email: typeof email === 'string' ? email : email.value,
    apiToken: typeof apiToken === 'string' ? apiToken : apiToken.value,
  };
  return this.credentials;
}

async discover(options: DiscoveryOptions): Promise<DiscoveredSource<ZendeskStagedSource>[]> {
  await this.loadCredentials(options);
  // ... rest of discover method
}
```

**Notion Adapter** (`src/lib/v2/sources/adapters/notion-adapter.ts`):
```typescript
private async loadCredentials(options: DiscoveryOptions): Promise<NotionCredentials> {
  if (this.credentials) return this.credentials;

  const { getSecret } = await import('@/lib/secrets');

  const secretValue = await getSecret('transparent-trust-notion-api-token');
  const apiToken = typeof secretValue === 'string' ? secretValue : secretValue.apiToken;

  if (!apiToken) {
    throw new Error('Notion API token not configured in Secrets Manager');
  }

  this.credentials = { apiToken };
  return this.credentials;
}

async discover(options: DiscoveryOptions): Promise<DiscoveredSource<NotionStagedSource>[]> {
  await this.loadCredentials(options);
  // ... rest of discover method
}
```

## Step 3: Database Schema Update

Update `prisma/schema.prisma` to remove the `credentials` field from `IntegrationConnection` (it will no longer store actual credentials):

```prisma
model IntegrationConnection {
  id                String    @id @default(cuid())
  integrationType   String    // 'slack', 'zendesk', 'notion'
  name              String
  config            Json?     // Still stores config: channels, tags, filters, etc.
  status            String    @default("ACTIVE") // ACTIVE, INACTIVE, ERROR
  lastSyncAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Remove this line:
  // credentials       Json?     // No longer needed - credentials in Secrets Manager

  @@index([integrationType])
  @@index([status])
}
```

Create a migration:
```bash
npx prisma migrate dev --name remove_credentials_from_integration_connection
```

## Step 4: Update Integration Connect Endpoints

The endpoints still accept credentials from the user (for validation), but don't store them in the database. Instead, they store them directly in Secrets Manager:

**`src/app/api/v2/integrations/slack/connect/route.ts`**:

```typescript
// Validate token and discover sources
const discovered = await discoverSlackSources(token);

// Store in Secrets Manager
const { putSecret } = await import('@/lib/secrets');
await putSecret('transparent-trust-slack-bot-token', token);

// Store connection metadata (no credentials)
let connection = await prisma.integrationConnection.findFirst({
  where: { integrationType: 'slack', name: 'IT Support Slack' },
});

if (connection) {
  connection = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      config: { channels: channelIds, ... },
      status: 'ACTIVE',
      lastSyncAt: new Date(),
    },
  });
} else {
  connection = await prisma.integrationConnection.create({
    data: {
      integrationType: 'slack',
      name: 'IT Support Slack',
      config: { channels: channelIds, ... },
      status: 'ACTIVE',
    },
  });
}
```

Same pattern for Zendesk and Notion endpoints.

## Step 5: Deploy

The deployment process:

1. **Create integration secrets in AWS Secrets Manager:**
   ```bash
   cd infrastructure/env/prod
   terraform apply -var-file=prod.tfvars
   ```
   This creates up to 18 secrets:
   - 4 Slack bot tokens (it, knowledge, gtm, customers)
   - 4 Salesforce credentials (client-id, client-secret, refresh-token, instance-url)
   - 3 Zendesk Internal credentials (subdomain, email, api-token)
   - 3 Zendesk Support credentials (subdomain, email, api-token - future)
   - 1 Notion API token

2. **Apply database migration:**
   ```bash
   npx prisma migrate deploy
   ```
   This removes the `credentials` field from `IntegrationConnection` if you're upgrading from an older version.

3. **Deploy application code:**
   ```bash
   vercel deploy --prod  # or your deployment method
   ```
   The application will read credentials from Secrets Manager at runtime via the integration endpoints and adapters.

## Local Development

For local development, the `getSecret()` function already handles fallback to environment variables:

1. Create `.env.local`:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
ZENDESK_SUBDOMAIN=mycompany
ZENDESK_EMAIL=api@company.com
ZENDESK_API_TOKEN=...
NOTION_API_TOKEN=secret_...
```

2. The adapters will read from `.env.local` automatically (no Secrets Manager needed locally)

## Summary

**Architecture:**
- Credentials stored in AWS Secrets Manager (enterprise security)
- Adapters fetch directly from Secrets Manager at runtime
- Database stores only configuration (channels, tags, filters)
- Integration endpoints accept credentials, validate, and store in Secrets Manager
- Single tenant, single set of credentials per integration type

**Benefits:**
- All secrets managed in one place (Secrets Manager)
- Rotation, audit, access control via AWS
- KMS encryption with key management
- Local development with `.env.local` fallback
- Clean database schema (no sensitive data stored)
