'use client';

/**
 * EditSkillModal - Modal for editing existing skills with scope definition
 *
 * Allows updating:
 * - Title, summary, content
 * - Scope definition (covers, futureAdditions, notIncluded)
 * - Categories, tags
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getLibraryConfig } from '@/lib/library-config';
import { handleModalResponse, getNetworkErrorMessage } from '@/lib/modal-error-handler';
import type { LibraryId, TypedBuildingBlock } from '@/types/v2/building-block';

export interface EditSkillModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The skill being edited */
  skill: TypedBuildingBlock;
  /** The library the skill belongs to */
  libraryId: LibraryId;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when skill is successfully updated */
  onSuccess?: () => void;
}

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded: string[];
}

export function EditSkillModal({
  isOpen,
  skill,
  libraryId,
  onClose,
  onSuccess,
}: EditSkillModalProps) {
  const [title, setTitle] = useState(skill.title);
  const [summary, setSummary] = useState(skill.summary || '');
  const [content, setContent] = useState(skill.content);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scope, setScope] = useState<ScopeDefinition>(() => {
    const attributes = skill.attributes as { scopeDefinition?: ScopeDefinition };
    return attributes?.scopeDefinition || {
      covers: '',
      futureAdditions: [],
      notIncluded: [],
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getLibraryConfig(libraryId);
  const requiresScope = config.requiresScopeDefinition;

  // Reset form when modal opens with new skill
  useEffect(() => {
    if (isOpen) {
      setTitle(skill.title);
      setSummary(skill.summary || '');
      setContent(skill.content);
      const attributes = skill.attributes as { scopeDefinition?: ScopeDefinition };
      setScope(
        attributes?.scopeDefinition || {
          covers: '',
          futureAdditions: [],
          notIncluded: [],
        }
      );
      setShowAdvanced(false);
      setError(null);
    }
  }, [isOpen, skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const attributes: Record<string, unknown> = { ...skill.attributes };
      if (requiresScope) {
        attributes.scopeDefinition = scope;
      }

      const payload = {
        title,
        summary: summary || undefined,
        content,
        attributes,
      };

      let response: Response;
      try {
        response = await fetch(`/api/v2/blocks/${skill.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (networkError) {
        console.error('[EditSkillModal] Network error:', networkError);
        setError(getNetworkErrorMessage());
        return;
      }

      const result = await handleModalResponse({
        response,
        errorMessage: `Failed to update ${config.singularName}`,
      });

      if (result) {
        try {
          onSuccess?.();
        } catch (callbackError) {
          console.error('[EditSkillModal] Error in onSuccess callback:', callbackError);
          setError('Error completing update. Please refresh the page.');
          return;
        }

        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[EditSkillModal] Error updating skill:', err);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {config.itemName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {/* Summary */}
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

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {config.mainContentHeading} *
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              disabled={isLoading}
              required
            />
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

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
              disabled={isLoading || !title || !content}
              className={`${config.accentColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : config.accentColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : config.accentColor === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
