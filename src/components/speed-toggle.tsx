"use client";

import { Zap, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpeedToggleProps {
  quickMode: boolean;
  onChange: (quickMode: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle between fast (Haiku) and quality (Sonnet) modes for LLM responses.
 * - Fast mode: 2-5 seconds, good for quick Q&A
 * - Quality mode: 10-30 seconds, better for complex analysis
 */
export function SpeedToggle({
  quickMode,
  onChange,
  disabled = false,
  className,
}: SpeedToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(!quickMode)}
      disabled={disabled}
      title={quickMode
        ? "Fast Mode (Haiku) - 2-5s responses. Click for quality mode."
        : "Quality Mode (Sonnet) - 10-30s responses. Click for fast mode."
      }
      className={cn(
        "h-8 px-2 gap-1.5",
        quickMode
          ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {quickMode ? (
        <>
          <Zap className="h-4 w-4" />
          <span className="text-xs font-medium">Fast</span>
        </>
      ) : (
        <>
          <Gauge className="h-4 w-4" />
          <span className="text-xs font-medium">Quality</span>
        </>
      )}
    </Button>
  );
}
