import { z } from "zod";

// Export schema type for factory
export type ValidationSchema<T> = z.ZodSchema<T>;

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// SHARED SCHEMAS (reused across multiple entities)
// ============================================

/**
 * Source URL schema - can be either a string URL or a SourceUrl object
 * Used by: Skills (sourceUrls), CustomerProfiles (sourceUrls), IT Skills (sourceUrls)
 */
export const sourceUrlSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url(),
    addedAt: z.string(),
    lastFetchedAt: z.string().optional(),
    // Additional fields for source tracking
    type: z.string().optional(), // e.g., "notion", "url"
    notionPageId: z.string().optional(), // Notion page ID if type is "notion"
    incorporated: z.boolean().optional(), // Whether this source has been incorporated into skill content
  }),
]);

/**
 * Quick fact schema - can be string (legacy) or object
 * Used by: Skills (quickFacts)
 */
export const quickFactSchema = z.union([
  z.string(),
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
]);

// Skill owner schema
const skillOwnerSchema = z.object({
  userId: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
  image: z.string().optional(),
});

// History entry schema
const historyEntrySchema = z.object({
  date: z.string(),
  action: z.string(),
  summary: z.string(),
  user: z.string().optional(),
});

// Skill schemas
export const createSkillSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required").max(100000),
  categories: z.array(z.string()).default([]),
  quickFacts: z.array(quickFactSchema).default([]),
  edgeCases: z.array(z.string()).default([]),
  sourceUrls: z.array(sourceUrlSchema).default([]),
  owners: z.array(skillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
});

// For updates, we use a separate schema without defaults
// This ensures that missing fields remain undefined (not updated)
// rather than being set to default values which would overwrite existing data
export const updateSkillSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  categories: z.array(z.string()).optional(),
  quickFacts: z.array(quickFactSchema).optional(),
  edgeCases: z.array(z.string()).optional(),
  sourceUrls: z.array(sourceUrlSchema).optional(),
  owners: z.array(skillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
  lastRefreshedAt: z.string().optional(),
});

// Customer profile source document schema
const customerSourceDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  uploadedAt: z.string(),
});

const customerOwnerSchema = z.object({
  name: z.string().min(1, "Owner name is required"),
  email: z.string().email().optional(),
  userId: z.string().optional(),
});

// Customer profile schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  industry: z.string().max(100).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  overview: z.string().min(1, "Overview is required").max(50000),
  products: z.string().max(50000).nullable().optional(),
  challenges: z.string().max(50000).nullable().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).default([]),
  sourceUrls: z.array(sourceUrlSchema).default([]),
  sourceDocuments: z.array(customerSourceDocumentSchema).optional(),
  // New content field
  content: z.string().max(100000).optional(),
  considerations: z.array(z.string()).optional(),
  owners: z.array(customerOwnerSchema).nullable().optional(),
  // Salesforce static fields
  salesforceId: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  employeeCount: z.number().optional(),
  annualRevenue: z.number().optional(),
  accountType: z.string().optional(),
  billingLocation: z.string().optional(),
  lastSalesforceSync: z.string().optional(),
});

// For updates, use a separate schema without defaults
// This ensures that missing fields remain undefined (not updated)
export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(100).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  overview: z.string().min(1).max(50000).optional(),
  products: z.string().max(50000).nullable().optional(),
  challenges: z.string().max(50000).nullable().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  sourceUrls: z.array(sourceUrlSchema).optional(),
  sourceDocuments: z.array(customerSourceDocumentSchema).optional(),
  // New content field
  content: z.string().max(100000).optional(),
  considerations: z.array(z.string()).optional(),
  owners: z.array(customerOwnerSchema).nullable().optional(),
  // Salesforce static fields
  salesforceId: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  employeeCount: z.number().optional(),
  annualRevenue: z.number().optional(),
  accountType: z.string().optional(),
  billingLocation: z.string().optional(),
  lastSalesforceSync: z.string().optional(),
});

// Project row schema
const conversationMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const usedSkillSchema = z.union([
  z.string(),
  z.object({ id: z.string(), title: z.string() }),
]);

const clarifyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const projectRowSchema = z.object({
  id: z.string().optional(), // Row ID (for updates)
  rowNumber: z.number().int().min(1),
  question: z.string().min(1, "Question is required"),
  response: z.string().optional(),
  status: z.string().optional(),
  error: z.string().nullable().optional(),
  sourceTab: z.string().nullable().optional(), // Excel tab this row came from
  conversationHistory: z.array(conversationMessageSchema).nullable().optional(),
  confidence: z.string().nullable().optional(),
  sources: z.string().nullable().optional(),
  reasoning: z.string().nullable().optional(),
  inference: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  usedSkills: z.array(usedSkillSchema).nullable().optional(),
  usedFallback: z.boolean().nullable().optional(),
  showRecommendation: z.boolean().nullable().optional(),
  clarifyConversation: z.array(clarifyMessageSchema).nullable().optional(),
  // Flagging fields
  flaggedForReview: z.boolean().nullable().optional(),
  flaggedAt: z.string().datetime().nullable().optional(),
  flaggedBy: z.string().nullable().optional(),
  flagNote: z.string().max(5000).nullable().optional(),
  // Flag resolution fields
  flagResolved: z.boolean().nullable().optional(),
  flagResolvedAt: z.string().datetime().nullable().optional(),
  flagResolvedBy: z.string().nullable().optional(),
  flagResolutionNote: z.string().max(5000).nullable().optional(),
  // Queue fields
  queuedForReview: z.boolean().nullable().optional(),
  queuedAt: z.string().datetime().nullable().optional(),
  queuedBy: z.string().nullable().optional(),
  queuedNote: z.string().max(5000).nullable().optional(),
  queuedReviewerId: z.string().nullable().optional(),
  queuedReviewerName: z.string().nullable().optional(),
  // Review workflow fields
  reviewStatus: z.enum(["NONE", "REQUESTED", "APPROVED", "CORRECTED"]).nullable().optional(),
  reviewRequestedAt: z.string().datetime().nullable().optional(),
  reviewRequestedBy: z.string().nullable().optional(),
  reviewNote: z.string().max(5000).nullable().optional(),
  assignedReviewerId: z.string().nullable().optional(),
  assignedReviewerName: z.string().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  userEditedAnswer: z.string().nullable().optional(),
  // Legacy/UI-only fields (not persisted but sent from client)
  challengePrompt: z.string().nullable().optional(),
  challengeResponse: z.string().nullable().optional(),
  challengeStatus: z.string().nullable().optional(),
  challengeError: z.string().nullable().optional(),
  conversationOpen: z.boolean().nullable().optional(),
  selected: z.boolean().nullable().optional(),
  detailsExpanded: z.boolean().nullable().optional(),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  sheetName: z.string().min(1, "Sheet name is required").max(200),
  columns: z.array(z.string()),
  rows: z.array(projectRowSchema),
  ownerId: z.string().optional(), // User ID to assign ownership
  ownerName: z.string().max(200).optional(),
  customerName: z.string().max(200).optional(),
  notes: z.string().max(10000).nullable().optional(),
  status: z.string().optional(),
  categories: z.array(z.string()).optional(), // Skill categories for tiered processing
});

// For updates, use a loose schema that accepts any row data
// The strict validation happens on create, updates just pass through
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  sheetName: z.string().min(1).max(200).optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.any()).optional(), // Accept any row object - validation happens at DB level
  ownerId: z.string().optional(),
  ownerName: z.string().max(200).nullable().optional(),
  customerName: z.string().max(200).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  status: z.string().optional(),
  categories: z.array(z.string()).nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerProfileIds: z.array(z.string()).nullable().optional(),
  reviewRequestedAt: z.any().optional(), // Accept any date format
  reviewRequestedBy: z.string().nullable().optional(),
  reviewedAt: z.any().optional(), // Accept any date format
  reviewedBy: z.string().nullable().optional(),
}).passthrough(); // Allow any additional fields

export const projectRowPatchSchema = z.object({
  flaggedForReview: z.boolean().optional(),
  flagNote: z.string().max(5000).nullable().optional(),
  flagResolved: z.boolean().optional(),
  flagResolutionNote: z.string().max(5000).nullable().optional(),
  queuedForReview: z.boolean().optional(),
  queuedNote: z.string().max(5000).nullable().optional(),
  queuedReviewerId: z.string().nullable().optional(),
  queuedReviewerName: z.string().nullable().optional(),
  reviewStatus: z.enum(["NONE", "REQUESTED", "APPROVED", "CORRECTED"]).optional(),
  reviewNote: z.string().max(5000).nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  reviewedBy: z.string().optional(),
  userEditedAnswer: z.string().optional(),
});

// Document schemas
export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().int().min(0).optional(),
  categories: z.array(z.string()).default([]),
});

// Reference URL schemas
export const createReferenceUrlSchema = z.object({
  url: z.string().url("Valid URL is required"),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  categories: z.array(z.string()).default([]),
});

export const bulkImportUrlsSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url("Valid URL is required"),
    title: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    categories: z.array(z.string()).optional(),
  })),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// IT Skill owner schema
const itSkillOwnerSchema = z.object({
  userId: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
});

// IT Skill schemas
export const createITSkillSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required").max(100000),
  categories: z.array(z.string()).default([]),
  sourceUrls: z.array(sourceUrlSchema).default([]),
  owners: z.array(itSkillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
  // Zendesk-specific fields
  zendeskTags: z.array(z.string()).optional(),
  incorporatedTickets: z.array(z.number()).optional(),
});

