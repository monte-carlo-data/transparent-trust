/**
 * IT Library Sidebar Sections
 *
 * Displays Error Codes, Resolution Summary, Sources, Related IT Skills,
 * Incorporated Sources, and Pending Sources.
 */

import { Code, Zap, AlertCircle } from 'lucide-react';
import type { SourceAssignment, StagedSource } from '@prisma/client';
import { ScopeCard } from '../ScopeCard';
import { IncorporatedSourcesSection, PendingSourcesSection } from './SourcesSection';
import { RelatedSkillsSection } from './RelatedSkillsSection';

interface RelatedSkill {
  id: string;
  title: string;
  slug: string | null;
}

interface ITSidebarProps {
  skillId: string;
  skillTitle: string;
  errorCodes?: string[];
  resolutionSummary?: string;
  sourceUrls?: string[];
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  incorporatedSources: Array<SourceAssignment & { stagedSource: StagedSource }>;
  pendingSources: StagedSource[];
  relatedSkills: RelatedSkill[];
}

export function ITSidebar({
  skillId,
  skillTitle,
  errorCodes = [],
  resolutionSummary,
  sourceUrls = [],
  scopeDefinition,
  incorporatedSources,
  pendingSources,
  relatedSkills,
}: ITSidebarProps) {
  return (
    <>
      {/* Scope */}
      <ScopeCard scope={scopeDefinition} skillTitle={skillTitle} />

      {/* Incorporated Sources */}
      <IncorporatedSourcesSection incorporatedSources={incorporatedSources} />

      {/* Pending Sources */}
      <PendingSourcesSection pendingSources={pendingSources} blockId={skillId} blockTitle={skillTitle} />

      {/* Error Codes */}
      {errorCodes.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Code className="w-4 h-4" />
            Error Codes
          </h3>
          <div className="space-y-2">
            {errorCodes.map((code) => (
              <div key={code} className="p-2 bg-red-50 rounded border border-red-200">
                <code className="text-xs font-mono text-red-700">{code}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source URLs */}
      {sourceUrls.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
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

      {/* Related IT Skills */}
      <RelatedSkillsSection
        title="Related IT Skills"
        skills={relatedSkills}
        linkHref={(skill) => `/v2/it/${skill.slug || skill.id}`}
      />

      {/* Resolution Summary (if available, shows as info box) */}
      {resolutionSummary && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Quick Summary
          </h3>
          <p className="text-sm text-gray-700">{resolutionSummary}</p>
        </div>
      )}
    </>
  );
}
