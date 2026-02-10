"use client";

import { useState } from "react";
import { ExternalLink, Trash2, Building2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmModal";

export type DetectedUrl = {
  url: string;
  title: string;
  detectedInMessageId: string;
  timestamp: Date;
};

interface DetectedUrlsPanelProps {
  urls: DetectedUrl[];
  focusedCustomerId: string | null;
  focusedCustomerName: string | null;
  onAddToKnowledge: (urls: { url: string; title: string }[]) => Promise<void>;
  onAddToCustomer: (urls: string[], customerId: string) => Promise<void>;
  onRemove: (url: string) => void;
  onClear: () => void;
}

export function DetectedUrlsPanel({
  urls,
  focusedCustomerId,
  focusedCustomerName,
  onAddToKnowledge,
  onAddToCustomer,
  onRemove,
  onClear,
}: DetectedUrlsPanelProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Clear Detected URLs",
    message: "Remove all detected URLs from this list? This won't affect URLs already used in the conversation.",
    variant: "default",
  });

  if (urls.length === 0) {
    return null;
  }

  const toggleUrl = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const selectAll = () => {
    setSelectedUrls(new Set(urls.map(u => u.url)));
  };

  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  const handleAddToKnowledge = async () => {
    if (selectedUrls.size === 0) return;
    setIsAdding(true);
    try {
      // Build URL objects with titles from the detected URLs
      const urlsWithTitles = urls
        .filter(u => selectedUrls.has(u.url))
        .map(u => ({ url: u.url, title: u.title }));
      await onAddToKnowledge(urlsWithTitles);
      // Remove added URLs from the list
      selectedUrls.forEach(url => onRemove(url));
      setSelectedUrls(new Set());
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddToCustomer = async () => {
    if (selectedUrls.size === 0 || !focusedCustomerId) return;
    setIsAdding(true);
    try {
      await onAddToCustomer(Array.from(selectedUrls), focusedCustomerId);
      // Remove added URLs from the list
      selectedUrls.forEach(url => onRemove(url));
      setSelectedUrls(new Set());
    } finally {
      setIsAdding(false);
    }
  };

  const handleClear = async () => {
    const confirmed = await confirm();
    if (confirmed) {
      onClear();
      setSelectedUrls(new Set());
    }
  };

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="py-3 px-4 border-b border-amber-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-amber-600" />
              <span>Detected URLs ({urls.length})</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 text-xs text-amber-600 hover:text-amber-700"
            >
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            URLs detected in your messages. Content was fetched for this chat only. Save them to reuse later.
          </p>

          {/* Selection controls */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              {selectedUrls.size > 0 && (
                <button
                  onClick={deselectAll}
                  className="text-muted-foreground hover:underline"
                >
                  Deselect all
                </button>
              )}
            </div>
            {selectedUrls.size > 0 && (
              <span className="text-muted-foreground">
                {selectedUrls.size} selected
              </span>
            )}
          </div>

          {/* URL list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {urls.map((urlItem) => (
              <div
                key={urlItem.url}
                className={cn(
                  "flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors",
                  selectedUrls.has(urlItem.url)
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border hover:border-primary/50"
                )}
                onClick={() => toggleUrl(urlItem.url)}
              >
                <input
                  type="checkbox"
                  checked={selectedUrls.has(urlItem.url)}
                  onChange={() => toggleUrl(urlItem.url)}
                  className="mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{urlItem.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{urlItem.url}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(urlItem.url);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {selectedUrls.size > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2"
                onClick={handleAddToKnowledge}
                disabled={isAdding}
              >
                <BookOpen className="h-4 w-4" />
                Add to Knowledge Base
              </Button>
              {focusedCustomerId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleAddToCustomer}
                  disabled={isAdding}
                >
                  <Building2 className="h-4 w-4" />
                  Add to {focusedCustomerName || "Customer"} Profile
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}