export const updateITSkillSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  categories: z.array(z.string()).optional(),
  sourceUrls: z.array(sourceUrlSchema).optional(),
  owners: z.array(itSkillOwnerSchema).optional(),
  history: z.array(historyEntrySchema).optional(),
  // Zendesk-specific fields
  zendeskTags: z.array(z.string()).optional(),
  lastTicketSync: z.string().optional(),
  incorporatedTickets: z.array(z.number()).optional(),
  pendingTickets: z.array(z.number()).optional(),
  // Slack thread fields
  pendingSlackThreads: z.array(z.string()).optional(),
  incorporatedSlackThreads: z.array(z.string()).optional(),
  // Notion page fields
  pendingNotionPages: z.array(z.string()).optional(),
  incorporatedNotionPages: z.array(z.string()).optional(),
});

// Contract schemas
export const createContractSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().int().min(0).optional(),
  customerId: z.string().uuid().optional(),
});

// Chat schemas - simple chat route
export const simpleChatSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1, "messages array is required"),
  systemPrompt: z.string().optional(),
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  quickMode: z.boolean().optional(),
});

// Chat schemas - knowledge chat route
const skillContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  sourceUrls: z.array(sourceUrlSchema).optional(),
});

const customerProfileContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional(),
  // New unified content field (markdown-structured prose)
  content: z.string().optional(),
  considerations: z.array(z.string()).optional(),
  // Legacy fields for backwards compatibility
  overview: z.string().optional(), // Now optional since content replaces it
  products: z.string().optional(),
  challenges: z.string().optional(),
  keyFacts: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(), // Now optional
});

const referenceUrlContextSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  content: z.string().optional(), // Optional content for ephemeral URLs (pre-fetched)
});

const chatMessageItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  defaultText: z.string(),
  text: z.string(),
  enabled: z.boolean(),
});

// GTM data context schema (from Snowflake - Gong, HubSpot, Looker)
const gtmDataContextSchema = z.object({
  salesforceAccountId: z.string(),
  customerName: z.string().optional(),
  // Pre-built context string (if already fetched and formatted)
  contextString: z.string().optional(),
  // Or individual data for server-side formatting
  gongCalls: z.array(z.object({
    id: z.string(),
    title: z.string(),
    date: z.string(),
    duration: z.number(),
    participants: z.array(z.string()),
    summary: z.string().optional(),
    transcript: z.string().optional(),
  })).optional(),
  hubspotActivities: z.array(z.object({
    id: z.string(),
    type: z.string(),
    date: z.string(),
    subject: z.string(),
    content: z.string().optional(),
  })).optional(),
  lookerMetrics: z.array(z.object({
    period: z.string(),
    metrics: z.record(z.string(), z.union([z.string(), z.number()])),
  })).optional(),
});

export const knowledgeChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(50000),
  skills: z.array(skillContextSchema).default([]),
  customerProfiles: z.array(customerProfileContextSchema).optional(),
  documentIds: z.array(z.string()).optional(),
  referenceUrls: z.array(referenceUrlContextSchema).optional(),
  conversationHistory: z.array(chatMessageItemSchema).optional(),
  chatSections: z.array(chatSectionSchema).optional(),
  userInstructions: z.string().max(50000).optional(), // User-facing behavior/persona instructions
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  quickMode: z.boolean().optional(),
  // Call mode for live customer calls - produces ultra-brief responses
  callMode: z.boolean().optional(),
  // GTM data from Snowflake (Gong, HubSpot, Looker)
  gtmData: gtmDataContextSchema.optional(),
  // Enable web search for up-to-date information beyond the knowledge base
  webSearch: z.boolean().optional(),
});

// Legacy chat message schema (for other uses)
export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(50000),
  customerId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  skillIds: z.array(z.string()).optional(),
  urlIds: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
});

// Question answer schema
export const questionAnswerSchema = z.object({
  question: z.string().min(1, "Question is required").max(10000),
  prompt: z.string().max(50000).optional(),
  // Legacy mode: pre-selected skills
  skills: z.array(z.object({
    title: z.string(),
    content: z.string(),
    id: z.string().optional(),
  })).optional(),
  // Progressive mode: tier 1 (core) skills + categories for tier 2/3 search
  tier1Skills: z.array(z.object({
    title: z.string(),
    content: z.string(),
    id: z.string().optional(),
  })).optional(),
  categories: z.array(z.string()).optional(),
  useProgressive: z.boolean().optional(), // Default true if tier1Skills provided
  fallbackContent: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
  })).optional(),
  // Dynamic prompt options
  mode: z.enum(["single", "bulk"]).optional(),
  domains: z.array(z.enum(["technical", "legal", "security"])).optional(),
  // Quick mode uses Haiku for faster responses (2-5s vs 10-30s)
  quickMode: z.boolean().optional(),
});

// Helper to validate and return typed result
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Zod v4 uses issues instead of errors
    const issues = result.error.issues || [];
    const firstIssue = issues[0];
    return {
      success: false,
      error: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid input",
    };
  }
  return { success: true, data: result.data };
}
