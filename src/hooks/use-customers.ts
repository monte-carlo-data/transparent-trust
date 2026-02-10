'use client';

import { useEffect, useState, useCallback } from 'react';

export interface CustomerItem {
  id: string;
  name: string;
  slug?: string;
  tier?: 'startup' | 'growth' | 'enterprise';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

interface UseCustomersOptions {
  search?: string;
  tier?: 'startup' | 'growth' | 'enterprise';
  enabled?: boolean;
}

/**
 * Fetch customers for use in chat context selection
 * Customers are first-class entities in V2 architecture
 */
export function useCustomers(options: UseCustomersOptions = {}) {
  const { search, tier, enabled = true } = options;
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = useCallback(
    async (forceReset = false) => {
      if (!enabled || forceReset) {
        setCustomers([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('limit', '200');
        params.set('orderBy', 'name');
        params.set('orderDir', 'asc');

        if (search) {
          params.set('search', search);
        }
        if (tier) {
          params.set('tier', tier);
        }

        const response = await fetch(`/api/v2/customers?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.statusText}`);
        }

        const data = await response.json();
        setCustomers(data.customers || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    },
    [search, tier, enabled]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, error, refetch: fetchCustomers };
}
