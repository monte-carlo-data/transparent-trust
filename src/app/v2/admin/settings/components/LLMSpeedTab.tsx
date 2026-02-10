"use client";

import { useState } from "react";
import { Zap, Gauge, RotateCcw, Info } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import { LLM_SPEED_DEFAULTS, type LLMFeature, type ModelSpeed } from "@/lib/config";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";

// Friendly labels for each LLM feature
const FEATURE_LABELS: Record<LLMFeature, { label: string; description: string }> = {
  "chat": {
    label: "The Oracle (Chat)",
    description: "Knowledge-based chat conversations"
  },
  "questions": {
    label: "Quick Questions",
    description: "Single Q&A from the questions page"
  },
  "questions-batch": {
    label: "Bulk Questions (RFP)",
    description: "Processing multiple RFP questions at once"
  },
  "skills-suggest": {
    label: "Skill Generation",
    description: "Creating or updating knowledge skills"
  },
  "skills-analyze": {
    label: "URL Analysis",
    description: "Analyzing URLs for skill routing"
  },
  "skills-analyze-rfp": {
    label: "RFP Analysis",
    description: "Analyzing RFPs for skill suggestions"
  },
  "skills-analyze-library": {
    label: "Library Analysis",
    description: "Knowledge library health checks"
  },
  "skills-refresh": {
    label: "Skill Refresh",
    description: "Refreshing skills from sources"
  },
  "customers-analyze": {
    label: "Customer URL Analysis",
    description: "Analyzing URLs for customer matching"
  },
  "customers-suggest": {
    label: "Customer Profile Generation",
    description: "Creating customer profiles from sources"
  },
  "customers-build": {
    label: "Customer Build from Docs",
    description: "Building profiles from uploaded documents"
  },
  "contracts-analyze": {
    label: "Contract Analysis",
    description: "Analyzing contract clauses"
  },
  "prompts-optimize": {
    label: "Prompt Optimization",
    description: "AI-assisted prompt improvements"
  },
  "documents-template": {
    label: "Document Templates",
    description: "Generating document templates"
  },
};

// Group features for better organization
const FEATURE_GROUPS = [
  {
    name: "Chat & Questions",
    features: ["chat", "questions", "questions-batch"] as LLMFeature[],
  },
  {
    name: "Knowledge Management",
    features: ["skills-suggest", "skills-analyze", "skills-analyze-rfp", "skills-analyze-library", "skills-refresh"] as LLMFeature[],
  },
  {
    name: "Customer & Contracts",
    features: ["customers-analyze", "customers-suggest", "customers-build", "contracts-analyze"] as LLMFeature[],
  },
  {
    name: "Utilities",
    features: ["prompts-optimize", "documents-template"] as LLMFeature[],
  },
];

type PreferencesResponse = {
  preferences?: { llmSpeedOverrides?: Record<string, ModelSpeed> };
};

export default function LLMSpeedTab() {
  const { data: prefsData, isLoading: loading } = useApiQuery<PreferencesResponse>({
    queryKey: ["user-preferences"],
    url: "/api/user/preferences",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoader size="md" className="text-gray-400" />
        <span className="ml-2 text-gray-500">Loading preferences...</span>
      </div>
    );
  }

  const initialOverrides = prefsData?.preferences?.llmSpeedOverrides || {};
  const overridesKey = JSON.stringify(initialOverrides);

  return (
    <LLMSpeedSettings
      key={overridesKey}
      initialOverrides={initialOverrides}
    />
  );
}

type LLMSpeedSettingsProps = {
  initialOverrides: Record<string, ModelSpeed>;
};

function LLMSpeedSettings({ initialOverrides }: LLMSpeedSettingsProps) {
  const [userOverrides, setUserOverrides] = useState<Record<string, ModelSpeed>>(initialOverrides);
  const [hasChanges, setHasChanges] = useState(false);

  // Save mutation
  const saveMutation = useApiMutation<void, { llmSpeedOverrides: Record<string, ModelSpeed> }>({
    url: "/api/user/preferences",
    method: "PUT",
    invalidateKeys: [["user-preferences"]],
    onSuccess: () => {
      toast.success("Speed preferences saved");
      setHasChanges(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save");
    },
  });

  const saving = saveMutation.isPending;

  const handleSpeedChange = (feature: LLMFeature, speed: ModelSpeed) => {
    const systemDefault = LLM_SPEED_DEFAULTS[feature];

    setUserOverrides(prev => {
      const updated = { ...prev };
      if (speed === systemDefault) {
        // Remove override if it matches system default
        delete updated[feature];
      } else {
        updated[feature] = speed;
      }
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ llmSpeedOverrides: userOverrides });
  };

  const handleReset = () => {
    setUserOverrides({});
    setHasChanges(true);
  };

  const getEffectiveSpeed = (feature: LLMFeature): ModelSpeed => {
    return userOverrides[feature] || LLM_SPEED_DEFAULTS[feature];
  };

  const isOverridden = (feature: LLMFeature): boolean => {
    return feature in userOverrides;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">LLM Speed Settings</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure speed vs quality tradeoffs for AI features
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={Object.keys(userOverrides).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <InlineLoader size="sm" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start gap-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-700">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Fast</span>
            </div>
            <span className="text-sm text-gray-600">Haiku model, 2-5 second responses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700">
              <Gauge className="h-4 w-4" />
              <span className="text-sm font-medium">Quality</span>
            </div>
            <span className="text-sm text-gray-600">Sonnet model, 10-30 second responses</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
          <Info className="h-3.5 w-3.5" />
          <span>Users can still toggle speed per-request in the chat interface</span>
        </div>
      </div>

      {/* Skill Generation Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Skill Generation
        </h4>
        <p className="text-sm text-blue-700 mt-1">
          Skill generation and updates always use the Quality (Sonnet) model to ensure comprehensive content handling,
          regardless of your speed preference. This ensures enough output tokens for complex skill responses.
        </p>
        <p className="text-xs text-blue-600 mt-2">
          Your speed preferences apply to other features like chat, questions, and analysis tasks.
        </p>
      </div>

      {/* Feature Groups */}
      <div className="space-y-6">
        {FEATURE_GROUPS.map((group) => (
          <div key={group.name}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{group.name}</h4>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {group.features.map((feature) => {
                const config = FEATURE_LABELS[feature];
                const effectiveSpeed = getEffectiveSpeed(feature);
                const systemDefault = LLM_SPEED_DEFAULTS[feature];
                const overridden = isOverridden(feature);

                return (
                  <div
                    key={feature}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{config.label}</span>
                        {overridden && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        System default: {systemDefault === "fast" ? "Fast (Haiku)" : "Quality (Sonnet)"}
                      </p>
                    </div>

                    {/* Speed Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => handleSpeedChange(feature, "fast")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          effectiveSpeed === "fast"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Zap className="h-4 w-4" />
                        Fast
                      </button>
                      <button
                        onClick={() => handleSpeedChange(feature, "quality")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          effectiveSpeed === "quality"
                            ? "bg-blue-500 text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Gauge className="h-4 w-4" />
                        Quality
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {Object.keys(userOverrides).length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-purple-900">
            {Object.keys(userOverrides).length} custom override{Object.keys(userOverrides).length !== 1 ? "s" : ""}
          </h4>
          <p className="text-sm text-purple-700 mt-1">
            These settings override the system defaults for your account.
          </p>
        </div>
      )}
    </div>
  );
}
