"use client";

import { ForwardedRef, forwardRef } from "react";

interface FlagReviewModalNoteInputProps {
  note: string;
  onNoteChange: (note: string) => void;
  action: "flag" | "need-help";
}

export const FlagReviewModalNoteInput = forwardRef(
  (
    { note, onNoteChange, action }: FlagReviewModalNoteInputProps,
    ref: ForwardedRef<HTMLTextAreaElement>
  ) => {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {action === "flag" ? "Note (optional)" : "Note for reviewer (optional)"}
        </label>
        <textarea
          ref={ref}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={
            action === "flag"
              ? "e.g., 'Need to verify compliance claim' or 'Check with legal'"
              : "e.g., 'Please verify the SOC 2 claims' or 'Not sure about this'"
          }
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg min-h-[80px] resize-y font-inherit leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>
    );
  }
);

FlagReviewModalNoteInput.displayName = "FlagReviewModalNoteInput";
