'use client';

/**
 * SkillAuditDialog
 *
 * Displays the audit trail (history) of a skill including all changes.
 * Shows: creation, edits, owner changes, tier changes, refreshes, syncs.
 * Used in skill detail views to provide transparency and accountability.
 */

import { useState } from 'react';
import { X, ChevronDown, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
import type { AuditLogEntry } from '@/lib/v2/audit';

interface SkillAuditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: AuditLogEntry[];
  skillTitle: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  created: <CheckCircle className="w-4 h-4 text-green-600" />,
  updated: <Clock className="w-4 h-4 text-blue-600" />,
  published: <CheckCircle className="w-4 h-4 text-green-600" />,
  archived: <AlertCircle className="w-4 h-4 text-gray-600" />,
  refreshed: <Clock className="w-4 h-4 text-amber-600" />,
  owner_added: <User className="w-4 h-4 text-purple-600" />,
  owner_removed: <User className="w-4 h-4 text-purple-600" />,
  category_added: <Clock className="w-4 h-4 text-blue-600" />,
  category_removed: <Clock className="w-4 h-4 text-blue-600" />,
  tier_changed: <Clock className="w-4 h-4 text-blue-600" />,
  synced: <CheckCircle className="w-4 h-4 text-green-600" />,
  sync_failed: <AlertCircle className="w-4 h-4 text-red-600" />,
  deleted: <AlertCircle className="w-4 h-4 text-red-600" />,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-50 dark:bg-green-950 border-l-4 border-l-green-600',
  updated: 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-600',
  published: 'bg-green-50 dark:bg-green-950 border-l-4 border-l-green-600',
  archived: 'bg-gray-50 dark:bg-gray-950 border-l-4 border-l-gray-600',
  refreshed: 'bg-amber-50 dark:bg-amber-950 border-l-4 border-l-amber-600',
  owner_added: 'bg-purple-50 dark:bg-purple-950 border-l-4 border-l-purple-600',
  owner_removed: 'bg-purple-50 dark:bg-purple-950 border-l-4 border-l-purple-600',
  category_added: 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-600',
  category_removed: 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-600',
  tier_changed: 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-600',
  synced: 'bg-green-50 dark:bg-green-950 border-l-4 border-l-green-600',
  sync_failed: 'bg-red-50 dark:bg-red-950 border-l-4 border-l-red-600',
  deleted: 'bg-red-50 dark:bg-red-950 border-l-4 border-l-red-600',
};

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Unknown date';
  }
}

export function SkillAuditDialog({
  isOpen,
  onClose,
  auditLog,
  skillTitle,
}: SkillAuditDialogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Sort by date descending (most recent first)
  const sortedLog = [...auditLog].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Skill History
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {skillTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto flex-1 p-6">
          {sortedLog.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No audit history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLog.map((entry, index) => (
                <div key={`${entry.date}-${index}`}>
                  <button
                    onClick={() =>
                      setExpandedIndex(expandedIndex === index ? null : index)
                    }
                    className={`w-full p-4 rounded-lg transition-colors ${
                      actionColors[entry.action] ||
                      'bg-gray-50 dark:bg-gray-950 border-l-4 border-l-gray-600'
                    } hover:opacity-90`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="pt-0.5 flex-shrink-0">
                          {actionIcons[entry.action] || (
                            <Clock className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {entry.summary}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                            <span>{formatDate(entry.date)}</span>
                            {entry.userName && (
                              <>
                                <span>•</span>
                                <span>{entry.userName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {entry.details && (
                        <ChevronDown
                          className={`w-4 h-4 flex-shrink-0 text-gray-500 transition-transform ${
                            expandedIndex === index ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedIndex === index && entry.details && (
                    <div className="mt-2 ml-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
