'use client';

/**
 * UnifiedLibraryClient - Single component for all library UIs
 *
 * Replaces the separate library client components:
 * - SkillsLibraryClient (knowledge)
 * - GtmSkillsLibraryClient (gtm)
 * - ITSkillsLibraryClient (it)
 * - KnowledgeBaseTab (customer-scoped)
 *
 * Configuration-driven via LibraryConfig to ensure consistency
 * and prevent bugs like missing showStageButton.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, CheckCircle } from 'lucide-react';
import { LibraryTabs } from '@/components/v2/LibraryTabs';
import { DashboardTab } from '@/components/v2/DashboardTab';
import { SlackBotTab } from '@/components/v2/SlackBotTab';
import { useAddToSkillDialog } from '@/components/v2/useAddToSkillDialog';
import { UnifiedSourceWizard } from '@/components/v2/sources';
import { CreateSkillModal } from '@/components/v2/CreateSkillModal';
import { getLibraryConfig, type LibraryConfig, type SourceType } from '@/lib/library-config';
import type { LibraryId, ScopeDefinition } from '@/types/v2/building-block';
import type { BotInteraction } from '@/lib/v2/bot-interactions';

// =============================================================================
// TYPES
// =============================================================================

export interface SkillItem {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  attributes: unknown;
  status: string;
  updatedAt: Date;
}

export interface StagedSourceItem {
  id: string;
  title: string;
  content: string | null;
  sourceType: string;
  stagedAt: Date;
  metadata: unknown;
  ignoredAt: Date | null;
  ignoredBy: string | null;
  contentPreview: string | null;
  assignments?: Array<{
    id: string;
    incorporatedAt: Date | null;
    incorporatedBy: string | null;
    block: {
      id: string;
      title: string;
      slug: string | null;
      isActive?: boolean;
    };
  }>;
}

export interface UnifiedLibraryClientProps {
  /** Library identifier - determines configuration */
  libraryId: LibraryId;
  /** Skills/items to display */
  skills: SkillItem[];
  /** Total count of skills (for stats) */
  totalSkills: number;
  /** Count of skills pending review */
  pendingReview: number;
  /** Count of active skills */
  activeSkills: number;
  /** Staged sources grouped by type */
  sourcesByType: Partial<Record<SourceType, StagedSourceItem[]>>;
  /** Bot interactions for the bot tab */
  pendingBot?: BotInteraction[];
  /** Current user for metadata */
  currentUser?: {
    id: string;
    name: string;
    email?: string;
    image?: string;
  } | null;
  /** Available categories for skill creation */
  availableCategories?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  /** Search params for filtering */
  searchParams?: {
    search?: string;
    review?: string;
  };
  /**
   * Customer ID for customer-scoped libraries.
   * When set, skills link to /v2/customers/{customerSlug}/skills/{skillSlug}
   */
  customerId?: string;
  /**
   * Customer slug for customer-scoped libraries.
   * Used to build the skill detail URL.
   */
  customerSlug?: string;
  /**
   * Active tab - controls which content is displayed.
   * For route-based navigation, this comes from the route.
   * For embedded mode, this can be controlled via state.
   */
  activeTab?: string;
  /**
   * Callback for tab changes (for embedded/state-based navigation).
   * If not provided and embedded=true, internal state is used.
   */
  onTabChange?: (tab: string) => void;
  /** Whether this is embedded (e.g., inside CustomerDetailClient) */
  embedded?: boolean;
  /** Whether current user is admin (for prompt editing permissions) */
  isAdmin?: boolean;
  /** Callback for refreshing sources - prevents router.refresh() in embedded mode */
  onRefreshSources?: () => Promise<void>;
}

// =============================================================================
// HELPERS
// =============================================================================

function getSourceStatus(source: StagedSourceItem): 'pending' | 'incorporated' | 'ignored' {
  if (source.ignoredAt) return 'ignored';
  if (
    source.assignments?.some(
      (a) => a.incorporatedAt && (a.block?.isActive ?? true)
    )
  )
    return 'incorporated';
  return 'pending';
}

function getPendingCount(sources: StagedSourceItem[]): number {
  return sources.filter((s) => getSourceStatus(s) === 'pending').length;
}

