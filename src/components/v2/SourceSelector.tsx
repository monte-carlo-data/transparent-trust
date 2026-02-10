'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, CheckSquare, Square, ExternalLink, RefreshCw, ChevronDown, Search, Loader2, Trash2, Zap, Tag, Users, Clock, ArrowDownLeft, ArrowUpRight, FileText, Calendar, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ignoreSource } from '@/lib/v2/sources/source-service';
import TokenCountBadge from './tokens/TokenCountBadge';
import {
  extractKeywords,
  quickMatchKeywords,
  formatKeyword,
  getMatchConfidence,
  getConfidenceColor,
  type QuickMatchResult,
} from '@/lib/v2/matching/keyword-utils';

interface StagedSource {
  id: string;
  type: 'zendesk' | 'slack' | 'notion' | 'gong' | 'url' | 'document';
  title: string;
  description?: string;
  status: 'NEW' | 'REVIEWED' | 'IGNORED';
  tags?: string[];
  url?: string;
  externalUrl?: string;
  createdAt: string;
  usedInSkills?: Array<{ id: string; title: string }>;
  /** Source-specific metadata for enhanced display */
  metadata?: Record<string, unknown>;
}

/** Gong-specific metadata for type-safe access */
interface GongMetadata {
  callId?: string;
  duration?: number;
  direction?: 'inbound' | 'outbound';
  participants?: Array<{
    name: string;
    email?: string;
    role: 'internal' | 'external';
  }>;
  topics?: string[];
  matchedCustomerId?: string;
  matchedCustomerName?: string; // Resolved customer name (when available)
  hasTranscript?: boolean;
  gongUrl?: string;
  startedAt?: string;
}


/** Format duration in seconds to human-readable string */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/** Extract company/domain from email */
function extractCompanyFromEmail(email: string): string | null {
  const match = email.match(/@(.+)$/);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  // Skip generic email providers
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
  if (genericDomains.includes(domain)) return null;
  // Extract company name from domain (e.g., "acme.com" -> "Acme")
  const companyPart = domain.split('.')[0];
  return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
}

/**
 * Extract company name from Gong call title
 * Common patterns:
 * - "Company A <> Company B" or "Company A <-> Company B" (call between two companies)
 * - "(Proposed) Company A <> Company B" (with prefix)
 * - "Company Name - Meeting Topic"
 */
function extractCompanyFromTitle(title: string, internalCompanyHint?: string): string | null {
  if (!title) return null;

  // Pattern 1: "Company A <> Company B" or "Company A <-> Company B"
  const separatorMatch = title.match(/^(?:\([^)]+\)\s*)?(.+?)\s*<[-]?>\s*(.+?)(?:\s*[-|:]|$)/);
  if (separatorMatch) {
    const [, companyA, companyB] = separatorMatch;
    // If we have a hint about which is internal, return the other one
    const internalLower = internalCompanyHint?.toLowerCase();
    if (internalLower) {
      if (companyA.toLowerCase().includes(internalLower)) {
        return companyB.trim();
      }
      if (companyB.toLowerCase().includes(internalLower)) {
        return companyA.trim();
      }
    }
    // Default: assume first company is external (customer)
    return companyA.trim();
  }

  // Pattern 2: "Company Name - Topic" or "Company Name: Topic"
  const dashMatch = title.match(/^(?:\([^)]+\)\s*)?([^-:|]+?)(?:\s*[-:|])/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }

  return null;
}

interface SkillForMatching {
  id: string;
  title: string;
  keywords?: string[];
  scopeCovers?: string;
}

interface SourceSelectorProps {
  sources: StagedSource[];
  selectedSourceIds: Set<string>;
  onSelectSource: (sourceId: string) => void;
  onDeselectSource: (sourceId: string) => void;
  onSelectAll?: (sourceIds?: string[]) => void;
  onSelectBulk?: (sourceIds: string[]) => void;
  onClearAll: () => void;
  sourceTypeFilter?: string[];
  isLoading?: boolean;
  onAddSelectedToSkill?: (sourceIds: string[]) => void;
  onRefreshComplete?: () => void;
  /** Skills for quick matching (fetched from scope-index API) */
  skillsForMatching?: SkillForMatching[];
  /** Callback when quick assign is clicked */
  onQuickAssign?: (sourceId: string, skillId: string) => Promise<void>;
  /** Library ID for fetching skills */
  libraryId?: string;
  /** Callback when link to customer is clicked (for bulk linking) */
  onLinkToCustomer?: (sourceIds: string[]) => void;
}

