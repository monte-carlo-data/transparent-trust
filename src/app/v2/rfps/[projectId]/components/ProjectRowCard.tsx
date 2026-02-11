'use client';

/**
 * Project Row Card
 *
 * Displays a single question/answer row in the bulk RFP project view.
 * Expandable card with UnifiedResponseCard for consistent display.
 */

import { CheckCircle, XCircle, Loader2, AlertCircle, Flag } from 'lucide-react';
import { UnifiedResponseCard } from '@/components/v2/rfp-responses';
import { getConfidenceColor } from '@/lib/v2/ui-utils';
import type { ProjectRow } from '../types';

interface ProjectRowCardProps {
  row: ProjectRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (rowId: string, updates: unknown) => Promise<void>;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle size={16} className="text-green-600" />;
    case 'ERROR':
      return <XCircle size={16} className="text-red-600" />;
    case 'PROCESSING':
      return <Loader2 size={16} className="text-blue-600 animate-spin" />;
    default:
      return <AlertCircle size={16} className="text-slate-400" />;
  }
}

export function ProjectRowCard({
  row,
  isExpanded,
  onToggleExpand,
  onUpdate,
}: ProjectRowCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
      {/* Row Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-750 flex items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon(row.status)}
          <p className="text-sm text-slate-900 dark:text-white line-clamp-2 text-left">
            {row.question}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {row.confidence && row.status === 'COMPLETED' && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(
                row.confidence
              )}`}
            >
              {row.confidence}
            </span>
          )}
          {row.flaggedForReview && <Flag size={14} className="text-red-600" />}
          <span className="text-xs text-slate-500 dark:text-gray-400">{row.status}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-gray-700 px-4 py-4 bg-slate-50 dark:bg-gray-850">
          <UnifiedResponseCard
            question={row.question}
            response={row.response}
            confidence={row.confidence}
            status={row.status}
            reasoning={row.reasoning}
            inference={row.inference}
            sources={row.sources}
            flaggedForReview={row.flaggedForReview}
            reviewStatus={row.reviewStatus}
            library="knowledge"
            onFlag={() => onUpdate(row.id, { flaggedForReview: true })}
            onAccept={() =>
              onUpdate(row.id, {
                reviewStatus: 'APPROVED',
                flaggedForReview: false,
              })
            }
            onAnswerEdit={(newAnswer) =>
              onUpdate(row.id, { userEditedAnswer: newAnswer })
            }
            allowEditing={true}
            isLoading={false}
          />
        </div>
      )}
    </div>
  );
}
