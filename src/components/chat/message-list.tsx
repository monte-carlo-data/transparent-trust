"use client";

import { useRef, useEffect, useState } from "react";
import { User, Bot, Eye, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, HelpCircle, XCircle, Globe, ExternalLink, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/types/v2/chat";
import { MessageFeedback } from "./message-feedback";

// Confidence badge styling helper
function getConfidenceBadge(confidence: string | undefined) {
  if (!confidence) return null;
  const conf = confidence.toLowerCase();
  if (conf.includes("high")) {
    return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "High" };
  } else if (conf.includes("medium")) {
    return { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Medium" };
  } else if (conf.includes("low")) {
    return { icon: HelpCircle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", label: "Low" };
  } else if (conf.includes("unable")) {
    return { icon: XCircle, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", label: "Unable" };
  }
  return { icon: HelpCircle, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: confidence };
}

// Inline expandable transparency section for message footer
function MessageTransparencySection({
  message,
  onViewFullPrompt,
  onRequestAddToKnowledge,
  onRequestKnowledge,
}: {
  message: ChatMessage;
  onViewFullPrompt: () => void;
  onRequestAddToKnowledge?: (urls: { url: string; title: string }[]) => void;
  onRequestKnowledge?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const confidenceBadge = getConfidenceBadge(message.confidence);
  // Use notes (new format) or fall back to reasoning (old format)
  const notesText = message.notes || message.reasoning || null;
  const hasWebSources = message.webSearchSources && message.webSearchSources.length > 0;

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {confidenceBadge ? (
          <>
            <confidenceBadge.icon className={`h-3.5 w-3.5 ${confidenceBadge.color}`} />
            <span className="font-medium">Confidence:</span>
            <span className={`font-medium ${confidenceBadge.color}`}>
              {confidenceBadge.label}
            </span>
          </>
        ) : (
          <>
            <Eye className="h-3 w-3" />
            <span>Transparency</span>
          </>
        )}
        {hasWebSources && (
          <span className="flex items-center gap-1 text-blue-600">
            <Globe className="h-3 w-3" />
            <span className="text-[10px]">{message.webSearchSources!.length}</span>
          </span>
        )}
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 ml-0.5" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-0.5" />
        )}
      </Button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="mt-3 rounded-lg border bg-background/50 overflow-hidden max-h-[60vh] overflow-y-auto">
          {/* Confidence header section */}
          {confidenceBadge && (
            <div className={`px-4 py-2.5 ${confidenceBadge.bg} border-b ${confidenceBadge.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <confidenceBadge.icon className={`h-5 w-5 ${confidenceBadge.color}`} />
                  <span className={`text-sm font-semibold ${confidenceBadge.color}`}>
                    {confidenceBadge.label} Confidence
                  </span>
                </div>
                {/* Show request knowledge button for low/medium/unable confidence */}
                {onRequestKnowledge && ["low", "medium", "unable"].some(level =>
                  message.confidence?.toLowerCase().includes(level)
                ) && (
                  <button
                    onClick={onRequestKnowledge}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
                    title="Request to add this knowledge to the knowledge base"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>Request Knowledge</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes section */}
          {notesText && (
            <div className="px-4 py-3 border-b">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {notesText}
              </p>
            </div>
          )}

          {/* Web search sources section */}
          {hasWebSources && (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">
                    Web Search Sources ({message.webSearchSources!.length})
                  </span>
                </div>
                {onRequestAddToKnowledge && (
                  <button
                    onClick={() => {
                      const urls = message.webSearchSources!.map(s => ({
                        url: s.url,
                        title: s.title || s.url,
                      }));
                      onRequestAddToKnowledge(urls);
                    }}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded transition-colors"
                    title="Request to add these sources to the knowledge base"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>Add to Knowledge</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {message.webSearchSources!.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:bg-muted/50 rounded-md p-2 -mx-2 group transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground group-hover:text-blue-600">
                          {source.title || source.url}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {source.url}
                        </p>
                        {source.citedText && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            &quot;{source.citedText}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* View full prompt action */}
          <button
            onClick={onViewFullPrompt}
            className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
          >
            <Eye className="h-4 w-4" />
            View full prompt
          </button>
        </div>
      )}
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  sessionId?: string | null;
  onViewTransparency?: (message: ChatMessage) => void;
  onFeedbackChange?: (messageId: string, feedback: ChatMessage["feedback"]) => void;
  onRequestAddToKnowledge?: (urls: { url: string; title: string }[]) => void;
  onRequestKnowledge?: () => void;
}

export function MessageList({ messages, sessionId, onViewTransparency, onFeedbackChange, onRequestAddToKnowledge, onRequestKnowledge }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Bot className="h-12 w-12 mx-auto opacity-50" />
          <p>Start a conversation</p>
          <p className="text-sm">
            Select knowledge sources from the sidebar, then ask a question
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          sessionId={sessionId}
          onViewTransparency={onViewTransparency}
          onFeedbackChange={onFeedbackChange}
          onRequestAddToKnowledge={onRequestAddToKnowledge}
          onRequestKnowledge={onRequestKnowledge}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  sessionId?: string | null;
  onViewTransparency?: (message: ChatMessage) => void;
  onFeedbackChange?: (messageId: string, feedback: ChatMessage["feedback"]) => void;
  onRequestAddToKnowledge?: (urls: { url: string; title: string }[]) => void;
  onRequestKnowledge?: () => void;
}

function MessageBubble({ message, sessionId, onViewTransparency, onFeedbackChange, onRequestAddToKnowledge, onRequestKnowledge }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className={cn(
          "text-sm leading-relaxed",
          !isUser && "[&>p]:my-3 [&>ul]:my-3 [&>ol]:my-3 [&_li]:my-1 [&>h1]:mt-5 [&>h1]:mb-2 [&>h1]:text-base [&>h1]:font-semibold [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:mt-4 [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-medium [&_strong]:font-semibold [&>p:has(strong:first-child)]:mt-4"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Transparency section for assistant messages */}
        {!isUser && onViewTransparency && (
          <MessageTransparencySection
            message={message}
            onViewFullPrompt={() => onViewTransparency(message)}
            onRequestAddToKnowledge={onRequestAddToKnowledge}
            onRequestKnowledge={onRequestKnowledge}
          />
        )}

        {/* Knowledge sources used (shown even without transparency metadata) */}
        {!isUser && !message.confidence && ((message.skillsUsed?.length ?? 0) > 0 || (message.documentsUsed?.length ?? 0) > 0 || (message.urlsUsed?.length ?? 0) > 0 || (message.webSearchSources?.length ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.skillsUsed?.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {skill.title}
              </span>
            ))}
            {message.documentsUsed?.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                {doc.title}
              </span>
            ))}
            {message.urlsUsed?.map((url) => (
              <span
                key={url.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
              >
                {url.title}
              </span>
            ))}
            {(message.webSearchSources?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                <Globe className="h-3 w-3" />
                Web Search ({message.webSearchSources?.length} source{message.webSearchSources?.length === 1 ? "" : "s"})
              </span>
            )}
          </div>
        )}

        {/* Feedback for assistant messages */}
        {!isUser && onFeedbackChange && (
          <MessageFeedback
            messageId={message.id}
            sessionId={sessionId || null}
            feedback={message.feedback}
            onFeedbackChange={(feedback) => onFeedbackChange(message.id, feedback)}
          />
        )}
      </div>
    </div>
  );
}
