"use client";

import type { TypedStagedSource } from "@/types/v2";

interface SourceItemProps {
  source: TypedStagedSource;
  isSelected: boolean;
  onToggle: () => void;
}

export function SourceItem({ source, isSelected, onToggle }: SourceItemProps) {
  return (
    <label className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-3 w-3 rounded cursor-pointer"
      />
      <span className="text-xs truncate" title={source.title}>
        {source.title}
      </span>
    </label>
  );
}
