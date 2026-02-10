'use client';

/**
 * LinkToCustomerModal
 *
 * Modal for linking library-scoped sources to specific customers.
 * Supports both single source linking and bulk selection from linkable sources.
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link2, Search, CheckCircle2, Users } from 'lucide-react';
import type { LibraryId, SourceType } from '@/types/v2';

interface Customer {
  id: string;
  name: string;
  slug: string;
}

interface LinkableSource {
  id: string;
  title: string;
  sourceType: string;
  externalId: string;
  contentPreview?: string;
  stagedAt: string;
  matchedCustomerId?: string;
  linkedToCustomers: Array<{
    customerId: string;
    customerName?: string;
  }>;
  metadata?: Record<string, unknown>;
}

interface LinkToCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Library to query sources from (e.g., 'gtm') */
  libraryId: LibraryId;
  /** Filter by source type (e.g., 'gong') */
  sourceType?: SourceType;
  /** Pre-selected source ID (for single source linking) */
  sourceId?: string;
  /** Pre-selected source title (for display) */
  sourceTitle?: string;
  /** Pre-selected source IDs (for bulk linking from external selection) */
  preSelectedSourceIds?: string[];
}

export function LinkToCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  libraryId,
  sourceType,
  sourceId,
  sourceTitle,
  preSelectedSourceIds,
}: LinkToCustomerModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sources, setSources] = useState<LinkableSource[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    sourceId ? new Set([sourceId]) : preSelectedSourceIds?.length ? new Set(preSelectedSourceIds) : new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Define callbacks first (before useEffects that use them)
  const loadCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/customers');
      if (!response.ok) throw new Error('Failed to load customers');

      const result = await response.json();
      setCustomers(
        result.customers?.map((c: { id: string; company?: string; name?: string; slug?: string }) => ({
          id: c.id,
          name: c.company || c.name || 'Unnamed Customer',
          slug: c.slug || c.id,
        })) || []
      );
    } catch (err) {
      console.error('Error loading customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    }
  }, []);

  const loadSources = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        libraryId,
        limit: '100',
      });
      if (sourceType) params.set('sourceType', sourceType);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/v2/sources/linkable?${params}`);
      if (!response.ok) throw new Error('Failed to load sources');

      const result = await response.json();
      setSources(result.sources || []);
    } catch (err) {
      console.error('Error loading sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  }, [libraryId, sourceType, searchQuery]);

  // Load customers on open
  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      // Load sources unless we have a single pre-selected source
      // (bulk pre-selection still needs to load sources to show the list)
      if (!sourceId) {
        loadSources();
      }
    }
  }, [isOpen, sourceId, loadCustomers, loadSources]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedSourceIds(
        sourceId
          ? new Set([sourceId])
          : preSelectedSourceIds?.length
            ? new Set(preSelectedSourceIds)
            : new Set()
      );
      setSelectedCustomerId(null);
      setSearchQuery('');
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, sourceId, preSelectedSourceIds]);

  // Reload sources when search changes (only in bulk selection mode)
  useEffect(() => {
    if (isOpen && !sourceId) {
      const debounce = setTimeout(() => {
        loadSources();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery, isOpen, sourceId, loadSources]);

  const toggleSource = (id: string) => {
    const newSelected = new Set(selectedSourceIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSourceIds(newSelected);
  };

  const handleLink = async () => {
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }

    if (selectedSourceIds.size === 0) {
      setError('Please select at least one source');
      return;
    }

    try {
      setIsLinking(true);
      setError(null);

      const response = await fetch('/api/v2/sources/link-to-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds: Array.from(selectedSourceIds),
          customerId: selectedCustomerId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link sources');
      }

      const result = await response.json();

      if (result.errors?.length > 0) {
        // Build detailed error message showing which sources failed
        const failedDetails = result.errors
          .slice(0, 3) // Show max 3 errors
          .map((e: { sourceId: string; error: string }) => `• ${e.error}`)
          .join('\n');
        const moreText =
          result.errors.length > 3 ? `\n...and ${result.errors.length - 3} more` : '';
        setError(
          `Linked ${result.linked} source(s), but ${result.errors.length} failed:\n${failedDetails}${moreText}`
        );
      } else {
        setSuccessMessage(`Successfully linked ${result.linked} source(s) to customer`);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Error linking sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to link sources');
    } finally {
      setIsLinking(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Filter sources that aren't already linked to selected customer
  const filteredSources = selectedCustomerId
    ? sources.filter((s) => !s.linkedToCustomers.some((l) => l.customerId === selectedCustomerId))
    : sources;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Sources to Customer
          </DialogTitle>
        </DialogHeader>

        {successMessage ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. Select Customer
              </label>
              <div className="relative">
                <select
                  value={selectedCustomerId || ''}
                  onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                  disabled={isLinking}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Choose a customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source Selection */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  2. Select Sources to Link
                  {selectedSourceIds.size > 0 && (
                    <span className="ml-2 text-blue-600">({selectedSourceIds.size} selected)</span>
                  )}
                </label>
                {sourceId ? (
                  <span className="text-sm text-gray-500">
                    Linking: {sourceTitle || sourceId}
                  </span>
                ) : (
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search sources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {!sourceId && (
                <div className="border rounded-lg flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading sources...</div>
                  ) : filteredSources.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {selectedCustomerId
                        ? 'All sources already linked to this customer'
                        : 'No linkable sources found'}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredSources.map((source) => (
                        <label
                          key={source.id}
                          className="flex items-start p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSourceIds.has(source.id)}
                            onChange={() => toggleSource(source.id)}
                            disabled={isLinking}
                            className="mt-1 mr-3"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {source.title}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {source.sourceType}
                              </span>
                            </div>
                            {source.contentPreview && (
                              <p className="text-sm text-gray-500 truncate mt-0.5">
                                {source.contentPreview}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>{formatDate(source.stagedAt)}</span>
                              {source.linkedToCustomers.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Linked to {source.linkedToCustomers.length} customer(s)
                                </span>
                              )}
                              {source.matchedCustomerId && (
                                <span className="text-blue-500">
                                  Auto-matched
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {sourceId && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600">
                    You are about to link the source &quot;{sourceTitle}&quot; to{' '}
                    {selectedCustomer ? (
                      <strong>{selectedCustomer.name}</strong>
                    ) : (
                      'the selected customer'
                    )}
                    .
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLinking}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLink}
                disabled={isLinking || !selectedCustomerId || selectedSourceIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLinking ? 'Linking...' : `Link ${selectedSourceIds.size} Source(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
