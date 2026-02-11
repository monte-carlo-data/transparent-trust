"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

interface QueueIndicatorProps {
  projectId: string;
}

export function QueueIndicator({ projectId }: QueueIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `/api/v2/projects/${projectId}?includeRows=false`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.project?.rowStats) {
            const stats = result.data.project.rowStats;
            setPendingCount(stats.pending || 0);
            setProcessingCount(stats.processing || 0);
          }
        }
      } catch (err) {
        console.error("Failed to fetch queue stats:", err);
      }
    };

    fetchStats();

    // Poll every 2 seconds while there are pending or processing items
    const interval = setInterval(fetchStats, 2000);

    return () => clearInterval(interval);
  }, [projectId]);

  const totalQueuedItems = pendingCount + processingCount;

  if (totalQueuedItems === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-blue-700">
          <AlertCircle size={20} className="flex-shrink-0" />
          <span className="font-medium">
            {totalQueuedItems} {totalQueuedItems === 1 ? "item" : "items"} in queue
          </span>
        </div>

        {processingCount > 0 && (
          <span className="text-sm text-blue-600">
            ({processingCount} processing)
          </span>
        )}

        {pendingCount > 0 && (
          <div className="ml-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-700 font-medium">
                {pendingCount} waiting
              </span>
            </div>
          </div>
        )}
      </div>

      {processingCount > 0 && (
        <p className="text-sm text-blue-600 mt-2">
          Processing in progress. This page will update automatically.
        </p>
      )}
    </div>
  );
}
