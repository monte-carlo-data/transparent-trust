"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSelectionStore } from "@/stores/selection-store";
import { CategoryGroup } from "./CategoryGroup";
import type { LibrarySectionProps, KnowledgeBarItem } from "@/types/knowledge-bar";

export function LibrarySection({
  config,
  isEnabled,
  isExpanded,
  onToggleEnabled,
  onToggleExpanded,
  skills,
  documents,
}: LibrarySectionProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  const { skillSelections, toggleSkill, documentSelections, toggleDocument } =
    useSelectionStore();

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const categoryMap = new Map<string, KnowledgeBarItem[]>();

    skills.forEach((skill) => {
      const category =
        skill.categories && skill.categories.length > 0
          ? skill.categories[0]
          : "Uncategorized";

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(skill);
    });

    const sortedCategories = Array.from(categoryMap.entries())
      .sort(([a], [b]) => {
        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        return a.localeCompare(b);
      });

    return sortedCategories.map(([category, categorySkills]) => ({
      category,
      skills: categorySkills.sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [skills]);

  // Count selected items per category
  const selectedCountByCategory = useMemo(() => {
    const counts = new Map<string, { selected: number; total: number }>();

    skillsByCategory.forEach(({ category, skills: categorySkills }) => {
      const selected = categorySkills.filter((s) =>
        skillSelections.get(s.id)
      ).length;
      counts.set(category, { selected, total: categorySkills.length });
    });

    return counts;
  }, [skillsByCategory, skillSelections]);

  const selectedSkillCount = useMemo(
    () => Array.from(skillSelections.values()).filter(Boolean).length,
    [skillSelections]
  );

  const selectedDocCount = useMemo(
    () =>
      documents.filter((d) => documentSelections.get(d.id)).length,
    [documents, documentSelections]
  );

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleCategorySkills = (categorySkills: KnowledgeBarItem[], selectAll: boolean) => {
    categorySkills.forEach((skill) => {
      const isSelected = skillSelections.get(skill.id) || false;
      if (selectAll && !isSelected) {
        toggleSkill(skill.id);
      } else if (!selectAll && isSelected) {
        toggleSkill(skill.id);
      }
    });
  };

  // Minimized view when disabled
  if (!isEnabled) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: `var(--color-${config.accentColor})` }}>
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{config.name}</span>
              {selectedSkillCount + selectedDocCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedSkillCount + selectedDocCount}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleEnabled}
              className="h-6 text-xs"
            >
              Enable
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Expanded view
  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <button
          onClick={() => onToggleExpanded()}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {config.name} ({selectedSkillCount + selectedDocCount}/
            {skills.length + documents.length})
          </CardTitle>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="py-2 px-3 space-y-3">
          {/* Skills Section */}
          {skills.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">
                  Skills ({selectedSkillCount}/{skills.length})
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={() =>
                      skillsByCategory.forEach(({ skills: cats }) =>
                        toggleCategorySkills(cats, true)
                      )
                    }
                    className="text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() =>
                      skillsByCategory.forEach(({ skills: cats }) =>
                        toggleCategorySkills(cats, false)
                      )
                    }
                    className="text-primary hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {skillsByCategory.map(({ category, skills: categorySkills }) => (
                  <CategoryGroup
                    key={category}
                    category={category}
                    skills={categorySkills}
                    isCollapsed={collapsedCategories.has(category)}
                    onToggleCollapse={() => toggleCategory(category)}
                    selectedCount={
                      selectedCountByCategory.get(category)?.selected || 0
                    }
                    totalCount={
                      selectedCountByCategory.get(category)?.total || 0
                    }
                    onCategoryToggle={(selectAll) =>
                      toggleCategorySkills(categorySkills, selectAll)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {documents.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">
                  Documents ({selectedDocCount}/{documents.length})
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={() =>
                      documents.forEach((d) => {
                        if (!documentSelections.get(d.id)) {
                          toggleDocument(d.id);
                        }
                      })
                    }
                    className="text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() =>
                      documents.forEach((d) => {
                        if (documentSelections.get(d.id)) {
                          toggleDocument(d.id);
                        }
                      })
                    }
                    className="text-primary hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={documentSelections.get(doc.id) || false}
                      onChange={() => toggleDocument(doc.id)}
                      className="h-3 w-3 rounded cursor-pointer"
                    />
                    <span className="text-xs truncate">
                      {doc.title || "Document"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Disable button */}
          <div className="border-t pt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleEnabled}
              className="h-6 text-xs"
            >
              Disable
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
