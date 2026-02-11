"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { SourceItem } from "./SourceItem";
import { getSourceTypeConfig } from "@/lib/source-type-config";
import type { TypedStagedSource, SourceType } from "@/types/v2";

interface SourceTypeGroupProps {
  sourceType: SourceType;
  sources: TypedStagedSource[];
}

export function SourceTypeGroup({ sourceType, sources }: SourceTypeGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const config = getSourceTypeConfig(sourceType);
  const Icon = config.icon;

  const { sourceSelections, toggleSource, selectAllSources, selectNoSources } =
    useSelectionStore();

  // Calculate selection counts
  const selectedCount = sources.filter(
    (s) => sourceSelections.get(s.id) || false
  ).length;
  const totalCount = sources.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleGroupToggle = (selectAll: boolean) => {
    const sourceIds = sources.map((s) => s.id);
    if (selectAll) {
      // Get current selected sources and add these
      const currentSelected = Array.from(sourceSelections.entries())
        .filter(([, selected]) => selected)
        .map(([id]) => id);
      const newSelected = [...new Set([...currentSelected, ...sourceIds])];
      selectAllSources(newSelected);
    } else {
      // Remove these sources from selection
      const currentSelected = Array.from(sourceSelections.entries())
        .filter(([, selected]) => selected)
        .map(([id]) => id);
      const newSelected = currentSelected.filter(
        (id) => !sourceIds.includes(id)
      );
      if (newSelected.length === 0) {
        selectNoSources();
      } else {
        selectAllSources(newSelected);
      }
    }
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {/* Source type header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50 transition-colors group"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
        <Icon className={cn("h-3 w-3", config.colorClass)} />
        <span className="text-xs font-medium flex-1 text-left">
          {config.labelPlural}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {selectedCount}/{totalCount}
        </span>
        {/* Group-level toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleGroupToggle(!allSelected);
          }}
          className={cn(
            "h-3 w-3 rounded border text-[8px] flex items-center justify-center",
            allSelected
              ? "bg-primary border-primary text-primary-foreground"
              : someSelected
                ? "bg-primary/50 border-primary"
                : "border-muted-foreground/50"
          )}
        >
          {allSelected && <Check className="h-2 w-2" />}
          {someSelected && (
            <span className="w-1.5 h-0.5 bg-primary-foreground" />
          )}
        </button>
      </button>

      {/* Sources in group */}
      {!isCollapsed && (
        <div className="ml-4 space-y-0.5">
          {sources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              isSelected={sourceSelections.get(source.id) || false}
              onToggle={() => toggleSource(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
