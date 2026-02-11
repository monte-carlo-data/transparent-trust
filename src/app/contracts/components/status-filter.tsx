"use client";

import { cn } from "@/lib/utils";
import { ContractReviewSummary } from "@/types/contractReview";

export type ContractStatusFilter = "all" | "PENDING" | "ANALYZING" | "ANALYZED" | "REVIEWED" | "ARCHIVED" | "has_flagged";

interface FilterCounts {
  all: number;
  PENDING: number;
  ANALYZING: number;
  ANALYZED: number;
  REVIEWED: number;
  ARCHIVED: number;
  has_flagged: number;
}

interface StatusFilterProps {
  currentFilter: ContractStatusFilter;
  onFilterChange: (filter: ContractStatusFilter) => void;
  counts: FilterCounts;
}

export function ContractStatusFilter({ currentFilter, onFilterChange, counts }: StatusFilterProps) {
  const filters: { key: ContractStatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "ANALYZED", label: "Analyzed" },
    { key: "REVIEWED", label: "Reviewed" },
  ];

  return (
    <div className="flex gap-1.5 flex-wrap">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
            currentFilter === key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  );
}

interface StatusSummaryCardsProps {
  currentFilter: ContractStatusFilter;
  onFilterChange: (filter: ContractStatusFilter) => void;
  counts: FilterCounts;
}

export function ContractStatusSummaryCards({ currentFilter, onFilterChange, counts }: StatusSummaryCardsProps) {
  const cards: { key: ContractStatusFilter; label: string; color: string; bgActive: string; borderActive: string }[] = [
    { key: "ANALYZED", label: "Ready for Review", color: "text-amber-500", bgActive: "bg-amber-50", borderActive: "border-amber-300" },
    { key: "has_flagged", label: "Has Flagged", color: "text-orange-500", bgActive: "bg-orange-50", borderActive: "border-orange-300" },
    { key: "PENDING", label: "Pending Analysis", color: "text-blue-500", bgActive: "bg-blue-50", borderActive: "border-blue-300" },
    { key: "REVIEWED", label: "Reviewed", color: "text-green-500", bgActive: "bg-green-50", borderActive: "border-green-300" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ key, label, color, bgActive, borderActive }) => {
        const isActive = currentFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(currentFilter === key ? "all" : key)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              isActive ? `${bgActive} border-2 ${borderActive}` : "bg-card border-border hover:border-muted-foreground/30"
            )}
          >
            <div className={cn("text-3xl font-bold", counts[key] > 0 ? color : "text-muted-foreground")}>
              {counts[key]}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </button>
        );
      })}
    </div>
  );
}

// Helper to calculate filter counts from contracts
export function calculateContractFilterCounts(contracts: ContractReviewSummary[]): FilterCounts {
  return {
    all: contracts.length,
    PENDING: contracts.filter((c) => c.status === "PENDING").length,
    ANALYZING: contracts.filter((c) => c.status === "ANALYZING").length,
    ANALYZED: contracts.filter((c) => c.status === "ANALYZED").length,
    REVIEWED: contracts.filter((c) => c.status === "REVIEWED").length,
    ARCHIVED: contracts.filter((c) => c.status === "ARCHIVED").length,
    has_flagged: contracts.filter((c) => (c.flaggedCount || 0) > 0).length,
  };
}
