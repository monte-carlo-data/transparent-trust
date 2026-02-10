"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronRight, Database, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSelectionStore } from "@/stores/selection-store";
import { useCustomerSources } from "@/hooks/use-customer-sources";
import { SourceTypeGroup } from "./SourceTypeGroup";
import { SOURCE_TYPE_DISPLAY_ORDER } from "@/lib/source-type-config";
import type { SourceType } from "@/types/v2";

interface CustomerSourcesSectionProps {
  customerId: string;
  isEnabled: boolean;
  isExpanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
}

export function CustomerSourcesSection({
  customerId,
  isEnabled,
  isExpanded,
  onToggleEnabled,
  onToggleExpanded,
}: CustomerSourcesSectionProps) {
  const { sourcesByType, countsByType, loading } = useCustomerSources(
    customerId,
    { enabled: isEnabled, hasContent: true }
  );

  const { sourceSelections, selectAllSources, selectNoSources } =
    useSelectionStore();

  const selectedSourceCount = useMemo(
    () => Array.from(sourceSelections.values()).filter(Boolean).length,
    [sourceSelections]
  );

  const totalSourceCount = countsByType.total;

  const handleSelectAll = () => {
    const allSourceIds = Object.values(sourcesByType)
      .flat()
      .map((s) => s.id);
    selectAllSources(allSourceIds);
  };

  const handleSelectNone = () => {
    selectNoSources();
  };

  // Minimized view when disabled
  if (!isEnabled) {
    return (
      <Card className="border-l-4 border-l-cyan-500">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Customer Sources</span>
              {selectedSourceCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedSourceCount}
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
            <Database className="h-4 w-4 text-cyan-600" />
            Customer Sources ({selectedSourceCount}/{totalSourceCount})
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
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
          {totalSourceCount === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {loading
                ? "Loading sources..."
                : "No sources with content available for this customer"}
            </div>
          ) : (
            <>
              {/* Header with All/None controls */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">
                  Raw Sources ({selectedSourceCount}/{totalSourceCount})
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={handleSelectAll}
                    className="text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={handleSelectNone}
                    className="text-primary hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Source groups by type */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {SOURCE_TYPE_DISPLAY_ORDER.map((sourceType) => {
                  const sources = sourcesByType[sourceType as keyof typeof sourcesByType];
                  if (!sources || sources.length === 0) return null;
                  return (
                    <SourceTypeGroup
                      key={sourceType}
                      sourceType={sourceType as SourceType}
                      sources={sources}
                    />
                  );
                })}
              </div>
            </>
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
