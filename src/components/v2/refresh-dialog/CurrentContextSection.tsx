'use client';

/**
 * CurrentContextSection
 *
 * Shows the current skill content and incorporated sources.
 * This represents what's already in the skill before refresh.
 */

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { SourceItem } from '../sources';
import type { SourceData } from './types';

interface CurrentContextSectionProps {
  skillContent: string;
  incorporatedSources: SourceData[];
}

export function CurrentContextSection({
  skillContent,
  incorporatedSources,
}: CurrentContextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render if there's nothing to show
  if (!skillContent && incorporatedSources.length === 0) {
    return null;
  }

  const skillTokens = Math.ceil(skillContent.length * 0.25);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
      >
        <h3 className="font-medium text-blue-900">
          Current Context ({incorporatedSources.length} sources)
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-blue-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t divide-y divide-gray-100">
          {/* Skill content - display only, always included */}
          {skillContent && (
            <div className="p-4 bg-blue-50/50">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <FileText className="w-4 h-4" />
                <span className="font-medium">Skill Content</span>
                <span className="text-blue-600">
                  ~{skillTokens.toLocaleString()} tokens
                </span>
              </div>
            </div>
          )}

          {/* Incorporated sources - display only, always included */}
          {incorporatedSources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              showCheckbox={false}
              registerTokens={true}
              size="sm"
            />
          ))}

          {incorporatedSources.length === 0 && !skillContent && (
            <div className="p-4 text-sm text-gray-500">
              No sources currently incorporated
            </div>
          )}
        </div>
      )}
    </div>
  );
}
