'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PersonaAttributes } from '@/types/v2/building-block';

export interface PersonaItem {
  id: string;
  title: string;
  slug?: string;
  content: string;
  summary?: string;
  attributes: PersonaAttributes;
  ownerId: string;
  teamId?: string;
  customerId?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

interface UsePersonasOptions {
  search?: string;
  isDefault?: boolean;
  enabled?: boolean;
}

/**
 * Fetch personas from V2 API
 * Used in chat feature for persona/instruction preset management
 */
export function usePersonas(options: UsePersonasOptions = {}) {
  const { search, isDefault, enabled = true } = options;
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPersonas = useCallback(
    async (forceReset = false) => {
      if (!enabled || forceReset) {
        setPersonas([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('libraryId', 'personas');
        params.set('blockType', 'persona');
        params.set('status', 'ACTIVE');
        params.set('limit', '200');
        params.set('orderBy', 'title');
        params.set('orderDir', 'asc');

        if (search) {
          params.set('search', search);
        }
        if (isDefault !== undefined) {
          params.set('isDefault', String(isDefault));
        }

        const response = await fetch(`/api/v2/blocks?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch personas: ${response.statusText}`);
        }

        const data = await response.json();
        setPersonas(data.blocks || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setPersonas([]);
      } finally {
        setLoading(false);
      }
    },
    [search, isDefault, enabled]
  );

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  return { personas, loading, error, refetch: fetchPersonas };
}
