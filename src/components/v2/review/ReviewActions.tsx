"use client";

import { Flag, CheckCircle, Edit2, AlertCircle } from "lucide-react";
import type { ReviewWorkflowState } from "./types";

interface ReviewActionsProps {
  state: ReviewWorkflowState;
  isLoading?: boolean;
  onFlag?: () => void;
  onApprove?: () => void;
  onEdit?: () => void;
  onUnflag?: () => void;
}

export function ReviewActions({
  state,
  isLoading = false,
  onFlag,
  onApprove,
  onEdit,
  onUnflag,
}: ReviewActionsProps) {
  const hasReviewStatus = state.reviewStatus && state.reviewStatus !== "NONE";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {/* Status Badge */}
      {state.reviewStatus === "APPROVED" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Approved
        </div>
      )}

      {state.reviewStatus === "CORRECTED" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          <Edit2 className="w-4 h-4" />
          Corrected
        </div>
      )}

      {state.reviewStatus === "REQUESTED" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          Review Pending
        </div>
      )}

      {state.flaggedForReview && !hasReviewStatus && (
        <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          <Flag className="w-4 h-4" />
          Flagged
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 ml-auto">
        {!state.flaggedForReview && !hasReviewStatus && (
          <>
            <button
              onClick={onFlag}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag className="w-4 h-4" />
              Flag
            </button>
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-50 rounded border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          </>
        )}

        {(state.flaggedForReview || hasReviewStatus) && (
          <>
            {state.reviewStatus !== "CORRECTED" && (
              <button
                onClick={onEdit}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}

            {!state.flagResolved && (
              <button
                onClick={onUnflag}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
