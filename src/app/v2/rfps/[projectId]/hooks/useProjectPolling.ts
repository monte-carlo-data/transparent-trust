import { useEffect, useRef } from 'react';

/**
 * Project Polling Hook
 *
 * Polls project status every 5 seconds when processing is active.
 * Automatically starts/stops polling based on isProcessing flag.
 * Surfaces errors to the user after consecutive failures.
 */

const MAX_CONSECUTIVE_FAILURES = 3;

interface UseProjectPollingOptions {
  projectId: string;
  isProcessing: boolean;
  onStatusUpdate: () => Promise<void>;
  onComplete: () => void;
  onError?: (error: string) => void;
}

export function useProjectPolling({
  projectId,
  isProcessing,
  onStatusUpdate,
  onComplete,
  onError,
}: UseProjectPollingOptions) {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const failureCountRef = useRef(0);

  useEffect(() => {
    if (isProcessing && projectId) {
      const poll = async () => {
        try {
          const res = await fetch(`/api/v2/projects/${projectId}/process-batch-status`, {
            cache: 'no-store',
          });

          if (!res.ok) {
            throw new Error(`Status check failed (${res.status})`);
          }

          const json = await res.json();

          if (json.success) {
            // Reset failure count on success
            failureCountRef.current = 0;

            const status = json.data.projectStatus;

            // Refresh project data
            await onStatusUpdate();

            // Stop polling if complete or error
            if (status === 'COMPLETED' || status === 'ERROR') {
              onComplete();
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          } else {
            throw new Error(json.error || 'Status check returned unsuccessful');
          }
        } catch (err) {
          failureCountRef.current++;
          console.error('Polling error:', err);

          // Surface error to user after consecutive failures
          if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES && onError) {
            onError(`Status updates failed ${failureCountRef.current} times. Check your connection.`);
          }
        }
      };

      // Initial poll
      poll();

      // Set up interval (5 seconds)
      pollingRef.current = setInterval(poll, 5000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        failureCountRef.current = 0;
      };
    }
  }, [isProcessing, projectId, onStatusUpdate, onComplete, onError]);
}
