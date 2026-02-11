import { FileText, Users, FolderKanban, Globe, FileCheck, User, Code, MessageSquare } from "lucide-react";
import { IntegrationConfig, AuditEntityType, AuditAction } from "./types";

export const INTEGRATIONS: Record<string, IntegrationConfig> = {
  notion: {
    name: "Notion",
    description: "Import IT documentation from Notion pages and databases",
    envVars: [
      { key: "NOTION_API_TOKEN", label: "Integration Token", placeholder: "secret_...", isSecret: true },
      { key: "NOTION_DATABASE_IDS", label: "Database IDs (comma-separated)", placeholder: "abc123,def456" },
      { key: "NOTION_PAGE_IDS", label: "Page IDs (comma-separated)", placeholder: "abc123,def456" },
      { key: "NOTION_ROOT_PAGE_ID", label: "Root Page ID (optional)", placeholder: "abc123" },
    ],
    docsUrl: "https://developers.notion.com/docs/create-a-notion-integration",
  },
  slack_knowledge: {
    name: "Slack (Knowledge Library)",
    description: "Connect to Slack for Knowledge library Q&A threads",
    envVars: [
      { key: "SLACK_BOT_TOKEN_KNOWLEDGE", label: "Bot Token (Knowledge)", placeholder: "xoxb-...", isSecret: true },
      { key: "SLACK_APP_TOKEN_KNOWLEDGE", label: "App Token (Knowledge)", placeholder: "xapp-...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/authentication/token-types#bot",
  },
  slack_it: {
    name: "Slack (IT Library)",
    description: "Connect to Slack for IT library support threads",
    envVars: [
      { key: "SLACK_BOT_TOKEN_IT", label: "Bot Token (IT)", placeholder: "xoxb-...", isSecret: true },
      { key: "SLACK_APP_TOKEN_IT", label: "App Token (IT)", placeholder: "xapp-...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/authentication/token-types#bot",
  },
  slack_gtm: {
    name: "Slack (GTM Library)",
    description: "Connect to Slack for GTM library discussions",
    envVars: [
      { key: "SLACK_BOT_TOKEN_GTM", label: "Bot Token (GTM)", placeholder: "xoxb-...", isSecret: true },
      { key: "SLACK_APP_TOKEN_GTM", label: "App Token (GTM)", placeholder: "xapp-...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/authentication/token-types#bot",
  },
  slack_customers: {
    name: "Slack (Customers Library)",
    description: "Connect to Slack for Customers library threads",
    envVars: [
      { key: "SLACK_BOT_TOKEN_CUSTOMERS", label: "Bot Token (Customers)", placeholder: "xoxb-...", isSecret: true },
      { key: "SLACK_APP_TOKEN_CUSTOMERS", label: "App Token (Customers)", placeholder: "xapp-...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/authentication/token-types#bot",
  },
  zendesk: {
    name: "Zendesk",
    description: "Import resolved tickets from Zendesk",
    envVars: [
      { key: "ZENDESK_SUBDOMAIN", label: "Subdomain", placeholder: "yourcompany" },
      { key: "ZENDESK_EMAIL", label: "Admin Email", placeholder: "admin@yourcompany.com" },
      { key: "ZENDESK_API_TOKEN", label: "API Token", placeholder: "...", isSecret: true },
      { key: "ZENDESK_TAGS", label: "Filter Tags (comma-separated)", placeholder: "it-support,resolved" },
    ],
    docsUrl: "https://developer.zendesk.com/api-reference/introduction/security-and-auth/",
  },
  gong: {
    name: "Gong",
    description: "Import call recordings and transcripts from Gong",
    envVars: [
      { key: "GONG_ACCESS_KEY", label: "Access Key", placeholder: "..." },
      { key: "GONG_ACCESS_KEY_SECRET", label: "Access Key Secret", placeholder: "...", isSecret: true },
    ],
    docsUrl: "https://gong.app.gong.io/settings/api/documentation",
  },
  salesforce: {
    name: "Salesforce",
    description: "Pull customer data from Salesforce to enrich profiles",
    envVars: [
      { key: "SALESFORCE_CLIENT_ID", label: "Client ID", placeholder: "3MVG9..." },
      { key: "SALESFORCE_CLIENT_SECRET", label: "Client Secret", placeholder: "ABC123...", isSecret: true },
      { key: "SALESFORCE_REFRESH_TOKEN", label: "Refresh Token", placeholder: "5Aep861...", isSecret: true },
      { key: "SALESFORCE_INSTANCE_URL", label: "Instance URL", placeholder: "https://yourcompany.salesforce.com" },
    ],
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm",
  },
  slack: {
    name: "Slack",
    description: "Send notifications to Slack channels",
    envVars: [
      { key: "SLACK_WEBHOOK_URL", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  snowflake: {
    name: "Snowflake",
    description: "Connect to Snowflake for GTM data (Gong calls, HubSpot activities, Looker metrics)",
    envVars: [
      { key: "SNOWFLAKE_ACCOUNT", label: "Account", placeholder: "your_account.region (e.g., abc12345.us-east-1)" },
      { key: "SNOWFLAKE_USER", label: "Username", placeholder: "your_username" },
      { key: "SNOWFLAKE_PASSWORD", label: "Password", placeholder: "your_password", isSecret: true },
      { key: "SNOWFLAKE_WAREHOUSE", label: "Warehouse", placeholder: "COMPUTE_WH" },
      { key: "SNOWFLAKE_DATABASE", label: "Database", placeholder: "YOUR_DATABASE" },
      { key: "SNOWFLAKE_SCHEMA", label: "Schema", placeholder: "PUBLIC" },
    ],
    docsUrl: "https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver",
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  questions: "Quick Questions",
  chat: "The Oracle (Chat)",
  "skills-suggest": "Knowledge Gremlin (Skills)",
  "customers-suggest": "The Rolodex (Customers)",
  "contracts-analyze": "Clause Checker (Contracts)",
  projects: "Project Answerer",
  "prompt-optimize": "Prompt Optimizer",
  "prompt-build": "Prompt Builder",
};

// Using CSS variables for theme-aware entity colors
export const entityTypeConfig: Record<
  AuditEntityType,
  { label: string; icon: typeof FileText; color: string }
> = {
  SKILL: { label: "Skill", icon: FileText, color: "var(--entity-skill)" },
  CUSTOMER: { label: "Customer", icon: Users, color: "var(--entity-customer)" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "var(--entity-project)" },
  DOCUMENT: { label: "Document", icon: FileText, color: "var(--entity-document)" },
  REFERENCE_URL: { label: "URL", icon: Globe, color: "var(--entity-url)" },
  CONTRACT: { label: "Contract", icon: FileCheck, color: "var(--entity-contract)" },
  USER: { label: "User", icon: User, color: "var(--entity-user)" },
  SETTING: { label: "Setting", icon: FileText, color: "var(--text-tertiary)" },
  PROMPT: { label: "Prompt", icon: FileText, color: "var(--entity-prompt)" },
  CONTEXT_SNIPPET: { label: "Snippet", icon: Code, color: "var(--entity-snippet)" },
  ANSWER: { label: "Answer", icon: MessageSquare, color: "var(--entity-answer)" },
};

// Using CSS variables for theme-aware action colors
export const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "var(--success)" },
  UPDATED: { label: "Updated", color: "var(--info)" },
  DELETED: { label: "Deleted", color: "var(--destructive)" },
  VIEWED: { label: "Viewed", color: "var(--entity-user)" },
  EXPORTED: { label: "Exported", color: "var(--entity-customer)" },
  OWNER_ADDED: { label: "Owner Added", color: "var(--success)" },
  OWNER_REMOVED: { label: "Owner Removed", color: "var(--entity-project)" },
  STATUS_CHANGED: { label: "Status Changed", color: "var(--info)" },
  REFRESHED: { label: "Refreshed", color: "var(--entity-url)" },
  MERGED: { label: "Merged", color: "var(--entity-contract)" },
  CORRECTED: { label: "Corrected", color: "var(--warning)" },
  APPROVED: { label: "Approved", color: "var(--success)" },
  REVIEW_REQUESTED: { label: "Review Requested", color: "var(--entity-customer)" },
  FLAG_RESOLVED: { label: "Flag Resolved", color: "var(--accent-green)" },
  CLARIFY_USED: { label: "Clarify Used", color: "var(--info)" },
};

export const TABS = [
  { id: "branding", label: "Branding" },
  { id: "integrations", label: "Integrations" },
  { id: "auth-groups", label: "Auth Groups" },
  { id: "llm-speed", label: "LLM Speed" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "usage", label: "API Usage" },
  { id: "audit", label: "Audit Log" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
