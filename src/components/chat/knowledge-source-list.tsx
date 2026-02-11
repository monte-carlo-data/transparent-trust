"use client";

import { useState, useMemo } from "react";
import { Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Threshold for showing search input
const SEARCH_THRESHOLD = 10;

interface KnowledgeSourceListProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; label: string; tooltip?: string }>;
  selections: Map<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectNone: () => void;
  emptyMessage?: string;
  compact?: boolean;
}

export function KnowledgeSourceList({
  title,
  icon,
  items,
  selections,
  onToggle,
  onSelectAll,
  onSelectNone,
  emptyMessage = "No items available",
  compact = false,
}: KnowledgeSourceListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCount = Array.from(selections.values()).filter(Boolean).length;
  const showSearch = items.length >= SEARCH_THRESHOLD;

  // Filter and sort items: selected first, then filtered by search
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // Filter by search query
    const filtered = query
      ? items.filter((item) => item.label.toLowerCase().includes(query))
      : items;

    // Sort: selected items first
    return [...filtered].sort((a, b) => {
      const aSelected = selections.get(a.id) || false;
      const bSelected = selections.get(b.id) || false;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [items, selections, searchQuery]);

  // Compact mode renders without Card wrapper for embedding in other containers
  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {icon}
            {title}
            <span>({selectedCount}/{items.length})</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-1"
              onClick={() => onSelectAll(items.map((item) => item.id))}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-1"
              onClick={onSelectNone}
            >
              None
            </Button>
          </div>
        </div>

        {/* Search input for compact mode */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full h-6 pl-6 pr-6 text-xs border border-input rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filteredItems.map((item) => (
            <SelectableItem
              key={item.id}
              label={item.label}
              tooltip={item.tooltip}
              selected={selections.get(item.id) || false}
              onClick={() => onToggle(item.id)}
              compact
              searchQuery={searchQuery}
            />
          ))}
          {filteredItems.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground py-1">No matches for &quot;{searchQuery}&quot;</p>
          )}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {title}
            <span className="text-muted-foreground">
              ({selectedCount}/{items.length})
            </span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onSelectAll(items.map((item) => item.id))}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={onSelectNone}
            >
              None
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        {/* Search input */}
        {showSearch && (
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full h-7 pl-7 pr-7 text-sm border border-input rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredItems.map((item) => (
            <SelectableItem
              key={item.id}
              label={item.label}
              tooltip={item.tooltip}
              selected={selections.get(item.id) || false}
              onClick={() => onToggle(item.id)}
              searchQuery={searchQuery}
            />
          ))}
          {filteredItems.length === 0 && searchQuery && (
            <p className="text-sm text-muted-foreground py-2">No matches for &quot;{searchQuery}&quot;</p>
          )}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SelectableItemProps {
  label: string;
  tooltip?: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  searchQuery?: string;
}

function SelectableItem({ label, tooltip, selected, onClick, compact = false, searchQuery = "" }: SelectableItemProps) {
  // Highlight matching text
  const highlightedLabel = useMemo(() => {
    if (!searchQuery) return label;

    const query = searchQuery.toLowerCase();
    const index = label.toLowerCase().indexOf(query);
    if (index === -1) return label;

    const before = label.slice(0, index);
    const match = label.slice(index, index + searchQuery.length);
    const after = label.slice(index + searchQuery.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{match}</mark>
        {after}
      </>
    );
  }, [label, searchQuery]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            aria-pressed={selected}
            aria-label={`${label}${selected ? " (selected)" : ""}`}
            className={cn(
              "w-full flex items-center gap-2 rounded text-left transition-colors",
              compact ? "px-1.5 py-1 text-xs" : "px-2 py-1.5 text-sm",
              selected
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-foreground"
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                "flex-shrink-0 rounded border flex items-center justify-center",
                compact ? "w-3.5 h-3.5" : "w-4 h-4",
                selected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {selected && <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />}
            </div>
            <span className="truncate">{highlightedLabel}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-sm font-medium">{label}</p>
          {tooltip && (
            <p className="text-xs text-muted-foreground mt-1 break-all">{tooltip}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
