"use client";

/**
 * MessageBubble - Individual message rendering with user/bot avatars
 *
 * Handles message display, transparency button, and feedback.
 */

import { Button } from "@/components/ui/button";
import { Bot, User, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MessageFeedback } from "@/components/chat/message-feedback";
import type { Message } from "./types";

export interface MessageBubbleProps {
  message: Message;
  sessionId: string | null;
  onViewTransparency: (messageId: string) => void;
  onFeedbackChange: () => void;
}

export function MessageBubble({
  message,
  sessionId,
  onViewTransparency,
  onFeedbackChange,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasTransparency = Boolean(message.transparency);

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {/* Transparency Button (assistant messages only) */}
        {!isUser && (
          <div className="flex items-center justify-end mb-2">
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${!hasTransparency ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => {
                if (!hasTransparency) return;
                onViewTransparency(message.id);
              }}
              disabled={!hasTransparency}
              title={
                hasTransparency
                  ? "View transparency"
                  : "Transparency not available for this message"
              }
              aria-label={
                hasTransparency
                  ? "View response transparency details"
                  : "Transparency not available"
              }
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Message Text */}
        <div className="text-sm leading-relaxed">
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Feedback (assistant messages only) */}
        {!isUser && (
          <MessageFeedback
            messageId={message.id}
            sessionId={sessionId}
            feedback={message.feedback}
            onFeedbackChange={onFeedbackChange}
          />
        )}
      </div>
    </div>
  );
}
