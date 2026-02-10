// Contract Review Types

export type ContractReviewStatus =
  | "PENDING"
  | "ANALYZING"
  | "ANALYZED"
  | "REVIEWED"
  | "ARCHIVED";

export type AlignmentRating =
  | "can_comply"      // We fully meet this requirement
  | "partial"         // We partially meet this, may need adjustments
  | "gap"             // We don't currently support this
  | "risk"            // This clause poses a risk to us
  | "info_only";      // Informational, no action needed

export type FindingCategory =
  // Security categories
  | "data_protection"
  | "security_controls"
  | "certifications"
  | "incident_response"
  | "vulnerability_management"
  | "access_control"
  | "encryption"
  | "penetration_testing"
  // Legal categories
  | "liability"
  | "indemnification"
  | "limitation_of_liability"
  | "insurance"
  | "termination"
  | "intellectual_property"
  | "warranties"
  | "governing_law"
  // Compliance categories
  | "audit_rights"
  | "subprocessors"
  | "data_retention"
  | "confidentiality"
  | "regulatory_compliance"
  // General
  | "sla_performance"
  | "payment_terms"
  | "other";

export type RowReviewStatus = "NONE" | "REQUESTED" | "APPROVED" | "CORRECTED";

// Individual finding from contract analysis (like BulkRow for RFP questions)
export type ContractFinding = {
  id: string;
  contractReviewId: string;
  category: FindingCategory;
  clauseText: string;           // The actual text from the contract
  rating: AlignmentRating;
  rationale: string;            // Why we rated it this way
  relevantSkills?: Array<string | { id: string; title: string }>;
  suggestedResponse?: string;   // How to respond or what to negotiate

  // Flagging workflow (like BulkRow)
  flaggedForReview: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  flagResolved: boolean;
  flagResolvedAt?: string;
  flagResolvedBy?: string;
  flagResolutionNote?: string;

  // Review workflow (like BulkRow)
  reviewStatus: RowReviewStatus;
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userEditedResponse?: string;  // User's corrected response

  // Security review delegation (for individual findings)
  assignedToSecurity: boolean;
  assignedToSecurityAt?: string;
  assignedToSecurityBy?: string;
  securityReviewNote?: string;
  securityReviewedAt?: string;
  securityReviewedBy?: string;

  // Feedback tracking (for prompt improvement)
  isManuallyAdded: boolean;           // True if human added this (AI missed it)
  originalSuggestedResponse?: string; // AI's original before user edits
  originalRating?: string;            // AI's original rating before changes
  originalRationale?: string;         // AI's original rationale before changes

  createdAt: string;
  updatedAt: string;
};

export type ContractReview = {
  id: string;
  name: string;
  filename: string;
  fileType: string;
  customerName?: string;
  contractType?: string;
  extractedText: string;
  status: ContractReviewStatus;
  overallRating?: "compliant" | "mostly_compliant" | "needs_review" | "high_risk";
  summary?: string;
  findings: ContractFinding[];
  findingsJson?: unknown;       // Legacy JSON field (for migration)
  skillsUsed?: string[];
  createdAt: string;
  updatedAt: string;
  analyzedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;

  // Owner tracking (like BulkProject)
  ownerId?: string;
  ownerName?: string;

  // Reviewer assignments
  legalReviewerId?: string;
  legalReviewerName?: string;
  legalReviewedAt?: string;
  legalReviewNotes?: string;

  securityReviewerId?: string;
  securityReviewerName?: string;
  securityReviewedAt?: string;
  securityReviewNotes?: string;
  securityReviewRequested: boolean;
  securityReviewRequestedAt?: string;
  securityReviewRequestedBy?: string;
};

// For API responses - list view summary
export type ContractReviewSummary = Pick<
  ContractReview,
  "id" | "name" | "filename" | "customerName" | "contractType" | "status" | "overallRating" | "createdAt" | "analyzedAt" | "ownerId" | "ownerName"
> & {
  findingsCount: number;
  riskCount: number;
  gapCount: number;
  flaggedCount: number;
};

// Legacy finding format from AI analysis (before conversion to DB records)
export type LegacyContractFinding = {
  id?: string;
  category: FindingCategory;
  clauseText: string;
  rating: AlignmentRating;
  rationale: string;
  relevantSkills?: string[];
  suggestedResponse?: string;
  flagged?: boolean;
  notes?: string;
};
