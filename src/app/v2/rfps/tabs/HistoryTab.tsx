"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, Calendar, Filter } from "lucide-react";
import { UnifiedResponseCard } from "@/components/v2/rfp-responses";
import type { TransparencyData } from "../components/types";

interface LogItem {
  id: string;
  source: "quick" | "rfp" | "project";
  question: string;
  response: string | null;
  confidence: string | null;
  status: string;
  library: string | null;
  flaggedForReview: boolean;
  reviewStatus: string | null;
  createdAt: string;
  projectId?: string | null;
  projectName?: string | null;
  outputData?: {
    reasoning?: string;
    inference?: string;
    sources?: string | string[];
  };
}

type StatusFilter = "all" | "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR";
type SourceFilter = "all" | "quick" | "rfp" | "project";
type ConfidenceFilter = "all" | "High" | "Medium" | "Low" | "Unable";
type FlaggedFilter = "all" | "flagged" | "not-flagged";
type ReviewStatusFilter = "all" | "APPROVED" | "NEEDS_REVIEW";

export function HistoryTab() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [flaggedFilter, setFlaggedFilter] = useState<FlaggedFilter>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadHistory = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          source: sourceFilter,
          status: statusFilter,
          limit: "50",
        });
        if (cursor) params.append("cursor", cursor);
        if (confidenceFilter !== "all") params.append("confidence", confidenceFilter);
        if (flaggedFilter !== "all") params.append("flagged", flaggedFilter);
        if (reviewStatusFilter !== "all") params.append("reviewStatus", reviewStatusFilter);

        const response = await fetch(`/api/v2/questions/log?${params}`);
        const result = await response.json();

        if (!response.ok) {
          console.error("API error:", result);
        }

        if (result.success && result.data?.items) {
          if (cursor) {
            setItems((prev) => [...prev, ...result.data.items]);
          } else {
            setItems(result.data.items);
          }
          setNextCursor(result.data.nextCursor || null);
          setHasMore(!!result.data.nextCursor);
        } else {
          console.log("No items found, result:", result);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [sourceFilter, statusFilter, confidenceFilter, flaggedFilter, reviewStatusFilter]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleReviewUpdate = async (questionId: string, updates: unknown) => {
    try {
      const response = await fetch(`/api/v2/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.question) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === questionId
                ? {
                    ...item,
                    flaggedForReview: result.data.question.flaggedForReview,
                    reviewStatus: result.data.question.reviewStatus,
                    response:
                      result.data.question.outputData?.response ||
                      item.response,
                  }
                : item
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to update question:", err);
    }
  };

  const getTransparencyData = (item: LogItem): TransparencyData | null => {
    if (!item.response) return null;
    return {
      confidence: item.confidence || "Unable",
      sources: "",
      reasoning: "",
      inference: "",
      remarks: "",
    };
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "ERROR":
        return "bg-red-100 text-red-800";
      case "PENDING":
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "quick":
        return "bg-purple-100 text-purple-800";
      case "project":
        return "bg-cyan-100 text-cyan-800";
      case "rfp":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="ERROR">Error</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="quick">Ask Tab Questions</option>
              <option value="project">Bulk Upload Questions</option>
            </select>
          </div>

          {/* Confidence Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Confidence
            </label>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Unable">Unable</option>
            </select>
          </div>

          {/* Flagged Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Review Flag
            </label>
            <select
              value={flaggedFilter}
              onChange={(e) => setFlaggedFilter(e.target.value as FlaggedFilter)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Items</option>
              <option value="flagged">Flagged</option>
              <option value="not-flagged">Not Flagged</option>
            </select>
          </div>

          {/* Review Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Review Status
            </label>
            <select
              value={reviewStatusFilter}
              onChange={(e) => setReviewStatusFilter(e.target.value as ReviewStatusFilter)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="APPROVED">Approved</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {isLoading && items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Loading history...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg mb-2">No questions found</p>
            <p className="text-slate-400 text-sm">
              Questions you ask in the{" "}
              <Link
                href="/v2/rfps/ask"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Ask tab
              </Link>{" "}
              or from{" "}
              <Link
                href="/v2/rfps/projects"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Bulk Projects
              </Link>{" "}
              will appear here.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                className="w-full px-4 py-3 hover:bg-slate-50 flex items-start justify-between gap-3 transition-colors"
              >
                <div className="flex-1 text-left space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-900 font-medium flex-1 line-clamp-2">
                      {item.question}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${getStatusBadgeColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${getSourceBadgeColor(item.source)}`}
                    >
                      {item.source === "quick"
                        ? "Ask Tab"
                        : item.source === "project"
                        ? "Bulk Upload"
                        : "RFP"}
                    </span>
                    {item.projectName && (
                      <span className="text-xs text-slate-600 px-2 py-1 bg-slate-100 rounded">
                        {item.projectName}
                      </span>
                    )}
                    {item.flaggedForReview && (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-800">
                        Flagged
                      </span>
                    )}
                    <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-slate-400 flex-shrink-0 transition-transform ${
                    expandedId === item.id ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded Content */}
              {expandedId === item.id && (
                <div className="border-t border-slate-200 px-4 py-4 bg-slate-50">
                  <UnifiedResponseCard
                    question={item.question}
                    response={item.response}
                    confidence={item.confidence}
                    status={item.status}
                    reasoning={item.outputData?.reasoning || null}
                    inference={item.outputData?.inference || null}
                    sources={
                      Array.isArray(item.outputData?.sources)
                        ? item.outputData.sources.join(', ')
                        : item.outputData?.sources || null
                    }
                    flaggedForReview={item.flaggedForReview}
                    reviewStatus={item.reviewStatus}
                    library={item.library || undefined}
                    onFlag={() =>
                      handleReviewUpdate(item.id, {
                        flaggedForReview: true,
                      })
                    }
                    onAccept={() =>
                      handleReviewUpdate(item.id, {
                        reviewStatus: 'APPROVED',
                        flaggedForReview: false,
                      })
                    }
                    allowEditing={false}
                    isLoading={false}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => loadHistory(nextCursor || undefined)}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-900 font-medium rounded-md transition-colors"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
