'use client';

import { useEffect, useState, useCallback } from 'react';
import type { KnowledgeBarItem } from '@/types/knowledge-bar';

interface UseCustomerSkillsOptions {
  enabled?: boolean;
  limit?: number;
}

/**
 * Fetch skills scoped to a specific customer across all libraries
 * Customer-scoped skills have libraryId set to knowledge/it/gtm/etc with customerId populated
 */
export function useCustomerSkills(
  customerId: string | null,
  options: UseCustomerSkillsOptions = {}
) {
  const { enabled = true, limit = 200 } = options;
  const [skills, setSkills] = useState<KnowledgeBarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchSkills = useCallback(
    async (offset = 0, forceReset = false) => {
      if (!enabled || !customerId || forceReset) {
        setSkills([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch blocks filtered by customerId across all libraries
        // Customer skills have blockType='knowledge' and customerId set
        const params = new URLSearchParams();
        params.set('customerId', customerId);
        params.set('status', 'ACTIVE');
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        params.set('orderBy', 'title');
        params.set('orderDir', 'asc');

        const response = await fetch(`/api/v2/blocks?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch customer skills: ${response.statusText}`);
        }

        const data = await response.json();
        setSkills(data.blocks || []);
        setHasMore((data.offset || 0) + (data.blocks || []).length < data.total);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setSkills([]);
      } finally {
        setLoading(false);
      }
    },
    [customerId, enabled, limit]
  );

  useEffect(() => {
    fetchSkills(0);
  }, [fetchSkills]);

  return { skills, loading, error, hasMore, refetch: fetchSkills };
}
