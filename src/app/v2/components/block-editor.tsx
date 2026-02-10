'use client';

/**
 * Block Editor Component
 *
 * Form for creating and editing building blocks.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Plus } from 'lucide-react';
import { SKILL_LIBRARIES } from '@/lib/v2/library-constants';

const LIBRARY_OPTIONS = [
  { id: 'knowledge', label: 'Knowledge Dashboard', blockType: 'knowledge' },
  { id: 'it', label: 'IT Dashboard', blockType: 'knowledge' },
  { id: 'gtm', label: 'GTM Dashboard', blockType: 'knowledge' },
  { id: 'prompts', label: 'Prompts', blockType: 'knowledge' },
  { id: 'personas', label: 'Personas', blockType: 'persona' },
  { id: 'templates', label: 'Templates', blockType: 'template' },
];

const STATUS_OPTIONS = [
  { id: 'DRAFT', label: 'Draft' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'ARCHIVED', label: 'Archived' },
];

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded?: string[];
}

interface Block {
  id?: string;
  title: string;
  slug?: string | null;
  libraryId: string;
  blockType: string;
  status: string;
  content: string;
  summary?: string | null;
  categories?: string[];
  attributes?: Record<string, unknown>;
}

interface BlockEditorProps {
  block?: Block;
  defaultLibrary?: string;
}

export function BlockEditor({ block, defaultLibrary }: BlockEditorProps) {
  const router = useRouter();
  const isNew = !block?.id;

  const [formData, setFormData] = useState<Block>({
    title: block?.title || '',
    slug: block?.slug || '',
    libraryId: block?.libraryId || defaultLibrary || 'knowledge',
    blockType: block?.blockType || 'knowledge',
    status: block?.status || 'DRAFT',
    content: block?.content || '',
    summary: block?.summary || '',
    categories: block?.categories || [],
  });

  const [scopeDefinition, setScopeDefinition] = useState<ScopeDefinition | null>(() => {
    const attrs = (block?.attributes as Record<string, unknown>) || {};
    const scope = attrs.scopeDefinition as ScopeDefinition | undefined;
    return scope || null;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // For skills, use the type-specific /api/v2/skills/publish endpoint
      // For other block types, use the generic blocks endpoint
      const isSkill = SKILL_LIBRARIES.includes(formData.libraryId as typeof SKILL_LIBRARIES[number]);

      if (isSkill) {
        // Use skills/publish endpoint which properly handles scopeDefinition
        // Automatically set to ACTIVE when saving
        const payload = {
          title: formData.title,
          summary: formData.summary,
          content: formData.content,
          categories: formData.categories,
          libraryId: formData.libraryId,
          status: 'ACTIVE',
          skillId: block?.id,
          scopeDefinition,
        };

        const response = await fetch('/api/v2/skills/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save skill');
        }

        const savedBlock = await response.json();
        router.push(`/v2/blocks/${savedBlock.id}`);
        router.refresh();
      } else {
        // Use generic blocks endpoint for personas, templates, etc.
        const url = isNew ? '/api/v2/blocks' : `/api/v2/blocks/${block.id}`;
        const method = isNew ? 'POST' : 'PATCH';

        const payload = {
          ...formData,
          ...(scopeDefinition && {
            attributes: {
              scopeDefinition,
            },
          }),
        };

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save block');
        }

        const savedBlock = await response.json();
        router.push(`/v2/blocks/${savedBlock.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save block');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (newCategory.trim() && !formData.categories?.includes(newCategory.trim())) {
      setFormData({
        ...formData,
        categories: [...(formData.categories || []), newCategory.trim()],
      });
      setNewCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setFormData({
      ...formData,
      categories: formData.categories?.filter((c) => c !== cat) || [],
    });
  };

  const handleLibraryChange = (libraryId: string) => {
    const library = LIBRARY_OPTIONS.find((l) => l.id === libraryId);
    setFormData({
      ...formData,
      libraryId,
      blockType: library?.blockType || 'knowledge',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          id="title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter block title"
        />
      </div>

      {/* Library and Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="library" className="block text-sm font-medium text-gray-700 mb-1">
            Library *
          </label>
          <select
            id="library"
            value={formData.libraryId}
            onChange={(e) => handleLibraryChange(e.target.value)}
            disabled={!isNew}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            {LIBRARY_OPTIONS.map((lib) => (
              <option key={lib.id} value={lib.id}>
                {lib.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <input
          id="summary"
          type="text"
          value={formData.summary || ''}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Brief description of the block"
        />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categories
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.categories?.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add category"
          />
          <button
            type="button"
            onClick={addCategory}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Content *
        </label>
        <textarea
          id="content"
          required
          rows={15}
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          placeholder="Enter block content (Markdown supported)"
        />
      </div>

      {/* Scope Definition */}
      {scopeDefinition && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Scope Definition</h3>
            <div className="space-y-3">
              {/* Currently Covers */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Currently Covers
                </label>
                <textarea
                  value={scopeDefinition.covers}
                  onChange={(e) =>
                    setScopeDefinition({
                      ...scopeDefinition,
                      covers: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="What does this skill cover?"
                />
              </div>

              {/* Future Additions */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Planned Additions (one per line)
                </label>
                <textarea
                  value={scopeDefinition.futureAdditions.join('\n')}
                  onChange={(e) =>
                    setScopeDefinition({
                      ...scopeDefinition,
                      futureAdditions: e.target.value.split('\n').filter(s => s.trim()),
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="What content should be added later?"
                />
              </div>

              {/* Not Included */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Explicitly Excluded (one per line)
                </label>
                <textarea
                  value={(scopeDefinition.notIncluded || []).join('\n')}
                  onChange={(e) =>
                    setScopeDefinition({
                      ...scopeDefinition,
                      notIncluded: e.target.value.split('\n').filter(s => s.trim()),
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="What should not be included?"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : isNew ? 'Create Block' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
