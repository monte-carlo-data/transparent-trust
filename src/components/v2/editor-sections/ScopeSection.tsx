'use client';

/**
 * Scope Definition Section - Editor
 *
 * Allows editing the scope definition which includes:
 * - Currently Covers
 * - Planned Additions (future content)
 * - Explicitly Excluded (out of scope items)
 */

import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import type { ScopeDefinition } from '@/types/v2/building-block';

interface ScopeSectionProps {
  scope: ScopeDefinition | null;
  onChange: (scope: ScopeDefinition | null) => void;
}

const EMPTY_SCOPE: ScopeDefinition = {
  covers: '',
  futureAdditions: [],
  notIncluded: [],
};

export function ScopeSection({ scope, onChange }: ScopeSectionProps) {
  // Allow adding scope definition if not present
  if (!scope) {
    return (
      <div className="space-y-4 border-b pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Scope Definition</h3>
            <p className="text-xs text-gray-500 mt-1">
              Define what this skill covers and what it doesn&apos;t.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(EMPTY_SCOPE)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" />
            Add Scope Definition
          </button>
        </div>
      </div>
    );
  }

  const handleChange = (field: keyof ScopeDefinition, value: unknown) => {
    onChange({
      ...scope,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6 border-b pb-6">
      {/* Currently Covers */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Currently Covers
        </label>
        <p className="text-xs text-gray-600 mb-2">
          What content and topics does this skill currently address?
        </p>
        <Textarea
          value={scope.covers}
          onChange={(e) => handleChange('covers', e.target.value)}
          placeholder="Describe what this skill covers..."
          rows={4}
          className="w-full font-mono text-sm"
        />
      </div>

      {/* Future Additions */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Planned Additions
        </label>
        <p className="text-xs text-gray-600 mb-2">
          What content should be added in the future? (one per line)
        </p>
        <Textarea
          value={scope.futureAdditions.join('\n')}
          onChange={(e) =>
            handleChange(
              'futureAdditions',
              e.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            )
          }
          placeholder="- Add advanced troubleshooting steps&#10;- Document new API features&#10;- Include security best practices"
          rows={4}
          className="w-full font-mono text-sm"
        />
      </div>

      {/* Explicitly Excluded */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Explicitly Excluded
        </label>
        <p className="text-xs text-gray-600 mb-2">
          What topics should NOT be included? (one per line)
        </p>
        <Textarea
          value={(scope.notIncluded || []).join('\n')}
          onChange={(e) =>
            handleChange(
              'notIncluded',
              e.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            )
          }
          placeholder="- Deprecated features&#10;- Competitor comparisons&#10;- Internal political discussions"
          rows={4}
          className="w-full font-mono text-sm"
        />
      </div>
    </div>
  );
}
