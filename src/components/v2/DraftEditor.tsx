'use client';

/**
 * Unified Draft Editor Component
 *
 * Reusable component for editing draft skills/knowledge blocks.
 * Used by Skills, IT Skills, and Customer knowledge libraries.
 * Handles:
 * - Title, content editing
 * - Categories (multi-select)
 * - Tier selection (core/extended/library)
 * - Source display and management
 * - Save as Draft / Publish / Regenerate actions
 */

import { useState } from 'react';
import { ArrowLeft, Save, Check, AlertCircle, RefreshCw, X } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

export interface DraftSkillData {
  title: string;
  content: string;
  summary?: string;
  categories?: string[];
  tier?: 'core' | 'extended' | 'library';
  attributes?: Record<string, unknown>;
}

export interface SourceContent {
  id: string;
  title: string;
  preview: string;
}

export interface DraftEditorProps {
  libraryId: LibraryId;
  draft: DraftSkillData;
  sourceContents: SourceContent[];
  promptUsed?: unknown;
  skillId?: string | null;
  onDraftChange: (draft: DraftSkillData) => void;
  onSaveAsDraft: () => Promise<void>;
  onPublish: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onBack: () => void;
  isSaving?: boolean;
  error?: string | null;
  onErrorDismiss?: () => void;
  availableCategories?: string[];
}

const TIER_OPTIONS: Array<{
  value: 'core' | 'extended' | 'library';
  label: string;
  description: string;
}> = [
  {
    value: 'core',
    label: 'Core',
    description: 'Always loaded in context',
  },
  {
    value: 'extended',
    label: 'Extended',
    description: 'Load on demand in category',
  },
  {
    value: 'library',
    label: 'Library',
    description: 'Search only',
  },
];

export default function DraftEditor({
  draft,
  sourceContents,
  onDraftChange,
  onSaveAsDraft,
  onPublish,
  onRegenerate,
  onBack,
  isSaving = false,
  error = null,
  onErrorDismiss,
}: DraftEditorProps) {
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    if (newCategory.trim() && !draft.categories?.includes(newCategory.trim())) {
      onDraftChange({
        ...draft,
        categories: [...(draft.categories || []), newCategory.trim()],
      });
      setNewCategory('');
      setShowCategoryInput(false);
    }
  };

  const handleRemoveCategory = (category: string) => {
    onDraftChange({
      ...draft,
      categories: draft.categories?.filter((c) => c !== category) || [],
    });
  };

  const handleTierChange = (newTier: 'core' | 'extended' | 'library') => {
    onDraftChange({
      ...draft,
      tier: newTier,
    });
  };

  return (
    <div className="p-8">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
          {onErrorDismiss && (
            <button
              onClick={onErrorDismiss}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Draft Editor (2/3 width) */}
        <div className="col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) =>
                onDraftChange({ ...draft, title: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Skill title..."
            />
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={draft.content}
              onChange={(e) =>
                onDraftChange({ ...draft, content: e.target.value })
              }
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              placeholder="Skill content..."
            />
            <p className="text-xs text-gray-500 mt-2">
              {draft.content.length} characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex gap-3">
            <button
              onClick={onSaveAsDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </button>
            <button
              onClick={onPublish}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Publish
            </button>
            <button
              onClick={onRegenerate}
              disabled={isSaving || sourceContents.length === 0}
              title={
                sourceContents.length === 0
                  ? 'No sources available to regenerate'
                  : 'Regenerate with same sources'
              }
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Right: Info & Sources (1/3 width) */}
        <div className="col-span-1 space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Skill Details
            </h3>

            {/* Status */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Status</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                Draft
              </div>
            </div>

            {/* Word Count */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Word Count
              </p>
              <p className="text-sm text-gray-900">
                {draft.content.split(/\s+/).filter(Boolean).length} words
              </p>
            </div>

            {/* Sources Used */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Sources Used
              </p>
              <p className="text-sm text-gray-600">
                {sourceContents.length} source
                {sourceContents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Tier Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tier</h3>
            <div className="space-y-2">
              {TIER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="tier"
                    value={option.value}
                    checked={draft.tier === option.value}
                    onChange={() => handleTierChange(option.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-600">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Categories
            </h3>

            {/* Category Pills */}
            <div className="mb-3 flex flex-wrap gap-2">
              {draft.categories?.map((category) => (
                <div
                  key={category}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  <span>{category}</span>
                  <button
                    onClick={() => handleRemoveCategory(category)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Category */}
            {showCategoryInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                  }}
                  placeholder="New category..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  className="px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowCategoryInput(false);
                    setNewCategory('');
                  }}
                  className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCategoryInput(true)}
                className="w-full px-3 py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded hover:bg-gray-50"
              >
                + Add Category
              </button>
            )}
          </div>

          {/* Sources Tab */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Sources ({sourceContents.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sourceContents.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">
                  No sources available
                </p>
              ) : (
                sourceContents.map((source) => (
                  <div
                    key={source.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100"
                  >
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
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Editing Tips</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Title:</strong> Clear, concise title that summarizes the
            skill
          </li>
          <li>
            <strong>Content:</strong> Detailed explanation, examples, and
            implementation details
          </li>
          <li>
            <strong>Tier:</strong> Controls how the skill is loaded in context
            (core always, extended by category, library search only)
          </li>
          <li>
            <strong>Categories:</strong> Tag with relevant topics for
            organization and filtering
          </li>
          <li>
            <strong>Save as Draft:</strong> Keep working on it later (won&apos;t be
            published)
          </li>
          <li>
            <strong>Publish:</strong> Makes the skill available in the library
            immediately
          </li>
        </ul>
      </div>
    </div>
  );
}
