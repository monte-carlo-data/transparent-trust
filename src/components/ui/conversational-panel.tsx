"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Send, Eye } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

export type Message = {
  role: "assistant" | "user";
  content: string;
};

/** Textarea height presets */
export type TextareaSize = "sm" | "md" | "lg";

const TEXTAREA_SIZES: Record<TextareaSize, { min: number; max: number }> = {
  sm: { min: 44, max: 120 },   // ~1-4 lines (original)
  md: { min: 80, max: 160 },   // ~3-6 lines
  lg: { min: 120, max: 240 },  // ~5-10 lines
};

export type ConversationalPanelProps = {
  /** Chat messages to display */
  messages: Message[];
  /** Current input value */
  input: string;
  /** Input change handler */
  onInputChange: (value: string) => void;
  /** Send message handler */
  onSend: () => void;
  /** Whether AI is generating a response */
  isLoading: boolean;
  /** Loading indicator text (default: "Thinking...") */
  loadingText?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Error message to display */
  error?: string | null;
  /** Error dismiss handler */
  onErrorDismiss?: () => void;
  /** Optional header content */
  header?: ReactNode;
  /** Optional content between header and messages (e.g., warnings) */
  headerExtras?: ReactNode;
  /** Content to show after initial assistant message (e.g., template buttons) */
  postInitialContent?: ReactNode;
  /** Show post-initial content only on first message */
  showPostInitialOnFirstOnly?: boolean;
  /** System prompt for transparency modal */
  systemPrompt?: string;
  /** Custom title for system prompt modal */
  systemPromptTitle?: string;
  /** Show system prompt button in input area controls */
  showSystemPromptButton?: boolean;
  /** Additional controls to show in input area (left side) */
  inputControls?: ReactNode;
  /** Additional controls to show in input area (right side) */
  inputControlsRight?: ReactNode;
  /** Background color for input area */
  inputBackgroundColor?: string;
  /** Number of textarea rows */
  textareaRows?: number;
  /** Auto-resize textarea */
  autoResizeTextarea?: boolean;
  /** Textarea height preset - defaults to "sm" for backward compatibility */
  textareaSize?: TextareaSize;
};

// ============================================
// MARKDOWN COMPONENTS
// ============================================

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p style={{ margin: "0 0 8px 0" }}>{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li style={{ marginBottom: "4px" }}>{children}</li>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code
      style={{
        backgroundColor: "#e2e8f0",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "13px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      {children}
    </code>
  ),
};

// ============================================
// MESSAGE BUBBLE
// ============================================

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        marginBottom: "16px",
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "12px 16px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          backgroundColor: isUser ? "#6366f1" : "#f1f5f9",
          color: isUser ? "var(--card)" : "#334155",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
        ) : (
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ============================================
// SYSTEM PROMPT MODAL
// ============================================

type SystemPromptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  systemPrompt: string;
};

function SystemPromptModal({
  isOpen,
  onClose,
  title,
  systemPrompt,
}: SystemPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "700px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: "4px 8px",
              backgroundColor: "transparent",
              border: "none",
              fontSize: "20px",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            This is the system prompt guiding the AI. You can edit prompts in
            Admin → Settings → Prompts.
          </p>
          <pre
            style={{
              margin: 0,
              padding: "16px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
              lineHeight: "1.6",
              color: "#334155",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {systemPrompt}
          </pre>
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ConversationalPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  loadingText = "Thinking...",
  placeholder = "Type a message...",
  error,
  onErrorDismiss,
  header,
  headerExtras,
  postInitialContent,
  showPostInitialOnFirstOnly = true,
  systemPrompt,
  systemPromptTitle = "System Prompt",
  showSystemPromptButton = true,
  inputControls,
  inputControlsRight,
  inputBackgroundColor = "#fafafa",
  textareaRows = 1,
  autoResizeTextarea = true,
  textareaSize = "sm",
}: ConversationalPanelProps) {
  const { min: minHeight, max: maxHeight } = TEXTAREA_SIZES[textareaSize];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    if (!autoResizeTextarea) return;
    const target = e.target as HTMLTextAreaElement;
    target.style.height = `${minHeight}px`;
    target.style.height = Math.min(target.scrollHeight, maxHeight) + "px";
  };

  // Show post-initial content only when we have exactly one assistant message
  const shouldShowPostInitial =
    postInitialContent &&
    (!showPostInitialOnFirstOnly ||
      (messages.length === 1 && messages[0].role === "assistant"));

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--card)",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Optional Header */}
      {header}

      {/* Optional Header Extras (warnings, etc.) */}
      {headerExtras}

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          minHeight: 0,
        }}
      >
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {/* Post-initial content (e.g., template buttons) */}
        {shouldShowPostInitial && (
          <div style={{ marginTop: "8px", marginLeft: "8px" }}>
            {postInitialContent}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            <InlineLoader size="sm" />
            {loadingText}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ padding: "12px 24px" }}>
          <InlineError message={error} onDismiss={onErrorDismiss} />
        </div>
      )}

      {/* Input Area */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: inputBackgroundColor,
        }}
      >
        {/* Controls Row */}
        {(inputControls ||
          inputControlsRight ||
          (showSystemPromptButton && systemPrompt)) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {showSystemPromptButton && systemPrompt && (
                <button
                  onClick={() => setShowSystemPromptModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    backgroundColor: "var(--card)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  <Eye size={14} />
                  View Prompt
                </button>
              )}
              {inputControls}
            </div>
            {inputControlsRight}
          </div>
        )}

        {/* Input Row */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder={placeholder}
            disabled={isLoading}
            rows={textareaRows}
            style={{
              flex: 1,
              padding: "12px 16px",
              fontSize: "14px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              minHeight: `${minHeight}px`,
              maxHeight: `${maxHeight}px`,
            }}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              border: "none",
              backgroundColor:
                input.trim() && !isLoading ? "#6366f1" : "#e2e8f0",
              color: input.trim() && !isLoading ? "var(--card)" : "#94a3b8",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            {isLoading ? <InlineLoader size="sm" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* System Prompt Modal */}
      {systemPrompt && (
        <SystemPromptModal
          isOpen={showSystemPromptModal}
          onClose={() => setShowSystemPromptModal(false)}
          title={systemPromptTitle}
          systemPrompt={systemPrompt}
        />
      )}
    </div>
  );
}

