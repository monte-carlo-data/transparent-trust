export type IntegrationStatus = {
  configured: boolean;
  lastTestedAt?: string;
  error?: string;
};

export type BrandingSettings = {
  appName: string;
  tagline: string;
  sidebarSubtitle: string;
  primaryColor: string;
};

export type SettingsResponse = {
  integrations: {
    salesforce: IntegrationStatus;
    slack: IntegrationStatus;
    anthropic: IntegrationStatus;
    google: IntegrationStatus;
  };
  appSettings: {
    maxFileUploadMb: number;
    defaultModel: string;
  };
  branding?: BrandingSettings;
};

export type IntegrationConfig = {
  name: string;
  description: string;
  envVars: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
  docsUrl?: string;
};

export type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

export type FeatureUsage = {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

export type DailyUsage = {
  date: string;
  tokens: number;
  cost: number;
  calls: number;
};

export type RecentCall = {
  id: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
  userEmail?: string;
};

export type UsageData = {
  summary: UsageSummary;
  byFeature: FeatureUsage[];
  daily: DailyUsage[];
  recentCalls: RecentCall[];
};

export type AuditEntityType =
  | "SKILL"
  | "CUSTOMER"
  | "PROJECT"
  | "DOCUMENT"
  | "REFERENCE_URL"
  | "CONTRACT"
  | "USER"
  | "SETTING"
  | "PROMPT"
  | "CONTEXT_SNIPPET"
  | "ANSWER";

export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "VIEWED"
  | "EXPORTED"
  | "OWNER_ADDED"
  | "OWNER_REMOVED"
  | "STATUS_CHANGED"
  | "REFRESHED"
  | "MERGED"
  | "CORRECTED"
  | "APPROVED"
  | "REVIEW_REQUESTED"
  | "FLAG_RESOLVED"
  | "CLARIFY_USED";

export type AuditLogEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityTitle: string | null;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RateLimitSettingItem = {
  key: string;
  value: string;
  description: string;
  isDefault: boolean;
};
