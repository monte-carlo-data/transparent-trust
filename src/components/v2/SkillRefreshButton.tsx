'use client';

/**
 * Skill Refresh Button Component
 *
 * Reusable component for refreshing skills with pending source assignments.
 * Implements lazy incorporation: user selects which pending sources to include in refresh.
 * Used across Knowledge, IT, and GTM (customer) skill detail pages.
 */

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import RefreshDialog from './RefreshDialog';
import type { LibraryId } from '@/types/v2';

interface RefreshResponse {
  id: string;
  title: string;
  content: string;
  originalContent?: string;
  summary: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  citations: Array<{
    id: string;
    sourceId: string;
    label: string;
    url?: string;
  }>;
  contradictions?: Array<{
    type: string;
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  changes: {
    sectionsAdded: string[];
    sectionsUpdated: string[];
    sectionsRemoved: string[];
    changeSummary: string;
  };
  splitRecommendation?: {
    shouldSplit: boolean;
    reason?: string;
    suggestedSkills?: Array<{
      title: string;
      scope: string;
    }>;
  };
}

interface SkillRefreshButtonProps {
  skillId: string;
  skillTitle: string;
  libraryId: LibraryId;
  pendingSources?: Array<{
    id: string;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  /** Current skill content for token estimation */
  skillContent?: string;
  /** Already incorporated sources */
  incorporatedSources?: Array<{
    id: string;
    title: string;
    sourceType: string;
    content?: string;
    contentLength?: number;
  }>;
  onRefreshComplete?: () => void;
}

export function SkillRefreshButton({
  skillId,
  skillTitle,
  pendingSources = [],
  skillContent = '',
  incorporatedSources = [],
  onRefreshComplete,
}: SkillRefreshButtonProps) {
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResponse | undefined>(undefined);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  const handleOpenRefreshDialog = () => {
    setShowRefreshDialog(true);
    // Initialize selected sources with all pending sources (user can deselect)
    setSelectedSourceIds(new Set(pendingSources.map(s => s.id)));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const sourceIds = Array.from(selectedSourceIds);
      const response = await fetch(`/api/v2/skills/${skillId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh skill');
      }

      const data = await response.json() as RefreshResponse;
      setRefreshResult(data);
    } catch (error) {
      console.error('Refresh error:', error);
      setRefreshResult({
        id: skillId,
        title: skillTitle,
        content: '',
        summary: error instanceof Error ? error.message : 'Failed to refresh',
        scopeDefinition: { covers: '', futureAdditions: [] },
        citations: [],
        changes: {
          sectionsAdded: [],
          sectionsUpdated: [],
          sectionsRemoved: [],
          changeSummary: 'Error occurred during refresh',
        },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    const newSet = new Set(selectedSourceIds);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    setSelectedSourceIds(newSet);
  };

  const handleApplyUpdates = async () => {
    setShowRefreshDialog(false);
    setRefreshResult(undefined);
    setSelectedSourceIds(new Set());
    onRefreshComplete?.();
  };

  const handleClose = () => {
    setShowRefreshDialog(false);
    setRefreshResult(undefined);
  };

  return (
    <>
      <button
        onClick={handleOpenRefreshDialog}
        disabled={isRefreshing}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        title="Refresh skill content from incorporated sources"
      >
        {isRefreshing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Source Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Source Refresh
            {pendingSources.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                {pendingSources.length}
              </span>
            )}
          </>
        )}
      </button>

      <RefreshDialog
        isOpen={showRefreshDialog}
        onClose={handleClose}
        onStartRefresh={handleRefresh}
        onApplyUpdates={handleApplyUpdates}
        isProcessing={isRefreshing}
        skillTitle={skillTitle}
        refreshResult={refreshResult}
        pendingSources={pendingSources}
        selectedSourceIds={selectedSourceIds}
        onToggleSource={handleToggleSource}
        skillContent={skillContent}
        incorporatedSources={incorporatedSources}
      />
    </>
  );
}
