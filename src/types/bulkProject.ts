export type BulkRow = {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
  sourceTab?: string; // Which Excel tab this row came from (for multi-tab uploads)
  conversationHistory?: { role: string; content: string }[];
  confidence?: string;
  sources?: string;
  reasoning?: string; // What skills matched and what was found directly
  inference?: string; // What was inferred/deduced, or "None" if everything was found directly
  remarks?: string;
  usedSkills?: (string | { id: string; title: string })[]; // Can be Skill objects or string IDs
  usedFallback?: boolean; // True if answer was generated from reference URLs instead of skills
  showRecommendation?: boolean;
  // Flagging (for self-notes, attention markers - independent of review workflow)
  flaggedForReview?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  // Flag resolution (close flag while preserving audit trail)
  flagResolved?: boolean;
  flagResolvedAt?: string;
  flagResolvedBy?: string;
  flagResolutionNote?: string;
  // Queue for batch review (persisted across sessions for collaboration)
  queuedForReview?: boolean;
  queuedAt?: string;
  queuedBy?: string;
  queuedNote?: string;
  queuedReviewerId?: string;
  queuedReviewerName?: string;
  // Review workflow (formal approval process - separate from flagging)
  reviewStatus?: "NONE" | "REQUESTED" | "APPROVED" | "CORRECTED";
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewNote?: string; // Note from requester to reviewer
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userEditedAnswer?: string;
  // Legacy fields for conversational refinement
  challengePrompt?: string;
  challengeResponse?: string;
  challengeStatus?: string;
  challengeError?: string;
  conversationOpen?: boolean;
  selected?: boolean;
  detailsExpanded?: boolean; // Toggle for showing reasoning/inference/remarks/sources
  clarifyConversation?: { role: 'user' | 'assistant'; content: string }[]; // Clarify conversation messages
  transparency?: {
    // Input transparency - what was sent to LLM
    compositionId?: string;
    blockIds?: string[];
    runtimeBlockIds?: string[];
    systemPrompt?: string;
    assembledAt?: string;
    model?: string;
    traceId?: string;
  };
};

// Simplified customer profile reference for projects
export type ProjectCustomerProfileRef = {
  id: string;
  name: string;
  industry?: string;
};

export type ProcessingStatus = "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type BulkProject = {
  id: string;
  name: string;
  sheetName: string;
  columns: string[];
  rows: BulkRow[];
  createdAt: string;
  lastModifiedAt: string;
  ownerId?: string;
  ownerName?: string;
  owner?: { id: string; name: string | null; email: string | null };
  customerName?: string; // Legacy text-only field
  // Primary customer (1-to-1 relationship)
  customerId?: string;
  customer?: ProjectCustomerProfileRef;
  status: "draft" | "in_progress" | "needs_review" | "finalized";
  notes?: string;
  // Skill category filtering for tiered processing
  categories?: string[];
  // Review workflow fields
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  // Linked customer profiles (legacy many-to-many)
  customerProfiles?: ProjectCustomerProfileRef[];
  // Background processing fields
  processingJobId?: string;
  processingStatus?: ProcessingStatus;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processingProgress?: number;
  processingError?: string;
};
