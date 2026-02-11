'use client';

import { useState } from 'react';
import { Check, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import SourceSelector from './SourceSelector';
import { SkillMetadataForm } from './SkillMetadataForm';
import { cn } from '@/lib/utils';
import { TokenRegistryProvider } from '@/lib/v2/tokens/TokenRegistryContext';
import TokenSummary from './tokens/TokenSummary';
import type { LibraryId } from '@/types/v2';

export type Step = 'discover' | 'select' | 'generating' | 'review' | 'metadata' | 'saving' | 'done';

interface StagedSource {
  id: string;
  type: 'zendesk' | 'slack' | 'notion' | 'gong' | 'url' | 'document';
  title: string;
  description?: string;
  status: 'NEW' | 'REVIEWED' | 'IGNORED';
  tags?: string[];
  url?: string;
  externalUrl?: string;
  createdAt: string;
  usedInSkills?: Array<{ id: string; title: string }>;
  /** Source-specific metadata for enhanced display */
  metadata?: Record<string, unknown>;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Owner {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

interface DiscoveryResult {
  staged: number;
  skipped?: number;
  total?: number;
  remaining?: number;
  hasMore?: boolean; // Indicates more sources are available (even if count unknown)
  totalEstimated?: number; // Total estimated available sources
  cumulativeStaged?: number; // Total staged across all discovery runs
  error?: string;
}

interface SkillForMatching {
  id: string;
  title: string;
  keywords?: string[];
  scopeCovers?: string;
}

interface CreateWizardProps {
  sources: StagedSource[];
  libraryId?: LibraryId;
  onGenerate: (selectedSourceIds: string[], notes?: string) => Promise<{
    title: string;
    content: string;
    scopeDefinition?: ScopeDefinition;
    citations?: Array<{ id: string; sourceId: string; label: string; url?: string }>;
    contradictions?: Array<{
      type: 'technical_contradiction' | 'version_mismatch' | 'scope_mismatch' | 'outdated_vs_current' | 'different_perspectives';
      description: string;
      sourceA: { id: string; label: string; excerpt: string };
      sourceB: { id: string; label: string; excerpt: string };
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }>;
    transparency?: {
      systemPrompt: string;
      userPrompt: string;
      rawResponse: string;
      compositionId: string;
      blockIds: string[];
      model: string;
      tokens: {
        input: number;
        output: number;
      };
      timestamp: string;
    };
  }>;
  onSave: (title: string, content: string, metadata?: SkillMetadata) => Promise<void>;
  onDone: () => void;
  onShowAddToSkill?: (sourceId: string) => void;
  onShowAddMultipleToSkill?: (sourceIds: string[]) => void;
  onDiscover?: (sinceDays: number) => Promise<DiscoveryResult | void>;
  onRefreshSources?: () => Promise<void>;
  sourceTypeLabel?: string;
  generatingLabel?: string;
  isLoadingSources?: boolean;
  isDiscovering?: boolean;
  sourceTypeFilter?: string[];
  availableCategories?: Category[];
  availableUsers?: Owner[];
  includeMetadata?: boolean;
  /** Skills for quick keyword matching */
  skillsForMatching?: SkillForMatching[];
  /** Callback when quick assign is clicked */
  onQuickAssign?: (sourceId: string, skillId: string) => Promise<void>;
  /** Callback when link to customer is clicked (for bulk linking) */
  onLinkToCustomer?: (sourceIds: string[]) => void;
}

interface ReviewState {
  title: string;
  content: string;
  scopeDefinition?: ScopeDefinition;
  citations?: Array<{ id: string; sourceId: string; label: string; url?: string }>;
  contradictions?: Array<{
    type: 'technical_contradiction' | 'version_mismatch' | 'scope_mismatch' | 'outdated_vs_current' | 'different_perspectives';
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded?: string[];
}

interface SkillMetadata {
  categories: string[];
  owners: Owner[];
  scopeDefinition?: ScopeDefinition;
  citations?: Array<{ id: string; sourceId: string; label: string; url?: string }>;
  contradictions?: Array<{
    type: 'technical_contradiction' | 'version_mismatch' | 'scope_mismatch' | 'outdated_vs_current' | 'different_perspectives';
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  sourceIds?: string[];
  llmTrace?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

const getSteps = (includeMetadata: boolean): Array<{ key: Step; label: string; index: number }> => {
  const baseSteps = [
    { key: 'generating' as const, label: 'Generate', index: 0 },
    { key: 'review' as const, label: 'Review & Edit', index: 1 },
  ];

  const metadataStep = includeMetadata
    ? { key: 'metadata' as const, label: 'Settings', index: 2 }
    : null;

  const saveIndex = includeMetadata ? 3 : 2;

  return [
    ...baseSteps,
    ...(metadataStep ? [metadataStep] : []),
    { key: 'saving' as const, label: 'Save', index: saveIndex },
  ];
};

export default function CreateWizard({
  sources,
  libraryId,
  onGenerate,
  onSave,
  onDone,
  onShowAddMultipleToSkill,
  onDiscover,
  onRefreshSources,
  sourceTypeLabel = 'Sources',
  generatingLabel = 'Generating content',
  isLoadingSources = false,
  isDiscovering = false,
  sourceTypeFilter = [],
  availableCategories = [],
  availableUsers = [],
  includeMetadata = true,
  skillsForMatching = [],
  onQuickAssign,
  onLinkToCustomer,
}: CreateWizardProps) {
  const STEPS = getSteps(includeMetadata);
  const [step, setStep] = useState<Step>('select');
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [sinceDays, setSinceDays] = useState(7);
  const [selectedSourceIds, setSelectedSourceIds] = useState(new Set<string>());
  const [sourceIdsForSave, setSourceIdsForSave] = useState<string[]>([]);
  const [reviewData, setReviewData] = useState<ReviewState | null>(null);
  const [metadata, setMetadata] = useState<SkillMetadata>({
    categories: [],
    owners: [],
    scopeDefinition: {
      covers: '',
      futureAdditions: [],
      notIncluded: [],
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [cumulativeStagedCount, setCumulativeStagedCount] = useState(0);

  const handleSelectSource = (sourceId: string) => {
    const newSet = new Set(selectedSourceIds);
    newSet.add(sourceId);
    setSelectedSourceIds(newSet);
  };

  const handleDeselectSource = (sourceId: string) => {
    const newSet = new Set(selectedSourceIds);
    newSet.delete(sourceId);
    setSelectedSourceIds(newSet);
  };

  const handleSelectAll = () => {
    const allIds = new Set(
      sources
        .filter((s) => sourceTypeFilter.length === 0 || sourceTypeFilter.includes(s.type))
        .map((s) => s.id)
    );
    setSelectedSourceIds(allIds);
  };

  const handleSelectBulk = (sourceIds: string[]) => {
    const newSet = new Set(selectedSourceIds);
    sourceIds.forEach((id) => newSet.add(id));
    setSelectedSourceIds(newSet);
  };

  const handleClearAll = () => {
    setSelectedSourceIds(new Set());
  };

  const handleGenerate = async () => {
    if (selectedSourceIds.size === 0) {
      setError('Please select at least one source');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      const sourceIdArray = Array.from(selectedSourceIds);
      const result = await onGenerate(sourceIdArray);
      setSourceIdsForSave(sourceIdArray);
      setReviewData({
        title: result.title,
        content: result.content,
        scopeDefinition: result.scopeDefinition,
        citations: result.citations,
        contradictions: result.contradictions,
        transparency: result.transparency,
      });
      // Auto-populate scope definition if provided by LLM
      if (result.scopeDefinition) {
        setMetadata({
          ...metadata,
          scopeDefinition: result.scopeDefinition,
          citations: result.citations,
          contradictions: result.contradictions,
          llmTrace: result.transparency,
        });
      }
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStep('select');
    }
  };

  const handleSave = async () => {
    if (!reviewData) return;

    setStep('saving');
    setError(null);
    setIsSaving(true);

    try {
      await onSave(reviewData.title, reviewData.content, {
        ...metadata,
        sourceIds: sourceIdsForSave,
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStep(includeMetadata ? 'metadata' : 'review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscover = async () => {
    if (!onDiscover) return;

    setDiscoverError(null);
    setDiscoveryResult(null);
    try {
      const result = await onDiscover(sinceDays);
      if (result) {
        // Track cumulative staged count across multiple discovery runs
        const newCumulativeCount = cumulativeStagedCount + (result.staged || 0);
        setCumulativeStagedCount(newCumulativeCount);

        // Enhance result with cumulative info for display
        const enhancedResult: DiscoveryResult = {
          ...result,
          cumulativeStaged: newCumulativeCount,
        };
        setDiscoveryResult(enhancedResult);
        if (result.error) {
          setDiscoverError(result.error);
        }
      }
      // Refresh sources to show newly staged items
      if (onRefreshSources) {
        await onRefreshSources();
      }
      // Stay on select step to show the discovery feedback and updated sources
      setStep('select');
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Discovery failed');
    }
  };

  return (
    <TokenRegistryProvider budget={{ max: 200000, reserved: 23000, available: 177000 }}>
      <div className="space-y-6">
        {/* Progress Indicator - only show after leaving select/discover step */}
        {step !== 'select' && step !== 'discover' && step !== 'done' && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, idx) => {
            const currentStepIndex = STEPS.find((stepItem) => stepItem.key === step)?.index ?? -1;
            const isActive = currentStepIndex === s.index;
            const isPast = currentStepIndex > s.index;

            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isPast
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-700'
                  )}
                >
                  {isPast ? <Check className="w-5 h-5" /> : s.index + 1}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-700'
                  )}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error Banner */}
      {(error || discoverError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-800 mt-1">{error || discoverError}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Discover Step */}
        {step === 'discover' && onDiscover && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to discover {sourceTypeLabel.toLowerCase()}?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                We&apos;ll fetch and stage new {sourceTypeLabel.toLowerCase()} for you to review.
              </p>
            </div>

            {/* Date Range Selector */}
            <div className="w-full max-w-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter by date (since)
              </label>
              <select
                value={sinceDays}
                onChange={(e) => setSinceDays(parseInt(e.target.value))}
                disabled={isDiscovering}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 6 months</option>
                <option value={365}>Last year</option>
              </select>
            </div>

            <button
              onClick={handleDiscover}
              disabled={isDiscovering}
              className={cn(
                'px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
                isDiscovering
                  ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              {isDiscovering && <Loader2 className="w-4 h-4 animate-spin" />}
              Start Discovery
            </button>
          </div>
        )}

        {/* Select Step */}
        {step === 'select' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select {sourceTypeLabel}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose the sources you want to use to generate content.
              </p>
            </div>

            {/* Discovery Controls - Time Range Picker and Discover More Button */}
            {onDiscover && (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <select
                  value={sinceDays}
                  onChange={(e) => setSinceDays(parseInt(e.target.value))}
                  disabled={isDiscovering}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 6 months</option>
                  <option value={365}>Last year</option>
                </select>
                <button
                  onClick={handleDiscover}
                  disabled={isDiscovering}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm',
                    isDiscovering
                      ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  {isDiscovering && <Loader2 className="w-4 h-4 animate-spin" />}
                  Discover More
                </button>
              </div>
            )}

            {/* Discovery Loading Feedback */}
            {isDiscovering && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <span className="text-blue-800 dark:text-blue-200">
                  Discovering {sourceTypeLabel.toLowerCase()}...
                </span>
              </div>
            )}

            {/* Discovery Feedback */}
            {discoveryResult && !discoveryResult.error && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm">
                <span className="text-green-800 dark:text-green-200">
                  {discoveryResult.staged === 0 && discoveryResult.skipped !== undefined && discoveryResult.skipped > 0 && !discoveryResult.hasMore ? (
                    <>All caught up! No new {sourceTypeLabel.toLowerCase()} to load.</>
                  ) : (
                    <>
                      Staged <strong>{discoveryResult.staged}</strong> {sourceTypeLabel.toLowerCase()}
                      {discoveryResult.skipped !== undefined && discoveryResult.skipped > 0 && (
                        <span className="text-green-700 dark:text-green-300">
                          {' '}({discoveryResult.skipped} skipped)
                        </span>
                      )}
                      {cumulativeStagedCount > 0 && (
                        <span className="text-green-700 dark:text-green-300">
                          {' '}• Total loaded: <strong>{cumulativeStagedCount}</strong>
                        </span>
                      )}
                      {(discoveryResult.hasMore || (discoveryResult.remaining !== undefined && discoveryResult.remaining > 0)) && (
                        <span className="text-green-600 dark:text-green-400">
                          {' '}• {discoveryResult.remaining && discoveryResult.remaining > 0
                            ? `${discoveryResult.remaining} more available`
                            : 'More available'} - discover again to load
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}

            <SourceSelector
              sources={sources}
              selectedSourceIds={selectedSourceIds}
              onSelectSource={handleSelectSource}
              onDeselectSource={handleDeselectSource}
              onSelectAll={handleSelectAll}
              onSelectBulk={handleSelectBulk}
              onClearAll={handleClearAll}
              sourceTypeFilter={sourceTypeFilter}
              isLoading={isLoadingSources}
              onAddSelectedToSkill={onShowAddMultipleToSkill ? (sourceIds) => {
                onShowAddMultipleToSkill(sourceIds);
                setSelectedSourceIds(new Set());
              } : undefined}
              skillsForMatching={skillsForMatching}
              onQuickAssign={onQuickAssign}
              libraryId={libraryId}
              onLinkToCustomer={onLinkToCustomer}
            />

            {/* Token Summary */}
            <TokenSummary showBreakdown />

            <div className="flex justify-end pt-4">
              <button
                onClick={handleGenerate}
                disabled={selectedSourceIds.size === 0}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
                  selectedSourceIds.size > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-700 cursor-not-allowed'
                )}
              >
                Generate Content
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Generating Step */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {generatingLabel}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Using {selectedSourceIds.size} source{selectedSourceIds.size !== 1 ? 's' : ''} to create content...
            </p>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && reviewData && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Review & Edit
              </h2>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={reviewData.title}
                onChange={(e) =>
                  setReviewData({ ...reviewData, title: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content
              </label>
              <textarea
                value={reviewData.content}
                onChange={(e) =>
                  setReviewData({ ...reviewData, content: e.target.value })
                }
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {reviewData.content.length} characters
              </p>
            </div>

            {/* Scope Definition */}
            {reviewData.scopeDefinition && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Scope Definition</h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                    Review what the LLM determined this skill covers and what should be added later.
                  </p>
                </div>

                {/* Currently Covers */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currently Covers
                  </label>
                  <textarea
                    value={reviewData.scopeDefinition.covers}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        scopeDefinition: {
                          covers: e.target.value,
                          futureAdditions: reviewData.scopeDefinition?.futureAdditions || [],
                          notIncluded: reviewData.scopeDefinition?.notIncluded || [],
                        },
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Future Additions */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Planned Additions (one per line)
                  </label>
                  <textarea
                    value={reviewData.scopeDefinition.futureAdditions.join('\n')}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        scopeDefinition: {
                          covers: reviewData.scopeDefinition?.covers || '',
                          futureAdditions: e.target.value.split('\n').filter(s => s.trim()),
                          notIncluded: reviewData.scopeDefinition?.notIncluded || [],
                        },
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Not Included */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Explicitly Excluded (one per line)
                  </label>
                  <textarea
                    value={(reviewData.scopeDefinition.notIncluded || []).join('\n')}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        scopeDefinition: {
                          covers: reviewData.scopeDefinition?.covers || '',
                          futureAdditions: reviewData.scopeDefinition?.futureAdditions || [],
                          notIncluded: e.target.value.split('\n').filter(s => s.trim()),
                        },
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep('select')}
                className="px-6 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  // Update metadata with any scope edits made in review
                  if (reviewData.scopeDefinition) {
                    setMetadata({ ...metadata, scopeDefinition: reviewData.scopeDefinition });
                  }
                  setStep(includeMetadata ? 'metadata' : 'saving');
                }}
                disabled={!reviewData.title.trim() || !reviewData.content.trim()}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
                  reviewData.title.trim() && reviewData.content.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-700 cursor-not-allowed'
                )}
              >
                {includeMetadata ? 'Next' : 'Save'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Metadata Step */}
        {includeMetadata && step === 'metadata' && reviewData && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Skill Settings
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Configure metadata for your skill (categories, owners).
              </p>
            </div>

            {libraryId && (
              <SkillMetadataForm
                categories={metadata.categories}
                owners={metadata.owners}
                scopeDefinition={metadata.scopeDefinition}
                availableCategories={availableCategories}
                availableUsers={availableUsers}
                libraryId={libraryId}
                onCategoriesChange={(cats) => setMetadata({ ...metadata, categories: cats })}
                onOwnersChange={(owners) => setMetadata({ ...metadata, owners })}
                onScopeDefinitionChange={(scope) => setMetadata({ ...metadata, scopeDefinition: scope })}
                showAdvanced
              />
            )}

            {/* Buttons */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep('review')}
                className="px-6 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
                  !isSaving
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-700 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Saving Step */}
        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Saving
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Creating and publishing your content...
            </p>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Success!
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
              Your content has been created and published successfully.
            </p>
            <button
              onClick={onDone}
              className="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors mt-4"
            >
              Done
            </button>
          </div>
        )}
      </div>
      </div>
    </TokenRegistryProvider>
  );
}
