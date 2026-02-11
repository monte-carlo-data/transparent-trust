'use client';

/**
 * RefreshResultView
 *
 * Displays the result of a skill refresh operation.
 * Handles both V2 and legacy result formats.
 */

import { useMemo } from 'react';
import { AlertCircle, Check, FileText } from 'lucide-react';
import { diffLines, Change } from 'diff';
import type {
  V2RefreshResult,
  LegacyRefreshResult,
  Citation,
  Contradiction,
} from './types';

interface RefreshResultViewProps {
  result: V2RefreshResult | LegacyRefreshResult;
  viewMode: 'diff' | 'preview';
  onViewModeChange: (mode: 'diff' | 'preview') => void;
}

export function RefreshResultView({
  result,
  viewMode,
  onViewModeChange,
}: RefreshResultViewProps) {
  // Parse the result based on type
  const isV2 = 'changes' in result && 'citations' in result;

  let hasChanges = false;
  let hasNewSources = false;
  let changeHighlights: string[] = [];
  let changeSummary = '';
  let contentPreview = '';
  let contradictions: Contradiction[] = [];
  let splitRecommendation = null;
  let citations: Citation[] = [];
  let originalContent = '';

  if (isV2) {
    const v2Result = result as V2RefreshResult;
    const changes = v2Result.changes;

    hasChanges =
      changes.sectionsAdded.length > 0 ||
      changes.sectionsUpdated.length > 0 ||
      changes.sectionsRemoved.length > 0;

    changeHighlights = [
      ...changes.sectionsAdded.map((s) => `Added: ${s}`),
      ...changes.sectionsUpdated.map((s) => `Updated: ${s}`),
      ...changes.sectionsRemoved.map((s) => `Removed: ${s}`),
    ];

    changeSummary = changes.changeSummary;
    contentPreview = v2Result.content;
    originalContent = v2Result.originalContent || '';
    contradictions = v2Result.contradictions || [];
    splitRecommendation = v2Result.splitRecommendation;
    citations = v2Result.citations || [];
  } else {
    const legacyResult = result as LegacyRefreshResult;
    hasChanges = legacyResult.suggestedUpdate?.hasChanges ?? false;
    hasNewSources =
      (legacyResult.ticketCount ?? 0) > 0 || (legacyResult.slackCount ?? 0) > 0;
    changeHighlights = legacyResult.suggestedUpdate?.changeHighlights ?? [];
    changeSummary = legacyResult.suggestedUpdate?.summary ?? '';
    contentPreview = legacyResult.suggestedUpdate?.content ?? '';
  }

  // Compute diff when we have both original and new content
  const diffResult = useMemo(() => {
    if (!hasChanges || !originalContent || !contentPreview) {
      return null;
    }
    return diffLines(originalContent, contentPreview);
  }, [hasChanges, originalContent, contentPreview]);

  // No changes case
  if (!hasChanges && !hasNewSources) {
    return (
      <NoChangesView
        result={result}
        isV2={isV2}
        citations={citations}
      />
    );
  }

  // Has changes case
  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Updates suggested!</p>
            <p className="text-sm text-amber-700 mt-1">
              {changeSummary || 'Found information relevant to this skill.'}
            </p>
          </div>
        </div>
      )}

      {contradictions.length > 0 && (
        <ContradictionsView contradictions={contradictions} />
      )}

      {changeHighlights.length > 0 && (
        <ChangeHighlightsView highlights={changeHighlights} />
      )}

      {contentPreview && (
        <ContentDiffView
          contentPreview={contentPreview}
          originalContent={originalContent}
          diffResult={diffResult}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      )}

      {splitRecommendation?.shouldSplit && (
        <SplitRecommendationView recommendation={splitRecommendation} />
      )}

      {citations.length > 0 && <CitationsView citations={citations} />}
    </div>
  );
}

// Sub-components

