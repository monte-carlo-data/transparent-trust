"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import { AuditLogEntry, AuditEntityType, AuditAction, Pagination } from "./types";
import { entityTypeConfig, actionConfig } from "./constants";
import { formatDate, formatFullDate, formatValue } from "./utils";

export default function AuditTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | "">("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      if (searchQuery) params.set("search", searchQuery);
      if (selectedEntityType) params.set("entityType", selectedEntityType);
      if (selectedAction) params.set("action", selectedAction);

      const response = await fetch(`/api/audit-log?${params.toString()}`);
      if (!response.ok) {
        // Try to extract error message from response
        // API returns { error: { code, message } } structure
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || errorData?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      const result = await response.json();
      // Handle both { data: { entries, pagination } } and { entries, pagination } formats
      const data = result.data || result;
      setEntries(data.entries || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedEntityType, selectedAction]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedEntityType("");
    setSelectedAction("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || selectedEntityType || selectedAction;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Track all changes across skills, customers, projects, and more</p>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="flex-1 border-none outline-none text-sm bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${
              showFilters ? "bg-blue-500 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button
            onClick={fetchAuditLog}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-gray-200 flex-wrap">
            <select
              value={selectedEntityType}
              onChange={(e) => { setSelectedEntityType(e.target.value as AuditEntityType | ""); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm"
            >
              <option value="">All Types</option>
              {Object.entries(entityTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value as AuditAction | ""); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm"
            >
              <option value="">All Actions</option>
              {Object.entries(actionConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700">
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Loading */}
      {isLoading && entries.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="flex justify-center mb-2">
            <InlineLoader size="lg" className="text-blue-500" />
          </div>
          Loading audit log...
        </div>
      )}

      {/* Empty */}
      {!isLoading && entries.length === 0 && !error && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Clock size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No audit log entries yet</p>
        </div>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {entries.map((entry, index) => {
            const entityConfig = entityTypeConfig[entry.entityType];
            const actConfig = actionConfig[entry.action];
            const isExpanded = expandedIds.has(entry.id);
            const EntityIcon = entityConfig.icon;

            return (
              <div key={entry.id} className={index < entries.length - 1 ? "border-b border-gray-100" : ""}>
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left ${isExpanded ? "bg-gray-50" : ""}`}
                >
                  {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${entityConfig.color}15` }}
                  >
                    <EntityIcon size={16} style={{ color: entityConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${actConfig.color}15`, color: actConfig.color }}
                      >
                        {actConfig.label}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {entityConfig.label}
                      </span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 truncate mt-1">
                      {entry.entityTitle || entry.entityId}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-gray-600">{entry.userName || entry.userEmail || "System"}</div>
                    <div className="text-xs text-gray-400" title={formatFullDate(entry.createdAt)}>
                      {formatDate(entry.createdAt)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pl-12 bg-gray-50">
                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <Clock size={12} />
                      {formatFullDate(entry.createdAt)}
                    </div>
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-xs font-medium text-gray-600 mb-1">Changes</h5>
                        <div className="bg-white border border-gray-200 rounded text-xs">
                          {Object.entries(entry.changes).map(([field, change], i) => (
                            <div
                              key={field}
                              className={`grid grid-cols-3 gap-2 p-2 ${i < Object.keys(entry.changes!).length - 1 ? "border-b border-gray-100" : ""}`}
                            >
                              <div className="font-medium text-gray-600">{field}</div>
                              <div className="text-red-500">From: {formatValue(change.from)}</div>
                              <div className="text-green-500">To: {formatValue(change.to)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Special display for Clarify Used entries */}
                    {entry.action === "CLARIFY_USED" && entry.metadata && (() => {
                      const meta = entry.metadata as Record<string, unknown>;
                      const autoFlagged = Boolean(meta.autoFlagged);
                      const projectName = meta.projectName ? String(meta.projectName) : null;
                      const question = meta.question ? String(meta.question) : null;
                      const userMessage = meta.userMessage ? String(meta.userMessage) : null;
                      const conversationLength = meta.conversationLength ? String(meta.conversationLength) : null;
                      return (
                        <div className="mb-2 space-y-2">
                          {autoFlagged && (
                            <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                              Auto-flagged for review
                            </div>
                          )}
                          {projectName && (
                            <div className="text-xs">
                              <span className="text-gray-500">Project:</span>{" "}
                              <span className="text-gray-700 font-medium">{projectName}</span>
                            </div>
                          )}
                          {question && (
                            <div className="text-xs">
                              <span className="text-gray-500">Question:</span>{" "}
                              <span className="text-gray-700">{question.substring(0, 200)}{question.length > 200 ? "..." : ""}</span>
                            </div>
                          )}
                          {userMessage && (
                            <div className="bg-white border border-gray-200 rounded p-2">
                              <div className="text-xs font-medium text-gray-600 mb-1">User asked:</div>
                              <div className="text-xs text-gray-700 whitespace-pre-wrap">{userMessage}</div>
                            </div>
                          )}
                          {conversationLength && (
                            <div className="text-xs text-gray-500">
                              Conversation length: {conversationLength} messages
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Show other metadata for non-clarify entries */}
                    {entry.action !== "CLARIFY_USED" && entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-xs font-medium text-gray-600 mb-1">Details</h5>
                        <div className="bg-white border border-gray-200 rounded text-xs p-2 space-y-1">
                          {Object.entries(entry.metadata).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-gray-500">{key}:</span>
                              <span className="text-gray-700">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">ID: {entry.entityId}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 p-3 bg-white border border-gray-200 rounded-lg">
          <span className="text-sm text-gray-500">
            {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
