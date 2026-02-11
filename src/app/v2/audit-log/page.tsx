/**
 * V2 Audit Log Page
 *
 * System audit trail - reuses components from V1 audit-log
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loading';
import { useApiQuery } from '@/hooks/use-api';

import {
  SearchFilterBar,
  AuditEntryRow,
  PaginationControls,
  AuditEntityType,
  AuditAction,
  AuditLogEntry,
  Pagination,
} from '@/app/audit-log/components';

type AuditLogResponse = {
  entries: AuditLogEntry[];
  pagination: Pagination;
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | ''>('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  // Expansion state for entries
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Fetch audit log with useApiQuery
  const { data: auditData, isLoading, error: queryError, refetch } = useApiQuery<AuditLogResponse>({
    queryKey: ['audit-log', page, limit, searchQuery, selectedEntityType, selectedAction],
    url: '/api/audit-log',
    params: {
      page,
      limit,
      search: searchQuery || undefined,
      entityType: selectedEntityType || undefined,
      action: selectedAction || undefined,
    },
    responseKey: 'data',
  });

  const hasActiveFilters = Boolean(selectedEntityType || selectedAction || searchQuery);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedEntityType('');
    setSelectedAction('');
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleToggleEntry = useCallback((entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2/admin"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
        </div>
        <p className="text-gray-500">System activity and changes across the platform</p>
      </div>

      {/* Filter Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        selectedEntityType={selectedEntityType}
        onEntityTypeChange={(type) => {
          setSelectedEntityType(type);
          setPage(1);
        }}
        selectedAction={selectedAction}
        onActionChange={(action) => {
          setSelectedAction(action);
          setPage(1);
        }}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onRefresh={handleRefresh}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <InlineLoader />
        </div>
      )}

      {/* Error State */}
      {queryError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">
            {queryError instanceof Error ? queryError.message : 'Failed to load audit log'}
          </p>
        </div>
      )}

      {/* Entries */}
      {!isLoading && !queryError && auditData && (
        <div>
          {auditData.entries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No audit log entries found</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {auditData.entries.map((entry, index) => (
                  <AuditEntryRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedEntryId === entry.id}
                    isLast={index === auditData.entries.length - 1}
                    onToggle={() => handleToggleEntry(entry.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <PaginationControls
                pagination={auditData.pagination}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
