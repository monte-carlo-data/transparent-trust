"use client";

import React from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { SkillItem } from "./SkillItem";
import type { CategoryGroupProps } from "@/types/knowledge-bar";

export function CategoryGroup({
  category,
  skills,
  isCollapsed,
  onToggleCollapse,
  selectedCount,
  totalCount,
  onCategoryToggle,
}: CategoryGroupProps) {
  const allSelected = selectedCount === totalCount;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  const { toggleSkill, skillSelections } = useSelectionStore();

  return (
    <div className="space-y-0.5">
      {/* Category header */}
      <button
        onClick={() => onToggleCollapse()}
        className="w-full flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50 transition-colors group"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-xs font-medium flex-1 text-left">{category}</span>
        <span className="text-[10px] text-muted-foreground">
          {selectedCount}/{totalCount}
        </span>
        {/* Category-level toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCategoryToggle(!allSelected);
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
          {someSelected && <span className="w-1.5 h-0.5 bg-primary-foreground" />}
        </button>
      </button>

      {/* Skills in category */}
      {!isCollapsed && (
        <div className="ml-4 space-y-0.5">
          {skills.map((skill) => (
            <SkillItem
              key={skill.id}
              skill={skill}
              isSelected={skillSelections.get(skill.id) || false}
              onToggle={() => toggleSkill(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
