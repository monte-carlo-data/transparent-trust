'use client';

/**
 * LibraryContent - Generic client component for library tabs
 *
 * Renders the library header, tabs, and content based on the active tab.
 * Uses route-based navigation via LibraryTabs with basePath.
 *
 * This is a reusable component for all skill libraries (knowledge, it, gtm, talent).
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
import { getLibraryConfig } from '@/lib/library-config';
import { useLibraryContext } from './library-context';
import {
  getPendingCount,
  getScopeCovers,
  getIconForSourceType,
  colorClasses,
} from './source-utils';

interface LibraryContentProps {
  activeTab: string;
  searchParams?: {
    search?: string;
    review?: string;
  };
}

export function LibraryContent({ activeTab, searchParams = {} }: LibraryContentProps) {
  const router = useRouter();
  const {
    libraryId,
    skills,
    totalSkills,
    pendingReview,
    activeSkills,
    sourcesByType,
    pendingBot,
    isAdmin,
  } = useLibraryContext();

  const config = getLibraryConfig(libraryId);
  const colors = colorClasses[config.accentColor];
  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);

  // Combine all sources for dialog lookup
  const allSources = useMemo(() => {
    const combined: Array<{ id: string; title: string; content: string | null; sourceType: string; stagedAt: Date; metadata: unknown; ignoredAt: Date | null; ignoredBy: string | null; contentPreview: string | null; assignments?: Array<{ id: string; incorporatedAt: Date | null; incorporatedBy: string | null; block: { id: string; title: string; slug: string | null; isActive?: boolean } }> }> = [];
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
  const counts = useMemo(() => ({
    items: totalSkills,
    urls: sourcesByType.url?.length,
    documents: sourcesByType.document?.length,
    zendesk: sourcesByType.zendesk?.length,
    slack: sourcesByType.slack?.length,
    notion: sourcesByType.notion?.length,
    gong: sourcesByType.gong?.length,
    bot: pendingBot.length || undefined,
  }), [totalSkills, sourcesByType, pendingBot.length]);

  // Compute pending counts for dashboard
  const pendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [type, sources] of Object.entries(sourcesByType)) {
      if (sources) {
        counts[type] = getPendingCount(sources);
      }
    }
    return counts;
  }, [sourcesByType]);

  // Total staged sources (pending only)
  const totalStagedSources = useMemo(() =>
    Object.values(pendingCounts).reduce((sum, count) => sum + count, 0) + pendingBot.length,
    [pendingCounts, pendingBot.length]
  );

  // Build source actions for dashboard
  const sourceActions = useMemo(() => {
    const actions = config.sourceTabs.map((tab) => ({
      label: tab.label,
      count: pendingCounts[tab.type] || 0,
      description: tab.emptyDescription,
      color: config.accentColor as 'blue' | 'purple' | 'green' | 'amber',
      icon: getIconForSourceType(tab.type),
      tabName: tab.type === 'document' ? 'documents' : tab.type === 'url' ? 'urls' : tab.type,
    }));

    // Add bot action if enabled
    if (config.showQATab) {
      actions.push({
        label: 'bot interactions',
        count: pendingBot.length,
        description: 'Review Slack bot interactions',
        color: 'blue' as const,
        icon: 'bot' as const,
        tabName: 'qa',
      });
    }

    return actions;
  }, [config.sourceTabs, config.accentColor, config.showQATab, pendingCounts, pendingBot.length]);

  // Navigation helper for skill detail
  const handleNavigate = useCallback((skillSlug: string | null, skillId: string) => {
    router.push(`${config.basePath}/${skillSlug || skillId}`);
  }, [router, config.basePath]);

  // Handle tab navigation from dashboard
  const handleDashboardNavigate = useCallback((tabName: string) => {
    if (tabName === 'dashboard') {
      router.push(config.basePath);
    } else {
      router.push(`${config.basePath}/${tabName}`);
    }
  }, [router, config.basePath]);

  const handleSuccess = useCallback((skillId?: string) => {
    if (skillId) {
      router.push(`${config.basePath}/${skillId}`);
    } else {
      router.push(config.basePath);
    }
  }, [router, config.basePath]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalSkills} {config.pluralName} · {pendingReview} pending review · {activeSkills} active
          </p>
        </div>
        <button
          onClick={() => setShowCreateSkillModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:shadow-md transition-shadow ${colors.button}`}
        >
          <Plus className="w-4 h-4" />
          {config.addButtonLabel}
        </button>
      </div>

      {/* Tabs - route-based navigation */}
      <LibraryTabs
        libraryId={libraryId as 'knowledge' | 'it' | 'gtm' | 'talent' | 'customers'}
        activeTab={activeTab}
        basePath={config.basePath}
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
            onNavigate={handleDashboardNavigate}
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

        {/* Source Tabs */}
        {config.sourceTabs.map((tabConfig) => {
          const tabName = tabConfig.type === 'url' ? 'urls' : tabConfig.type === 'document' ? 'documents' : tabConfig.type;
          if (activeTab !== tabName) return null;

          // Cast to any to handle the SourceType union
          const sources = (sourcesByType as Record<string, typeof sourcesByType.url>)[tabConfig.type] || [];

          return (
            <UnifiedSourceWizard
              key={tabConfig.type}
              sourceType={tabConfig.type}
              libraryId={libraryId}
              sources={sources}
              onSuccess={handleSuccess}
              onCancel={() => {}}
              onShowAddToSkill={onShowAddToSkill}
              onShowAddMultipleToSkill={onShowAddMultipleToSkill}
              onRefreshSources={async () => {
                window.location.reload();
              }}
            />
          );
        })}

        {/* Slack Bot Tab */}
        {activeTab === 'qa' && config.showQATab && (
          <SlackBotTab
            libraryId={libraryId as 'knowledge' | 'it' | 'gtm' | 'talent'}
            pendingBot={pendingBot}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Dialogs */}
      {renderDialog()}
      <CreateSkillModal
        isOpen={showCreateSkillModal}
        libraryId={libraryId}
        onClose={() => setShowCreateSkillModal(false)}
        onSuccess={(skillId) => handleSuccess(skillId)}
      />
    </div>
  );
}

// Skills list component
interface SkillsListProps {
  skills: Array<{
    id: string;
    title: string;
    slug: string | null;
    summary: string | null;
    attributes: unknown;
    status: string;
    updatedAt: Date;
  }>;
  config: ReturnType<typeof getLibraryConfig>;
  colors: typeof colorClasses[keyof typeof colorClasses];
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
