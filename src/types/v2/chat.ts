import type { LibraryId } from '@/types/v2/building-block';

/**
 * Unified ChatMessage type for V2 architecture
 * Used throughout chat feature (session, storage, API)
 * Tracks LLM transparency and block usage
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;

  // Response analysis and metadata
  confidence?: string;
  notes?: string;
  reasoning?: string;

  // Block usage tracking (split by type for UI display)
  blocksUsed?: Array<{
    id: string;
    title: string;
    libraryId: LibraryId;
    blockType?: string;
  }>;
  skillsUsed?: Array<{
    id: string;
    title: string;
  }>;
  documentsUsed?: Array<{
    id: string;
    title: string;
  }>;
  urlsUsed?: Array<{
    id: string;
    title: string;
  }>;

  // Staged sources used (raw customer sources)
  sourcesUsed?: Array<{
    id: string;
    title: string;
    sourceType: string;
  }>;

  // Web search sources (when web search is enabled)
  webSearchSources?: Array<{
    url: string;
    title?: string;
    citedText?: string;
  }>;

  // LLM call transparency
  transparency?: {
    systemPrompt: string;
    compositionId: string;
    blockIds: string[];
    runtimeBlockIds: string[];
    runtimeContext?: {
      callMode?: boolean;
      userInstructions?: string;
    };
    model: string;
    blocksUsed: Array<{
      id: string;
      title: string;
      content: string;
      libraryId: LibraryId;
      blockType?: string;
      entryType?: string | null;
    }>;
  };

  // User feedback on response
  feedback?: {
    rating?: 'THUMBS_UP' | 'THUMBS_DOWN' | null;
    comment?: string;
    flaggedForReview?: boolean;
    flagNote?: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}
