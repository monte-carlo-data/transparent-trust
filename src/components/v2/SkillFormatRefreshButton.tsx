'use client';

/**
 * Skill Format Refresh Button Component
 *
 * Triggers a format refresh to regenerate a skill through current format standards.
 * Uses the same UI pattern as SkillRefreshButton for consistency.
 */

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import RefreshDialog from './RefreshDialog';

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

interface SkillFormatRefreshButtonProps {
  skillId: string;
  skillTitle: string;
  onRefreshComplete?: () => void;
}

export function SkillFormatRefreshButton({
  skillId,
  skillTitle,
  onRefreshComplete,
}: SkillFormatRefreshButtonProps) {
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResponse | undefined>(undefined);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowRefreshDialog(true);

    try {
      const response = await fetch(`/api/v2/skills/${skillId}/format-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh skill format');
      }

      const data = await response.json() as RefreshResponse;
      setRefreshResult(data);
    } catch (error) {
      console.error('Format refresh error:', error);
      setRefreshResult({
        id: skillId,
        title: skillTitle,
        content: '',
        summary: error instanceof Error ? error.message : 'Failed to refresh skill format',
        scopeDefinition: { covers: '', futureAdditions: [] },
        citations: [],
        changes: {
          sectionsAdded: [],
          sectionsUpdated: [],
          sectionsRemoved: [],
          changeSummary: 'Error occurred during format refresh',
        },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyUpdates = async () => {
    // The format refresh endpoint already updated the skill
    setShowRefreshDialog(false);
    setRefreshResult(undefined);
    onRefreshComplete?.();
  };

  const handleClose = () => {
    setShowRefreshDialog(false);
    setRefreshResult(undefined);
  };

  return (
    <>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        title="Regenerate skill through current format standards"
      >
        {isRefreshing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Format Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Format Refresh
          </>
        )}
      </button>

      <RefreshDialog
        isOpen={showRefreshDialog}
        onClose={handleClose}
        onStartRefresh={async () => {}}
        onApplyUpdates={handleApplyUpdates}
        isProcessing={isRefreshing}
        isApplying={false}
        skillTitle={skillTitle}
        refreshResult={refreshResult}
        pendingSources={[]}
      />
    </>
  );
}
