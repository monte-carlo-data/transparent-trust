'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, RefreshCw, Clock, User } from 'lucide-react';
import CategoryPills from './CategoryPills';
import UsageBadge from './UsageBadge';
import PendingSourcesBadge from './PendingSourcesBadge';
import OwnerAvatars from './OwnerAvatars';
import SyncStatusBadgeV2 from './SyncStatusBadgeV2';

interface SkillOwner {
  userId?: string;
  name: string;
  email?: string;
  image?: string;
}

interface HistoryEntry {
  date: string;
  action: 'created' | 'updated' | 'refreshed' | 'owner_added' | 'owner_removed';
  summary: string;
  user?: string;
}

interface Source {
  url: string;
  title?: string;
  type?: string;
  incorporated?: boolean;
}

interface LibraryCardProps {
  id: string;
  title: string;
  content: string;
  categories?: string[];
  owners?: SkillOwner[];
  syncStatus?: 'synced' | 'pending' | 'failed' | null;
  lastSyncedAt?: string;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  history?: HistoryEntry[];
  sourceUrls?: Source[];
  pendingTicketsCount?: number;
  pendingSlackCount?: number;
  pendingNotionCount?: number;
  onEdit?: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
  onCategoryManage?: () => void;
  onOwnerManage?: () => void;
  onViewHistory?: () => void;
}

export default function LibraryCard({
  title,
  content,
  categories = [],
  owners = [],
  syncStatus,
  lastSyncedAt,
  usageCount = 0,
  createdAt,
  updatedAt,
  status = 'ACTIVE',
  history = [],
  sourceUrls = [],
  pendingTicketsCount = 0,
  pendingSlackCount = 0,
  pendingNotionCount = 0,
  onEdit,
  onRefresh,
  onDelete,
  onCategoryManage,
  onOwnerManage,
  onViewHistory,
}: LibraryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const pendingSourcesCount = pendingTicketsCount + pendingSlackCount + pendingNotionCount;
  const incorporatedSources = sourceUrls.filter((s) => s.incorporated).length;
  const pendingSources = sourceUrls.filter((s) => !s.incorporated).length;
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:shadow-lg">
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-base mb-2">
              {title}
            </h3>
            {/* Badges row */}
            <div className="flex flex-wrap gap-2 items-center">
              {status === 'DRAFT' && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                  Draft
                </span>
              )}
              {syncStatus && (
                <SyncStatusBadgeV2
                  status={syncStatus}
                  lastSyncedAt={lastSyncedAt}
                  size="sm"
                  showLabel={false}
                />
              )}
              {usageCount > 0 && <UsageBadge usageCount={usageCount} size="sm" />}
              {pendingSourcesCount > 0 && (
                <PendingSourcesBadge count={pendingSourcesCount} size="sm" />
              )}
            </div>
          </div>

          {/* Expand arrow */}
          <button
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-shrink-0 mt-1"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Categories
                </h4>
                <CategoryPills categories={categories} size="sm" />
              </div>
            )}

            {/* Owners */}
            {owners.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Owners
                </h4>
                <OwnerAvatars owners={owners} size="sm" />
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Created {new Date(createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Updated {new Date(updatedAt).toLocaleDateString()}
              </div>
              <div className="col-span-2">
                Word count: {wordCount} words
              </div>
            </div>

            {/* Content Preview */}
            <div>
              <button
                onClick={() =>
                  setExpandedSection(
                    expandedSection === 'content' ? null : 'content'
                  )
                }
                className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1 hover:text-gray-900"
              >
                {expandedSection === 'content' ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Content
              </button>
              {expandedSection === 'content' && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto line-clamp-5">
                  {content}
                </div>
              )}
            </div>

            {/* Sources */}
            {sourceUrls.length > 0 && (
              <div>
                <button
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === 'sources' ? null : 'sources'
                    )
                  }
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1 hover:text-gray-900"
                >
                  {expandedSection === 'sources' ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Sources ({sourceUrls.length})
                </button>
                {expandedSection === 'sources' && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingSources > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-1">
                          Pending ({pendingSources})
                        </p>
                        {sourceUrls
                          .filter((s) => !s.incorporated)
                          .map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-amber-50 border border-amber-200 p-2 rounded text-amber-700 mb-1 truncate"
                            >
                              {source.title || source.url}
                            </div>
                          ))}
                      </div>
                    )}
                    {incorporatedSources > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1">
                          Incorporated ({incorporatedSources})
                        </p>
                        {sourceUrls
                          .filter((s) => s.incorporated)
                          .map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-green-50 border border-green-200 p-2 rounded text-green-700 truncate"
                            >
                              {source.title || source.url}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <button
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === 'history' ? null : 'history'
                    )
                  }
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1 hover:text-gray-900"
                >
                  {expandedSection === 'history' ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  History ({history.length})
                </button>
                {expandedSection === 'history' && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {history.map((entry, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded"
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {entry.action}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          {entry.summary}
                        </div>
                        <div className="text-gray-500 flex items-center gap-1 mt-1">
                          {entry.user && (
                            <>
                              <User className="w-3 h-3" />
                              {entry.user}
                            </>
                          )}
                          <Clock className="w-3 h-3" />
                          {new Date(entry.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 flex flex-wrap gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded transition-colors flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
            {onCategoryManage && (
              <button
                onClick={onCategoryManage}
                className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded transition-colors"
              >
                Categories
              </button>
            )}
            {onOwnerManage && (
              <button
                onClick={onOwnerManage}
                className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded transition-colors"
              >
                Owners
              </button>
            )}
            {onRefresh && pendingSourcesCount > 0 && (
              <button
                onClick={onRefresh}
                className="px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            )}
            {onViewHistory && history.length > 0 && (
              <button
                onClick={onViewHistory}
                className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded transition-colors"
              >
                View History
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-700 rounded transition-colors flex items-center gap-1 ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
