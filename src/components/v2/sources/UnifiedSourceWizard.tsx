'use client';

/**
 * Unified Source Wizard
 *
 * Single component that replaces all individual source wizard implementations (Slack, Zendesk, Notion, Gong, URL, Document).
 * Uses configuration-driven approach to support different source types with minimal duplication.
 *
 * Key features:
 * - Generic discovery handling using config
 * - Config-driven panel rendering (Slack channel selector, Notion URL importer, etc.)
 * - Unified callbacks for generate/save/done
 * - Quick-assign support for sources that support it
 * - Handles pagination and time-based discovery automatically
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CreateWizard from '@/components/v2/CreateWizard';
import { getSourceStatus } from './types';
import { SlackChannelPanel, NotionImportPanel, UrlStagePanel, DocumentStagePanel, ZendeskFilterPanel, GongConfigPanel, type ZendeskFilters } from './config-panels';
import { LinkToCustomerModal } from './LinkToCustomerModal';
import { getSourceWizardConfig } from '@/lib/source-wizard-config';
import type { SourceWizardProps, StagedSourceItem } from './types';

interface SkillForMatching {
  id: string;
  title: string;
  keywords?: string[];
  scopeCovers?: string;
}

interface UnifiedSourceWizardProps extends SourceWizardProps {
  /** Source type (e.g., 'slack', 'zendesk', 'notion', 'gong', 'url', 'document') */
  sourceType: string;

  /** Staged sources to display */
  sources: StagedSourceItem[];

  /** Whether sources are being loaded */
  isLoading?: boolean;

  /** Whether discovery is in progress */
  isDiscovering?: boolean;

  /** Callback when sources are refreshed (for pagination/discovery) */
  onRefreshSources?: () => Promise<void>;
}