function NoChangesView({
  result,
  isV2,
  citations,
}: {
  result: V2RefreshResult | LegacyRefreshResult;
  isV2: boolean;
  citations: Citation[];
}) {
  const summary = isV2
    ? (result as V2RefreshResult).summary
    : (result as LegacyRefreshResult).suggestedUpdate?.summary ||
      (result as LegacyRefreshResult).message;

  const legacyResult = !isV2 ? (result as LegacyRefreshResult) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-lg font-medium text-green-700">
          Content already up to date
        </p>
        <p className="text-gray-600 text-center max-w-md">
          {summary ||
            'The AI reviewed the sources and determined the skill already contains this information.'}
        </p>
      </div>

      {citations.length > 0 && <CitationsView citations={citations} title="Sources cited:" />}

      {legacyResult?.processedSources && legacyResult.processedSources.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">Sources reviewed:</h4>
          <ul className="space-y-2 bg-gray-50 rounded-lg p-3">
            {legacyResult.processedSources.map((source, idx) => (
              <li key={idx} className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {source.title || source.url}
                </a>
                <span className="text-xs text-gray-600">({source.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ContradictionsView({ contradictions }: { contradictions: Contradiction[] }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <p className="font-medium text-red-800">Contradictions found</p>
      </div>
      <div className="space-y-3 mt-2">
        {contradictions.map((contradiction, idx) => (
          <div key={idx} className="text-sm bg-white rounded p-2 border border-red-100">
            <p className="font-medium text-red-700 mb-1">
              {contradiction.type}
              {contradiction.severity && (
                <span
                  className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor:
                      contradiction.severity === 'high'
                        ? '#fee'
                        : contradiction.severity === 'medium'
                        ? '#fef3c7'
                        : '#fef08a',
                    color:
                      contradiction.severity === 'high'
                        ? 'var(--destructive)'
                        : contradiction.severity === 'medium'
                        ? '#92400e'
                        : '#713f12',
                  }}
                >
                  {contradiction.severity}
                </span>
              )}
            </p>
            <p className="text-red-700 mb-2">{contradiction.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs bg-red-50 p-2 rounded mb-2">
              <div>
                <p className="font-medium text-red-600">{contradiction.sourceA.label}</p>
                <p className="text-red-700 italic">{contradiction.sourceA.excerpt}</p>
              </div>
              <div>
                <p className="font-medium text-red-600">{contradiction.sourceB.label}</p>
                <p className="text-red-700 italic">{contradiction.sourceB.excerpt}</p>
              </div>
            </div>
            <p className="text-red-700 font-medium">
              Recommendation: {contradiction.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangeHighlightsView({ highlights }: { highlights: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">What changed:</h4>
      <ul className="space-y-1">
        {highlights.map((highlight, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-green-600 font-bold">+</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentDiffView({
  contentPreview,
  originalContent,
  diffResult,
  viewMode,
  onViewModeChange,
}: {
  contentPreview: string;
  originalContent: string;
  diffResult: Change[] | null;
  viewMode: 'diff' | 'preview';
  onViewModeChange: (mode: 'diff' | 'preview') => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Content changes:</h4>
        {originalContent && (
          <div className="flex gap-1">
            <button
              onClick={() => onViewModeChange('diff')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'diff'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Diff
            </button>
            <button
              onClick={() => onViewModeChange('preview')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {viewMode === 'diff' && diffResult ? (
        <div className="bg-gray-50 p-3 rounded-lg max-h-64 overflow-y-auto font-mono text-xs">
          {diffResult.map((part: Change, index: number) => (
            <div
              key={index}
              className={`whitespace-pre-wrap ${
                part.added
                  ? 'bg-green-100 text-green-800 border-l-2 border-green-500 pl-2'
                  : part.removed
                  ? 'bg-red-100 text-red-800 border-l-2 border-red-500 pl-2'
                  : 'text-gray-600'
              }`}
            >
              {part.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 p-3 rounded-lg max-h-64 overflow-y-auto">
          <pre className="text-sm whitespace-pre-wrap font-sans">{contentPreview}</pre>
        </div>
      )}
    </div>
  );
}

function SplitRecommendationView({
  recommendation,
}: {
  recommendation: NonNullable<V2RefreshResult['splitRecommendation']>;
}) {
  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
      <p className="font-medium text-blue-900 mb-2">Split recommendation</p>
      <p className="text-sm text-blue-800 mb-2">{recommendation.reason}</p>
      {recommendation.suggestedSkills && recommendation.suggestedSkills.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-blue-700 uppercase">Suggested skills:</p>
          {recommendation.suggestedSkills.map((skill, idx) => (
            <div key={idx} className="bg-white rounded p-2 border border-blue-100">
              <p className="font-medium text-blue-900">{skill.title}</p>
              <p className="text-xs text-blue-700">{skill.scope}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationsView({
  citations,
  title = 'Sources cited:',
}: {
  citations: Citation[];
  title?: string;
}) {
  return (
    <div className="border-t pt-4">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <ul className="space-y-2 bg-gray-50 rounded-lg p-3">
        {citations.map((citation, idx) => (
          <li key={idx} className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            {citation.url ? (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                title={citation.label}
              >
                {citation.label}
              </a>
            ) : (
              <span className="truncate" title={citation.label}>
                {citation.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
