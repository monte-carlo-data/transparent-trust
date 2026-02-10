'use client';

/**
 * Add Sources to Skill Dialog
 *
 * Modal for assigning one or more staged sources to an existing skill.
 * Shows available skills with search/filter capability.
 * Supports bulk source assignment to a single skill.
 */

import { useState } from 'react';
import { X, Search, Loader } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface Skill {
  id: string;
  title: string;
  slug: string | null;
}

interface AddSourceToSkillDialogProps {
  sourceIds: string | string[];
  sourceTitle?: string;
  sourceTitles?: string[];
  skills: Skill[];
  libraryId: LibraryId;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddSourceToSkillDialog({
  sourceIds,
  sourceTitle,
  sourceTitles,
  skills,
  isOpen,
  onClose,
  onSuccess,
}: AddSourceToSkillDialogProps) {
  // Normalize sourceIds to always be an array
  const sourceIdArray = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  // For display, use sourceTitles if provided, otherwise sourceTitle for single or generic message
  const displayTitle =
    sourceTitles && sourceTitles.length > 0
      ? sourceTitles.length === 1
        ? sourceTitles[0]
        : `${sourceTitles.length} sources`
      : sourceTitle || 'Source';

  const [searchText, setSearchText] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSkills = skills.filter((skill) =>
    skill.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedSkillId) {
      setError('Please select a skill');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v2/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds: sourceIdArray,
          blockId: selectedSkillId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add sources to skill');
      }

      setSelectedSkillId(null);
      setSearchText('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add sources to skill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSearchText('');
      setSelectedSkillId(null);
      setError(null);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add to Skill</h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Source info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900">
                {sourceIdArray.length === 1 ? 'Adding to skill:' : `Adding ${sourceIdArray.length} sources to skill:`}
              </p>
              {sourceTitles && sourceTitles.length > 1 ? (
                <div className="text-sm text-blue-800 mt-2 space-y-1">
                  {sourceTitles.map((title, idx) => (
                    <p key={idx} className="truncate" title={title}>
                      • {title}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-blue-800 truncate" title={displayTitle}>
                  {displayTitle}
                </p>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search skills..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Skills list */}
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {filteredSkills.length > 0 ? (
                filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => setSelectedSkillId(skill.id)}
                    disabled={isLoading}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                      selectedSkillId === skill.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {skill.title}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  {skills.length === 0 ? 'No skills available' : 'No skills match your search'}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-800">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isLoading || !selectedSkillId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add to Skill'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
