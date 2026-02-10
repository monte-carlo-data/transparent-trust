"use client";

import type { SkillItemProps } from "@/types/knowledge-bar";

export function SkillItem({ skill, isSelected, onToggle }: SkillItemProps) {
  return (
    <label className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-3 w-3 rounded cursor-pointer"
      />
      <span className="text-xs truncate">{skill.title}</span>
    </label>
  );
}