const sourceTypeConfig = {
  zendesk: { label: 'Zendesk', color: 'bg-blue-100 text-blue-700' },
  slack: { label: 'Slack', color: 'bg-purple-100 text-purple-700' },
  notion: { label: 'Notion', color: 'bg-gray-100 text-gray-700' },
  gong: { label: 'Gong', color: 'bg-pink-100 text-pink-700' },
  url: { label: 'URL', color: 'bg-green-100 text-green-700' },
  document: { label: 'Document', color: 'bg-orange-100 text-orange-700' },
};

// Simplified 3-filter system: Unused (default), Used, Ignored
type FilterType = 'unused' | 'used' | 'ignored';

const filterConfig: Record<FilterType, { label: string; activeColor: string; inactiveColor: string }> = {
  unused: { label: 'Unused', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  used: { label: 'Used', activeColor: 'bg-green-600 text-white', inactiveColor: 'bg-green-100 text-green-700 hover:bg-green-200' },
  ignored: { label: 'Ignored', activeColor: 'bg-gray-600 text-white', inactiveColor: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
};

// Source types that support content refresh
const REFRESHABLE_SOURCE_TYPES = ['url', 'zendesk', 'slack'];

export default function SourceSelector({
  sources,
  selectedSourceIds,
  onSelectSource,
  onDeselectSource,
  onSelectBulk,
  onClearAll,
  sourceTypeFilter = [],
  isLoading = false,
  onAddSelectedToSkill,
  onRefreshComplete,
  skillsForMatching = [],
  onQuickAssign,
  onLinkToCustomer,
}: SourceSelectorProps) {
  // Toggle-based filters - multiple can be active at once
  // Default: only 'unused' is active
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set(['unused']));
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);
  const [ignoringSourceId, setIgnoringSourceId] = useState<string | null>(null);
  const [isBulkRefreshing, setIsBulkRefreshing] = useState(false);
  const [bulkRefreshProgress, setBulkRefreshProgress] = useState<{ completed: number; total: number } | null>(null);

  // Gong config state - fetched from API
  const [internalCompanyName, setInternalCompanyName] = useState<string>('');

  // Fetch Gong config on mount (for internal company name)
  useEffect(() => {
    const hasGongSources = sources.some(s => s.type === 'gong');
    if (!hasGongSources) return;

    const fetchGongConfig = async () => {
      try {
        const res = await fetch('/api/v2/integrations/gong/status?libraryId=gtm');
        if (res.ok) {
          const data = await res.json();
          if (data.config?.internalCompanyName) {
            setInternalCompanyName(data.config.internalCompanyName);
          }
        }
      } catch (error) {
        // Company name display is optional, but log for debugging
        console.warn('[SourceSelector] Failed to fetch Gong config:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    };
    fetchGongConfig();
  }, [sources]);

  // Gong transcript fetch state
  const [isFetchingTranscripts, setIsFetchingTranscripts] = useState(false);
  const [transcriptFetchProgress, setTranscriptFetchProgress] = useState<{ completed: number; total: number } | null>(null);

  // Quick assign state
  const [quickAssignDropdownId, setQuickAssignDropdownId] = useState<string | null>(null);
  const [assigningSourceId, setAssigningSourceId] = useState<string | null>(null);
  const quickAssignRef = useRef<HTMLDivElement>(null);

  // Close quick assign dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickAssignRef.current && !quickAssignRef.current.contains(event.target as Node)) {
        setQuickAssignDropdownId(null);
      }
    };
    if (quickAssignDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quickAssignDropdownId]);

  // Memoize keyword extraction for each source
  const sourceKeywordsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const source of sources) {
      const text = `${source.title} ${source.description || ''}`;
      const keywords = extractKeywords(text, 5);
      map.set(source.id, keywords);
    }
    return map;
  }, [sources]);

  // Memoize quick matches for each source
  const quickMatchesMap = useMemo(() => {
    if (skillsForMatching.length === 0) return new Map<string, QuickMatchResult[]>();

    const map = new Map<string, QuickMatchResult[]>();
    for (const source of sources) {
      const keywords = sourceKeywordsMap.get(source.id) || [];
      if (keywords.length > 0) {
        const matches = quickMatchKeywords(keywords, skillsForMatching, 3);
        map.set(source.id, matches);
      }
    }
    return map;
  }, [sources, skillsForMatching, sourceKeywordsMap]);

  // Handle quick assign
  const handleQuickAssign = async (e: React.MouseEvent, sourceId: string, skillId: string) => {
    e.stopPropagation();
    if (!onQuickAssign) return;

    setAssigningSourceId(sourceId);
    try {
      await onQuickAssign(sourceId, skillId);
      setQuickAssignDropdownId(null);
      // Trigger refresh to update source status
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Quick assign failed:', error);
      alert('Failed to assign source. Please try again.');
    } finally {
      setAssigningSourceId(null);
    }
  };

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    if (showTagDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagDropdown]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  const [fetchedSources, setFetchedSources] = useState<Record<string, boolean>>({});
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [sourceContent, setSourceContent] = useState<Record<string, string>>({});

  const toggleFilter = (filter: FilterType) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      // Don't allow deselecting if it's the only active filter
      if (newFilters.size > 1) {
        newFilters.delete(filter);
      }
    } else {
      newFilters.add(filter);
    }
    setActiveFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Map source status to our simplified filter categories
  const getSourceFilter = (source: StagedSource): FilterType => {
    if (source.status === 'IGNORED') return 'ignored';
    if (source.status === 'REVIEWED') return 'used';
    return 'unused'; // NEW status = unused
  };

  // Extract all unique tags from sources
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (sources || []).forEach((source) => {
      if (sourceTypeFilter.length > 0 && !sourceTypeFilter.includes(source.type)) {
        return;
      }
      source.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [sources, sourceTypeFilter]);

  // Compute filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = { unused: 0, used: 0, ignored: 0 };
    (sources || []).forEach((source) => {
      // Apply source type filter first
      if (sourceTypeFilter.length > 0 && !sourceTypeFilter.includes(source.type)) {
        return;
      }
      const filter = getSourceFilter(source);
      counts[filter]++;
    });
    return counts;
  }, [sources, sourceTypeFilter]);

  // Filter sources based on active filters, selected tags, and search query
  const filteredSources = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return (sources || []).filter((source) => {
      // Source type filter
      if (sourceTypeFilter.length > 0 && !sourceTypeFilter.includes(source.type)) {
        return false;
      }
      // Check if source's filter category is in active filters
      const sourceFilter = getSourceFilter(source);
      if (!activeFilters.has(sourceFilter)) {
        return false;
      }
      // Tag filter - source must have at least one of the selected tags (if any selected)
      if (selectedTags.size > 0) {
        const sourceTags = source.tags || [];
        const hasMatchingTag = sourceTags.some((tag) => selectedTags.has(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      // Search filter - match title, description, or tags
      if (query) {
        const title = source.title.toLowerCase();
        const description = (source.description || '').toLowerCase();
        const tagMatches = (source.tags || []).some((tag) => tag.toLowerCase().includes(query));
        const titleMatch = title.includes(query);
        const descriptionMatch = description.includes(query);
        if (!titleMatch && !descriptionMatch && !tagMatches) {
          return false;
        }
      }
      return true;
    });
  }, [sources, activeFilters, sourceTypeFilter, selectedTags, searchQuery]);

  // Pagination logic
  const itemsPerPage = 25;
  const totalPages = Math.ceil(filteredSources.length / itemsPerPage);
  const paginatedSources = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredSources.slice(start, end);
  }, [filteredSources, currentPage]);

  const toggleSource = (sourceId: string) => {
    if (selectedSourceIds.has(sourceId)) {
      onDeselectSource(sourceId);
    } else {
      onSelectSource(sourceId);
    }
  };

  const handleFetchContent = async (
    e: React.MouseEvent,
    sourceId: string,
    sourceType: string
  ) => {
    e.stopPropagation();

    // Only refreshable source types can be fetched
    if (!REFRESHABLE_SOURCE_TYPES.includes(sourceType)) {
      return;
    }

    setFetchingSourceId(sourceId);
    try {
      const response = await fetch('/api/v2/sources/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to refresh content:', error);
        alert(`Failed to refresh content: ${error.error}`);
        return;
      }

      setFetchedSources((prev) => ({
        ...prev,
        [sourceId]: true,
      }));

      // Notify parent to refresh sources list
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Error refreshing source:', error);
      alert('Failed to refresh source content. Please try again.');
    } finally {
      setFetchingSourceId(null);
    }
  };

  const handleBulkRefresh = async () => {
    // Get selected sources that are refreshable
    const selectedSources = sources.filter(s => selectedSourceIds.has(s.id));
    const refreshableSources = selectedSources.filter(s => REFRESHABLE_SOURCE_TYPES.includes(s.type));

    if (refreshableSources.length === 0) {
      alert('No refreshable sources selected. Select URL, Zendesk, or Slack sources to refresh.');
      return;
    }

    setIsBulkRefreshing(true);
    setBulkRefreshProgress({ completed: 0, total: refreshableSources.length });

    try {
      const sourceIds = refreshableSources.map(s => s.id);
      const response = await fetch('/api/v2/sources/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to refresh sources:', error);
        alert(`Failed to refresh sources: ${error.error}`);
        return;
      }

      const result = await response.json();

      // Mark all successfully refreshed sources
      const refreshedIds: string[] = (result.results || [])
        .filter((r: { success: boolean; id: string }) => r.success)
        .map((r: { id: string }) => r.id);

      setFetchedSources((prev) => {
        const next = { ...prev };
        refreshedIds.forEach(id => {
          next[id] = true;
        });
        return next;
      });

      setBulkRefreshProgress({ completed: result.succeeded || 0, total: result.total || refreshableSources.length });

      // Show result summary
      if (result.failed > 0) {
        alert(`Refreshed ${result.succeeded} of ${result.total} sources. ${result.failed} failed.`);
      }

      // Notify parent to refresh sources list
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Error refreshing sources:', error);
      alert('Failed to refresh sources. Please try again.');
    } finally {
      setIsBulkRefreshing(false);
      setBulkRefreshProgress(null);
    }
  };

  // Fetch transcripts for selected Gong sources (re-fetches all, even if already have transcript)
  const handleFetchTranscripts = async () => {
    const selectedSources = sources.filter(s => selectedSourceIds.has(s.id));
    const gongSources = selectedSources.filter(s => s.type === 'gong');

    if (gongSources.length === 0) {
      alert('No Gong sources selected.');
      return;
    }

    setIsFetchingTranscripts(true);
    setTranscriptFetchProgress({ completed: 0, total: gongSources.length });

    try {
      const sourceIds = gongSources.map(s => s.id);
      const response = await fetch('/api/v2/sources/gong/fetch-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch transcripts:', error);
        alert(`Failed to fetch transcripts: ${error.error}`);
        return;
      }

      const result = await response.json();
      setTranscriptFetchProgress({ completed: result.succeeded || 0, total: result.total || gongSources.length });

      // Show result summary
      if (result.failed > 0) {
        alert(`Fetched transcripts for ${result.succeeded} of ${result.total} calls. ${result.failed} failed.`);
      }

      // Notify parent to refresh sources list
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      alert('Failed to fetch transcripts. Please try again.');
    } finally {
      setIsFetchingTranscripts(false);
      setTranscriptFetchProgress(null);
    }
  };

  const handleToggleExpand = (
    e: React.MouseEvent,
    sourceId: string,
    source: StagedSource
  ) => {
    e.stopPropagation();

    if (expandedSourceId === sourceId) {
      setExpandedSourceId(null);
      return;
    }

    // Use the description field which already contains the full content
    if (!sourceContent[sourceId] && source.description) {
      setSourceContent((prev) => ({
        ...prev,
        [sourceId]: source.description || 'No content available',
      }));
    }

    setExpandedSourceId(sourceId);
  };

  const handleIgnoreSource = async (e: React.MouseEvent, sourceId: string) => {
    e.stopPropagation();
    setIgnoringSourceId(sourceId);
    try {
      await ignoreSource({ sourceId });
      // Notify parent to refresh sources list
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Error ignoring source:', error);
      alert('Failed to ignore source. Please try again.');
    } finally {
      setIgnoringSourceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-gray-600">Loading sources...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search sources by title, description, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Simplified Toggle Filters - click to expand/collapse categories */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-gray-600 mr-1">Show:</span>
        {(Object.entries(filterConfig) as [FilterType, typeof filterConfig[FilterType]][]).map(([filter, config]) => {
          const isActive = activeFilters.has(filter);
          const count = filterCounts[filter];
          return (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                isActive ? config.activeColor : config.inactiveColor
              )}
            >
              <span>{config.label}</span>
              <span className={cn('text-xs font-semibold', isActive ? 'opacity-80' : 'opacity-70')}>
                ({count})
              </span>
            </button>
          );
        })}

        {/* Tag Filter Dropdown */}
        {allTags.length > 0 && (
          <div className="relative ml-2" ref={tagDropdownRef}>
            <button
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                selectedTags.size > 0
                  ? 'bg-yellow-600 text-white'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              )}
            >
              <span>Tags</span>
              {selectedTags.size > 0 && (
                <span className="text-xs font-semibold opacity-80">({selectedTags.size})</span>
              )}
              <ChevronDown className={cn('w-4 h-4 transition-transform', showTagDropdown && 'rotate-180')} />
            </button>

            {showTagDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Filter by tags</span>
                  {selectedTags.size > 0 && (
                    <button
                      onClick={() => setSelectedTags(new Set())}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = new Set(selectedTags);
                      if (newTags.has(tag)) {
                        newTags.delete(tag);
                      } else {
                        newTags.add(tag);
                      }
                      setSelectedTags(newTags);
                      setCurrentPage(1); // Reset to first page when tags change
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    {selectedTags.has(tag) ? (
                      <CheckSquare className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="truncate">{tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            // Use bulk select if available, otherwise select one by one
            if (onSelectBulk) {
              const toAdd = filteredSources.filter((s) => !selectedSourceIds.has(s.id)).map((s) => s.id);
              if (toAdd.length > 0) {
                onSelectBulk(toAdd);
              }
            } else {
              const toAdd = filteredSources.filter((s) => !selectedSourceIds.has(s.id));
              toAdd.forEach((source) => onSelectSource(source.id));
            }
          }}
          disabled={filteredSources.length === 0}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select All
        </button>
        <button
          onClick={onClearAll}
          disabled={selectedSourceIds.size === 0}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <span className="text-sm text-gray-600 ml-auto self-center">
          {selectedSourceIds.size} of {filteredSources.length} selected
        </span>
        {/* Refresh Selected Button - show when refreshable sources are selected */}
        {selectedSourceIds.size > 0 && sources.some(s => selectedSourceIds.has(s.id) && REFRESHABLE_SOURCE_TYPES.includes(s.type)) && (
          <button
            onClick={handleBulkRefresh}
            disabled={isBulkRefreshing}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
              isBulkRefreshing
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'text-orange-700 bg-orange-100 hover:bg-orange-200'
            )}
          >
            {isBulkRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {bulkRefreshProgress ? `Refreshing ${bulkRefreshProgress.completed}/${bulkRefreshProgress.total}...` : 'Refreshing...'}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh Selected
              </>
            )}
          </button>
        )}
        {/* Fetch Transcripts Button - show when Gong sources are selected */}
        {selectedSourceIds.size > 0 && sources.some(s =>
          selectedSourceIds.has(s.id) && s.type === 'gong'
        ) && (
          <button
            onClick={handleFetchTranscripts}
            disabled={isFetchingTranscripts}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
              isFetchingTranscripts
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'text-pink-700 bg-pink-100 hover:bg-pink-200'
            )}
          >
            {isFetchingTranscripts ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {transcriptFetchProgress ? `Fetching ${transcriptFetchProgress.completed}/${transcriptFetchProgress.total}...` : 'Fetching...'}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Fetch Transcripts
              </>
            )}
          </button>
        )}
        {onAddSelectedToSkill && selectedSourceIds.size > 0 && (
          <button
            onClick={() => onAddSelectedToSkill(Array.from(selectedSourceIds))}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
          >
            Add to Skill
          </button>
        )}
        {onLinkToCustomer && selectedSourceIds.size > 0 && (
          <button
            onClick={() => onLinkToCustomer(Array.from(selectedSourceIds))}
            className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
          >
            Link to Customer
          </button>
        )}
      </div>

      {/* Sources List */}
      <div className="border border-gray-300 rounded-lg overflow-y-auto" style={{ minHeight: '500px' }}>
        {filteredSources.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No sources found. Try adjusting your filters.
          </div>
        ) : (
          <div>
            {paginatedSources.map((source) => (
              <div
                key={source.id}
                className={cn(
                  'border-b border-gray-200 last:border-b-0',
                  selectedSourceIds.has(source.id) && 'bg-blue-50'
                )}
              >
                <div
                  onClick={() => toggleSource(source.id)}
                  className={cn(
                    'flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors',
                    selectedSourceIds.has(source.id) && 'bg-blue-50'
                  )}
                >
                  {/* Checkbox */}
                  <div className="mt-1 flex-shrink-0">
                    {selectedSourceIds.has(source.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title with company badge for Gong sources */}
                    <div className="flex items-start gap-2">
                      <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
                        {source.title}
                      </h4>
                      {/* Prominent company badge for Gong calls */}
                      {source.type === 'gong' && (() => {
                        const gong = (source.metadata || {}) as GongMetadata;
                        const externalParticipants = gong.participants?.filter(p => p.role === 'external') || [];
                        const companiesFromEmail = [...new Set(
                          externalParticipants
                            .map(p => p.email ? extractCompanyFromEmail(p.email) : null)
                            .filter(Boolean)
                        )] as string[];

                        // Priority: 1) matched customer name, 2) email domain, 3) title extraction
                        // Use internalCompanyName (from Gong config) to filter out our company from title patterns
                        const companyDisplay = gong.matchedCustomerName
                          || (companiesFromEmail.length > 0 ? companiesFromEmail[0] : null)
                          || extractCompanyFromTitle(source.title, internalCompanyName || undefined);

                        if (!companyDisplay) return null;

                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-semibold whitespace-nowrap flex-shrink-0">
                            <Building2 className="w-3 h-3" />
                            {companyDisplay}
                            {companiesFromEmail.length > 1 && !gong.matchedCustomerName && (
                              <span className="text-purple-600">+{companiesFromEmail.length - 1}</span>
                            )}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Tags and metadata */}
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      {/* Source type badge */}
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          sourceTypeConfig[source.type]?.color
                        )}
                      >
                        {sourceTypeConfig[source.type]?.label || source.type}
                      </span>

                      {/* Status badge - using simplified labels */}
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        getSourceFilter(source) === 'unused' ? 'bg-blue-100 text-blue-700' :
                        getSourceFilter(source) === 'used' ? 'bg-green-100 text-green-700' :
                        'bg-gray-200 text-gray-700'
                      )}>
                        {getSourceFilter(source) === 'unused' ? 'Unused' :
                         getSourceFilter(source) === 'used' ? 'Used' : 'Ignored'}
                      </span>

                      {/* Token Count Badge */}
                      <TokenCountBadge
                        tokens={Math.ceil((source.description?.length || 0) * 0.25)}
                        size="sm"
                      />

                      {/* Tags */}
                      {source.tags?.slice(0, 2).map((tag, idx) => (
                        <span
                          key={`${tag}-${idx}`}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {source.tags && source.tags.length > 2 && (
                        <span className="text-xs text-gray-600">
                          +{source.tags.length - 2}
                        </span>
                      )}

                      {/* Created date */}
                      <span className="text-xs text-gray-600 ml-auto">
                        {new Date(source.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Gong-specific metadata */}
                    {source.type === 'gong' && source.metadata && (() => {
                      const gong = source.metadata as GongMetadata;
                      const externalParticipants = gong.participants?.filter(p => p.role === 'external') || [];
                      const companies = [...new Set(
                        externalParticipants
                          .map(p => p.email ? extractCompanyFromEmail(p.email) : null)
                          .filter(Boolean)
                      )];

                      return (
                        <div className="flex flex-wrap gap-2 mt-2 items-center text-xs">
                          {/* Call Date */}
                          {gong.startedAt && (
                            <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                              <Calendar className="w-3 h-3" />
                              {new Date(gong.startedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          )}

                          {/* Duration */}
                          {gong.duration && (
                            <span className="inline-flex items-center gap-1 text-gray-600">
                              <Clock className="w-3 h-3" />
                              {formatDuration(gong.duration)}
                            </span>
                          )}

                          {/* Direction */}
                          {gong.direction && (
                            <span className="inline-flex items-center gap-1 text-gray-600">
                              {gong.direction === 'inbound' ? (
                                <ArrowDownLeft className="w-3 h-3 text-green-500" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-blue-500" />
                              )}
                              {gong.direction}
                            </span>
                          )}

                          {/* External participants / companies */}
                          {externalParticipants.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-gray-600">
                              <Users className="w-3 h-3" />
                              {companies.length > 0 ? (
                                <span className="font-medium text-gray-800">
                                  {companies.slice(0, 2).join(', ')}
                                  {companies.length > 2 && ` +${companies.length - 2}`}
                                </span>
                              ) : (
                                <span>
                                  {externalParticipants.slice(0, 2).map(p => p.name.split(' ')[0]).join(', ')}
                                  {externalParticipants.length > 2 && ` +${externalParticipants.length - 2}`}
                                </span>
                              )}
                            </span>
                          )}

                          {/* Transcript status */}
                          {!gong.hasTranscript && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <FileText className="w-3 h-3" />
                              No transcript
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Gong topics (from Gong's AI) */}
                    {source.type === 'gong' && source.metadata && (source.metadata as GongMetadata).topics?.length ? (
                      <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                        <Tag className="w-3 h-3 text-gray-400" />
                        {((source.metadata as GongMetadata).topics || []).slice(0, 4).map((topic, idx) => {
                          // Handle both string topics and object topics {name, duration} from Gong API
                          const topicName = typeof topic === 'string' ? topic : (topic as { name?: string })?.name || '';
                          return (
                            <span
                              key={`topic-${idx}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-100"
                            >
                              {topicName}
                            </span>
                          );
                        })}
                        {((source.metadata as GongMetadata).topics?.length || 0) > 4 && (
                          <span className="text-xs text-gray-500">
                            +{((source.metadata as GongMetadata).topics?.length || 0) - 4}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Extracted Keywords (for non-Gong sources) */}
                    {source.type !== 'gong' && sourceKeywordsMap.get(source.id)?.length ? (
                      <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                        <Tag className="w-3 h-3 text-gray-400" />
                        {sourceKeywordsMap.get(source.id)?.slice(0, 4).map((keyword, idx) => (
                          <span
                            key={`kw-${idx}`}
                            className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100"
                          >
                            {formatKeyword(keyword)}
                          </span>
                        ))}
                        {(sourceKeywordsMap.get(source.id)?.length || 0) > 4 && (
                          <span className="text-xs text-gray-500">
                            +{(sourceKeywordsMap.get(source.id)?.length || 0) - 4}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Used info */}
                    {getSourceFilter(source) === 'used' && (source.usedInSkills?.length || (source.type === 'url' && source.externalUrl)) ? (
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600 items-center">
                        {source.type === 'url' && source.externalUrl && (
                          <span className="inline-flex items-center gap-1 max-w-full">
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[360px]">{source.externalUrl}</span>
                          </span>
                        )}
                        {source.usedInSkills?.length ? (
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            <span className="text-gray-500">Used in:</span>
                            {source.usedInSkills.slice(0, 2).map((skill) => (
                              <span
                                key={skill.id}
                                className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100"
                              >
                                {skill.title}
                              </span>
                            ))}
                            {source.usedInSkills.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{source.usedInSkills.length - 2} more
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Quick Assign Suggestions */}
                    {quickMatchesMap.get(source.id)?.length && getSourceFilter(source) === 'unused' ? (
                      <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-gray-500 mr-1">Quick assign:</span>
                        {quickMatchesMap.get(source.id)?.slice(0, 2).map((match) => {
                          const confidence = getMatchConfidence(match.score);
                          return (
                            <button
                              key={match.skillId}
                              onClick={(e) => handleQuickAssign(e, source.id, match.skillId)}
                              disabled={assigningSourceId === source.id}
                              className={cn(
                                'text-xs px-2 py-0.5 rounded border font-medium transition-colors hover:opacity-80',
                                getConfidenceColor(confidence),
                                assigningSourceId === source.id && 'opacity-50 cursor-not-allowed'
                              )}
                              title={`${Math.round(match.score * 100)}% match - ${match.matchedKeywords.join(', ')}`}
                            >
                              {assigningSourceId === source.id ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                match.skillTitle.length > 25
                                  ? match.skillTitle.slice(0, 25) + '...'
                                  : match.skillTitle
                              )}
                            </button>
                          );
                        })}
                        {(quickMatchesMap.get(source.id)?.length || 0) > 2 && (
                          <div className="relative" ref={quickAssignDropdownId === source.id ? quickAssignRef : undefined}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickAssignDropdownId(quickAssignDropdownId === source.id ? null : source.id);
                              }}
                              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                            >
                              +{(quickMatchesMap.get(source.id)?.length || 0) - 2} more
                            </button>
                            {quickAssignDropdownId === source.id && (
                              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                <div className="p-2 border-b border-gray-100">
                                  <span className="text-xs font-medium text-gray-600">All matches</span>
                                </div>
                                {quickMatchesMap.get(source.id)?.map((match) => {
                                  const confidence = getMatchConfidence(match.score);
                                  return (
                                    <button
                                      key={match.skillId}
                                      onClick={(e) => handleQuickAssign(e, source.id, match.skillId)}
                                      disabled={assigningSourceId === source.id}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate">{match.skillTitle}</span>
                                      <span className={cn(
                                        'text-xs px-1.5 py-0.5 rounded',
                                        getConfidenceColor(confidence)
                                      )}>
                                        {Math.round(match.score * 100)}%
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Refresh, expand, and external link buttons */}
                  <div className="flex gap-2 flex-shrink-0 mt-1">
                    {REFRESHABLE_SOURCE_TYPES.includes(source.type) && (
                      <button
                        onClick={(e) => handleFetchContent(e, source.id, source.type)}
                        disabled={fetchingSourceId === source.id || fetchedSources[source.id]}
                        className={cn(
                          'p-1.5 rounded transition-colors',
                          fetchingSourceId === source.id
                            ? 'bg-orange-100 text-orange-600 cursor-wait'
                            : fetchedSources[source.id]
                              ? 'bg-green-100 text-green-600'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        )}
                        title={
                          fetchingSourceId === source.id
                            ? 'Refreshing...'
                            : fetchedSources[source.id]
                              ? 'Content refreshed'
                              : `Refresh ${source.type === 'url' ? 'URL' : source.type === 'zendesk' ? 'Zendesk ticket' : 'Slack thread'} content`
                        }
                      >
                        <RefreshCw className={cn('w-4 h-4', fetchingSourceId === source.id && 'animate-spin')} />
                      </button>
                    )}

                    {/* Expand/collapse button */}
                    <button
                      onClick={(e) => handleToggleExpand(e, source.id, source)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        expandedSourceId === source.id
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      )}
                      title="View full content"
                    >
                      <ChevronDown className={cn('w-4 h-4 transition-transform', expandedSourceId === source.id && 'rotate-180')} />
                    </button>

                    {/* External link - supports URL sources and Gong calls */}
                    {(source.externalUrl || (source.type === 'gong' && (source.metadata as GongMetadata)?.gongUrl)) && (
                      <a
                        href={source.externalUrl || (source.metadata as GongMetadata)?.gongUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title={source.type === 'gong' ? 'Open in Gong' : 'Open external link'}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {/* Ignore button */}
                    <button
                      onClick={(e) => handleIgnoreSource(e, source.id)}
                      disabled={ignoringSourceId === source.id}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        ignoringSourceId === source.id
                          ? 'bg-red-100 text-red-600 cursor-wait'
                          : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                      )}
                      title={ignoringSourceId === source.id ? 'Ignoring...' : 'Ignore this source'}
                    >
                      <Trash2 className={cn('w-4 h-4', ignoringSourceId === source.id && 'animate-pulse')} />
                    </button>
                  </div>
                </div>

                {/* Expanded content - full width below */}
                {expandedSourceId === source.id && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
                    <div className="bg-white rounded p-3 text-sm text-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs border border-gray-200">
                      {sourceContent[source.id] || 'Loading...'}
                    </div>
                    {/* Action buttons in expanded view */}
                    <div className="flex gap-2">
                      {onAddSelectedToSkill && (
                        <button
                          onClick={() => onAddSelectedToSkill([source.id])}
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                        >
                          Add to Skill
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredSources.length > itemsPerPage && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredSources.length)} of {filteredSources.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'px-2.5 py-1.5 text-sm font-medium rounded transition-colors',
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Selection summary */}
      {selectedSourceIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedSourceIds.size} source{selectedSourceIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearAll}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