function getScopeCovers(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== 'object') return null;
  const attrs = attributes as Record<string, unknown>;
  const scopeDefinition = attrs.scopeDefinition as ScopeDefinition | undefined;
  return scopeDefinition?.covers || null;
}

// Color utilities - all classes must be complete strings for Tailwind purging
const colorClasses = {
  blue: {
    button: 'bg-blue-600 hover:bg-blue-700',
    border: 'border-l-blue-500',
    hoverBorder: 'hover:border-blue-300',
    ring: 'focus:ring-blue-500',
  },
  purple: {
    button: 'bg-purple-600 hover:bg-purple-700',
    border: 'border-l-purple-500',
    hoverBorder: 'hover:border-purple-300',
    ring: 'focus:ring-purple-500',
  },
  green: {
    button: 'bg-green-600 hover:bg-green-700',
    border: 'border-l-green-500',
    hoverBorder: 'hover:border-green-300',
    ring: 'focus:ring-green-500',
  },
  amber: {
    button: 'bg-amber-600 hover:bg-amber-700',
    border: 'border-l-amber-500',
    hoverBorder: 'hover:border-amber-300',
    ring: 'focus:ring-amber-500',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function UnifiedLibraryClient({
  libraryId,
  skills,
  totalSkills,
  pendingReview,
  activeSkills,
  sourcesByType,
  pendingBot = [],
  searchParams = {},
  customerId,
  customerSlug,
  activeTab: activeTabProp,
  onTabChange: onTabChangeProp,
  embedded = false,
  isAdmin = false,
  onRefreshSources,
}: UnifiedLibraryClientProps) {
  const router = useRouter();
  const config = getLibraryConfig(libraryId);
  const colors = colorClasses[config.accentColor];

  // Internal state for embedded mode when no external tab control
  const [internalTab, setInternalTab] = useState(activeTabProp || config.initialTab);

  // Active tab - use prop if provided, otherwise internal state (for embedded)
  const activeTab = activeTabProp || internalTab;

  // Tab change handler - use prop callback or internal state
  const handleTabChange = useCallback((tab: string) => {
    if (onTabChangeProp) {
      onTabChangeProp(tab);
    } else {
      setInternalTab(tab);
    }
  }, [onTabChangeProp]);

  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);

  // Combine all sources for dialog lookup (bot interactions are separate, not mixed)
  const allSources = useMemo(() => {
    const combined: StagedSourceItem[] = [];
    for (const sources of Object.values(sourcesByType)) {
      if (sources) combined.push(...sources);
    }
    return combined;
  }, [sourcesByType]);

  // Add to skill dialog hook
  const { onShowAddToSkill, onShowAddMultipleToSkill, renderDialog } = useAddToSkillDialog({
    libraryId,
    skills,
    sources: allSources,
  });

  // Compute counts for tabs
  const counts = {
    items: totalSkills,
    urls: sourcesByType.url?.length,
    documents: sourcesByType.document?.length,
    zendesk: sourcesByType.zendesk?.length,
    slack: sourcesByType.slack?.length,
    notion: sourcesByType.notion?.length,
    gong: sourcesByType.gong?.length,
    bot: pendingBot.length || undefined,
  };

  // Compute pending counts for dashboard
  const pendingCounts: Record<string, number> = {};
  for (const [type, sources] of Object.entries(sourcesByType)) {
    if (sources) {
      pendingCounts[type] = getPendingCount(sources);
    }
  }

  // Total staged sources (pending only)
  const totalStagedSources =
    Object.values(pendingCounts).reduce((sum, count) => sum + count, 0) + pendingBot.length;

  // Build source actions for dashboard
  const sourceActions = config.sourceTabs.map((tab) => ({
    label: tab.label,
    count: pendingCounts[tab.type] || 0,
    description: tab.emptyDescription,
    color: config.accentColor as 'blue' | 'purple' | 'green' | 'amber',
    icon: getIconForSourceType(tab.type),
    tabName: tab.type === 'document' ? 'documents' : tab.type === 'url' ? 'urls' : tab.type,
  }));

  // Add bot action if enabled (uses 'qa' tab ID to match Slack Bot tab)
  if (config.showQATab) {
    sourceActions.push({
      label: 'bot interactions',
      count: pendingBot.length,
      description: 'Review Slack bot interactions',
      color: 'blue' as const,
      icon: 'bot' as const,
      tabName: 'qa',
    });
  }

  // Navigation helper
  const handleNavigate = (skillSlug: string | null, skillId: string) => {
    try {
      if (customerId && customerSlug) {
        // Customer-scoped: use customer skill path
        router.push(`/v2/customers/${customerSlug}/skills/${skillSlug || skillId}`);
      } else {
        // Library-scoped: use library path
        router.push(`${config.basePath}/${skillSlug || skillId}`);
      }
    } catch (error) {
      console.error('[UnifiedLibraryClient] Error in handleNavigate:', error, {
        customerId,
        customerSlug,
        skillSlug,
        skillId,
      });
      alert('Error navigating to skill. Please try again.');
    }
  };

  const handleSuccess = (skillId?: string) => {
    try {
      // Customer-scoped with skill ID: navigate to customer skill detail
      if (customerId && customerSlug && skillId) {
        router.push(`/v2/customers/${customerSlug}/skills/${skillId}`);
        return;
      }

      // Customer-scoped without skill ID: reload to show new skill in list
      if (customerId && !customerSlug) {
        console.error('[UnifiedLibraryClient] Cannot complete customer skill creation: customerSlug is missing', {
          customerId,
          customerSlug,
          skillId,
        });
        alert('Error completing creation. Please refresh the page to see your new skill.');
        window.location.reload();
        return;
      }

      if (customerId) {
        window.location.reload();
        return;
      }

      // Library-scoped with skill ID: navigate to skill detail
      if (skillId) {
        router.push(`${config.basePath}/${skillId}`);
        return;
      }

      // No skill ID: return to library list
      router.push(config.basePath);
    } catch (error) {
      console.error('[UnifiedLibraryClient] Error in handleSuccess:', error);
      alert('An error occurred while completing creation. Please refresh and try again.');
    }
  };

  return (
    <div className={embedded ? '' : 'p-8'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {/* Title and stats - only shown for standalone mode */}
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {totalSkills} {config.pluralName} · {pendingReview} pending review · {activeSkills}{' '}
              active
            </p>
          </div>
        )}
        {/* Create Skill Button - shown in both standalone and embedded modes */}
        <button
          onClick={() => setShowCreateSkillModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:shadow-md transition-shadow ${colors.button}`}
        >
          <Plus className="w-4 h-4" />
          {config.addButtonLabel}
        </button>
      </div>

      {/* Tabs */}
      <LibraryTabs
        libraryId={libraryId as 'knowledge' | 'it' | 'gtm' | 'talent' | 'customers'}
        isCustomerLibrary={!!customerId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={counts}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            libraryId={libraryId as 'knowledge' | 'it' | 'gtm' | 'talent' | 'customers'}
            totalSkills={totalSkills}
            activeSkills={activeSkills}
            pendingReview={pendingReview}
            totalStagedSources={totalStagedSources}
            sourceActions={sourceActions}
            onNavigate={handleTabChange}
          />
        )}

        {/* Skills List Tab */}
        {activeTab === 'items' && (
          <SkillsList
            skills={skills}
            config={config}
            colors={colors}
            searchParams={searchParams}
            onNavigate={handleNavigate}
          />
        )}

        {/* Source Tabs - all sources now use UnifiedSourceWizard */}
        {config.sourceTabs.map((tabConfig) => {
          // Map source type to tab ID (matches LibraryTabs tab definitions)
          const tabName = tabConfig.type === 'url' ? 'urls' : tabConfig.type === 'document' ? 'documents' : tabConfig.type;
          if (activeTab !== tabName) return null;

          const sources = sourcesByType[tabConfig.type] || [];

          return (
            <SourceWizardDispatcher
              key={tabConfig.type}
              sourceType={tabConfig.type}
              libraryId={libraryId}
              sources={sources}
              customerId={customerId}
              embedded={embedded}
              onSuccess={handleSuccess}
              onShowAddToSkill={onShowAddToSkill}
              onShowAddMultipleToSkill={onShowAddMultipleToSkill}
              onRefreshSources={onRefreshSources}
            />
          );
        })}

        {/* Slack Bot Tab (Channel Config + Interactions + Prompt Editor) */}
        {activeTab === 'qa' && config.showQATab && (
          <SlackBotTab
            libraryId={libraryId as 'knowledge' | 'it' | 'gtm' | 'talent'}
            pendingBot={pendingBot}
            customerId={customerId}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Add Source to Skill Dialog */}
      {renderDialog()}

      {/* Create Skill Modal */}
      <CreateSkillModal
        isOpen={showCreateSkillModal}
        libraryId={libraryId}
        customerId={customerId}
        onClose={() => setShowCreateSkillModal(false)}
        onSuccess={(skillId) => handleSuccess(skillId)}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SkillsListProps {
  skills: SkillItem[];
  config: LibraryConfig;
  colors: (typeof colorClasses)[keyof typeof colorClasses];
  searchParams: { search?: string; review?: string };
  onNavigate: (slug: string | null, id: string) => void;
}

function SkillsList({
  skills,
  config,
  colors,
  searchParams,
  onNavigate,
}: SkillsListProps) {
  if (skills.length === 0) {
    return (
      <div
        className={`text-center py-12 bg-white rounded-lg border-l-4 ${colors.border} border-t border-r border-b border-gray-200 shadow-sm`}
      >
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{config.emptyStateTitle}</h3>
        <p className="text-gray-500 mb-4">
          {searchParams.search || searchParams.review !== 'all'
            ? 'Try adjusting your filters.'
            : config.emptyStateMessage}
        </p>
{/* TODO: Implement manual skill creation form */}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {skills.map((skill) => (
        <button
          key={skill.id}
          onClick={() => onNavigate(skill.slug, skill.id)}
          className="text-left hover:no-underline w-full"
        >
          <div
            className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md ${colors.hoverBorder} transition-all duration-200`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{skill.title}</h3>
                  {skill.status === 'DRAFT' && (
                    <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded whitespace-nowrap">
                      Pending Review
                    </span>
                  )}
                  {skill.status === 'ACTIVE' && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
                {skill.summary && (
                  <p className="text-sm text-gray-600 line-clamp-2">{skill.summary}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>
                {new Date(skill.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {/* Scope Definition - shows what LLM uses for skill matching */}
            {getScopeCovers(skill.attributes) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Scope (used for LLM matching):</p>
                <p className="text-sm text-gray-700">{getScopeCovers(skill.attributes)}</p>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// Dispatcher for source wizards - unified approach via config
interface SourceWizardDispatcherProps {
  sourceType: SourceType;
  libraryId: LibraryId;
  sources: StagedSourceItem[];
  customerId?: string;
  embedded?: boolean;
  onSuccess: () => void;
  onShowAddToSkill: (sourceId: string) => void;
  onShowAddMultipleToSkill: (sourceIds: string[]) => void;
  onRefreshSources?: () => Promise<void>;
}

function SourceWizardDispatcher({
  sourceType,
  libraryId,
  sources,
  customerId,
  embedded,
  onSuccess,
  onShowAddToSkill,
  onShowAddMultipleToSkill,
  onRefreshSources,
}: SourceWizardDispatcherProps) {
  return (
    <UnifiedSourceWizard
      sourceType={sourceType}
      libraryId={libraryId}
      customerId={customerId}
      sources={sources}
      onSuccess={onSuccess}
      onCancel={() => {}}
      onShowAddToSkill={onShowAddToSkill}
      onShowAddMultipleToSkill={onShowAddMultipleToSkill}
      onRefreshSources={onRefreshSources || (async () => {
        // In embedded mode, don't reload - let parent handle it
        // In standalone mode, hard reload to ensure all data is fresh
        if (!embedded) {
          window.location.reload();
        }
      })}
    />
  );
}

// Helper to map source types to icons
function getIconForSourceType(
  type: SourceType
): 'search' | 'file' | 'megaphone' | 'zap' | 'ticket' | 'document' | 'bot' {
  switch (type) {
    case 'url':
      return 'search';
    case 'document':
      return 'file';
    case 'gong':
      return 'megaphone';
    case 'slack':
      return 'search';
    case 'zendesk':
      return 'ticket';
    case 'notion':
      return 'file';
    default:
      return 'file';
  }
}
