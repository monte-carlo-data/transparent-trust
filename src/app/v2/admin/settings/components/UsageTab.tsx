"use client";

import { useState } from "react";
import { UsageData } from "./types";
import { FEATURE_LABELS } from "./constants";
import { formatCost, formatTokens } from "./utils";
import { InlineError } from "@/components/ui/status-display";
import { useApiQuery } from "@/hooks/use-api";

export default function UsageTab() {
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"user" | "all">("all");

  const {
    data: usageData,
    isLoading: loading,
    error: queryError,
    refetch: fetchUsageData,
  } = useApiQuery<UsageData>({
    queryKey: ["usage", days, scope],
    url: "/api/v2/usage",
    params: { days, scope },
    staleTime: 60 * 1000, // 1 minute
  });

  const error = queryError?.message || null;

  const maxTokens = usageData?.byFeature?.reduce((max, f) => Math.max(max, f.totalTokens), 0) || 1;
  const maxDailyTokens = usageData?.daily?.reduce((max, d) => Math.max(max, d.tokens), 0) || 1;

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading usage data...</div>;
  }

  if (error) {
    return <InlineError message={error} />;
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex gap-3 mb-4">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "user" | "all")}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Users</option>
          <option value="user">My Usage Only</option>
        </select>
        <button
          onClick={() => fetchUsageData()}
          className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {usageData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Total Tokens</div>
              <div className="text-xl font-bold">{formatTokens(usageData.summary.totalTokens)}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Estimated Cost</div>
              <div className="text-xl font-bold text-green-600">{formatCost(usageData.summary.totalCost)}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">API Calls</div>
              <div className="text-xl font-bold">{usageData.summary.callCount.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Avg Cost/Call</div>
              <div className="text-xl font-bold">
                {formatCost(usageData.summary.totalCost / Math.max(usageData.summary.callCount, 1))}
              </div>
            </div>
          </div>

          {/* Usage by Feature */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg mb-4">
            <h4 className="font-medium mb-3">Usage by Feature</h4>
            {usageData.byFeature.length === 0 ? (
              <p className="text-gray-400 text-sm">No usage data yet</p>
            ) : (
              <div className="space-y-3">
                {usageData.byFeature.map((item) => (
                  <div key={item.feature}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{FEATURE_LABELS[item.feature] || item.feature}</span>
                      <span className="text-gray-500">
                        {formatTokens(item.totalTokens)} ({formatCost(item.totalCost)})
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{ width: `${(item.totalTokens / maxTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Chart */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="font-medium mb-3">Daily Usage</h4>
            {usageData.daily.length === 0 ? (
              <p className="text-gray-400 text-sm">No usage data yet</p>
            ) : (
              <>
                <div className="flex items-end gap-px h-24">
                  {usageData.daily.slice(-30).map((day) => (
                    <div
                      key={day.date}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t"
                      style={{ height: `${(day.tokens / maxDailyTokens) * 100}%`, minHeight: day.tokens > 0 ? "4px" : "0px" }}
                      title={`${day.date}: ${formatTokens(day.tokens)} tokens`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>{usageData.daily[0]?.date}</span>
                  <span>{usageData.daily[usageData.daily.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          {/* Recent API Calls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium mb-3">Recent API Calls</h4>
            {usageData.recentCalls.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent calls</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Time</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Feature</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Input</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Output</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Total</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.recentCalls.map((call) => (
                      <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          {FEATURE_LABELS[call.feature] || call.feature}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-600">
                          {formatTokens(call.inputTokens)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-600">
                          {formatTokens(call.outputTokens)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatTokens(call.totalTokens)}
                        </td>
                        <td className="py-2 px-2 text-right text-green-600 font-medium">
                          {formatCost(call.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
