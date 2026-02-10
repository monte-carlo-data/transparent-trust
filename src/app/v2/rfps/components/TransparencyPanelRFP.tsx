"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { TransparencyData } from "./types";

interface TransparencyPanelProps {
  data: TransparencyData;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  library?: string;
}

export function TransparencyPanelRFP({
  data,
  expanded = false,
  onToggle,
  library,
}: TransparencyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
  };

  return (
    <div className="border rounded-lg bg-slate-50 mt-4">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">Transparency Details</h3>
          {data.confidence && (
            <span className={`text-xs px-2 py-1 rounded ${
              data.confidence.includes("High")
                ? "bg-green-100 text-green-700"
                : data.confidence.includes("Medium")
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}>
              {data.confidence}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t divide-y divide-slate-200 bg-white">
          <DetailRow title="Reasoning" content={data.reasoning} />
          {data.inference && data.inference !== "None" && (
            <DetailRow title="Inference" content={data.inference} />
          )}
          <SourcesRow
            sources={Array.isArray(data.sources) ? data.sources.join(", ") : data.sources}
            library={library}
          />
        </div>
      )}
    </div>
  );
}

export function DetailRow({
  title,
  content,
}: {
  title: string;
  content: string | null | undefined;
}) {
  const hasContent = Boolean(content && content.trim && content.trim().length > 0);
  return (
    <div className="px-3 py-2 text-sm">
      <div className="font-semibold text-slate-900 mb-1">{title}</div>
      <div className="text-slate-700 whitespace-pre-wrap">
        {hasContent ? content : "Not provided"}
      </div>
    </div>
  );
}

export function SourcesRow({
  sources,
  library,
}: {
  sources: string | null | undefined;
  library?: string;
}) {
  const hasContent = Boolean(
    sources && String(sources).trim().length > 0 && String(sources).toLowerCase() !== "none"
  );

  if (!hasContent) {
    return (
      <div className="px-3 py-2 text-sm">
        <div className="font-semibold text-slate-900 mb-1">Sources</div>
        <div className="text-slate-700">Not provided</div>
      </div>
    );
  }

  // Parse comma-separated sources into individual items
  const sourceList = (String(sources) || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Map library to the appropriate path
  const getLibraryPath = (lib: string) => {
    const normalized = lib.toLowerCase();
    if (normalized === "it" || normalized === "it-skills") return "it";
    if (normalized === "gtm") return "gtm";
    return "knowledge"; // default to knowledge for 'skills'
  };

  const libraryPath = library ? getLibraryPath(library) : undefined;

  return (
    <div className="px-3 py-2 text-sm">
      <div className="font-semibold text-slate-900 mb-2">Sources</div>
      <div className="space-y-1">
        {sourceList.map((source, idx) =>
          libraryPath ? (
            <a
              key={idx}
              href={`/v2/${libraryPath}?search=${encodeURIComponent(source)}`}
              className="text-blue-600 hover:text-blue-800 hover:underline block text-sm"
            >
              {source}
            </a>
          ) : (
            <div key={idx} className="text-slate-700">
              • {source}
            </div>
          )
        )}
      </div>
    </div>
  );
}
