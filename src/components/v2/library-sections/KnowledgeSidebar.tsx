/**
 * Knowledge Library Sidebar Sections
 *
 * Displays Keywords, Sources, Related Skills, Used by Customers, Citations, and Contradictions.
 */

import { LinkIcon, AlertTriangle } from 'lucide-react';
import type { SourceAssignment, StagedSource } from '@prisma/client';
import type { SkillOwner } from '@/types/v2';
import { SkillDetailCard } from '../SkillDetailCard';
import { ScopeCard } from '../ScopeCard';
import { IncorporatedSourcesSection, PendingSourcesSection } from './SourcesSection';
import { RelatedSkillsSection } from './RelatedSkillsSection';

interface Citation {
  id: string;
  label: string;
  url?: string;
  reference?: string;
}

interface Contradiction {
  type: string;
  description: string;
  sourceA: { label: string; excerpt: string };
  sourceB: { label: string; excerpt: string };
}

interface RelatedSkill {
  id: string;
  title: string;
  slug: string | null;
}

interface KnowledgeSidebarProps {
  skillId: string;
  skillTitle: string;
  categories: string[];
  owners: SkillOwner[];
  auditLog: unknown[];
  syncStatus?: unknown;
  usageCount?: number;
  lastUsedAt?: string;
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  sourceUrls: string[];
  incorporatedSources: Array<SourceAssignment & { stagedSource: StagedSource }>;
  pendingSources: StagedSource[];
  relatedSkills: RelatedSkill[];
  customersWithThisSkill: RelatedSkill[];
  citations: Citation[];
  contradictions: Contradiction[];
}

export function KnowledgeSidebar({
  skillId,
  skillTitle,
  categories,
  owners,
  auditLog,
  syncStatus,
  usageCount,
  lastUsedAt,
  scopeDefinition,
  sourceUrls,
  incorporatedSources,
  pendingSources,
  relatedSkills,
  customersWithThisSkill,
  citations,
  contradictions,
}: KnowledgeSidebarProps) {
  return (
    <>
      {/* Skill Details Card */}
      <SkillDetailCard
        categories={categories}
        owners={owners}
        auditLog={auditLog as never[]}
        syncStatus={syncStatus as 'synced' | 'pending' | 'failed' | undefined}
        usageCount={usageCount}
        lastUsedAt={lastUsedAt}
        skillTitle={skillTitle}
        availableCategories={[]}
      />

      {/* Scope */}
      <ScopeCard scope={scopeDefinition} skillTitle={skillTitle} />

      {/* Incorporated Sources */}
      <IncorporatedSourcesSection incorporatedSources={incorporatedSources} />

      {/* Pending Sources */}
      <PendingSourcesSection pendingSources={pendingSources} blockId={skillId} blockTitle={skillTitle} />

      {/* Source URLs */}
      {sourceUrls.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Sources
          </h3>
          <ul className="space-y-2">
            {sourceUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                  title={url}
                >
                  {url.replace(/^https?:\/\//, '')}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Skills */}
      <RelatedSkillsSection
        title="Related Skills"
        skills={relatedSkills}
        linkHref={(skill) => `/v2/knowledge/${skill.slug || skill.id}`}
      />

      {/* Used by Customers */}
      <RelatedSkillsSection
        title="Used by Customers"
        skills={customersWithThisSkill}
        linkHref={(customer) => `/v2/customers/${customer.slug || customer.id}`}
      />

      {/* Citations */}
      {citations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-blue-600" />
            Source Citations
          </h3>
          <div className="space-y-2">
            {citations.map((citation) => (
              <div key={citation.id} className="text-sm">
                <div className="font-medium text-gray-700">{citation.label}</div>
                {citation.url && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline block mt-1"
                  >
                    {citation.url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {citation.reference && (
                  <div className="text-xs text-gray-500 mt-1">{citation.reference}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Contradictions Detected
          </h3>
          <div className="space-y-3">
            {contradictions.map((contradiction, idx) => (
              <div key={idx} className="text-sm border-l-2 border-yellow-300 pl-3">
                <div className="font-medium text-yellow-900">
                  {contradiction.type.replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-yellow-800 mt-1">{contradiction.description}</div>
                <div className="text-xs text-yellow-700 mt-2 space-y-1">
                  <p className="font-medium">Source A: {contradiction.sourceA.label}</p>
                  <p className="italic text-yellow-700">&quot;{contradiction.sourceA.excerpt}&quot;</p>
                  <p className="font-medium mt-2">Source B: {contradiction.sourceB.label}</p>
                  <p className="italic text-yellow-700">&quot;{contradiction.sourceB.excerpt}&quot;</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