export function UnifiedSourceWizard({
  sourceType,
  libraryId,
  customerId,
  onSuccess,
  sources,
  isLoading = false,
  isDiscovering = false,
  onShowAddToSkill,
  onShowAddMultipleToSkill,
  onRefreshSources,
}: UnifiedSourceWizardProps) {
  const router = useRouter();
  const config = getSourceWizardConfig(sourceType);

  // State for discovery and pagination
  const [discoveringState, setDiscoveringState] = useState(false);
  const [skillsForMatching, setSkillsForMatching] = useState<SkillForMatching[]>([]);

  // Pagination state (for Zendesk)
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSince, setCurrentSince] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  // Zendesk filter state
  const [zendeskFilters, setZendeskFilters] = useState<ZendeskFilters>({
    ticketNumber: '',
    tags: [],
    excludeTags: [],
    assignees: [],
    dateFrom: '',
    dateTo: '',
  });

  // Link to customer modal state (for library-scoped sources)
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedSourceIdsForLink, setSelectedSourceIdsForLink] = useState<string[]>([]);

  // Filter sources for Zendesk
  const filteredSources = useMemo(() => {
    if (sourceType !== 'zendesk') return sources;

    return sources.filter((source) => {
      const metadata = source.metadata as {
        ticketId?: number;
        assignee?: { id: string };
        tags?: string[];
        ticketCreatedAt?: string;
        ticketUpdatedAt?: string;
      } | null;

      if (!metadata) return true;

      // Filter by ticket number
      if (zendeskFilters.ticketNumber) {
        const ticketIdStr = metadata.ticketId?.toString() || '';
        if (!ticketIdStr.includes(zendeskFilters.ticketNumber)) {
          return false;
        }
      }

      // Filter by included tags (must have ALL included tags)
      if (zendeskFilters.tags.length > 0) {
        const sourceTags = metadata.tags || [];
        const hasAllIncludedTags = zendeskFilters.tags.every((tag) => sourceTags.includes(tag));
        if (!hasAllIncludedTags) {
          return false;
        }
      }

      // Filter by excluded tags (must not have ANY excluded tags)
      if (zendeskFilters.excludeTags.length > 0) {
        const sourceTags = metadata.tags || [];
        const hasExcludedTag = zendeskFilters.excludeTags.some((tag) => sourceTags.includes(tag));
        if (hasExcludedTag) {
          return false;
        }
      }

      // Filter by assignees
      if (zendeskFilters.assignees.length > 0) {
        const assigneeId = metadata.assignee?.id;
        if (!assigneeId || !zendeskFilters.assignees.includes(assigneeId)) {
          return false;
        }
      }

      // Filter by date range
      if (zendeskFilters.dateFrom || zendeskFilters.dateTo) {
        const createdDate = metadata.ticketCreatedAt?.split('T')[0];
        const updatedDate = metadata.ticketUpdatedAt?.split('T')[0];
        const latestDate = updatedDate && createdDate && updatedDate > createdDate ? updatedDate : createdDate;

        if (zendeskFilters.dateFrom && latestDate && latestDate < zendeskFilters.dateFrom) {
          return false;
        }
        if (zendeskFilters.dateTo && latestDate && latestDate > zendeskFilters.dateTo) {
          return false;
        }
      }

      return true;
    });
  }, [sources, sourceType, zendeskFilters]);

  // Load skills for quick-assign
  useEffect(() => {
    if (!config.supportsQuickAssign) return;

    const fetchSkills = async () => {
      try {
        const response = await fetch(`/api/v2/skills/scope-index?libraryId=${libraryId}`);
        if (response.ok) {
          const data = await response.json();
          setSkillsForMatching(data.skills || []);
        }
      } catch (error) {
        console.error('Failed to fetch skills for matching:', error);
      }
    };
    fetchSkills();
  }, [libraryId, config.supportsQuickAssign]);

  // Handle quick assign
  const handleQuickAssign = useCallback(
    async (sourceId: string, skillId: string) => {
      const response = await fetch('/api/v2/sources/quick-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, skillId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign');
      }

      router.refresh();
    },
    [router]
  );

  // Generic discovery handler using config
  const handleDiscover = useCallback(
    async (sinceDays: number) => {
      if (!config.discovery) {
        return { staged: 0, skipped: 0, total: 0, error: 'Discovery not supported for this source type' };
      }

      setDiscoveringState(true);
      try {
        const discovery = config.discovery;
        let allStaged = 0;
        let allSkipped = 0;
        let page = currentPage;
        let since = currentSince;

        // Time-based discovery
        if (!since) {
          since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
          setCurrentSince(since);
        }

        // Track cursor for cursor-based pagination
        let cursor = currentCursor;

        // For paginated APIs: keep fetching until we get results
        while (true) {
          // Build endpoint URL - add page/cursor parameter for paginated APIs
          let fetchUrl = discovery.fetchEndpoint(libraryId, sinceDays, customerId);
          if (discovery.cursorPagination && cursor) {
            // Use cursor-based pagination
            fetchUrl = discovery.cursorPagination.buildUrl(fetchUrl, cursor);
          } else if (discovery.pagination) {
            // Append page parameter to existing URL
            const separator = fetchUrl.includes('?') ? '&' : '?';
            fetchUrl = `${fetchUrl}${separator}page=${page}`;
          }

          const response = await fetch(fetchUrl);
          if (!response.ok) {
            let errorMessage = `Failed to fetch ${discovery.itemLabel}`;
            try {
              const errorData = await response.json();
              const errorObj = errorData as Record<string, unknown>;
              if (errorObj.error) {
                errorMessage = String(errorObj.error);
              }
            } catch {
              // Use default error message if JSON parsing fails
            }
            throw new Error(errorMessage);
          }

          const data = await response.json();
          const items = discovery.extractItems(data);

          if (items.length === 0) {
            // No more items - reset pagination for next discovery
            setCurrentPage(1);
            setCurrentSince(null);
            setCurrentCursor(null);
            return {
              staged: allStaged,
              skipped: allSkipped,
              total: allStaged + allSkipped,
              error: `No new ${discovery.itemLabel} found in this time range`,
            };
          }

          // Stage the items
          const stageRes = await fetch(discovery.stageEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [discovery.stageBodyKey]: items,
              libraryId,
              ...(customerId && { customerId }),
            }),
          });

          if (!stageRes.ok) {
            const errorData = await stageRes.json().catch(() => ({}));
            console.error('Stage request failed:', {
              status: stageRes.status,
              statusText: stageRes.statusText,
              error: errorData,
              requestBody: { [discovery.stageBodyKey]: items, libraryId, ...(customerId && { customerId }) },
            });
            throw new Error(`Failed to stage ${discovery.itemLabel}: ${JSON.stringify(errorData)}`);
          }

          const stageData = await stageRes.json();
          const newStaged = stageData.staged || 0;
          const newSkipped = stageData.skipped || 0;

          allStaged += newStaged;
          allSkipped += newSkipped;

          // Check if we should continue with pagination
          const hasMore = discovery.hasMore?.(data);

          // Extract cursor for cursor-based pagination
          const nextCursor = discovery.cursorPagination?.getCursor(data);

          if (newStaged > 0 || !hasMore) {
            // We got results or there are no more pages
            if (hasMore && newStaged === 0) {
              // All items were skipped but there are more pages - try next page
              if (discovery.cursorPagination && nextCursor) {
                cursor = nextCursor;
              } else {
                page++;
              }
              continue;
            } else {
              // Got results or no more pages - stop
              if (hasMore) {
                if (discovery.cursorPagination && nextCursor) {
                  setCurrentCursor(nextCursor);
                } else {
                  setCurrentPage(page + 1);
                }
              } else {
                setCurrentPage(1);
                setCurrentSince(null);
                setCurrentCursor(null);
              }

              return {
                staged: allStaged,
                skipped: allSkipped,
                total: stageData.total || items.length,
                hasMore,
              };
            }
          }

          // All items skipped and more pages exist - continue to next page
          if (discovery.cursorPagination && nextCursor) {
            cursor = nextCursor;
          } else {
            page++;
          }
        }
      } finally {
        setDiscoveringState(false);
        if (onRefreshSources) {
          await onRefreshSources();
        } else {
          router.refresh();
        }
      }
    },
    [config, libraryId, customerId, currentPage, currentSince, currentCursor, onRefreshSources, router]
  );

  return (
    <div className="space-y-4">
      {/* Config Panel - Slack channel selector, Notion URL importer, etc. */}
      {config.configPanel && (
        <>
          {config.configPanel.type === 'slack-channel' && (
            <SlackChannelPanel libraryId={libraryId} customerId={customerId} />
          )}
          {config.configPanel.type === 'notion-import' && (
            <NotionImportPanel
              libraryId={libraryId}
              showByDefault={Boolean(config.configPanel.showWhenEmpty && sources.length === 0)}
              onImportSuccess={onRefreshSources || (async () => router.refresh())}
            />
          )}
          {config.configPanel.type === 'url-stage' && (
            <UrlStagePanel
              libraryId={libraryId}
              customerId={customerId}
              onStageSuccess={onRefreshSources || (async () => router.refresh())}
            />
          )}
          {config.configPanel.type === 'document-stage' && (
            <DocumentStagePanel
              libraryId={libraryId}
              customerId={customerId}
              onStageSuccess={onRefreshSources || (async () => router.refresh())}
            />
          )}
          {config.configPanel.type === 'zendesk-filter' && sources.length > 0 && (
            <ZendeskFilterPanel
              sources={sources}
              filters={zendeskFilters}
              onFilterChange={setZendeskFilters}
            />
          )}
          {config.configPanel.type === 'gong-config' && (
            <GongConfigPanel
              libraryId={libraryId}
              customerId={customerId}
            />
          )}
        </>
      )}

      {/* CreateWizard for skill generation */}
      <CreateWizard
        sources={filteredSources.map((s) => {
          const metadata = s.metadata as Record<string, unknown> | null;
          const usedInSkills = (s.assignments || [])
            .filter((assignment) => assignment.incorporatedAt && (assignment.block?.isActive ?? true))
            .map((assignment) => ({
              id: assignment.block.id,
              title: assignment.block.title,
            }))
            .filter((skill, index, all) => all.findIndex((item) => item.id === skill.id) === index);
          return {
            id: s.id,
            type: sourceType as 'slack' | 'zendesk' | 'notion' | 'gong' | 'url' | 'document',
            title: s.title,
            description: s.content || (metadata?.externalUrl as string) || undefined,
            externalUrl: (metadata?.url as string) || (metadata?.externalUrl as string) || (metadata?.gongUrl as string) || undefined,
            status: getSourceStatus(s),
            tags: (metadata?.tags as string[]) || [],
            createdAt: s.stagedAt.toISOString(),
            usedInSkills: usedInSkills.length > 0 ? usedInSkills : undefined,
            metadata: metadata || undefined,
          };
        })}
        libraryId={libraryId}
        onGenerate={async (sourceIds: string[]) => {
          const response = await fetch('/api/v2/skills/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceIds,
              libraryId,
              ...(customerId && { customerId }),
            }),
          });
          if (!response.ok) throw new Error('Failed to generate skill');
          const data = await response.json();
          return {
            ...data.draft,
            transparency: data.transparency,
          };
        }}
        onSave={async (title: string, content: string, metadata) => {
          const response = await fetch('/api/v2/skills/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              content,
              libraryId,
              status: 'ACTIVE',
              ...(customerId && { customerId }),
              ...(metadata && {
                sourceIds: metadata.sourceIds,
                categories: metadata.categories,
                owners: metadata.owners,
                scopeDefinition: metadata.scopeDefinition,
                citations: metadata.citations,
                contradictions: metadata.contradictions,
                llmTrace: metadata.llmTrace,
              }),
            }),
          });
          if (!response.ok) throw new Error('Failed to publish skill');
        }}
        onDone={() => {
          onSuccess();
          router.refresh();
        }}
        onDiscover={config.discovery ? handleDiscover : undefined}
        onRefreshSources={onRefreshSources}
        sourceTypeLabel={config.label}
        generatingLabel={config.generatingLabel}
        isLoadingSources={isLoading}
        isDiscovering={discoveringState || isDiscovering}
        sourceTypeFilter={config.sourceTypeFilter}
        includeMetadata={true}
        onShowAddToSkill={onShowAddToSkill}
        onShowAddMultipleToSkill={onShowAddMultipleToSkill}
        skillsForMatching={config.supportsQuickAssign ? skillsForMatching : undefined}
        onQuickAssign={config.supportsQuickAssign ? handleQuickAssign : undefined}
        onLinkToCustomer={!customerId ? (sourceIds) => {
          setSelectedSourceIdsForLink(sourceIds);
          setShowLinkModal(true);
        } : undefined}
      />

      {/* Link to Customer Modal - only for library-scoped sources */}
      {!customerId && (
        <LinkToCustomerModal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setSelectedSourceIdsForLink([]);
          }}
          onSuccess={() => {
            setShowLinkModal(false);
            setSelectedSourceIdsForLink([]);
            onRefreshSources?.();
          }}
          libraryId={libraryId}
          sourceType={sourceType as 'gong' | 'slack' | 'zendesk' | 'url' | 'document' | 'notion'}
          preSelectedSourceIds={selectedSourceIdsForLink}
        />
      )}
    </div>
  );
}
