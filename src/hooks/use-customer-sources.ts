'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { TypedStagedSource, SourceType } from '@/types/v2';

interface UseCustomerSourcesOptions {
  enabled?: boolean;
  /** Only fetch sources with content */
  hasContent?: boolean;
  /** Filter by specific source type */
  sourceType?: SourceType;
  limit?: number;
}

export interface SourcesByType {
  url: TypedStagedSource[];
  zendesk: TypedStagedSource[];
  slack: TypedStagedSource[];
  notion: TypedStagedSource[];
  gong: TypedStagedSource[];
  document: TypedStagedSource[];
  looker: TypedStagedSource[];
}

/**
 * Fetch staged sources scoped to a specific customer.
 * Returns sources grouped by type for UI display.
 */
export function useCustomerSources(
  customerId: string | null,
  options: UseCustomerSourcesOptions = {}
) {
  const { enabled = true, hasContent = true, sourceType, limit = 100 } = options;
  const [sources, setSources] = useState<TypedStagedSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSources = useCallback(async () => {
    if (!enabled || !customerId) {
      setSources([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('customerId', customerId);
      params.set('limit', String(limit));
      params.set('orderBy', 'stagedAt');
      params.set('orderDir', 'desc');

      if (hasContent) {
        params.set('hasContent', 'true');
      }

      if (sourceType) {
        params.set('sourceType', sourceType);
      }

      const response = await fetch(`/api/v2/sources?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch customer sources: ${response.statusText}`);
      }

      const data = await response.json();
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, enabled, hasContent, sourceType, limit]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Group sources by type for UI display
  const sourcesByType = useMemo<SourcesByType>(() => {
    const grouped: SourcesByType = {
      url: [],
      zendesk: [],
      slack: [],
      notion: [],
      gong: [],
      document: [],
      looker: [],
    };

    for (const source of sources) {
      if (grouped[source.sourceType]) {
        grouped[source.sourceType].push(source);
      }
    }

    return grouped;
  }, [sources]);

  // Get counts by type
  const countsByType = useMemo(() => {
    return {
      url: sourcesByType.url.length,
      zendesk: sourcesByType.zendesk.length,
      slack: sourcesByType.slack.length,
      notion: sourcesByType.notion.length,
      gong: sourcesByType.gong.length,
      document: sourcesByType.document.length,
      looker: sourcesByType.looker.length,
      total: sources.length,
    };
  }, [sourcesByType, sources.length]);

  return {
    sources,
    sourcesByType,
    countsByType,
    loading,
    error,
    refetch: fetchSources,
  };
}
