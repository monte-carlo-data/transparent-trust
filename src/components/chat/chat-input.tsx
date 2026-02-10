"use client";

import { useRef, useEffect, ReactNode } from "react";
import { Send, Globe } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SpeedToggle } from "@/components/speed-toggle";
import { cn } from "@/lib/utils";

/** Height presets for the textarea */
type TextareaSize = "sm" | "md" | "lg";

const TEXTAREA_SIZES: Record<TextareaSize, { min: number; max: number }> = {
  sm: { min: 80, max: 160 },   // ~3-6 lines
  md: { min: 120, max: 200 },  // ~5-8 lines
  lg: { min: 240, max: 360 },  // ~10-15 lines
};

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder?: string;
  quickMode?: boolean;
  onQuickModeChange?: (quickMode: boolean) => void;
  webSearch?: boolean;
  onWebSearchChange?: (webSearch: boolean) => void;
  /** Optional content to render on the left side of the bottom row */
  leftContent?: ReactNode;
  /** Optional content to render on the right side of the bottom row */
  rightContent?: ReactNode;
  /** Textarea height preset - defaults to "lg" */
  size?: TextareaSize;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder = "Type your message...",
  quickMode,
  onQuickModeChange,
  webSearch,
  onWebSearchChange,
  leftContent,
  rightContent,
  size = "lg",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { min: minHeight, max: maxHeight } = TEXTAREA_SIZES[size];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${minHeight}px`;
      textareaRef.current.style.height =
        Math.max(minHeight, Math.min(textareaRef.current.scrollHeight, maxHeight)) + "px";
    }
  }, [value, minHeight, maxHeight]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-border bg-background">
      {/* Input row */}
      <div className="flex gap-3 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className={cn(
            "flex-1 resize-none text-base leading-relaxed"
          )}
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label={isLoading ? "Sending message" : "Send message"}
        >
          {isLoading ? (
            <InlineLoader size="md" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      {/* Bottom controls row */}
      {(leftContent || rightContent || (onQuickModeChange && quickMode !== undefined) || (onWebSearchChange && webSearch !== undefined)) && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            {leftContent}
            {/* Web Search Toggle */}
            {onWebSearchChange && webSearch !== undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onWebSearchChange(!webSearch)}
                disabled={isLoading}
                title={webSearch
                  ? "Web Search enabled - searching the web for current info. Click to disable."
                  : "Web Search disabled - using knowledge base only. Click to enable for recent updates."
                }
                className={cn(
                  "h-8 px-2 gap-1.5",
                  webSearch
                    ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="h-4 w-4" />
                <span className="text-xs font-medium">Web Search {webSearch ? "On" : "Off"}</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {rightContent}
            {onQuickModeChange && quickMode !== undefined && (
              <SpeedToggle
                quickMode={quickMode}
                onChange={onQuickModeChange}
                disabled={isLoading}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
