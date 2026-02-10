'use client';

/**
 * Skill History Component
 *
 * Displays audit trail of skill modifications with timestamps and user attribution.
 */

import { Clock, Edit3, RotateCcw, Plus } from 'lucide-react';

interface HistoryEntry {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
}

interface SkillHistoryProps {
  history?: HistoryEntry[];
  lastRefreshedAt?: string;
  createdAt?: string;
}

export function SkillHistory({ history = [], lastRefreshedAt, createdAt }: SkillHistoryProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'updated':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'refreshed':
        return <RotateCcw className="w-4 h-4 text-amber-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-50 border-green-200';
      case 'updated':
        return 'bg-blue-50 border-blue-200';
      case 'refreshed':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry, index) => (
        <div
          key={index}
          className={`rounded-lg border p-4 ${getActionColor(entry.action)}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">{getActionIcon(entry.action)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-gray-900 text-sm capitalize">
                  {entry.action}
                </p>
                <p className="text-xs text-gray-600">
                  {formatDate(entry.date)}
                </p>
              </div>
              <p className="text-sm text-gray-700">{entry.summary}</p>
              {entry.user && (
                <p className="text-xs text-gray-500 mt-2">
                  By: {entry.user}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {(createdAt || lastRefreshedAt) && (
        <div className="pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-1">
          {createdAt && (
            <p>
              <span className="font-medium">Created:</span> {formatDate(createdAt)}
            </p>
          )}
          {lastRefreshedAt && (
            <p>
              <span className="font-medium">Last Refreshed:</span> {formatDate(lastRefreshedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
