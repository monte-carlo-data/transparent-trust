'use client';

/**
 * Basic Fields Section - Editor
 *
 * Editable fields:
 * - Title (required)
 * - Summary (optional)
 * - Content (required)
 * - Status (ACTIVE, ARCHIVED)
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getLibraryConfig } from '@/lib/library-config';
import type { LibraryId, BlockStatus, TypedBuildingBlock } from '@/types/v2/building-block';

interface FormDataBasic {
  title: string;
  summary: string;
  content: string;
  status: BlockStatus;
}

interface BasicFieldsSectionProps {
  skill: TypedBuildingBlock;
  libraryId: LibraryId;
  formData: FormDataBasic;
  onChange: (updates: Partial<FormDataBasic>) => void;
}

export function BasicFieldsSection({
  libraryId,
  formData,
  onChange,
}: BasicFieldsSectionProps) {
  const config = getLibraryConfig(libraryId);

  return (
    <div className="space-y-6 border-b pb-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Title *
        </label>
        <Input
          type="text"
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          required
          placeholder="Enter skill title"
          className="w-full"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Summary
        </label>
        <Input
          type="text"
          value={formData.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          placeholder="Brief overview (optional)"
          className="w-full"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          {config.mainContentHeading} *
        </label>
        <Textarea
          value={formData.content}
          onChange={(e) => onChange({ content: e.target.value })}
          required
          placeholder={`Enter ${config.singularName} content`}
          rows={12}
          className="w-full font-mono text-sm"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Status
        </label>
        <select
          value={formData.status}
          onChange={(e) => onChange({ status: e.target.value as BlockStatus })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
    </div>
  );
}
