'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Loader2, AlertCircle, Sparkles, ChevronDown, ChevronRight, Zap, FileText, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { estimateTokens, formatTokenCount, MODEL_LIMITS } from '@/lib/tokenUtils';
import { LookerConfigForm } from '@/components/v2/integrations/LookerConfigForm';

interface Skill {
  id: string;
  title: string;
  content?: string | null;
  summary?: string | null;
}

interface ViewTabProps {
  viewId: string;
  customerId: string;
  teamId?: string;
  cachedContent?: { content: string; generatedAt: Date; transparency?: { systemPrompt: string } } | null;
  viewSummary?: string;
  compositionId?: string;
  customerSkills?: Skill[];
  customerData?: Record<string, unknown>;
  libraryId?: string;
}

export function ViewTab({
  viewId,
  customerId,
  teamId,
  cachedContent,
  viewSummary,
  compositionId,
  customerSkills = [],
  customerData,
  libraryId,
}: ViewTabProps) {
  const [content, setContent] = useState(cachedContent?.content || null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(
    cachedContent?.generatedAt ? new Date(cachedContent.generatedAt) : null
  );
  const [systemPrompt, setSystemPrompt] = useState<string | null>(cachedContent?.transparency?.systemPrompt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [lookerContext, setLookerContext] = useState<{
    dashboardTitle: string;
    formattedHtml: string;
  } | null>(null);
  const [lookerLoading, setLookerLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // For audit views: track which skills are selected (default: none for audits)
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());

  // Fetch the system prompt for preview (before generation)
  useEffect(() => {
    if (compositionId && !cachedContent && !systemPrompt) {
      fetch(`/api/v2/prompts/${compositionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.prompt) {
            setSystemPrompt(data.data.prompt);
          }
        })
        .catch((err) => console.error('Failed to fetch prompt:', err));
    }
  }, [compositionId, cachedContent, systemPrompt]);

  // Map composition IDs to audit types for Looker dashboard lookup
  const AUDIT_COMPOSITIONS: Record<string, string> = {
    customer_coverage_audit: 'coverage',
    customer_operations_audit: 'operations',
    customer_adoption_audit: 'adoption',
  };
  const isAuditComposition = compositionId && compositionId in AUDIT_COMPOSITIONS;
  const auditType = compositionId ? AUDIT_COMPOSITIONS[compositionId] : undefined;

  // Track if Looker is not configured (to avoid retrying)
  const [lookerNotConfigured, setLookerNotConfigured] = useState(false);

  // Fetch Looker context for Audit views
  useEffect(() => {
    if (isAuditComposition && libraryId && teamId && !cachedContent && auditType && !lookerNotConfigured) {
      setLookerLoading(true);
      fetch(`/api/v2/views/looker-context?libraryId=${libraryId}&customerId=${customerId}&auditType=${auditType}&teamId=${teamId}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            // Check if Looker is simply not configured - this is not an error
            if (res.status === 400 && errorData.error?.includes('not configured')) {
              setLookerNotConfigured(true);
              return null;
            }
            throw new Error(errorData.error || 'Failed to fetch Looker context');
          }
          return res.json();
        })
        .then((data) => {
          if (data?.dashboardTitle) {
            setLookerContext({
              dashboardTitle: data.dashboardTitle,
              formattedHtml: data.formattedHtml,
            });
          }
        })
        .catch((err) => console.error('Failed to fetch Looker context:', err))
        .finally(() => setLookerLoading(false));
    }
  }, [isAuditComposition, auditType, libraryId, customerId, teamId, cachedContent, lookerNotConfigured]);

  const generate = useCallback(async (forceRefresh = false) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    try {
      // For audit views, only send selected skills; for other views, send all
      const skillIds = isAuditComposition
        ? Array.from(selectedSkillIds)
        : undefined; // undefined means "use all skills" in the API

      const res = await fetch('/api/v2/views/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewId, customerId, forceRefresh, libraryId, skillIds }),
        signal: abortController.signal,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate');
      }
      const data = await res.json();
      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setContent(data.content);
        setGeneratedAt(new Date(data.generatedAt));
        setSystemPrompt(data.transparency?.systemPrompt || null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [viewId, customerId, libraryId, isAuditComposition, selectedSkillIds]);

  // Calculate token estimates
  const customerDataTokens = customerData ? estimateTokens(JSON.stringify(customerData)) : 0;
  // For audit views, only count selected skills; for other views, count all
  const skillsToCount = isAuditComposition
    ? customerSkills.filter(s => selectedSkillIds.has(s.id))
    : customerSkills;
  const skillsTokens = skillsToCount.reduce((sum, s) => {
    const skillContent = s.content || s.summary || '';
    return sum + estimateTokens(s.title) + estimateTokens(skillContent);
  }, 0);
  const systemPromptTokens = systemPrompt ? estimateTokens(systemPrompt) : 2000; // Use actual if available
  const totalInputTokens = customerDataTokens + skillsTokens + systemPromptTokens;
  const contextLimit = MODEL_LIMITS.quality.inputContext;
  const usagePercent = Math.round((totalInputTokens / contextLimit) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Generating analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-900 font-medium">Failed to generate analysis</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => generate(true)}
              className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No cached content - show generate button with context preview
  if (!content) {
    return (
      <div className="space-y-6">
        {/* Configuration Panel for Audit Views */}
        {isAuditComposition && teamId && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-900">Looker Dashboard Configuration</span>
              </div>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-sm text-amber-700 hover:text-amber-900 font-medium"
              >
                {showConfig ? 'Hide' : 'Show'} Configuration
              </button>
            </div>
            {showConfig && <LookerConfigForm teamId={teamId} libraryId={libraryId || 'customers'} auditType={auditType} />}
          </div>
        )}

        {/* Header */}
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Analysis</h3>
          <p className="text-gray-500 mb-2 max-w-md mx-auto">
            {viewSummary || 'This analysis will be generated using the customer\'s skills and profile data.'}
          </p>
          {compositionId && (
            <p className="text-xs text-gray-400">
              Prompt: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{compositionId}</code>
            </p>
          )}
        </div>

        {/* Context Preview Panel */}
        <div className="border rounded-lg bg-gray-50">
          <button
            onClick={() => setShowContext(!showContext)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              {showContext ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <span className="font-medium text-gray-700">Context to be sent</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  usagePercent > 80
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Zap className="w-3 h-3" />
                {formatTokenCount(totalInputTokens)} / {formatTokenCount(contextLimit)} ({usagePercent}%)
              </div>
            </div>
          </button>

          {showContext && (
            <div className="border-t px-4 py-4 space-y-4">
              {/* Customer Data Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Customer Profile</span>
                  <span className="text-xs text-gray-500">{formatTokenCount(customerDataTokens)} tokens</span>
                </div>
                {customerData ? (
                  <div className="bg-white border rounded p-3 text-xs font-mono text-gray-600 max-h-32 overflow-auto">
                    {JSON.stringify(customerData, null, 2)}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Customer profile data will be included</p>
                )}
              </div>

              {/* Skills Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Customer Skills {isAuditComposition
                      ? `(${selectedSkillIds.size} of ${customerSkills.length} selected)`
                      : `(${customerSkills.length})`}
                  </span>
                  <span className="text-xs text-gray-500">{formatTokenCount(skillsTokens)} tokens</span>
                </div>
                {isAuditComposition && customerSkills.length > 0 && (
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => setSelectedSkillIds(new Set(customerSkills.map(s => s.id)))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedSkillIds(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Clear all
                    </button>
                    <span className="text-xs text-gray-400">
                      (Skills provide additional context for the audit)
                    </span>
                  </div>
                )}
                {customerSkills.length > 0 ? (
                  <div className="space-y-2">
                    {customerSkills.map((skill) => {
                      const skillContent = skill.content || skill.summary || '';
                      const skillTokens = estimateTokens(skill.title) + estimateTokens(skillContent);
                      const isSelected = selectedSkillIds.has(skill.id);
                      const showSkill = isAuditComposition ? isSelected : true;

                      return (
                        <div
                          key={skill.id}
                          className={`bg-white border rounded ${isAuditComposition ? '' : 'cursor-pointer hover:bg-gray-50'} ${
                            isAuditComposition && !isSelected ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                              {isAuditComposition && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedSkillIds);
                                    if (e.target.checked) {
                                      newSet.add(skill.id);
                                    } else {
                                      newSet.delete(skill.id);
                                    }
                                    setSelectedSkillIds(newSet);
                                  }}
                                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                                />
                              )}
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">{skill.title}</span>
                            </div>
                            <span className="text-xs text-gray-500">{formatTokenCount(skillTokens)}</span>
                          </div>
                          {showSkill && skillContent && (
                            <details className="cursor-pointer">
                              <summary className="border-t px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 select-none">
                                Show content
                              </summary>
                              <div className="border-t px-3 py-2 bg-gray-50">
                                <div className="bg-white border rounded p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap break-words max-h-48 overflow-auto">
                                  {skillContent}
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No customer skills yet</p>
                )}
              </div>

              {/* Looker Dashboard Data Section (Audit Views) */}
              {isAuditComposition && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Looker Dashboard Data</span>
                    {lookerLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  {lookerContext ? (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-sm text-blue-900 font-medium mb-2">{lookerContext.dashboardTitle}</p>
                      <p className="text-xs text-blue-700">
                        Dashboard tables and metrics will be sent to the LLM for analysis.
                      </p>
                    </div>
                  ) : lookerLoading ? (
                    <div className="bg-gray-50 border rounded p-3">
                      <p className="text-sm text-gray-500 italic flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading dashboard...
                      </p>
                    </div>
                  ) : lookerNotConfigured ? (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-sm text-amber-800">
                        Looker integration not configured. Configure a dashboard above to include metrics data in your analysis.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Dashboard data will be fetched when generating analysis</p>
                  )}
                </div>
              )}

              {/* System Prompt Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">System Prompt</span>
                  <span className="text-xs text-gray-500">~{formatTokenCount(systemPromptTokens)} tokens</span>
                </div>
                {systemPrompt ? (
                  <details className="cursor-pointer">
                    <summary className="text-sm text-blue-600 hover:text-blue-700 font-medium select-none">
                      Show full assembled prompt
                    </summary>
                    <div className="mt-2 bg-white border rounded p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap break-words max-h-64 overflow-auto">
                      {systemPrompt}
                    </div>
                  </details>
                ) : (
                  <p className="text-sm text-gray-500">
                    Includes role definition, analysis framework, and output format instructions from composition{' '}
                    <code className="bg-gray-100 px-1 rounded">{compositionId}</code>
                  </p>
                )}
              </div>

              {/* Token Summary */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Total Input</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatTokenCount(totalInputTokens)} tokens
                    </span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${usagePercent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, usagePercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={() => generate(false)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Generate Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Generated {generatedAt ? generatedAt.toLocaleString() : 'just now'}
          </span>
          {compositionId && (
            <span className="text-xs text-gray-400">
              Prompt: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{compositionId}</code>
            </span>
          )}
        </div>
        <button
          onClick={() => generate(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Expandable Prompt Section */}
      {systemPrompt && (
        <div className="mb-4 border rounded-lg bg-gray-50">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 rounded-lg"
          >
            <div className="flex items-center gap-2">
              {showPrompt ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-sm font-medium text-gray-700">View Full Prompt</span>
            </div>
            <span className="text-xs text-gray-500">
              {formatTokenCount(estimateTokens(systemPrompt))} tokens
            </span>
          </button>
          {showPrompt && (
            <div className="border-t px-4 py-4">
              <div className="bg-white border rounded p-4 text-xs font-mono text-gray-600 whitespace-pre-wrap break-words max-h-96 overflow-auto">
                {systemPrompt}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="prose prose-sm max-w-none bg-white rounded-lg border p-6">
        <ReactMarkdown
          components={{
            h1: (props) => <h1 className="text-2xl font-bold mt-4 mb-3" {...props} />,
            h2: (props) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
            h3: (props) => <h3 className="text-lg font-bold mt-3 mb-2" {...props} />,
            p: (props) => <p className="mb-3" {...props} />,
            ul: (props) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
            ol: (props) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
            li: (props) => <li className="text-gray-700" {...props} />,
            code: (props) => (
              <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-gray-800" {...props} />
            ),
            pre: (props) => (
              <pre className="bg-gray-100 p-3 rounded text-sm font-mono text-gray-800 overflow-auto mb-3" {...props} />
            ),
            blockquote: (props) => (
              <blockquote
                className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-3"
                {...props}
              />
            ),
            table: (props) => (
              <table className="border-collapse w-full my-3" {...props} />
            ),
            th: (props) => (
              <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left" {...props} />
            ),
            td: (props) => <td className="border border-gray-300 px-3 py-2" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
