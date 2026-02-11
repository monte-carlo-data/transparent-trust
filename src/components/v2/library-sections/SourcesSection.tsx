/**
 * Sources Section Component
 *
 * Shared across all libraries.
 * Shows incorporated sources and pending sources for assignment.
 */

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { SourceAssignmentButton } from '@/app/v2/components/source-assignment-button';

/**
 * Simplified source assignment type matching SidebarContext
 */
interface IncorporatedSource {
  id: string;
  incorporatedAt: Date | null;
  stagedSource: {
    id: string;
    title: string | null;
    sourceType?: string;
  };
}

interface IncorporatedSourcesSectionProps {
  incorporatedSources: IncorporatedSource[];
}

/**
 * Simplified pending source type matching SidebarContext
 */
interface PendingSource {
  id: string;
  title: string | null;
  sourceType: string;
  stagedAt?: Date;
}

interface PendingSourcesSectionProps {
  pendingSources: PendingSource[];
  blockId: string;
  blockTitle: string;
}

export function IncorporatedSourcesSection({
  incorporatedSources,
}: IncorporatedSourcesSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        Incorporated Sources ({incorporatedSources.length})
      </h3>
      {incorporatedSources.length > 0 ? (
        <div className="space-y-2">
          {incorporatedSources.map((assignment) => (
            <div key={assignment.id} className="p-2 bg-green-50 rounded border border-green-200">
              <div className="text-xs font-medium text-green-900">{assignment.stagedSource.title}</div>
              {assignment.stagedSource.sourceType && (
                <div className="text-xs text-gray-600 mt-1">{assignment.stagedSource.sourceType}</div>
              )}
              {assignment.incorporatedAt && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Incorporated {new Date(assignment.incorporatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No sources linked to this skill yet.</p>
      )}
    </div>
  );
}

export function PendingSourcesSection({
  pendingSources,
  blockId,
  blockTitle,
}: PendingSourcesSectionProps) {
  if (pendingSources.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        Pending Sources ({pendingSources.length})
      </h3>
      <div className="space-y-2">
        {pendingSources.map((source) => (
          <div key={source.id} className="p-2 bg-white rounded border border-yellow-100">
            <div className="text-xs font-medium text-gray-900">{source.title}</div>
            <div className="text-xs text-gray-600 mt-1">
              {source.sourceType}{source.stagedAt && ` • ${new Date(source.stagedAt).toLocaleDateString()}`}
            </div>
            <SourceAssignmentButton
              stagedSourceId={source.id}
              blockId={blockId}
              blockTitle={blockTitle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
