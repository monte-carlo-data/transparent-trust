'use client';

import { X, Calendar, User } from 'lucide-react';

interface HistoryEntry {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
}

interface SkillHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
}

function getActionColor(action: string) {
  switch (action) {
    case 'created':
      return 'bg-green-50 border-green-200 text-green-700';
    case 'updated':
      return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'refreshed':
      return 'bg-purple-50 border-purple-200 text-purple-700';
    case 'owner_added':
    case 'owner_removed':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700';
  }
}

function getActionLabel(action: string) {
  switch (action) {
    case 'created':
      return 'Created';
    case 'updated':
      return 'Updated';
    case 'refreshed':
      return 'Refreshed';
    case 'owner_added':
      return 'Owner Added';
    case 'owner_removed':
      return 'Owner Removed';
    default:
      return action;
  }
}

export default function SkillHistoryDialog({
  isOpen,
  onClose,
  history,
}: SkillHistoryDialogProps) {
  if (!isOpen) return null;

  const sortedHistory = [...history].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Skill History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedHistory.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No history available</p>
          ) : (
            <div className="space-y-4">
              {sortedHistory.map((entry, index) => (
                <div
                  key={`${entry.date}-${index}`}
                  className={`border rounded-lg p-4 ${getActionColor(entry.action)}`}
                >
                  {/* Timeline marker */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {entry.action === 'created' ? (
                        <div className="w-2 h-2 rounded-full bg-current mt-1" />
                      ) : entry.action === 'refreshed' ? (
                        <div className="w-2 h-2 rounded-full bg-current mt-1" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-current mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-sm">
                          {getActionLabel(entry.action)}
                        </h4>
                        <time className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>

                      {entry.summary && (
                        <p className="text-sm mb-2">{entry.summary}</p>
                      )}

                      {entry.user && (
                        <div className="text-xs flex items-center gap-1 opacity-75">
                          <User className="w-3 h-3" />
                          {entry.user}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
