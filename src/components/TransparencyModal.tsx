"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TransparencyConfigColor = "purple" | "blue" | "yellow" | "green";

export type TransparencyConfig = {
  label: string;
  value: string | number;
  color?: TransparencyConfigColor;
};

export type TransparencySection = {
  id: string;
  title: string;
  content: string;
  note?: React.ReactNode;
  copyLabel?: string;
  defaultExpanded?: boolean;
  maxHeight?: number;
  truncateAt?: number;
  showCharCount?: boolean;
};

export type TransparencyModalProps = {
  open?: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerColor?: "purple" | "blue" | "gray";
  configs?: TransparencyConfig[];
  systemPrompt: string;
  systemPromptNote?: React.ReactNode;
  sections?: TransparencySection[];
};

const configColors: Record<
  TransparencyConfigColor,
  { bg: string; text: string; badge: string }
> = {
  purple: { bg: "bg-purple-50", text: "text-purple-900", badge: "text-purple-700" },
  blue: { bg: "bg-blue-50", text: "text-blue-900", badge: "text-blue-700" },
  yellow: { bg: "bg-amber-100", text: "text-amber-900", badge: "text-amber-700" },
  green: { bg: "bg-green-50", text: "text-green-900", badge: "text-green-700" },
};

const headerColorClasses = {
  purple: "bg-purple-50",
  blue: "bg-blue-50",
  gray: "bg-slate-50",
};

const titleColorClasses = {
  purple: "text-purple-700",
  blue: "text-sky-700",
  gray: "text-slate-800",
};

function ConfigBadges({ configs }: { configs?: TransparencyConfig[] }) {
  if (!configs?.length) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {configs.map((config, idx) => {
        const scheme = configColors[config.color || "blue"];
        return (
          <span
            key={idx}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              scheme.bg,
              scheme.badge
            )}
          >
            <span className="uppercase text-[10px] opacity-70">{config.label}:</span>
            <span className={scheme.text}>
              {typeof config.value === "number"
                ? config.value.toLocaleString()
                : config.value}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function formatContent(content: string, truncateAt?: number) {
  if (truncateAt && content.length > truncateAt) {
    return `${content.slice(0, truncateAt)}\n\n... (truncated for display)`;
  }
  return content;
}

export function TransparencyModal({
  open = true,
  onClose,
  title = "Prompt Transparency",
  subtitle,
  headerColor = "gray",
  configs,
  systemPrompt,
  systemPromptNote,
  sections = [],
}: TransparencyModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const initialExpanded = useMemo(() => {
    const ids = new Set<string>();
    ids.add("system");
    sections.forEach((section) => {
      if (section.defaultExpanded !== false) {
        ids.add(section.id);
      }
    });
    return ids;
  }, [sections]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(initialExpanded);

  useEffect(() => {
    setExpandedSections(initialExpanded);
  }, [initialExpanded]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(label);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore copy errors
    }
  };

  const sectionList: TransparencySection[] = [
    {
      id: "system",
      title: "System Prompt",
      content: systemPrompt,
      note: systemPromptNote,
      defaultExpanded: true,
      showCharCount: true,
      copyLabel: "system",
    },
    ...sections,
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className={cn("px-6 py-5 border-b", headerColorClasses[headerColor])}>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className={cn("text-lg", titleColorClasses[headerColor])}>
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-slate-500 mt-1">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          <ConfigBadges configs={configs} />

          {sectionList.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const displayContent = formatContent(section.content, section.truncateAt);

            return (
              <div
                key={section.id}
                className="border rounded-lg bg-card shadow-sm"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    <div className="font-semibold text-sm">{section.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {section.note ||
                        (section.showCharCount &&
                          `${section.content.length.toLocaleString()} characters`)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {section.copyLabel && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(section.content, section.copyLabel!)}
                        aria-label={`Copy ${section.title}`}
                      >
                        {copiedId === section.copyLabel ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleSection(section.id)}
                      aria-label={isExpanded ? "Collapse section" : "Expand section"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 overflow-auto" style={{ maxHeight: section.maxHeight || 320 }}>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-muted rounded-md p-3 overflow-x-auto leading-relaxed">
                      {displayContent}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TransparencyModal;
