"use client";

import { useEffect, useState } from "react";
import { Cpu, Zap, BookOpen, ChevronDown } from "lucide-react";

const calls = [
  {
    title: "Bulk processing",
    endpoint: "/api/v2/projects/[id]/process",
    description: "Processes pending rows using the RFP system prompt and selected skills/categories.",
    models: [
      { speed: "Fast", model: "Haiku (fast)", maxTokens: "≈80k" },
      { speed: "Quality", model: "Sonnet (quality)", maxTokens: "≈200k" },
    ],
  },
  {
    title: "Single row rerun",
    endpoint: "/api/v2/projects/[id]/rows/[rowId]/rerun",
    description: "Reruns one row with current context and clarify thread.",
    models: [
      { speed: "Fast", model: "Haiku (fast)", maxTokens: "≈80k" },
      { speed: "Quality", model: "Sonnet (quality)", maxTokens: "≈200k" },
    ],
  },
  {
    title: "Single question",
    endpoint: "/api/v2/questions/ask",
    description: "Ask one-off questions with the same RFP prompt and skills.",
    models: [
      { speed: "Fast", model: "Haiku (fast)", maxTokens: "≈80k" },
      { speed: "Quality", model: "Sonnet (quality)", maxTokens: "≈200k" },
    ],
  },
];

export function DashboardTab() {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptSource, setPromptSource] = useState<string | null>(null);

  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const res = await fetch("/api/v2/prompts/questions");
        const json = await res.json();
        if (json.success && json.data?.prompt) {
          setPrompt(json.data.prompt);
          setPromptSource(json.data.source || null);
        }
      } catch {
        setPrompt(null);
      }
    };
    loadPrompt();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">LLM Calls in this workspace</h2>
        <p className="text-sm text-slate-600">
          These endpoints power the RFP & Questions flows. Speed maps to model and context window size.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {calls.map((call) => (
          <div key={call.endpoint} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={16} className="text-blue-600" />
              <h3 className="font-semibold text-slate-900">{call.title}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-2">{call.endpoint}</p>
            <p className="text-sm text-slate-700 mb-3">{call.description}</p>
            <div className="space-y-2 text-sm">
              {call.models.map((m) => (
                <div key={m.speed} className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  <span className="font-medium">{m.speed}:</span>
                  <span className="text-slate-700">{m.model}</span>
                  <span className="text-slate-500">({m.maxTokens} context)</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-blue-600" />
          <h3 className="font-semibold text-slate-900">System prompt (RFP)</h3>
        </div>
        {prompt ? (
          <details className="border border-slate-200 rounded-md">
            <summary className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer">
              <ChevronDown size={14} />
              View prompt text
            </summary>
            <div className="p-3 text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 space-y-2">
              {promptSource && (
                <p className="text-xs text-slate-500">Source: {promptSource === "database" ? "Database (prompts library)" : "Default fallback"}</p>
              )}
              {prompt}
            </div>
          </details>
        ) : (
          <p className="text-sm text-slate-500">Prompt not available.</p>
        )}
      </div>
    </div>
  );
}
