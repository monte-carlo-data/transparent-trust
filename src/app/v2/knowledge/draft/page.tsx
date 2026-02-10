'use client';

/**
 * Draft Skill Review Page
 *
 * Shows generated draft skill from selected sources.
 * Allows editing before publishing to library.
 */

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { PromptIndicator } from '@/components/v2/PromptIndicator';

interface DraftSkill {
  title: string;
  content: string;
  summary?: string;
  categories?: string[];
  tier?: 'core' | 'extended' | 'library';
  attributes?: Record<string, unknown>;
  // V2 Skill Building Fields
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  citations?: Array<{
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
}

function DraftSkillPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState<DraftSkill | null>(null);
  const [sourceContents, setSourceContents] = useState<Array<{ id: string; title: string; preview: string }>>([]);
  const [promptUsed, setPromptUsed] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draft' | 'sources'>('draft');
  const [skillId, setSkillId] = useState<string | null>(null);

  // Parse draft data from URL or session
  useEffect(() => {
    const draftData = searchParams.get('draft');
    const id = searchParams.get('skillId');

    if (id) {
      setSkillId(id);
    }

    if (draftData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(draftData));
        // Ensure draft has required fields
        const draft = {
          ...parsed.draft,
          summary: parsed.draft.summary || '',
          categories: parsed.draft.categories || [],
          tier: parsed.draft.tier || 'library',
          attributes: parsed.draft.attributes || {},
          // Preserve V2 skill building fields
          scopeDefinition: parsed.draft.scopeDefinition,
          citations: parsed.draft.citations || [],
          contradictions: parsed.draft.contradictions || [],
        };
        setDraft(draft);
        setSourceContents(parsed.sourceContents);
        setPromptUsed(parsed.promptUsed);
      } catch {
        setError('Failed to parse draft data');
      }
    }
    setIsLoading(false);
  }, [searchParams]);

  const handleSaveAsDraft = async () => {
    if (!draft) return;

    setIsSaving(true);
    setError(null);

    try {
      const sourceIds = sourceContents.map((s) => s.id);
      const libraryId = (promptUsed?.libraryId as string) || 'skills';
      const customerId = promptUsed?.customerId as string | undefined;

      const response = await fetch('/api/v2/skills/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          summary: draft.summary,
          content: draft.content,
          categories: draft.categories,
          tier: draft.tier,
          attributes: draft.attributes,
          libraryId,
          sourceIds,
          status: 'DRAFT',
          customerId,
          skillId: skillId || undefined,
          refreshAction: skillId ? 'manual-edit' : undefined,
          // V2 Skill Building Fields
          scopeDefinition: draft.scopeDefinition,
          citations: draft.citations,
          contradictions: draft.contradictions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save draft');
      }

      // Success - redirect to review page
      router.push('/v2/knowledge/review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) return;

    setIsSaving(true);
    setError(null);

    try {
      const sourceIds = sourceContents.map((s) => s.id);
      const libraryId = (promptUsed?.libraryId as string) || 'skills';
      const customerId = promptUsed?.customerId as string | undefined;

      const response = await fetch('/api/v2/skills/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          summary: draft.summary,
          content: draft.content,
          categories: draft.categories,
          tier: draft.tier,
          attributes: draft.attributes,
          libraryId,
          sourceIds,
          status: 'ACTIVE',
          customerId,
          skillId: skillId || undefined,
          refreshAction: skillId ? 'manual-edit' : undefined,
          // V2 Skill Building Fields
          scopeDefinition: draft.scopeDefinition,
          citations: draft.citations,
          contradictions: draft.contradictions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish skill');
      }

      // Success - redirect to skills library
      router.push('/v2/knowledge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish skill');
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!draft || sourceContents.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      const sourceIds = sourceContents.map((s) => s.id);
      const libraryId = (promptUsed?.libraryId as string) || 'skills';
      const customerId = promptUsed?.customerId as string | undefined;

      // Call generation API to regenerate with same sources
      const response = await fetch('/api/v2/skills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds,
          libraryId,
          customerId,
          promptOverrides: {
            compositionId: promptUsed?.compositionId,
            personaId: promptUsed?.personaId,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate skill');
      }

      const newDraftData = await response.json();

      // Update draft with new content
      setDraft(newDraftData.draft);
      setSourceContents(newDraftData.sourceContents);
      setPromptUsed(newDraftData.promptUsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate skill');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading draft...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-8">
        <Link
          href="/v2/knowledge"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Skills
        </Link>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">No Draft Available</h3>
              <p className="text-sm text-yellow-800">
                No draft skill was found. Please select sources and generate a skill from the Skills library.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2/knowledge"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Skills
      </Link>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Prompt Indicator */}
      {promptUsed && (
        <PromptIndicator
          compositionName={promptUsed.compositionName as string}
          compositionId={promptUsed.compositionId as string}
          personaName={promptUsed.personaName as string}
          personaId={promptUsed.personaId as string}
          blocks={promptUsed.blocks as string[]}
          onChangePrompt={() => {
            // TODO: Allow regenerating with different prompt/persona
            console.log('Change prompt clicked');
          }}
        />
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Draft Editor (2/3 width) */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Title */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Skill title..."
              />
            </div>

            {/* Content */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-700 mb-2">Content</label>
              <textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                placeholder="Skill content..."
              />
              <p className="text-xs text-gray-500 mt-1">{draft.content.length} characters</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={handleSaveAsDraft}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                Publish
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isSaving || sourceContents.length === 0}
                title={sourceContents.length === 0 ? 'No sources available to regenerate' : 'Regenerate with same sources'}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sources & Info (1/3 width) */}
        <div className="col-span-1">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('draft')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'draft'
                  ? 'border-b-blue-600 text-blue-600'
                  : 'border-b-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sources'
                  ? 'border-b-blue-600 text-blue-600'
                  : 'border-b-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Sources ({sourceContents.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'draft' && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Status</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  Draft
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Tier</p>
                <select
                  value={draft.tier || 'library'}
                  onChange={(e) => setDraft({ ...draft, tier: e.target.value as 'core' | 'extended' | 'library' })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="core">Core</option>
                  <option value="extended">Extended</option>
                  <option value="library">Library</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Categories</p>
                <input
                  type="text"
                  value={draft.categories?.join(', ') || ''}
                  onChange={(e) => setDraft({ ...draft, categories: e.target.value.split(',').map(c => c.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="comma-separated categories"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Word Count</p>
                <p className="text-sm text-gray-900">
                  {draft.content.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Sources Used</p>
                <p className="text-sm text-gray-600">{sourceContents.length} source{sourceContents.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-2">
              {sourceContents.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-xs text-gray-600">
                  No sources available
                </div>
              ) : (
                sourceContents.map((source) => (
                  <div key={source.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                    <h4 className="text-xs font-semibold text-gray-900 mb-1 line-clamp-2">
                      {source.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {source.preview}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Editing Tips</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Title:</strong> A clear, concise title that summarizes the skill
          </li>
          <li>
            <strong>Summary:</strong> 1-2 sentence overview of what this skill is about
          </li>
          <li>
            <strong>Content:</strong> Detailed explanation, examples, and implementation details
          </li>
          <li>
            <strong>Attributes:</strong> Additional metadata like keywords, product, category, etc.
          </li>
          <li>
            <strong>Save as Draft:</strong> Keep working on it later (won&apos;t be published)
          </li>
          <li>
            <strong>Publish:</strong> Makes the skill available in the library immediately
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function DraftSkillPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <DraftSkillPageContent />
    </Suspense>
  );
}
