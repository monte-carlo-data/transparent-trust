'use client';

/**
 * Gong Configuration Panel
 * Maps customers to Gong workspace IDs to prevent cross-customer data leakage
 *
 * For library-scoped context (no customerId):
 * - Shows info panel explaining how to link calls (via bulk selection toolbar)
 *
 * For customer-scoped context (with customerId):
 * - Shows configuration options for customer-specific Gong settings
 */

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface GongConfigPanelProps {
  libraryId: LibraryId;
  customerId?: string;
}

interface GongConfig {
  workspaceId?: string;
  minDuration?: number;
  crmId?: string;
  domain?: string;
}

export function GongConfigPanel({ libraryId, customerId }: GongConfigPanelProps) {
  const [minDuration, setMinDuration] = useState<number>(0);
  const [crmId, setCrmId] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const params = [`libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);

        const response = await fetch(`/api/v2/integrations/gong/status?${params.join('&')}`);
        if (response.ok) {
          const data = await response.json();
          const config = data.config as GongConfig | undefined;

          if (config) {
            setMinDuration(config.minDuration || 0);
            setCrmId(config.crmId || '');
            setDomain(config.domain || '');
            setIsConfigured(true);
          }
        }
      } catch (error) {
        console.error('Failed to load Gong config:', error);
        setError(
          `Failed to load existing configuration: ${
            error instanceof Error ? error.message : 'Network error'
          }. You can still save new configuration.`
        );
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, [libraryId, customerId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/v2/integrations/gong/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          minDuration: minDuration > 0 ? minDuration : undefined,
          crmId: crmId.trim() || undefined,
          domain: domain.trim() || undefined,
          ...(customerId && { customerId }),
        }),
      });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Response wasn't JSON - use status-based message
          if (response.status === 401) {
            errorMessage = 'Authentication required - please log in again';
          } else if (response.status === 403) {
            errorMessage = 'You do not have permission to configure Gong';
          } else if (response.status === 404) {
            errorMessage = 'Configuration endpoint not found - please contact support';
          } else if (response.status >= 500) {
            errorMessage = 'Server error - please try again later';
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save configuration');
      }

      setIsConfigured(true);
      setSuccessMessage('Configuration saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save Gong config:', error);
      setError(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-600">Loading configuration...</span>
        </div>
      </div>
    );
  }

  // For library-scoped context (no customerId), show info panel only
  // The "Link to Customer" button is now in the bulk selection toolbar
  if (!customerId) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Gong Call Linking</h3>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Gong calls discovered here can be linked to specific customers. Once linked, they appear in the customer&apos;s knowledge base for skill creation.
          </p>
          <p className="text-sm text-blue-700 mt-2">
            <strong>To link calls:</strong> Select one or more calls below, then click &quot;Link to Customer&quot; in the toolbar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Gong Configuration</h3>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ℹ️ <strong>Global Settings:</strong> Workspace ID and API credentials are configured in <a href="/v2/admin/settings?tab=integrations" className="underline font-medium">Admin Settings → Integrations</a>
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="minDuration" className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Call Duration (seconds)
          </label>
          <input
            id="minDuration"
            type="number"
            min="0"
            step="60"
            placeholder="0 (no filter)"
            value={minDuration || ''}
            onChange={(e) => setMinDuration(parseInt(e.target.value) || 0)}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional: Only discover calls longer than this duration (e.g., 300 for 5 minutes)
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="crmId" className="block text-sm font-medium text-gray-700 mb-1">
            CRM Customer ID
          </label>
          <input
            id="crmId"
            type="text"
            placeholder="e.g., acme-corp or cust_12345"
            value={crmId}
            onChange={(e) => setCrmId(e.target.value)}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional: If provided, all discovered calls will be assigned to this customer
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
            Email Domain for Customer Matching
          </label>
          <input
            id="domain"
            type="text"
            placeholder="e.g., acme.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional: Calls with external participants from this domain will be assigned to this customer (unless CRM ID is set)
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </button>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 flex items-start gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3 border border-green-200">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{successMessage}</p>
          </div>
        )}

        {isConfigured && !successMessage && (
          <div className="mt-3 flex items-start gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-3 border border-blue-200">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Gong discovery is configured for this customer</p>
          </div>
        )}
      </div>
    </div>
  );
}
