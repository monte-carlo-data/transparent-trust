'use client';

/**
 * Unified Response Card
 *
 * Single component for displaying RFP responses across Ask tab, Projects tab, and History tab.
 * Provides consistent layout with configurable features via props.
 *
 * Features:
 * - Response display with confidence badge
 * - Collapsible transparency details (Reasoning, Inference, Sources with links)
 * - Flag and Accept review actions
 * - Optional inline editing with toggle (for bulk view)
 */

import { useState, useRef, useEffect } from 'react';
import { Flag, CheckCircle, Edit2, Loader2 } from 'lucide-react';
import { TransparencyPanelRFP } from '@/app/v2/rfps/components/TransparencyPanelRFP';
import { useAutoResizeTextarea } from '@/lib/hooks/useAutoResizeTextarea';
import { getConfidenceBadgeClasses } from '@/lib/v2/ui-utils';

export interface UnifiedResponseCardProps {
  // Core data
  question: string;
  response: string | null;
  confidence: string | null;
  status: string;

  // Transparency metadata
  reasoning?: string | null;
  inference?: string | null;
  sources?: string | null;

  // Review state
  flaggedForReview: boolean;
  reviewStatus?: string | null;

  // Context
  library?: string;

  // Callbacks
  onFlag: () => void;
  onAccept: () => void;
  onAnswerEdit?: (newAnswer: string) => void;  // Only for bulk view

  // UI options
  allowEditing?: boolean;  // Show edit toggle (for Projects tab)
  isLoading?: boolean;
}

export function UnifiedResponseCard({
  question,
  response,
  confidence,
  status,
  reasoning,
  inference,
  sources,
  flaggedForReview,
  reviewStatus,
  library,
  onFlag,
  onAccept,
  onAnswerEdit,
  allowEditing = false,
  isLoading = false,
}: UnifiedResponseCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Track local edits only when actively editing; otherwise derive from response prop
  const [localEdit, setLocalEdit] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use local edit when editing, otherwise use response prop directly
  const editedAnswer = localEdit ?? response ?? '';
  const textareaRef = useAutoResizeTextarea(editedAnswer);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - clear local edits
      setLocalEdit(null);
      setIsEditing(false);
    } else {
      // Start editing - initialize local edit from current response
      setLocalEdit(response || '');
      setIsEditing(true);
    }
  };

  const handleAnswerChange = (value: string) => {
    setLocalEdit(value);

    // Debounced save (800ms)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      if (onAnswerEdit) {
        onAnswerEdit(value);
      }
      setIsSaving(false);
    }, 800);
  };

  const hasReviewStatus = reviewStatus && reviewStatus !== 'NONE';
  const isApproved = reviewStatus === 'APPROVED';

  return (
    <div className="space-y-4">
      {/* Question */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">Question</h3>
        <p className="text-slate-700">{question}</p>
      </div>

      {/* Processing/Error States */}
      {status === 'PROCESSING' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Processing response...
        </div>
      )}

      {status === 'ERROR' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Failed to process question
        </div>
      )}

      {/* Response Content */}
      {response && status === 'COMPLETED' && (
        <div className="space-y-4">
          {/* Header with badges and actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
              Response
            </span>
            {confidence && (
              <span
                className={`px-2 py-1 text-xs rounded-full ${getConfidenceBadgeClasses(confidence)}`}
              >
                Confidence: {confidence}
              </span>
            )}

            {/* Review Status Badge */}
            {isApproved && (
              <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" />
                Accepted
              </span>
            )}

            {flaggedForReview && !hasReviewStatus && (
              <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                <Flag className="w-3 h-3" />
                Flagged
              </span>
            )}

            {/* Edit Toggle (Projects bulk only) */}
            {allowEditing && onAnswerEdit && (
              <button
                type="button"
                onClick={handleEditToggle}
                className={`ml-auto text-xs px-3 py-1 rounded-md border transition ${
                  isEditing
                    ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isEditing ? (
                  <span className="flex items-center gap-1">
                    <Edit2 size={14} />
                    Done Editing
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Edit2 size={14} />
                    Edit
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Response Text or Edit Textarea */}
          {isEditing && allowEditing ? (
            <div>
              <textarea
                ref={textareaRef}
                value={editedAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={5}
              />
              {isSaving && (
                <p className="text-xs text-slate-500 mt-1">Saving...</p>
              )}
            </div>
          ) : (
            <p className="text-slate-700 whitespace-pre-wrap">{response}</p>
          )}

          {/* Transparency Panel */}
          <TransparencyPanelRFP
            data={{
              confidence: confidence || undefined,
              reasoning: reasoning || undefined,
              inference: inference || undefined,
              sources: sources || undefined,
            }}
            library={library}
          />

          {/* Review Actions: Flag and Accept */}
          <div className="flex items-center gap-2 pt-2">
            {!flaggedForReview && !hasReviewStatus && (
              <>
                <button
                  onClick={onFlag}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Flag className="w-4 h-4" />
                  Flag
                </button>
                <button
                  onClick={onAccept}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-50 rounded border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept
                </button>
              </>
            )}

            {flaggedForReview && !hasReviewStatus && (
              <button
                onClick={onAccept}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-50 rounded border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Accepting will automatically unflag"
              >
                <CheckCircle className="w-4 h-4" />
                Accept (Unflag)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
