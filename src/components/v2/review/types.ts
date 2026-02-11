export type TabId = "dashboard" | "ask" | "bulk" | "history";

export interface TransparencyData {
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
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
