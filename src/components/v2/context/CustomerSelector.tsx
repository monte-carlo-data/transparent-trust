'use client';

import { useState, useEffect } from 'react';

interface Customer {
  id: string;
  company: string;
  slug: string;
}

interface CustomerSelectorProps {
  value: string | undefined;
  onChange: (customerId: string | undefined) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function CustomerSelector({
  value,
  onChange,
  isLoading = false,
  placeholder = 'Select customer (optional)...',
}: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/v2/customers?limit=100&sort=company');
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || []);
        } else {
          setError('Failed to load customers');
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customers');
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Customer Context (Optional)
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={isLoading || loading}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.company}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
      {value && (
        <p className="mt-1 text-xs text-slate-500">
          Customer-specific skills will be included in the context
        </p>
      )}
    </div>
  );
}
