"use client";

import { useState, useCallback } from "react";
import { Check, X, ChevronDown, ChevronUp, Info } from "lucide-react";

/**
 * Generic suggestion item - base interface for all suggestion types.
 */
export interface SuggestionItem {
  id: string;
  title: string;
  reasoning: string;
}

/**
 * Props for the SuggestionReview component.
 */
export interface SuggestionReviewProps<T extends SuggestionItem> {
  /** Title shown above the suggestions */
  title: string;
  /** Optional description/explanation */
  description?: string;
  /** The suggestions to review */
  suggestions: T[];
  /** Custom render function for each item */
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  /** Called when user approves with selected items */
  onApprove: (selectedItems: T[]) => void;
  /** Called when user rejects all suggestions */
  onReject?: () => void;
  /** Allow user to add/remove items (default: true) */
  allowModify?: boolean;
  /** Show reasoning for each item (default: true) */
  showReasoning?: boolean;
  /** Approve button text (default: "Approve") */
  approveText?: string;
  /** Reject button text (default: "Skip") */
  rejectText?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * SuggestionReview - Generic component for reviewing AI suggestions.
 *
 * Pattern: AI suggests → Human reviews → Approves → Executes
 *
 * Used for:
 * - RFP skill selection
 * - Source assignment suggestions
 * - Categorization suggestions
 * - Any human-in-the-loop AI decision
 */
export function SuggestionReview<T extends SuggestionItem>({
  title,
  description,
  suggestions,
  renderItem,
  onApprove,
  onReject,
  allowModify = true,
  showReasoning = true,
  approveText = "Approve",
  rejectText = "Skip",
  isLoading = false,
}: SuggestionReviewProps<T>) {
  // Track which items are selected (all selected by default)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(suggestions.map((s) => s.id))
  );
  // Track which items have expanded reasoning
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleSelected = useCallback((id: string) => {
    if (!allowModify) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [allowModify]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(suggestions.map((s) => s.id)));
  }, [suggestions]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleApprove = useCallback(() => {
    const selectedItems = suggestions.filter((s) => selectedIds.has(s.id));
    onApprove(selectedItems);
  }, [suggestions, selectedIds, onApprove]);

  const selectedCount = selectedIds.size;
  const totalCount = suggestions.length;

  if (suggestions.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-500">No suggestions available.</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {description && (
              <p className="text-sm text-slate-600 mt-0.5">{description}</p>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {selectedCount} of {totalCount} selected
          </div>
        </div>

        {/* Select all/none controls */}
        {allowModify && totalCount > 1 && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
              disabled={isLoading}
            >
              Select all
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-xs text-blue-600 hover:text-blue-800"
              disabled={isLoading}
            >
              Select none
            </button>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="divide-y divide-slate-200">
        {suggestions.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isExpanded = expandedIds.has(item.id);

          return (
            <div
              key={item.id}
              className={`px-4 py-3 transition-colors ${
                isSelected ? "bg-white" : "bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {allowModify && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(item.id)}
                    disabled={isLoading}
                    className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </button>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(item, isSelected)
                  ) : (
                    <div className="font-medium text-slate-900">{item.title}</div>
                  )}

                  {/* Reasoning toggle */}
                  {showReasoning && item.reasoning && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1"
                    >
                      <Info size={12} />
                      <span>Why?</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}

                  {/* Expanded reasoning */}
                  {showReasoning && isExpanded && item.reasoning && (
                    <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded px-3 py-2 border-l-2 border-blue-300">
                      {item.reasoning}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions footer */}
      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {selectedCount === 0 && "Select at least one item to proceed"}
        </div>
        <div className="flex gap-2">
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1"
            >
              <X size={14} />
              {rejectText}
            </button>
          )}
          <button
            type="button"
            onClick={handleApprove}
            disabled={isLoading || selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1"
          >
            <Check size={14} />
            {approveText} ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SkillSuggestion - Specialized suggestion type for skill selection.
 */
export interface SkillSuggestion extends SuggestionItem {
  skillId: string;
  questionIndices: number[];
}

/**
 * SkillSuggestionReview - Wrapper for skill selection suggestions.
 */
export function SkillSuggestionReview({
  suggestions,
  totalQuestions,
  onApprove,
  onReject,
  isLoading,
}: {
  suggestions: SkillSuggestion[];
  totalQuestions: number;
  onApprove: (selectedSkills: SkillSuggestion[]) => void;
  onReject?: () => void;
  isLoading?: boolean;
}) {
  return (
    <SuggestionReview
      title="Suggested Skills"
      description={`AI suggests ${suggestions.length} skills for ${totalQuestions} questions`}
      suggestions={suggestions}
      onApprove={onApprove}
      onReject={onReject}
      isLoading={isLoading}
      approveText="Use Selected Skills"
      rejectText="Use All Skills"
      renderItem={(item, isSelected) => (
        <div>
          <div className={`font-medium ${isSelected ? "text-slate-900" : "text-slate-500"}`}>
            {item.title}
          </div>
          {item.questionIndices.length > 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              Relevant to {item.questionIndices.length} question{item.questionIndices.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    />
  );
}
