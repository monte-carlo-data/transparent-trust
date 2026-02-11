/**
 * RefreshDialog Types
 *
 * Shared type definitions for the RefreshDialog component family.
 */

export interface ProcessedSource {
  url: string;
  type: string;
  title?: string;
}

export interface Citation {
  id: string;
  sourceId: string;
  label: string;
  url?: string;
}

export interface Contradiction {
  type: string;
  description: string;
  sourceA: { id: string; label: string; excerpt: string };
  sourceB: { id: string; label: string; excerpt: string };
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface SkillChanges {
  sectionsAdded: string[];
  sectionsUpdated: string[];
  sectionsRemoved: string[];
  changeSummary: string;
}

export interface V2RefreshResult {
  id: string;
  title: string;
  content: string;
  summary: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  citations: Citation[];
  contradictions?: Contradiction[];
  changes: SkillChanges;
  splitRecommendation?: {
    shouldSplit: boolean;
    reason?: string;
    suggestedSkills?: Array<{
      title: string;
      scope: string;
    }>;
  };
  originalContent?: string;
}

export interface LegacyRefreshResult {
  newTickets?: Array<{ id: number; subject: string; url: string }>;
  ticketCount?: number;
  newSlackThreads?: Array<{ id: string; title: string; channelName: string }>;
  slackCount?: number;
  processedSources?: ProcessedSource[];
  sourceCount?: number;
  suggestedUpdate?: {
    title: string;
    content: string;
    hasChanges: boolean;
    changeHighlights?: string[];
    summary?: string;
  };
  message?: string;
}

export interface SourceData {
  id: string;
  title: string;
  sourceType: string;
  content?: string;
  contentLength?: number;
}

export interface RefreshDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRefresh: () => Promise<void>;
  onApplyUpdates: () => Promise<void>;
  onMarkAsReviewed?: () => Promise<void>;
  isProcessing?: boolean;
  isApplying?: boolean;
  skillTitle: string;
  refreshResult?: V2RefreshResult | LegacyRefreshResult;
  pendingSources?: SourceData[];
  selectedSourceIds?: Set<string>;
  onToggleSource?: (sourceId: string) => void;
  skillContent?: string;
  incorporatedSources?: SourceData[];
}

// Type guard to check if it's a V2 result
export function isV2RefreshResult(result: unknown): result is V2RefreshResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'changes' in result &&
    'citations' in result
  );
}

// Type guard to check if it's a legacy result
export function isLegacyRefreshResult(result: unknown): result is LegacyRefreshResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    ('suggestedUpdate' in result || 'ticketCount' in result)
  );
}
