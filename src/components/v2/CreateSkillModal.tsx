'use client';

/**
 * CreateSkillModal - Type-specific modal for creating skills
 *
 * Handles creation of skills across all skill libraries:
 * - knowledge
 * - it
 * - gtm
 * - customers (customer-scoped)
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getLibraryConfig } from '@/lib/library-config';
import { handleModalResponse, getNetworkErrorMessage } from '@/lib/modal-error-handler';
import type { LibraryId, SkillType } from '@/types/v2/building-block';

export interface CreateSkillModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The library to create the skill in (knowledge, IT, GTM, or customers) */
  libraryId: LibraryId;
  /** Optional customer ID for customer-scoped skills (required when libraryId='customers') */
  customerId?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when skill is successfully created, receives the new skill's ID */
  onSuccess?: (skillId: string) => void;
  /** Optional: Set to true to create a foundational skill (template) */
  isFoundational?: boolean;
}

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded: string[];
}

export function CreateSkillModal({
  isOpen,
  libraryId,
  customerId,
  onClose,
  onSuccess,
  isFoundational: initialIsFoundational = false,
}: CreateSkillModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scope, setScope] = useState<ScopeDefinition>({
    covers: '',
    futureAdditions: [],
    notIncluded: [],
  });
  const [creationMode, setCreationMode] = useState<'generated' | 'foundational'>('generated');
  const [refreshMode, setRefreshMode] = useState<'regenerative' | 'additive'>('regenerative');
  const [isFoundational, setIsFoundational] = useState(initialIsFoundational);
  const [skillType, setSkillType] = useState<SkillType>(initialIsFoundational ? 'intelligence' : 'knowledge');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getLibraryConfig(libraryId);
  const requiresScope = config.requiresScopeDefinition;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        libraryId,
        title,
        content,
        summary: summary || undefined,
        skillType,
      };

      if (customerId) {
        payload.customerId = customerId;
      }

      // Build attributes with modes and scope
      const attributes: Record<string, unknown> = {
        creationMode,
        refreshMode,
        scopeDefinition: scope, // All skills have scope (required)
      };

      if (isFoundational) {
        attributes.isFoundational = true;
      }

      payload.attributes = attributes;

      let response: Response;
      try {
        response = await fetch('/api/v2/skills/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (networkError) {
        console.error('[CreateSkillModal] Network error:', networkError);
        setError(getNetworkErrorMessage());
        return;
      }

      const result = await handleModalResponse<{ id: string }>({
        response,
        errorMessage: `Failed to create ${config.singularName}`,
      });

      // Wrap onSuccess callback in try-catch to prevent silent failures
      try {
        onSuccess?.(result.id);
      } catch (callbackError) {
        console.error('[CreateSkillModal] Error in onSuccess callback:', callbackError);
        setError('Error completing creation. Please try navigating manually.');
        return;
      }

      // Reset form and close
      setTitle('');
      setSummary('');
      setContent('');
      setScope({ covers: '', futureAdditions: [], notIncluded: [] });
      setCreationMode('generated');
      setRefreshMode('regenerative');
      setIsFoundational(false);
      setShowAdvanced(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[CreateSkillModal] Error creating skill:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create {config.itemName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={config.placeholderExamples?.[0] || `Enter ${config.singularName} title`}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary
            </label>
            <Input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief overview (optional)"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {config.mainContentHeading} {!isFoundational && '*'}
              {isFoundational && (
                <span className="text-xs text-gray-500 ml-2">(Optional for foundational skills - will be populated from sources)</span>
              )}
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isFoundational ? 'Leave empty - content will be extracted from sources' : `Enter ${config.singularName} content...`}
              rows={8}
              disabled={isLoading}
              required={!isFoundational}
            />
          </div>

          {/* Skill Type */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Skill Type</h3>
            <div className="space-y-2">
              <label className="flex items-start cursor-pointer p-3 border rounded hover:bg-gray-50">
                <input
                  type="radio"
                  value="knowledge"
                  checked={skillType === 'knowledge'}
                  onChange={(e) => setSkillType(e.target.value as SkillType)}
                  disabled={isLoading || isFoundational}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">Knowledge (How-to, Q&A)</div>
                  <div className="text-sm text-gray-600">
                    Synthesized content with Common Questions section. Best for procedures, guides, and documentation.
                  </div>
                </div>
              </label>
              <label className="flex items-start cursor-pointer p-3 border rounded hover:bg-gray-50">
                <input
                  type="radio"
                  value="intelligence"
                  checked={skillType === 'intelligence'}
                  onChange={(e) => setSkillType(e.target.value as SkillType)}
                  disabled={isLoading}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">Intelligence (Context, Narrative)</div>
                  <div className="text-sm text-gray-600">
                    Narrative context without Q&A. Best for account intelligence, background, and relationships.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Skill Modes */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Skill Modes</h3>

            {/* Foundational Skill Checkbox - only shown when NOT creating for a specific customer */}
            {!customerId && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFoundational}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsFoundational(checked);
                      // Auto-select foundational + additive + intelligence when checked
                      if (checked) {
                        setCreationMode('foundational');
                        setRefreshMode('additive');
                        setSkillType('intelligence');
                      }
                    }}
                    disabled={isLoading}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-blue-900">Make this a foundational skill</div>
                    <div className="text-sm text-blue-700">
                      Create a template that can be applied to multiple customers. Content will be extracted from sources based on the scope you define.
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-3">
              {/* Creation Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Creation Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="generated"
                      checked={creationMode === 'generated'}
                      onChange={(e) => setCreationMode(e.target.value as 'generated')}
                      className="mt-1 mr-2"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="font-medium">Generated (Default)</div>
                      <div className="text-sm text-gray-600">LLM synthesizes content from all sources</div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="foundational"
                      checked={creationMode === 'foundational'}
                      onChange={(e) => setCreationMode(e.target.value as 'foundational')}
                      className="mt-1 mr-2"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="font-medium">Foundational</div>
                      <div className="text-sm text-gray-600">LLM extracts only scope-relevant content from sources</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Refresh Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="regenerative"
                      checked={refreshMode === 'regenerative'}
                      onChange={(e) => setRefreshMode(e.target.value as 'regenerative')}
                      className="mt-1 mr-2"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="font-medium">Regenerative (Default)</div>
                      <div className="text-sm text-gray-600">Reprocess all sources on refresh</div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="additive"
                      checked={refreshMode === 'additive'}
                      onChange={(e) => setRefreshMode(e.target.value as 'additive')}
                      className="mt-1 mr-2"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="font-medium">Additive</div>
                      <div className="text-sm text-gray-600">Only process new sources and append to existing content</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Scope Definition (if required) */}
          {requiresScope && (
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-3"
              >
                {showAdvanced ? '▼' : '▶'} Scope Definition
              </button>

              {showAdvanced && (
                <div className="space-y-3 ml-4">
                  {/* Covers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currently Covers
                    </label>
                    <Textarea
                      value={scope.covers}
                      onChange={(e) => setScope({ ...scope, covers: e.target.value })}
                      placeholder="What does this skill cover?"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Future Additions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Planned Additions
                    </label>
                    <Textarea
                      value={scope.futureAdditions.join('\n')}
                      onChange={(e) =>
                        setScope({
                          ...scope,
                          futureAdditions: e.target.value
                            .split('\n')
                            .filter((line) => line.trim()),
                        })
                      }
                      placeholder="What should be added later? (one per line)"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Excluded */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Explicitly Excluded
                    </label>
                    <Textarea
                      value={scope.notIncluded.join('\n')}
                      onChange={(e) =>
                        setScope({
                          ...scope,
                          notIncluded: e.target.value
                            .split('\n')
                            .filter((line) => line.trim()),
                        })
                      }
                      placeholder="What should NOT be included? (one per line)"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title || (!content && !isFoundational)}
              className={`${config.accentColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : config.accentColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : config.accentColor === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {isLoading ? 'Creating...' : `Create ${config.itemName}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
