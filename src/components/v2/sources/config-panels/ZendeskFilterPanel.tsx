'use client';

/**
 * Zendesk Filter Panel
 * Allows filtering Zendesk tickets by tag, assignee, ticket number, and date range
 * Tags support three-state toggle: neutral → include → exclude → neutral
 */

import { useState, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZendeskMetadata {
  ticketId: number;
  status?: string;
  priority?: string;
  assignee?: { id: string; name: string; email: string };
  tags?: string[];
  ticketCreatedAt?: string;
  ticketUpdatedAt?: string;
}

interface StagedSource {
  id: string;
  title: string;
  metadata: unknown;
}

export interface ZendeskFilters {
  ticketNumber: string;
  tags: string[];
  excludeTags: string[];
  assignees: string[];
  dateFrom: string;
  dateTo: string;
}

interface ZendeskFilterPanelProps {
  sources: StagedSource[];
  filters: ZendeskFilters;
  onFilterChange: (filters: ZendeskFilters) => void;
}

export function ZendeskFilterPanel({
  sources,
  filters,
  onFilterChange,
}: ZendeskFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique values from sources
  const uniqueValues = useMemo(() => {
    const tags = new Set<string>();
    const assignees = new Map<string, string>(); // id -> name
    let minDate = new Date().toISOString().split('T')[0];
    let maxDate = new Date().toISOString().split('T')[0];

    sources.forEach((source) => {
      const metadata = source.metadata as ZendeskMetadata | undefined;
      if (!metadata) return;

      // Collect tags
      metadata.tags?.forEach((tag) => tags.add(tag));

      // Collect assignees
      if (metadata.assignee?.id && metadata.assignee?.name) {
        assignees.set(metadata.assignee.id, metadata.assignee.name);
      }

      // Track date range
      if (metadata.ticketCreatedAt) {
        const createdDate = metadata.ticketCreatedAt.split('T')[0];
        if (createdDate < minDate) minDate = createdDate;
        if (createdDate > maxDate) maxDate = createdDate;
      }
      if (metadata.ticketUpdatedAt) {
        const updatedDate = metadata.ticketUpdatedAt.split('T')[0];
        if (updatedDate < minDate) minDate = updatedDate;
        if (updatedDate > maxDate) maxDate = updatedDate;
      }
    });

    return {
      tags: Array.from(tags).sort(),
      assignees: Array.from(assignees.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      minDate,
      maxDate,
    };
  }, [sources]);

  // Three-state toggle: neutral → include → exclude → neutral
  const handleTagToggle = (tag: string) => {
    const isIncluded = filters.tags.includes(tag);
    const isExcluded = filters.excludeTags.includes(tag);

    if (!isIncluded && !isExcluded) {
      // Neutral → Include
      onFilterChange({ ...filters, tags: [...filters.tags, tag] });
    } else if (isIncluded) {
      // Include → Exclude
      onFilterChange({
        ...filters,
        tags: filters.tags.filter((t) => t !== tag),
        excludeTags: [...filters.excludeTags, tag],
      });
    } else {
      // Exclude → Neutral
      onFilterChange({
        ...filters,
        excludeTags: filters.excludeTags.filter((t) => t !== tag),
      });
    }
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    const newAssignees = filters.assignees.includes(assigneeId)
      ? filters.assignees.filter((a) => a !== assigneeId)
      : [...filters.assignees, assigneeId];
    onFilterChange({ ...filters, assignees: newAssignees });
  };

  const handleClearAll = () => {
    onFilterChange({
      ticketNumber: '',
      tags: [],
      excludeTags: [],
      assignees: [],
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters =
    filters.ticketNumber ||
    filters.tags.length > 0 ||
    filters.excludeTags.length > 0 ||
    filters.assignees.length > 0 ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      {/* Filter Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">Filter Zendesk Tickets</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {[
                filters.ticketNumber ? 1 : 0,
                filters.tags.length,
                filters.excludeTags.length,
                filters.assignees.length,
                filters.dateFrom || filters.dateTo ? 1 : 0,
              ].reduce((a, b) => a + b)}{' '}
              active
            </span>
          )}
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-gray-600 transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      {/* Filter Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          {/* Ticket Number Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Ticket Number
            </label>
            <input
              type="text"
              placeholder="Search by ticket ID..."
              value={filters.ticketNumber}
              onChange={(e) =>
                onFilterChange({ ...filters, ticketNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  onFilterChange({ ...filters, dateFrom: e.target.value })
                }
                min={uniqueValues.minDate}
                max={uniqueValues.maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  onFilterChange({ ...filters, dateTo: e.target.value })
                }
                min={uniqueValues.minDate}
                max={uniqueValues.maxDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tags */}
          {uniqueValues.tags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Tags
                {(filters.tags.length > 0 || filters.excludeTags.length > 0) && (
                  <span className="font-normal text-gray-500 ml-1">
                    ({filters.tags.length > 0 && `${filters.tags.length} included`}
                    {filters.tags.length > 0 && filters.excludeTags.length > 0 && ', '}
                    {filters.excludeTags.length > 0 && `${filters.excludeTags.length} excluded`})
                  </span>
                )}
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Click to include, click again to exclude, click again to clear
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueValues.tags.map((tag) => {
                  const isIncluded = filters.tags.includes(tag);
                  const isExcluded = filters.excludeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        isIncluded && 'bg-blue-600 text-white',
                        isExcluded && 'bg-red-600 text-white line-through',
                        !isIncluded &&
                          !isExcluded &&
                          'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                      )}
                    >
                      {isExcluded && '− '}
                      {isIncluded && '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assignees */}
          {uniqueValues.assignees.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Assigned To ({filters.assignees.length} selected)
              </label>
              <div className="space-y-2">
                {uniqueValues.assignees.map((assignee) => (
                  <button
                    key={assignee.id}
                    onClick={() => handleAssigneeToggle(assignee.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center',
                      filters.assignees.includes(assignee.id)
                        ? 'bg-blue-50 border border-blue-300 text-gray-900 font-medium'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                    )}
                  >
                    <span className="flex-1">{assignee.name}</span>
                    {filters.assignees.includes(assignee.id) && (
                      <span className="text-blue-600">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear All Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
