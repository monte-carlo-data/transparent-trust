export type TabId = "dashboard" | "ask" | "projects" | "history";

export interface TransparencyData {
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  // Deprecated - kept for backwards compatibility with old data
  remarks?: string;
}

export interface ReviewWorkflowState {
  flaggedForReview: boolean;
  flagNote?: string;
  flagResolved?: boolean;
  reviewStatus?: string;
  reviewedBy?: string;
  userEditedAnswer?: string;
}
