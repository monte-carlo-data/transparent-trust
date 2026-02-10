/**
 * Company-Specific Configuration
 *
 * This file centralizes all company/organization-specific values.
 * The open-source repo ships with generic defaults.
 *
 * For your private deployment, create a `company.config.local.ts` or
 * set the corresponding environment variables to override these defaults.
 *
 * Environment variables take precedence over the values defined here.
 */

export const COMPANY_CONFIG = {
  // ---------------------------------------------------------------------------
  // Company Identity
  // ---------------------------------------------------------------------------

  /** Company name used in prompts and UI placeholders */
  name: process.env.COMPANY_NAME || "",

  /** Product/platform name used in RFP and chat responses */
  productName: process.env.PRODUCT_NAME || "",

  /** Primary company domain (e.g., "acme.com") */
  domain: process.env.COMPANY_DOMAIN || "",

  // ---------------------------------------------------------------------------
  // Admin Access
  // ---------------------------------------------------------------------------

  /** Comma-separated admin email addresses (fallback if ADMIN_EMAILS env var is not set) */
  adminEmails: process.env.ADMIN_EMAILS || "",

  // ---------------------------------------------------------------------------
  // Trust & Compliance
  // ---------------------------------------------------------------------------

  /** URL to the company's public trust center (e.g., "https://trust.acme.com") */
  trustCenterUrl: process.env.TRUST_CENTER_URL || "",

  // ---------------------------------------------------------------------------
  // Helpdesk / Support
  // ---------------------------------------------------------------------------

  /** Zendesk helpdesk URL for Slack bot ticket creation */
  zendeskHelpdeskUrl: process.env.ZENDESK_HELPDESK_URL || "",

  // ---------------------------------------------------------------------------
  // Infrastructure
  // ---------------------------------------------------------------------------

  /** Primary domain for the application (set in terraform.tfvars for deployment) */
  appDomain: process.env.APP_DOMAIN || "localhost:3000",

  /** Monitoring alert email for AWS CloudWatch alarms */
  monitoringEmail: process.env.MONITORING_ALERT_EMAIL || "",

  // ---------------------------------------------------------------------------
  // Git Sync
  // ---------------------------------------------------------------------------

  /** GitHub organization or user that owns the repo */
  githubRepoOwner: process.env.GITHUB_REPO_OWNER || "",

  /** GitHub repository name */
  githubRepoName: process.env.GITHUB_REPO_NAME || "transparent-trust",

  // ---------------------------------------------------------------------------
  // AWS Accounts (for infrastructure/Terraform - not used at runtime)
  // ---------------------------------------------------------------------------

  /** AWS root account ID (for DNS zone management) */
  awsRootAccountId: process.env.AWS_ROOT_ACCOUNT_ID || "",

  /** AWS dev account ID */
  awsDevAccountId: process.env.AWS_DEV_ACCOUNT_ID || "",

  /** AWS production account ID */
  awsProdAccountId: process.env.AWS_PROD_ACCOUNT_ID || "",
} as const;
