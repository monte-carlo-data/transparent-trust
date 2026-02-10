'use client';

/**
 * Audits Tab Component
 *
 * Umbrella tab containing sub-navigation for all audit types:
 * - Coverage Audit: Data quality monitoring coverage analysis
 * - Operations Audit: Alerting system health analysis
 * - Adoption Audit: User engagement and feature utilization
 *
 * Each audit view loads Looker dashboard data specific to its audit type.
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { BarChart3, CheckCircle, Users } from 'lucide-react';
import { ViewTab } from './ViewTab';
import type { ViewDefinition } from '@/lib/v2/views/view-definitions';

interface Skill {
  id: string;
  title: string;
  content?: string | null;
  summary?: string | null;
}

interface AuditsTabProps {
  auditViews: ViewDefinition[];
  customerId: string;
  teamId?: string;
  generatedViews: Record<string, { content: string; generatedAt: Date }>;
  customerSkills: Skill[];
  customerData: Record<string, unknown>;
  libraryId?: string;
}

const AUDIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  view_coverage_audit: BarChart3,
  view_operations_audit: CheckCircle,
  view_adoption_audit: Users,
};

const AUDIT_DESCRIPTIONS: Record<string, string> = {
  view_coverage_audit:
    'Analyze data quality coverage across tables, columns, and monitoring rules.',
  view_operations_audit:
    'Analyze alerting system health, alert distribution, and operational patterns.',
  view_adoption_audit:
    'Analyze user adoption patterns, engagement metrics, and feature utilization.',
};

export function AuditsTab({
  auditViews,
  customerId,
  teamId,
  generatedViews,
  customerSkills,
  customerData,
  libraryId = 'customers',
}: AuditsTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Derive active audit directly from URL (single source of truth)
  const defaultAuditId = auditViews[0]?.id || '';
  const auditFromUrl = searchParams.get('audit');
  const activeAuditId = auditFromUrl && auditViews.some((v) => v.id === auditFromUrl)
    ? auditFromUrl
    : defaultAuditId;

  // Update URL when audit changes
  const handleAuditChange = (auditId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Keep the tab=audits param, add/update the audit param
    if (auditId === defaultAuditId) {
      params.delete('audit');
    } else {
      params.set('audit', auditId);
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  };

  const activeAudit = auditViews.find((v) => v.id === activeAuditId);

  if (auditViews.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No audit views configured.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation pills */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {auditViews.map((view) => {
          const Icon = AUDIT_ICONS[view.id] || CheckCircle;
          const isActive = activeAuditId === view.id;
          const hasGenerated = !!generatedViews[view.id];

          return (
            <button
              key={view.id}
              onClick={() => handleAuditChange(view.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{view.title.replace(' Audit', '')}</span>
              {hasGenerated && (
                <span className="w-2 h-2 rounded-full bg-green-500" title="Generated" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active audit description */}
      {activeAudit && (
        <div className="text-sm text-gray-600">
          {AUDIT_DESCRIPTIONS[activeAudit.id] || activeAudit.summary}
        </div>
      )}

      {/* Active audit view */}
      {activeAudit && (
        <ViewTab
          key={activeAudit.id}
          viewId={activeAudit.id}
          customerId={customerId}
          teamId={teamId}
          cachedContent={generatedViews[activeAudit.id]}
          viewSummary={activeAudit.summary}
          compositionId={activeAudit.compositionId}
          customerSkills={customerSkills}
          customerData={customerData}
          libraryId={libraryId}
        />
      )}
    </div>
  );
}
