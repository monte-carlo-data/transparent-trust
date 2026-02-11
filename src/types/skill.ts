export type SkillFact = {
  question: string;
  answer: string;
};

/**
 * @deprecated Since 2024-12 - Use sourceUrls and content fields on Skill instead.
 * Will be removed after 2025-03-01. See TECH_DEBT.md for migration plan.
 */
export type SkillInformation = {
  /** @deprecated Use Skill.content instead */
  responseTemplate?: string;
  /** @deprecated Use Skill.sourceUrls instead */
  sources?: string[];
};

// Default categories - users can customize via Admin > Settings > Categories
// Keep this list small - users should add domain-specific categories
export const DEFAULT_SKILL_CATEGORIES = [
  "Product & Features",
  "Security & Compliance",
  "Integrations",
  "Pricing & Plans",
  "Company",
  "Other",
] as const;

// Category type for user-defined categories
export type SkillCategoryItem = {
  id: string;
  name: string;
  description?: string;
  color?: string; // Optional color for UI display
  createdAt: string;
};

/**
 * @deprecated Since 2024-12 - Use `string` directly or `categories: string[]` on Skill.
 * Will be removed after 2025-03-01.
 */
export type SkillCategory = string;

export type SourceUrl = {
  url: string;
  title?: string; // User-friendly name for the URL
  addedAt: string;
  lastFetchedAt?: string;
};

// Source document info (for skills built from uploaded documents)
export type SourceDocument = {
  id: string;
  filename: string;
  uploadedAt: string;
};

export type SkillOwner = {
  userId?: string; // Links to User table for SSO users
  name: string;
  email?: string;
  image?: string; // User avatar URL
};

export type SkillHistoryEntry = {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
};

export type SyncStatus = "synced" | "pending" | "failed" | null;

export type Skill = {
  id: string;
  title: string;
  /** Broad capability areas this skill belongs to (can be multiple) */
  categories?: string[];
  /**
   * @deprecated Since 2024-12 - Use categories[] instead.
   * Kept for backwards compatibility migration. Will be removed after 2025-03-01.
   */
  category?: SkillCategory;
  content: string;
  quickFacts: SkillFact[];
  edgeCases: string[];
  /** URLs used to build/update this skill */
  sourceUrls: SourceUrl[];
  /** Documents used to build this skill */
  sourceDocuments?: SourceDocument[];
  /**
   * @deprecated Since 2024-12 - Use sourceUrls and content fields instead.
   * Kept for backwards compatibility migration. Will be removed after 2025-03-01.
   */
  information?: SkillInformation;
  /**
   * @deprecated Since 2026-01 - Use status instead.
   * Legacy field kept for backwards compatibility. Will be removed in future version.
   */
  isActive?: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  lastRefreshedAt?: string;
  /**
   * @deprecated Since 2024-12 - Use sourceUrls instead.
   * Kept for backwards compatibility migration. Will be removed after 2025-03-01.
   */
  lastSourceLink?: string;
  /** Subject matter experts responsible for this skill */
  owners?: SkillOwner[];
  /** Audit trail of changes */
  history?: SkillHistoryEntry[];
  // Git sync tracking
  /** Sync status: "synced", "pending", "failed", or null (unknown) */
  syncStatus?: SyncStatus;
  /** Last successful sync to/from git */
  lastSyncedAt?: string;
  // Usage tracking
  /** Number of times this skill has been used in answers */
  usageCount?: number;
  /** Last time this skill was used in an answer */
  lastUsedAt?: string;
};
