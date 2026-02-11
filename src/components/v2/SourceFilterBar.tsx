'use client';

/**
 * Source Filter Bar Component
 *
 * Reusable filter controls for displaying sources by status:
 * - Pending: Sources awaiting assignment/review
 * - Incorporated: Sources that have been used in skills/items
 * - Ignored: Sources that have been rejected
 */

import { CheckCircle, X } from 'lucide-react';

export interface SourceFilterBarProps {
  statusFilters: {
    pending: boolean;
    incorporated: boolean;
    ignored: boolean;
  };
  onStatusChange: (status: 'pending' | 'incorporated' | 'ignored', checked: boolean) => void;
  counts: {
    pending: number;
    incorporated: number;
    ignored: number;
  };
}

export function SourceFilterBar({
  statusFilters,
  onStatusChange,
  counts,
}: SourceFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Pending Filter */}
      <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300 hover:border-blue-400 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={statusFilters.pending}
          onChange={(e) => onStatusChange('pending', e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer"
        />
        <span className="text-sm font-medium text-gray-700">
          Pending
          <span className="ml-1 text-gray-500">({counts.pending})</span>
        </span>
      </label>

      {/* Incorporated Filter */}
      <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300 hover:border-green-400 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={statusFilters.incorporated}
          onChange={(e) => onStatusChange('incorporated', e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer"
        />
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-gray-700">
          Incorporated
          <span className="ml-1 text-gray-500">({counts.incorporated})</span>
        </span>
      </label>

      {/* Ignored Filter */}
      <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300 hover:border-gray-500 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={statusFilters.ignored}
          onChange={(e) => onStatusChange('ignored', e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer"
        />
        <X className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          Ignored
          <span className="ml-1 text-gray-500">({counts.ignored})</span>
        </span>
      </label>
    </div>
  );
}
