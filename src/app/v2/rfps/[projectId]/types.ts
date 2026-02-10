export interface ProjectRow {
  id: string;
  question: string;
  response: string | null;
  confidence: string | null;
  sources: string | null;
  reasoning: string | null;
  inference: string | null;
  remarks: string | null;
  status: string;
  flaggedForReview: boolean;
  reviewStatus: string | null;
  reviewNote?: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  rowCount: number;
  createdAt: string;
  rows: ProjectRow[];
  rowStats?: {
    pending: number;
    processing: number;
    completed: number;
    error: number;
  };
}

export interface SkillPreview {
  skillId: string;
  skillTitle: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  scopeCovers: string;
  estimatedTokens: number;
  isCustomerSkill?: boolean;
}
