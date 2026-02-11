"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Flag, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FlagReviewModal, { type FlagReviewData } from "@/components/FlagReviewModal";
import type { ChatMessage } from "@/types/v2/chat";

type FeedbackRating = NonNullable<NonNullable<ChatMessage["feedback"]>["rating"]>;

interface MessageFeedbackProps {
  messageId: string;
  sessionId: string | null;
  feedback?: ChatMessage["feedback"];
  onFeedbackChange: (feedback: ChatMessage["feedback"]) => void;
}

export function MessageFeedback({
  messageId,
  sessionId,
  feedback,
  onFeedbackChange,
}: MessageFeedbackProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [initialFlagAction, setInitialFlagAction] = useState<"flag" | "need-help">("flag");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState(feedback?.comment || "");

  const saveFeedback = async (updates: Partial<ChatMessage["feedback"]>) => {
    setIsSaving(true);
    try {
      const newFeedback = { ...feedback, ...updates };

      // Save to API
      const res = await fetch("/api/v2/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          sessionId,
          ...newFeedback,
        }),
      });

      if (!res.ok) throw new Error("Failed to save feedback");

      onFeedbackChange(newFeedback as ChatMessage["feedback"]);
      return true;
    } catch {
      toast.error("Failed to save feedback");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRating = async (newRating: FeedbackRating) => {
    const success = await saveFeedback({ rating: newRating });
    if (success) {
      toast.success(newRating === "THUMBS_UP" ? "Thanks for the feedback!" : "Feedback recorded");
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return;
    const success = await saveFeedback({ comment: comment.trim() });
    if (success) {
      toast.success("Comment saved");
      setShowCommentInput(false);
    }
  };

  const handleOpenFlag = () => {
    setInitialFlagAction("flag");
    setShowFlagModal(true);
  };

  const handleOpenHelp = () => {
    setInitialFlagAction("need-help");
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (flagData: FlagReviewData) => {
    setShowFlagModal(false);

    if (flagData.action === "flag") {
      const success = await saveFeedback({
        flaggedForReview: true,
        flagNote: flagData.note,
      });
      if (success) {
        toast.success("Flagged for attention");
      }
    } else {
      // Need help / request review - save with review request info
      const res = await fetch("/api/v2/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          sessionId,
          reviewRequested: true,
          reviewerId: flagData.reviewerId,
          reviewerName: flagData.reviewerName,
          reviewNote: flagData.note,
          sendNow: flagData.sendTiming === "now",
        }),
      });

      if (res.ok) {
        toast.success(flagData.sendTiming === "now" ? "Review requested" : "Added to review queue");
      } else {
        toast.error("Failed to request review");
      }
    }
  };

  const rating = feedback?.rating;

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-2">
        {/* Thumbs up/down */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRating("THUMBS_UP")}
            disabled={isSaving}
            className={`p-1.5 rounded transition-colors ${
              rating === "THUMBS_UP"
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Good response"
            aria-label="Mark response as helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleRating("THUMBS_DOWN")}
            disabled={isSaving}
            className={`p-1.5 rounded transition-colors ${
              rating === "THUMBS_DOWN"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Needs improvement"
            aria-label="Mark response as unhelpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Flag / Help buttons */}
        <button
          onClick={handleOpenFlag}
          disabled={isSaving}
          className={`p-1.5 rounded transition-colors ${
            feedback?.flaggedForReview
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title="Flag for attention"
          aria-label="Flag this response for review"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleOpenHelp}
          disabled={isSaving}
          className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Request help"
          aria-label="Request help from a reviewer"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>

        {/* Add comment button */}
        {!showCommentInput && (
          <button
            onClick={() => setShowCommentInput(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            {feedback?.comment ? "Edit comment" : "Add comment"}
          </button>
        )}

        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
      </div>

      {/* Comment input */}
      {showCommentInput && (
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowCommentInput(false);
                setComment(feedback?.comment || "");
              }
            }}
            placeholder="Add a comment about this response..."
            className="w-full p-2 text-xs border border-border rounded-md resize-none bg-background"
            rows={2}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCommentSubmit}
              disabled={!comment.trim() || isSaving}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowCommentInput(false);
                setComment(feedback?.comment || "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Show existing comment */}
      {!showCommentInput && feedback?.comment && (
        <div className="mt-1 text-xs text-muted-foreground italic">
          &ldquo;{feedback.comment}&rdquo;
        </div>
      )}

      {/* Flag/Review Modal */}
      <FlagReviewModal
        isOpen={showFlagModal}
        initialAction={initialFlagAction}
        onSubmit={handleFlagSubmit}
        onCancel={() => setShowFlagModal(false)}
        allowQueueing={true}
      />
    </div>
  );
}
