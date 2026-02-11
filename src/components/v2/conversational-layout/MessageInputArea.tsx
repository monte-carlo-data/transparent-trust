"use client";

/**
 * MessageInputArea - Input controls with speed/search toggles
 *
 * Handles message input, send button, and settings toggles.
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineLoader } from "@/components/ui/loading";
import { Send } from "lucide-react";

export interface MessageInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
  modelSpeed: "fast" | "quality";
  onModelSpeedChange: (speed: "fast" | "quality") => void;
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
}

export function MessageInputArea({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Type your message...",
  modelSpeed,
  onModelSpeedChange,
  webSearchEnabled,
  onWebSearchChange,
}: MessageInputAreaProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-border bg-background p-4 space-y-3">
      {/* Settings Toggles */}
      <div className="flex items-center gap-2">
        {/* Speed Toggle */}
        <Button
          size="sm"
          variant={modelSpeed === "fast" ? "default" : "outline"}
          onClick={() => onModelSpeedChange(modelSpeed === "fast" ? "quality" : "fast")}
          className="gap-2 h-8"
          title="Response Speed: Fast (Haiku) or Quality (Sonnet)"
        >
          <span className="text-xs">Speed: {modelSpeed === "fast" ? "Fast" : "Quality"}</span>
        </Button>

        {/* Web Search Toggle */}
        <Button
          size="sm"
          variant={webSearchEnabled ? "default" : "outline"}
          onClick={() => onWebSearchChange(!webSearchEnabled)}
          className="gap-2 h-8"
          title="Enable web search for real-time information"
        >
          <span className="text-xs">{webSearchEnabled ? "Search On" : "Local Only"}</span>
        </Button>
      </div>

      {/* Input Area */}
      <div className="flex items-end gap-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[52px] resize-none"
          rows={2}
        />
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label={disabled ? "Sending message" : "Send message"}
        >
          {disabled ? (
            <InlineLoader size="sm" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
