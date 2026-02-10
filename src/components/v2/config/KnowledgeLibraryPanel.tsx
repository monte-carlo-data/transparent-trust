"use client";

import { useState, useMemo } from "react";
import {
  BookOpen,
  FileText,
  Globe,
  ChevronDown,
  ChevronRight,
  Settings2,
  Check,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import type { Skill } from "@/types/skill";
import type { ReferenceUrl } from "@/types/referenceUrl";

/**
 * KnowledgeLibraryPanel - Shared component for knowledge selection
 *
 * Used by: Chat, Collateral, Projects, Contract Review (via KnowledgeSidebar)
 *
 * Features:
 * - Category-grouped skill selection
 * - Document and URL selection
 * - Skill source URL toggle
 * - Inline source customization
 */

export interface KnowledgeLibraryPanelProps {
  skills: Skill[];
  documents: { id: string; title: string; filename: string }[];
  urls: ReferenceUrl[];
  selectedPersonaName?: string;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCustomizeClick?: () => void; // Optional callback for page-level CTA
}

interface SkillsByCategory {
  category: string;
  skills: Skill[];
}

export function KnowledgeLibraryPanel({
  skills,
  documents,
  urls,
  selectedPersonaName,
  isExpanded,
  onExpandedChange,
  onCustomizeClick,
}: KnowledgeLibraryPanelProps) {
  const [isCustomizingSources, setIsCustomizingSources] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const {
    skillSelections,
    documentSelections,
    urlSelections,
    includeSkillSources,
    toggleSkill,
    toggleDocument,
    toggleUrl,
    selectAllSkills,
    selectNoSkills,
    selectAllDocuments,
    selectNoDocuments,
    selectAllUrls,
    selectNoUrls,
    setIncludeSkillSources,
  } = useSelectionStore();

  // Group skills by category
  const skillsByCategory = useMemo((): SkillsByCategory[] => {
    const categoryMap = new Map<string, Skill[]>();

    skills.forEach((skill) => {
      const category = skill.categories && skill.categories.length > 0
        ? skill.categories[0]
        : "Uncategorized";

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(skill);
    });

    // Sort categories alphabetically, but put "Uncategorized" at the end
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
      const selected = categorySkills.filter(s => skillSelections.get(s.id)).length;
      counts.set(category, { selected, total: categorySkills.length });
    });

    return counts;
  }, [skillsByCategory, skillSelections]);

  // Count total selected
  const selectedSkillCount = useMemo(
    () => Array.from(skillSelections.values()).filter(Boolean).length,
    [skillSelections]
  );
  const selectedDocCount = useMemo(
    () => Array.from(documentSelections.values()).filter(Boolean).length,
    [documentSelections]
  );
  const selectedUrlCount = useMemo(
    () => Array.from(urlSelections.values()).filter(Boolean).length,
    [urlSelections]
  );

  // Count source URLs from selected skills
  const skillSourceUrlCount = useMemo(() => {
    const selectedSkillIds = Array.from(skillSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    let count = 0;
    skills
      .filter((skill) => selectedSkillIds.includes(skill.id))
      .forEach((skill) => {
        count += skill.sourceUrls?.length || 0;
      });
    return count;
  }, [skills, skillSelections]);

  // Additional sources (docs + standalone URLs that user can customize)
  const additionalSourceCount = selectedDocCount + selectedUrlCount;

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

  // Toggle all skills in a category
  const toggleCategorySkills = (categorySkills: Skill[], selectAll: boolean) => {
    categorySkills.forEach((skill) => {
      const isSelected = skillSelections.get(skill.id) || false;
      if (selectAll && !isSelected) {
        toggleSkill(skill.id);
      } else if (!selectAll && isSelected) {
        toggleSkill(skill.id);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <button
          onClick={() => onExpandedChange(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge Library
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
          {/* Persona indicator with customize hint */}
          <div className="space-y-0.5">
            {selectedPersonaName ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Using: </span>
                <span className="font-medium">{selectedPersonaName}</span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No persona selected
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {selectedPersonaName ? "Auto-selected by persona. " : "All skills available. "}
              <button
                onClick={onCustomizeClick}
                className="text-primary hover:underline"
              >
                Customize
              </button>
            </div>
          </div>

          {/* Skills header with All/None */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <BookOpen className="h-3.5 w-3.5" />
              Skills ({selectedSkillCount}/{skills.length})
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                onClick={() => selectAllSkills(skills.map((s) => s.id))}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={selectNoSkills}
                className="text-primary hover:underline"
              >
                None
              </button>
            </div>
          </div>

          {/* Category-grouped skills */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {skillsByCategory.map(({ category, skills: categorySkills }) => {
              const isCollapsed = collapsedCategories.has(category);
              const counts = selectedCountByCategory.get(category);
              const allSelected = counts && counts.selected === counts.total;
              const someSelected = counts && counts.selected > 0 && counts.selected < counts.total;

              return (
                <div key={category} className="space-y-0.5">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50 transition-colors group"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium flex-1 text-left">
                      {category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {counts?.selected}/{counts?.total}
                    </span>
                    {/* Category-level toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategorySkills(categorySkills, !allSelected);
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
                      {categorySkills.map((skill) => (
                        <label
                          key={skill.id}
                          className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={skillSelections.get(skill.id) || false}
                            onChange={() => toggleSkill(skill.id)}
                            className="h-3 w-3 rounded cursor-pointer"
                          />
                          <span className="text-xs truncate">{skill.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {skills.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">
                No skills available
              </p>
            )}
          </div>

          {/* Sources summary */}
          <div className="pt-2 border-t space-y-2">
            {!isCustomizingSources ? (
              <div className="space-y-2">
                {/* Skill source URLs toggle */}
                {skillSourceUrlCount > 0 && (
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2 text-xs">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Include skill source URLs ({skillSourceUrlCount})
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeSkillSources}
                      onChange={(e) => setIncludeSkillSources(e.target.checked)}
                      className="h-3.5 w-3.5 rounded cursor-pointer"
                    />
                  </label>
                )}

                {/* Additional sources summary */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span>
                      {additionalSourceCount > 0 ? (
                        <>
                          {additionalSourceCount} additional source{additionalSourceCount !== 1 ? "s" : ""}
                        </>
                      ) : (
                        "No additional sources"
                      )}
                    </span>
                  </div>
                  {(documents.length > 0 || urls.length > 0) && (
                    <button
                      onClick={() => setIsCustomizingSources(true)}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Settings2 className="h-3 w-3" />
                      Customize
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <SourcesCustomizeView
                documents={documents}
                urls={urls}
                documentSelections={documentSelections}
                urlSelections={urlSelections}
                onToggleDocument={toggleDocument}
                onToggleUrl={toggleUrl}
                onSelectAllDocuments={() => selectAllDocuments(documents.map((d) => d.id))}
                onSelectNoDocuments={selectNoDocuments}
                onSelectAllUrls={() => selectAllUrls(urls.map((u) => u.id))}
                onSelectNoUrls={selectNoUrls}
                onDone={() => setIsCustomizingSources(false)}
              />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Sources Customize View (for docs and URLs)
function SourcesCustomizeView({
  documents,
  urls,
  documentSelections,
  urlSelections,
  onToggleDocument,
  onToggleUrl,
  onSelectAllDocuments,
  onSelectNoDocuments,
  onSelectAllUrls,
  onSelectNoUrls,
  onDone,
}: {
  documents: { id: string; title: string; filename: string }[];
  urls: ReferenceUrl[];
  documentSelections: Map<string, boolean>;
  urlSelections: Map<string, boolean>;
  onToggleDocument: (id: string) => void;
  onToggleUrl: (id: string) => void;
  onSelectAllDocuments: () => void;
  onSelectNoDocuments: () => void;
  onSelectAllUrls: () => void;
  onSelectNoUrls: () => void;
  onDone: () => void;
}) {
  const [urlSearch, setUrlSearch] = useState("");

  const filteredUrls = useMemo(
    () =>
      urls.filter(
        (u) =>
          u.title?.toLowerCase().includes(urlSearch.toLowerCase()) ||
          u.url.toLowerCase().includes(urlSearch.toLowerCase())
      ),
    [urls, urlSearch]
  );

  const selectedDocCount = Array.from(documentSelections.values()).filter(Boolean).length;
  const selectedUrlCount = Array.from(urlSelections.values()).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Done button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onDone} className="h-6 text-xs">
          <Check className="h-3 w-3 mr-1" />
          Done
        </Button>
      </div>

      {/* Documents Section */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <FileText className="h-3.5 w-3.5" />
              Documents ({selectedDocCount}/{documents.length})
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <button onClick={onSelectAllDocuments} className="text-primary hover:underline">
                All
              </button>
              <span className="text-muted-foreground">|</span>
              <button onClick={onSelectNoDocuments} className="text-primary hover:underline">
                None
              </button>
            </div>
          </div>

          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={documentSelections.get(doc.id) || false}
                  onChange={() => onToggleDocument(doc.id)}
                  className="h-3 w-3 rounded cursor-pointer"
                />
                <span className="text-xs truncate">{doc.title || doc.filename}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* URLs Section */}
      {urls.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Globe className="h-3.5 w-3.5" />
              URLs ({selectedUrlCount}/{urls.length})
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <button onClick={onSelectAllUrls} className="text-primary hover:underline">
                All
              </button>
              <span className="text-muted-foreground">|</span>
              <button onClick={onSelectNoUrls} className="text-primary hover:underline">
                None
              </button>
            </div>
          </div>

          {urls.length > 5 && (
            <input
              type="text"
              placeholder="Search URLs..."
              value={urlSearch}
              onChange={(e) => setUrlSearch(e.target.value)}
              className="w-full px-2 py-1 text-xs border rounded"
            />
          )}

          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {filteredUrls.map((url) => (
              <label
                key={url.id}
                className="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={urlSelections.get(url.id) || false}
                  onChange={() => onToggleUrl(url.id)}
                  className="h-3 w-3 rounded cursor-pointer"
                />
                <span className="text-xs truncate">
                  {url.title || url.url.split("/").pop() || url.url}
                </span>
              </label>
            ))}
            {filteredUrls.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">
                {urlSearch ? "No matching URLs" : "No URLs available"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
