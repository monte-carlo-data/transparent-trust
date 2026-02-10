"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type FeedbackRating = "THUMBS_UP" | "THUMBS_DOWN" | null;

interface ChatFeedbackModalProps {
  isOpen: boolean;
  sessionId: string | null;
  messageCount: number;
  onClose: () => void;
  onSubmitAndNewChat: () => void;
}

export function ChatFeedbackModal({
  isOpen,
  sessionId,
  messageCount,
  onClose,
  onSubmitAndNewChat,
}: ChatFeedbackModalProps) {
  const [rating, setRating] = useState<FeedbackRating>(null);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const saveFeedback = async (additionalData?: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: `session-${sessionId || "unsaved"}`,
          sessionId: sessionId || "no-session",
          rating,
          comment: comment.trim() || null,
          ...additionalData,
        }),
      });

      if (!res.ok) throw new Error("Failed to save feedback");
      return true;
    } catch {
      toast.error("Failed to save feedback");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!rating && !comment.trim()) {
      // No feedback given, just close
      onSubmitAndNewChat();
      return;
    }

    const success = await saveFeedback();
    if (success) {
      toast.success("Thanks for the feedback!");
      onSubmitAndNewChat();
    }
  };

  const handleSkip = () => {
    onSubmitAndNewChat();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">End Chat</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-5">
            <p className="text-sm text-muted-foreground">
              How was this conversation? ({messageCount} messages)
            </p>

            {/* Rating buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setRating(rating === "THUMBS_UP" ? null : "THUMBS_UP")}
                disabled={isSaving}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                  rating === "THUMBS_UP"
                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "border-border hover:border-green-300 hover:bg-green-50/50"
                }`}
              >
                <ThumbsUp className="h-5 w-5" />
                <span className="font-medium">Good</span>
              </button>
              <button
                onClick={() => setRating(rating === "THUMBS_DOWN" ? null : "THUMBS_DOWN")}
                disabled={isSaving}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                  rating === "THUMBS_DOWN"
                    ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "border-border hover:border-red-300 hover:bg-red-50/50"
                }`}
              >
                <ThumbsDown className="h-5 w-5" />
                <span className="font-medium">Needs work</span>
              </button>
            </div>

            {/* Comment */}
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any additional feedback? (optional)"
                className="w-full p-3 text-sm border border-border rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isSaving}
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Submit & New Chat"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
