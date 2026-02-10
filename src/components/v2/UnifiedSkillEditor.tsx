'use client';

/**
 * Unified Skill Editor
 *
 * Full-page editor for all skill properties across all libraries.
 * Provides comprehensive editing capability with all sections visible.
 *
 * Features:
 * - Edit all skill properties (title, content, categories, attributes, scope)
 * - Library-specific section rendering via config
 * - Dynamic category loading and creation
 * - Owner/SME selection
 * - Scope definition editing (when applicable)
 * - Real-time validation
 * - Save/cancel workflows
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLibraryConfig } from '@/lib/library-config';
import { getVisibleEditorSections } from '@/lib/v2/editor-ui/editor-sections-config';
import { BasicFieldsSection } from './editor-sections/BasicFieldsSection';
import { CategoriesSection } from './editor-sections/CategoriesSection';
import { AttributesSection } from './editor-sections/AttributesSection';
import { ScopeSection } from './editor-sections/ScopeSection';
import type { LibraryId, TypedBuildingBlock, BlockStatus, ScopeDefinition } from '@/types/v2/building-block';

interface UnifiedSkillEditorProps {
  skill: TypedBuildingBlock;
  libraryId: LibraryId;
  backLink: string;
}

interface EditorFormData {
  title: string;
  summary: string;
  content: string;
  status: BlockStatus;
  categories: string[];
  attributes: Record<string, unknown>;
  scope: ScopeDefinition | null;
}

export function UnifiedSkillEditor({
  skill,
  libraryId,
  backLink,
}: UnifiedSkillEditorProps) {
  const router = useRouter();
  const config = getLibraryConfig(libraryId);
  const visibleSections = getVisibleEditorSections(libraryId);

  // Extract scope from attributes safely
  const skillAttributes = skill.attributes as Record<string, unknown> | null;
  const initialScope = skillAttributes?.scopeDefinition as ScopeDefinition | undefined;

  const [formData, setFormData] = useState<EditorFormData>({
    title: skill.title,
    summary: skill.summary || '',
    content: skill.content,
    status: skill.status as BlockStatus,
    categories: skill.categories || [],
    attributes: skillAttributes || {},
    scope: initialScope || null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const updateFormData = (updates: Partial<EditorFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        summary: formData.summary || undefined,
        content: formData.content,
        status: formData.status,
        categories: formData.categories,
        attributes: {
          ...formData.attributes,
          ...(formData.scope && { scopeDefinition: formData.scope }),
        },
      };

      const response = await fetch(`/api/v2/blocks/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to save ${config.singularName}`);
      }

      setHasChanges(false);
      router.push(backLink);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      console.error('Error saving skill:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        return;
      }
    }
    router.push(backLink);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={backLink}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Edit {config.itemName}</h1>
              <p className="text-sm text-gray-600">{skill.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.title.trim() || !formData.content.trim()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-8">
          {/* Basic Fields */}
          {visibleSections.some((s) => s.key === 'basic') && (
            <BasicFieldsSection
              skill={skill}
              libraryId={libraryId}
              formData={{
                title: formData.title,
                summary: formData.summary,
                content: formData.content,
                status: formData.status,
              }}
              onChange={(updates) => updateFormData(updates)}
            />
          )}

          {/* Categories */}
          {visibleSections.some((s) => s.key === 'categories') && (
            <CategoriesSection
              libraryId={libraryId}
              categories={formData.categories}
              onChange={(categories) => updateFormData({ categories })}
            />
          )}

          {/* Attributes */}
          {visibleSections.some((s) => s.key === 'attributes') && (
            <AttributesSection
              libraryId={libraryId}
              attributes={formData.attributes}
              onChange={(attributes) => updateFormData({ attributes })}
            />
          )}

          {/* Scope Definition */}
          {visibleSections.some((s) => s.key === 'scope') && (
            <ScopeSection
              scope={formData.scope}
              onChange={(scope) => updateFormData({ scope })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
