"use client";

import { cn } from "@/lib/utils";

type FlagReviewAction = "flag" | "need-help";

interface FlagReviewModalActionTabsProps {
  action: FlagReviewAction;
  onActionChange: (action: FlagReviewAction) => void;
}

export function FlagReviewModalActionTabs({
  action,
  onActionChange,
}: FlagReviewModalActionTabsProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onActionChange("flag")}
        className={cn(
          "flex-1 p-3 rounded-lg border-2 bg-white cursor-pointer text-center transition-all",
          action === "flag"
            ? "border-sky-500 bg-sky-50"
            : "border-slate-200"
        )}
      >
        <span className="text-xl mb-1 block">🚩</span>
        <span className="text-sm font-medium text-slate-800">Flag</span>
        <span className="text-xs text-slate-500 mt-0.5 block">Mark for your attention</span>
      </button>
      <button
        type="button"
        onClick={() => onActionChange("need-help")}
        className={cn(
          "flex-1 p-3 rounded-lg border-2 bg-white cursor-pointer text-center transition-all",
          action === "need-help"
            ? "border-sky-500 bg-sky-50"
            : "border-slate-200"
        )}
      >
        <span className="text-xl mb-1 block">🤚</span>
        <span className="text-sm font-medium text-slate-800">Need Help?</span>
        <span className="text-xs text-slate-500 mt-0.5 block">Request a review</span>
      </button>
    </div>
  );
}
