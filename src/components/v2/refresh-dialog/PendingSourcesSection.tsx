'use client';

/**
 * PendingSourcesSection
 *
 * Shows pending sources that can be selected for refresh.
 * Uses SourceItem for consistent rendering and token tracking.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SourceItem } from '../sources';
import type { SourceData } from './types';

interface PendingSourcesSectionProps {
  sources: SourceData[];
  selectedIds: Set<string>;
  onToggle?: (sourceId: string) => void;
  defaultExpanded?: boolean;
}

export function PendingSourcesSection({
  sources,
  selectedIds,
  onToggle,
  defaultExpanded = true,
}: PendingSourcesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (sources.length === 0) {
    return null;
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
      >
        <h3 className="font-medium text-amber-900">
          Pending Sources ({selectedCount} of {sources.length} selected)
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-amber-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-amber-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t divide-y divide-gray-100">
          {sources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              selected={selectedIds.has(source.id)}
              onToggle={onToggle}
              showCheckbox={true}
              registerTokens={selectedIds.has(source.id)}
              size="sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
