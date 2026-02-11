"use client";

import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SendTiming = "now" | "later";
type FlagReviewAction = "flag" | "need-help";

interface FlagReviewModalButtonsProps {
  action: FlagReviewAction;
  onSubmit: (timing: SendTiming) => void;
  onCancel: () => void;
  allowQueueing?: boolean;
  queuedCount?: number;
}

export function FlagReviewModalButtons({
  action,
  onSubmit,
  onCancel,
  allowQueueing = true,
  queuedCount = 0,
}: FlagReviewModalButtonsProps) {
  return (
    <DialogFooter className="flex-wrap gap-2">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>

      {/* Queue for End - only available for "need-help" action (flags are instant, not queueable) */}
      {allowQueueing && action === "need-help" && (
        <Button
          onClick={() => onSubmit("later")}
          className="bg-violet-500 hover:bg-violet-600"
        >
          Queue for End
          {queuedCount > 0 && (
            <span className="inline-flex items-center justify-center bg-violet-400 text-white rounded-full px-2 py-0.5 text-xs font-semibold ml-2">
              {queuedCount}
            </span>
          )}
        </Button>
      )}

      <Button
        onClick={() => onSubmit("now")}
        className={action === "flag" ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-500 hover:bg-sky-600"}
      >
        {action === "flag" ? "Flag Now" : "Send Now"}
      </Button>
    </DialogFooter>
  );
}
