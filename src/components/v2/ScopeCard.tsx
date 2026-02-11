'use client';

/**
 * ScopeCard
 *
 * Displays skill scope definition: what it covers, future additions, and exclusions.
 * Helps teams understand the skill's current focus and planned evolution.
 */

import { CheckCircle, Plus, XCircle, Lightbulb } from 'lucide-react';

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded?: string[];
}

interface ScopeCardProps {
  scope?: ScopeDefinition;
  skillTitle: string;
}

export function ScopeCard({ scope }: ScopeCardProps) {
  // Show a subtle empty state if scope is not defined or empty
  if (!scope || !scope.covers) {
    return (
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Scope</h3>
        <p className="text-xs text-gray-600 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          No scope defined yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Scope</h3>

      <div className="space-y-6">
        {/* What it covers */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            Currently Covers
          </label>
          <p className="text-sm text-gray-700 leading-relaxed bg-green-50 p-3 rounded-lg border border-green-200 break-words overflow-wrap-break-word">
            {scope.covers}
          </p>
        </div>

        {/* Future additions */}
        {scope.futureAdditions && scope.futureAdditions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Planned Additions
            </label>
            <div className="space-y-2">
              {scope.futureAdditions.map((addition, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>{addition}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not included */}
        {scope.notIncluded && scope.notIncluded.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              Explicitly Excluded
            </label>
            <div className="space-y-2">
              {scope.notIncluded.map((excluded, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>{excluded}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scope.covers && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Lightbulb className="w-4 h-4" />
            No scope defined yet
          </div>
        )}
      </div>
    </div>
  );
}
