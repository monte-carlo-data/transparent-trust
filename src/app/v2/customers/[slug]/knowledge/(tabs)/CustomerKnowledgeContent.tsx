'use client';

/**
 * CustomerKnowledgeContent - Client component for customer knowledge base tabs
 *
 * Renders tabs and content for customer-scoped skill library.
 * Uses route-based navigation with basePath derived from customer slug.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, CheckCircle } from 'lucide-react';
import { LibraryTabs } from '@/components/v2/LibraryTabs';
import { DashboardTab } from '@/components/v2/DashboardTab';
import { useAddToSkillDialog } from '@/components/v2/useAddToSkillDialog';
import { UnifiedSourceWizard } from '@/components/v2/sources';
import { CreateSkillModal } from '@/components/v2/CreateSkillModal';
import { getLibraryConfig } from '@/lib/library-config';
import { useCustomerKnowledge } from './context';
import {
  getPendingCount,
  getScopeCovers,
  getIconForSourceType,
  colorClasses,
} from '@/lib/v2/library-routes';

interface CustomerKnowledgeContentProps {
  activeTab: string;
}

export function CustomerKnowledgeContent({ activeTab }: CustomerKnowledgeContentProps) {
  const router = useRouter();
  const {
    customerSlug,
    customerId,
    customerTitle,
    skills,
    totalSkills,
    sourcesByType,
  } = useCustomerKnowledge();

  const config = getLibraryConfig('customers');
  const colors = colorClasses.amber;
  const basePath = `/v2/customers/${customerSlug}/knowledge`;
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
    libraryId: 'customers',
    skills: skills as Array<typeof skills[0] & { updatedAt: Date }>,
    sources: allSources,
  });

  // Compute counts for tabs
  const counts = useMemo(() => ({
    items: totalSkills,
    urls: sourcesByType.url?.length,
    documents: sourcesByType.document?.length,
    slack: sourcesByType.slack?.length,
    gong: sourcesByType.gong?.length,
  }), [totalSkills, sourcesByType]);

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

  // Total staged sources
  const totalStagedSources = useMemo(() =>
    Object.values(pendingCounts).reduce((sum, count) => sum + count, 0),
    [pendingCounts]
  );

  // Build source actions for dashboard
  const sourceActions = useMemo(() => {
    return config.sourceTabs.map((tab) => ({
      label: tab.label,
      count: pendingCounts[tab.type] || 0,
      description: tab.emptyDescription,
      color: 'amber' as const,
      icon: getIconForSourceType(tab.type),
      tabName: tab.type === 'document' ? 'documents' : tab.type === 'url' ? 'urls' : tab.type,
    }));
  }, [config.sourceTabs, pendingCounts]);

  // Navigation helper for skill detail
  const handleNavigate = useCallback((skillSlug: string | null, skillId: string) => {
    router.push(`/v2/customers/${customerSlug}/skills/${skillSlug || skillId}`);
  }, [router, customerSlug]);

  // Handle tab navigation from dashboard
  const handleDashboardNavigate = useCallback((tabName: string) => {
    if (tabName === 'dashboard') {
      router.push(basePath);
    } else {
      router.push(`${basePath}/${tabName}`);
    }
  }, [router, basePath]);

  const handleSuccess = useCallback((skillId?: string) => {
    if (skillId) {
      router.push(`/v2/customers/${customerSlug}/skills/${skillId}`);
    } else {
      router.push(basePath);
    }
  }, [router, customerSlug, basePath]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{customerTitle} - Knowledge Base</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalSkills} skills
          </p>
        </div>
        <button
          onClick={() => setShowCreateSkillModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:shadow-md transition-shadow ${colors.button}`}
        >
          <Plus className="w-4 h-4" />
          Add Skill
        </button>
      </div>

      {/* Tabs - route-based navigation */}
      <LibraryTabs
        libraryId="customers"
        isCustomerLibrary={true}
        activeTab={activeTab}
        basePath={basePath}
        counts={counts}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            libraryId="customers"
            totalSkills={totalSkills}
            activeSkills={totalSkills}
            pendingReview={0}
            totalStagedSources={totalStagedSources}
            sourceActions={sourceActions}
            onNavigate={handleDashboardNavigate}
          />
        )}

        {/* Skills List Tab */}
        {activeTab === 'items' && (
          <SkillsList
            skills={skills as Array<typeof skills[0] & { updatedAt: Date }>}
            colors={colors}
            onNavigate={handleNavigate}
          />
        )}

        {/* Source Tabs */}
        {config.sourceTabs.map((tabConfig) => {
          const tabName = tabConfig.type === 'url' ? 'urls' : tabConfig.type === 'document' ? 'documents' : tabConfig.type;
          if (activeTab !== tabName) return null;

          const sources = (sourcesByType as Record<string, typeof sourcesByType.url>)[tabConfig.type] || [];

          return (
            <UnifiedSourceWizard
              key={tabConfig.type}
              sourceType={tabConfig.type}
              libraryId="customers"
              customerId={customerId}
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
      </div>

      {/* Dialogs */}
      {renderDialog()}
      <CreateSkillModal
        isOpen={showCreateSkillModal}
        libraryId="customers"
        customerId={customerId}
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
  colors: typeof colorClasses['amber'];
  onNavigate: (slug: string | null, id: string) => void;
}

function SkillsList({ skills, colors, onNavigate }: SkillsListProps) {
  if (skills.length === 0) {
    return (
      <div className={`text-center py-12 bg-white rounded-lg border-l-4 ${colors.border} border-t border-r border-b border-gray-200 shadow-sm`}>
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No skills yet</h3>
        <p className="text-gray-500 mb-4">Create skills from staged sources to build this customer&apos;s knowledge base.</p>
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
          <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md ${colors.hoverBorder} transition-all duration-200`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{skill.title}</h3>
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
                <p className="text-xs font-medium text-gray-500 mb-1">Scope:</p>
                <p className="text-sm text-gray-700">{getScopeCovers(skill.attributes)}</p>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
