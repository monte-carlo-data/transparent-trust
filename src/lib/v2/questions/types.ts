// Question processing output structure
export interface QuestionOutput {
  response: string;
  confidence: string;
  sources: string;
  reasoning: string;
  inference: string;
  remarks: string;
  tokensUsed?: number;
  transparency?: {
    systemPrompt: string;
    compositionId: string;
    blockIds: string[];
    runtimeBlockIds: string[];
    assembledAt: string;
  };
}

// Context fit estimation result - includes detailed breakdown for transparency
export interface ContextFitResult {
  fits: boolean;
  skillCount: number;
  totalTokens: number;
  maxTokens: number;
  availableTokens: number;
  utilizationPercent: number;
  suggestedBatchSize: number;
  // Detailed token breakdown for UI transparency
  breakdown: {
    skillTokens: number;
    questionTokens: number;
    fileContextTokens: number;
    systemPromptTokens: number; // Estimated prompt overhead
  };
  // Legacy field for backwards compatibility
  skillTokens: number;
}

// Processing parameters
export interface ProcessQuestionParams {
  question: string;
  context?: string;
  library: string;
  categories?: string[];
  customerId?: string;
  modelSpeed: 'fast' | 'quality';
}

export interface EstimateContextFitParams {
  questionCount: number;
  library: string;
  categories?: string[];
  tier?: string;
  modelSpeed?: 'fast' | 'quality';
  approvedSkillIds?: string[];
  fileContextTokens?: number;
}

export interface ProcessQuestionBatchParams {
  questions: Array<{ question: string; context?: string }>;
  library: string;
  categories?: string[];
  modelSpeed: 'fast' | 'quality';
  batchSize?: number;
  fileContext?: string;
}

// V2QuestionHistory data structure
export interface V2QuestionHistoryData {
  id: string;
  userId: string;
  teamId?: string;
  question: string;
  context?: string;
  library: string;
  modelSpeed: string;
  outputData?: Partial<QuestionOutput>;
  status: string;
  errorMessage?: string;
  tokensUsed?: number;
  flaggedForReview: boolean;
  flagNote?: string;
  reviewStatus?: string;
  reviewedBy?: string;
  userEditedAnswer?: string;
  createdAt: Date;
}
