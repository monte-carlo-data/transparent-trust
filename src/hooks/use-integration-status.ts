'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SourceType } from '@/types/v2';

export interface IntegrationStatus {
  type: SourceType;
  displayName: string;
  configured: boolean;
  connectionId?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ERROR';
  lastSyncAt?: string;
  lastError?: string;
  connectionTest?: {
    success: boolean;
    error?: string;
    testedAt: string;
  };
}

interface UseIntegrationStatusOptions {
  verify?: boolean;
  autoRefresh?: boolean;
  refetchInterval?: number; // ms
}

export function useIntegrationStatus(
  type?: string,
  options?: UseIntegrationStatusOptions
) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [allStatuses, setAllStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.verify) params.append('verify', 'true');

      const endpoint = type
        ? `/api/v2/integrations/${type}/status?${params.toString()}`
        : `/api/v2/integrations/status?${params.toString()}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (type) {
        setStatus(data);
      } else {
        setAllStatuses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Integration status error:', message);
    } finally {
      setLoading(false);
    }
  }, [type, options?.verify]);

  useEffect(() => {
    fetchStatus();

    if (options?.autoRefresh && options.refetchInterval) {
      const interval = setInterval(fetchStatus, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, options?.autoRefresh, options?.refetchInterval]);

  return {
    status: type ? status : undefined,
    allStatuses: type ? undefined : allStatuses,
    loading,
    error,
    refetch: fetchStatus,
  };
}
