'use client';

/**
 * ApplyFoundationalModal
 *
 * Modal for selecting customers to apply a foundational skill to.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Customer {
  id: string;
  name: string;
  slug: string;
}

interface ApplyFoundationalModalProps {
  isOpen: boolean;
  skillId: string;
  skillTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ApplyFoundationalModal({
  isOpen,
  skillId,
  skillTitle,
  onClose,
  onSuccess,
}: ApplyFoundationalModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  async function loadCustomers() {
    try {
      setIsLoadingCustomers(true);
      setError(null);

      const response = await fetch('/api/v2/customers');
      if (!response.ok) {
        throw new Error('Failed to load customers');
      }

      const result = await response.json();
      setCustomers(result.customers?.map((c: { id: string; company?: string; name?: string; slug?: string }) => ({
        id: c.id,
        name: c.company || c.name || 'Unnamed Customer',
        slug: c.slug || c.id,
      })) || []);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  }

  function toggleCustomer(customerId: string) {
    const newSelected = new Set(selectedCustomerIds);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomerIds(newSelected);
  }

  function selectAll() {
    setSelectedCustomerIds(new Set(customers.map(c => c.id)));
  }

  function deselectAll() {
    setSelectedCustomerIds(new Set());
  }

  async function handleApply() {
    if (selectedCustomerIds.size === 0) {
      setError('Please select at least one customer');
      return;
    }

    try {
      setIsApplying(true);
      setError(null);

      const response = await fetch(`/api/v2/skills/${skillId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: Array.from(selectedCustomerIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply foundational skill');
      }

      const result = await response.json();

      // Show summary
      if (result.data.errors.length > 0) {
        const errorMessage = `Applied to ${result.data.clonedSkills.length} customers, but failed for ${result.data.errors.length} customers`;
        setError(errorMessage);
      } else {
        onSuccess?.();
      }
    } catch (err) {
      console.error('Error applying foundational skill:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply skill');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply &quot;{skillTitle}&quot; to Customers</DialogTitle>
        </DialogHeader>

        {isLoadingCustomers ? (
          <div className="py-8 text-center text-gray-500">Loading customers...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                Select customers to apply this foundational skill to:
              </p>
              <div className="space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  disabled={isApplying}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  disabled={isApplying}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="border rounded-md max-h-96 overflow-y-auto">
              {customers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No customers found</div>
              ) : (
                <div className="divide-y">
                  {customers.map((customer) => (
                    <label
                      key={customer.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.has(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                        disabled={isApplying}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.slug}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isApplying}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={isApplying || selectedCustomerIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isApplying ? 'Applying...' : `Apply to ${selectedCustomerIds.size} Customer(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
