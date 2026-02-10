'use client';

import React, { useMemo } from 'react';
import { RefreshCw, Trash2, Plus } from 'lucide-react';

export interface StagedSourceItem {
  id: string;
  title: string;
  content: string | null;
  sourceType: string;
  stagedAt: Date | string;
  metadata: unknown;
  ignoredAt?: Date | null;
  ignoredBy?: string | null;
  assignments?: Array<{
    id: string;
    incorporatedAt: Date | null;
    block: { id: string; title: string; slug: string | null; isActive: boolean };
  }>;
}

type SourceStatus = 'NEW' | 'REVIEWED' | 'IGNORED';

interface StagedSourceListProps {
  sources: StagedSourceItem[];
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onRefresh?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
  onAddToSkill?: (id: string) => void;
  sourceTypeIcon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}

function getSourceStatus(source: StagedSourceItem): SourceStatus {
  if (source.ignoredAt) return 'IGNORED';
  if (
    source.assignments?.some(
      (a) =>
        (a as Record<string, unknown>).incorporatedAt !== null &&
        (a.block?.isActive ?? true) // Only count assignments to active skills
    )
  )
    return 'REVIEWED';
  return 'NEW';
}

function getStatusBadge(status: SourceStatus) {
  const styles = {
    NEW: 'bg-blue-100 text-blue-800',
    REVIEWED: 'bg-green-100 text-green-800',
    IGNORED: 'bg-gray-100 text-gray-800',
  };
  return styles[status];
}

export function StagedSourceList({
  sources,
  selectedIds = new Set(),
  onSelectionChange,
  onRefresh,
  onIgnore,
  onAddToSkill,
  sourceTypeIcon: Icon,
  compact = false,
}: StagedSourceListProps) {
  const [refreshing, setRefreshing] = React.useState<Set<string>>(new Set());
  const [ignoring, setIgnoring] = React.useState<Set<string>>(new Set());

  const statusCounts = useMemo(() => {
    const counts = { NEW: 0, REVIEWED: 0, IGNORED: 0 };
    sources.forEach((source) => {
      const status = getSourceStatus(source);
      counts[status]++;
    });
    return counts;
  }, [sources]);

  const handleRefresh = async (id: string) => {
    if (!onRefresh) return;
    setRefreshing((prev) => new Set(prev).add(id));
    try {
      await onRefresh(id);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleIgnore = async (id: string) => {
    if (!onIgnore) return;
    setIgnoring((prev) => new Set(prev).add(id));
    try {
      await onIgnore(id);
    } finally {
      setIgnoring((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && (
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="text-xs font-medium text-gray-600">
            NEW: {statusCounts.NEW} | REVIEWED: {statusCounts.REVIEWED} |
            IGNORED: {statusCounts.IGNORED}
          </span>
        </div>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {sources.map((source) => {
          const status = getSourceStatus(source);
          const isSelected = selectedIds.has(source.id);
          const isRefreshing = refreshing.has(source.id);
          const isIgnoring = ignoring.has(source.id);

          return (
            <div
              key={source.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {onSelectionChange && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleSelection(source.id)}
                  className="mt-1 cursor-pointer"
                />
              )}

              <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {source.title}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {source.assignments
                        ?.filter((a) => a.block?.isActive)
                        .map((assignment) => (
                          <span
                            key={assignment.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700"
                          >
                            {assignment.block?.title}
                          </span>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {typeof source.stagedAt === 'string'
                        ? new Date(source.stagedAt).toLocaleDateString()
                        : source.stagedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusBadge(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                </div>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                {onRefresh && (
                  <button
                    onClick={() => handleRefresh(source.id)}
                    disabled={isRefreshing}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Refresh content"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        isRefreshing ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                )}
                {onAddToSkill && (
                  <button
                    onClick={() => onAddToSkill(source.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    title="Add to skill"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {onIgnore && (
                  <button
                    onClick={() => handleIgnore(source.id)}
                    disabled={isIgnoring}
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Ignore source"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
