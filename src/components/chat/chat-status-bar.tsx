"use client";

import { useMemo } from "react";
import { AlertCircle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatStatusBarProps {
  selectedSkillCount: number;
  selectedDocCount: number;
  selectedUrlCount: number;
  modelSpeed: "fast" | "quality";
  isLoading?: boolean;
  onCustomize?: () => void;
  onPreviewPrompt?: () => void;
  selectedCustomerName?: string | null;
}

export function ChatStatusBar({
  selectedSkillCount,
  selectedDocCount,
  selectedUrlCount,
  modelSpeed,
  isLoading,
  onCustomize,
  onPreviewPrompt,
  selectedCustomerName,
}: ChatStatusBarProps) {
  // Estimate tokens based on model speed
  const maxTokens = modelSpeed === "fast" ? 80000 : 200000;

  // Simple token estimation - compute directly without useEffect
  const estimatedTokens = useMemo(() => {
    // Estimate: ~100 tokens per skill, ~500 per doc, ~300 per URL
    const skillTokens = selectedSkillCount * 100;
    const docTokens = selectedDocCount * 500;
    const urlTokens = selectedUrlCount * 300;
    const overheadTokens = 500; // System prompt, etc.

    return skillTokens + docTokens + urlTokens + overheadTokens;
  }, [selectedSkillCount, selectedDocCount, selectedUrlCount]);

  // Calculate utilization directly
  const utilizationPercent = useMemo(() => {
    return Math.round((estimatedTokens / maxTokens) * 100);
  }, [estimatedTokens, maxTokens]);

  // Determine status color based on utilization
  const getStatusColor = (percent: number | null) => {
    if (!percent) return "text-muted-foreground";
    if (percent >= 90) return "text-red-600";
    if (percent >= 70) return "text-amber-600";
    return "text-green-600";
  };

  const getStatusBg = (percent: number | null) => {
    if (!percent) return "bg-muted/30";
    if (percent >= 90) return "bg-red-50 dark:bg-red-950/20";
    if (percent >= 70) return "bg-amber-50 dark:bg-amber-950/20";
    return "bg-green-50 dark:bg-green-950/20";
  };

  const getStatusIcon = (percent: number | null) => {
    if (!percent) return null;
    if (percent >= 90)
      return <AlertCircle className="h-4 w-4" />;
    if (percent >= 70)
      return <AlertCircle className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const totalSelected = selectedSkillCount + selectedDocCount + selectedUrlCount;
  const contextSummary = [
    selectedSkillCount > 0 && `${selectedSkillCount} skill${selectedSkillCount !== 1 ? "s" : ""}`,
    selectedDocCount > 0 && `${selectedDocCount} doc${selectedDocCount !== 1 ? "s" : ""}`,
    selectedUrlCount > 0 && `${selectedUrlCount} URL${selectedUrlCount !== 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4 py-2.5 border-t border-b transition-colors",
      getStatusBg(utilizationPercent)
    )}>
      {/* Left: Context Summary */}
      <div className="flex items-center gap-4 text-sm flex-1 min-w-0">
        <span className="text-muted-foreground font-medium">Context:</span>
        {totalSelected > 0 ? (
          <span className="text-foreground">{contextSummary}</span>
        ) : (
          <span className="text-muted-foreground italic">No context selected</span>
        )}

        {/* Customer indicator */}
        {selectedCustomerName && (
          <>
            <div className="w-px h-4 bg-border" />
            <span className="text-muted-foreground">Customer:</span>
            <span className="text-foreground font-medium">{selectedCustomerName}</span>
          </>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Token usage */}
        <div className={cn(
          "flex items-center gap-2",
          getStatusColor(utilizationPercent)
        )}>
          {getStatusIcon(utilizationPercent)}
          <span className="whitespace-nowrap">
            {estimatedTokens
              ? `${(estimatedTokens / 1000).toFixed(1)}k / ${(maxTokens / 1000).toFixed(0)}k (${utilizationPercent}%)`
              : "Calculating..."}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onCustomize && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCustomize}
            disabled={isLoading}
            className="h-7 px-2 text-xs"
          >
            Customize
          </Button>
        )}

        {onPreviewPrompt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviewPrompt}
            disabled={isLoading}
            className="h-7 px-2 text-xs gap-1"
          >
            <Zap className="h-3 w-3" />
            Preview Prompt
          </Button>
        )}
      </div>
    </div>
  );
}
