'use client';

/**
 * RefreshDialog
 *
 * Main dialog component for refreshing skills with new sources.
 * Orchestrates the refresh flow: source selection → processing → result review.
 */

import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { TokenRegistryProvider, useTokenRegistry } from '@/lib/v2/tokens/TokenRegistryContext';
import { useTokenCost } from '@/lib/v2/tokens/useTokenCost';
import { TokenSummary } from '../tokens';
import { CurrentContextSection } from './CurrentContextSection';
import { PendingSourcesSection } from './PendingSourcesSection';
import { RefreshResultView } from './RefreshResultView';
import type { RefreshDialogProps, V2RefreshResult, LegacyRefreshResult } from './types';
import { isV2RefreshResult, isLegacyRefreshResult } from './types';

// Token budget configuration
const TOKEN_BUDGET = {
  max: 200000,
  reserved: 8000, // System prompt overhead
  available: 192000,
};

// Component to register skill content tokens (invisible)
function SkillContentTokenReporter({ content }: { content: string }) {
  useTokenCost({
    id: 'skill-content',
    label: 'Current Skill Content',
    type: 'skill',
    content,
    enabled: content.length > 0,
  });
  return null;
}

// Inner component that uses the token registry
function RefreshDialogContent({
  onClose,
  onStartRefresh,
  onApplyUpdates,
  onMarkAsReviewed,
  isProcessing = false,
  isApplying = false,
  skillTitle,
  refreshResult,
  pendingSources = [],
  selectedSourceIds = new Set(),
  onToggleSource,
  skillContent = '',
  incorporatedSources = [],
}: Omit<RefreshDialogProps, 'isOpen'>) {
  const [viewMode, setViewMode] = useState<'diff' | 'preview'>('diff');
  const { summary } = useTokenRegistry();

  const selectedCount = selectedSourceIds.size;
  const budgetOk = summary.total <= TOKEN_BUDGET.available;

  // Determine result type and changes
  const isV2 = refreshResult && isV2RefreshResult(refreshResult);
  const isLegacy = refreshResult && isLegacyRefreshResult(refreshResult);

  let hasChanges = false;

  if (isV2) {
    const v2Result = refreshResult as V2RefreshResult;
    const changes = v2Result.changes;
    hasChanges =
      changes.sectionsAdded.length > 0 ||
      changes.sectionsUpdated.length > 0 ||
      changes.sectionsRemoved.length > 0;
  } else if (isLegacy) {
    const legacyResult = refreshResult as LegacyRefreshResult;
    hasChanges = legacyResult.suggestedUpdate?.hasChanges ?? false;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
      {/* Invisible token reporter for skill content */}
      <SkillContentTokenReporter content={skillContent} />

      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Refresh Skill: {skillTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {!refreshResult && pendingSources.length > 0 && (
          <p className="text-sm text-gray-600">
            Review current context and select sources to include in refresh.
          </p>
        )}
        {refreshResult && (
          <p className="text-sm text-gray-600">
            Processing {selectedCount} source{selectedCount !== 1 ? 's' : ''} to suggest
            content updates.
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Source selection view (before refresh) */}
        {!refreshResult && (
          <div className="space-y-4 mb-6">
            <CurrentContextSection
              skillContent={skillContent}
              incorporatedSources={incorporatedSources}
            />

            <PendingSourcesSection
              sources={pendingSources}
              selectedIds={selectedSourceIds}
              onToggle={onToggleSource}
              defaultExpanded={true}
            />

            <TokenSummary showBreakdown={false} />
          </div>
        )}

        {/* Processing state */}
        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-gray-700">Processing pending sources...</p>
            <p className="text-sm text-gray-600">This may take 15-30 seconds.</p>
          </div>
        )}

        {/* No pending sources */}
        {!isProcessing && !refreshResult && pendingSources.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No pending sources to refresh
          </div>
        )}

        {/* Result view */}
        {!isProcessing && refreshResult && (
          <RefreshResultView
            result={refreshResult}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isProcessing || isApplying}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {refreshResult && hasChanges ? 'Discard' : 'Close'}
        </button>

        {/* Start Refresh button (before processing) */}
        {!refreshResult && pendingSources.length > 0 && (
          <button
            onClick={onStartRefresh}
            disabled={isProcessing || !budgetOk || selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Start Refresh
              </>
            )}
          </button>
        )}

        {/* Apply Updates button (after processing with changes) */}
        {refreshResult && hasChanges && (
          <button
            onClick={onApplyUpdates}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Updates
              </>
            )}
          </button>
        )}

        {/* Mark as Reviewed button (after processing with no changes) */}
        {refreshResult && !hasChanges && onMarkAsReviewed && (
          <button
            onClick={onMarkAsReviewed}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Mark as Reviewed
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Main export - wraps content in TokenRegistryProvider
export function RefreshDialog({ isOpen, ...props }: RefreshDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <TokenRegistryProvider budget={TOKEN_BUDGET}>
        <RefreshDialogContent {...props} />
      </TokenRegistryProvider>
    </div>
  );
}

// Also export as default for backwards compatibility
export default RefreshDialog;
