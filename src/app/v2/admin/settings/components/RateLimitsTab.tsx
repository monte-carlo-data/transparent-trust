"use client";

import { useState, useEffect } from "react";
import { InlineLoader } from "@/components/ui/loading";
import { toast } from "sonner";
import { RateLimitSettingItem } from "./types";

export default function RateLimitsTab() {
  const [settings, setSettings] = useState<RateLimitSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/app-settings")
      .then((res) => res.json())
      .then((result) => {
        // Handle both { data: { settings: [...] } } and { settings: [...] } formats
        const settingsData = result.data?.settings || result.settings || [];
        setSettings(settingsData);
        const values: Record<string, string> = {};
        settingsData.forEach((s: RateLimitSettingItem) => {
          values[s.key] = s.value;
        });
        setEditValues(values);
      })
      .catch(() => toast.error("Failed to load rate limit settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: editValues[key], isDefault: false } : s))
      );
      toast.success(`${key} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSaving(null);
    }
  };

  const getInputType = (key: string) => {
    if (key === "LLM_PROVIDER") return "select";
    return "number";
  };

  const formatLabel = (key: string) => {
    const labels: Record<string, string> = {
      LLM_BATCH_SIZE: "Batch Size",
      LLM_BATCH_DELAY_MS: "Delay Between Batches (ms)",
      LLM_RATE_LIMIT_RETRY_WAIT_MS: "Rate Limit Retry Wait (ms)",
      LLM_RATE_LIMIT_MAX_RETRIES: "Max Retries on Rate Limit",
      LLM_PROVIDER: "LLM Provider",
    };
    return labels[key] || key;
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="flex justify-center mb-2">
          <InlineLoader size="lg" />
        </div>
        Loading rate limit settings...
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Configure rate limit settings for batch question generation. These settings help manage API rate limits
        and can be adjusted based on your Anthropic tier or AWS Bedrock deployment.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-blue-800 mb-2">Rate Limit Tiers</h4>
        <p className="text-sm text-blue-700 mb-2">
          Anthropic API rate limits vary by tier. Adjust these settings based on your organization&apos;s limits:
        </p>
        <ul className="text-sm text-blue-700 list-disc ml-4 space-y-1">
          <li><strong>Free tier:</strong> 20,000 tokens/minute — use batch size 3, delay 30s</li>
          <li><strong>Build tier:</strong> 40,000 tokens/minute — use batch size 5, delay 15s</li>
          <li><strong>Scale tier:</strong> 80,000+ tokens/minute — use batch size 10, delay 5s</li>
          <li><strong>AWS Bedrock:</strong> Higher limits — use batch size 15, delay 2s</li>
        </ul>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formatLabel(setting.key)}
                  {setting.isDefault && (
                    <span className="ml-2 text-xs text-gray-400">(default)</span>
                  )}
                </label>
                <p className="text-xs text-gray-500 mb-2">{setting.description}</p>

                {getInputType(setting.key) === "select" ? (
                  <select
                    value={editValues[setting.key] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="anthropic">Anthropic (Direct API)</option>
                    <option value="bedrock">AWS Bedrock</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={editValues[setting.key] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                )}
              </div>

              <button
                onClick={() => handleSave(setting.key)}
                disabled={saving === setting.key || editValues[setting.key] === setting.value}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === setting.key ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-800 mb-1">Note</h4>
        <p className="text-sm text-amber-700">
          Changes take effect immediately for new batch operations. No restart required.
        </p>
      </div>
    </div>
  );
}
