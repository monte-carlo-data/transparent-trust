'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Loader2, Check, Plus, Trash2 } from 'lucide-react';

interface DashboardConfig {
  id: string;
  workspace?: string;
  filters?: Record<string, string>;
}

interface LookerConfigFormProps {
  teamId: string;
  libraryId: string;
  /** Optional audit type for audit-specific dashboard configs (coverage, operations, adoption) */
  auditType?: string;
  onSave?: (config: DashboardConfig) => void;
}

export function LookerConfigForm({ teamId, libraryId, auditType, onSave }: LookerConfigFormProps) {
  // Use combined key for audit-specific dashboards: 'customers:coverage', 'customers:operations', etc.
  const configKey = auditType ? `${libraryId}:${auditType}` : libraryId;
  const [dashboardId, setDashboardId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [filters, setFilters] = useState<Array<{ name: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<DashboardConfig | null>(null);

  const fetchCurrentConfig = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/integrations/looker/config?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        const config = data.config?.dashboardIds?.[configKey];
        if (config) {
          const dashConfig = typeof config === 'string' ? { id: config } : config;
          setCurrentConfig(dashConfig);
          setDashboardId(dashConfig.id);
          setWorkspaceName(dashConfig.workspace || '');
          // Convert filters object to array for UI
          if (dashConfig.filters) {
            setFilters(
              Object.entries(dashConfig.filters).map(([name, value]) => ({ name, value: String(value) }))
            );
          }
        }
      } else if (res.status === 403) {
        setError('You do not have permission to access this team configuration');
      } else if (res.status !== 404) {
        // 404 is expected when no config exists yet
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load configuration');
      }
    } catch {
      setError('Failed to connect to server. Please check your connection.');
    } finally {
      setInitialLoading(false);
    }
  }, [teamId, configKey]);

  // Load current config on mount
  useEffect(() => {
    fetchCurrentConfig();
  }, [fetchCurrentConfig]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(false);

      if (!dashboardId.trim()) {
        setError('Dashboard ID is required');
        return;
      }

      setLoading(true);
      try {
        // Get existing config first
        const getRes = await fetch(`/api/v2/integrations/looker/config?teamId=${teamId}`);
        let existingConfig: Record<string, unknown> = {};

        if (getRes.ok) {
          const data = await getRes.json();
          existingConfig = (data.config?.dashboardIds || {}) as Record<string, unknown>;
        }

        // Build filters object from array (filter out empty entries)
        const filtersObj: Record<string, string> = {};
        for (const f of filters) {
          if (f.name.trim() && f.value.trim()) {
            filtersObj[f.name.trim()] = f.value.trim();
          }
        }

        // Build new config
        const newConfig: DashboardConfig = {
          id: dashboardId.trim(),
          ...(workspaceName.trim() && { workspace: workspaceName.trim() }),
          ...(Object.keys(filtersObj).length > 0 && { filters: filtersObj }),
        };

        // Merge with existing configs for other libraries/audit types
        const updatedDashboardIds = {
          ...existingConfig,
          [configKey]: newConfig,
        };

        // Save
        const saveRes = await fetch('/api/v2/integrations/looker/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            dashboardIds: updatedDashboardIds,
          }),
        });

        if (!saveRes.ok) {
          const errorData = await saveRes.json();
          throw new Error(errorData.error || 'Failed to save configuration');
        }

        setCurrentConfig(newConfig);
        setSuccess(true);
        onSave?.(newConfig);

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save configuration');
      } finally {
        setLoading(false);
      }
    },
    [teamId, configKey, dashboardId, workspaceName, filters, onSave]
  );

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Looker Dashboard Configuration</h3>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Looker Dashboard Configuration</h3>

        {currentConfig && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Current:</strong> Dashboard {currentConfig.id}
              {currentConfig.workspace && ` (Workspace: ${currentConfig.workspace})`}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dashboard ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dashboardId}
              onChange={(e) => setDashboardId(e.target.value)}
              placeholder="e.g., 892"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in the dashboard URL: https://looker.com/dashboards/[ID]
            </p>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g., aer-lingus"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Workspace name from URL query parameter (Workspace name=...)
            </p>
          </div>

          {/* Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard Filters <span className="text-gray-400">(optional)</span>
            </label>
            <div className="space-y-2">
              {filters.map((filter, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={filter.name}
                    onChange={(e) => {
                      const updated = [...filters];
                      updated[index].name = e.target.value;
                      setFilters(updated);
                    }}
                    placeholder="Filter name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => {
                      const updated = [...filters];
                      updated[index].value = e.target.value;
                      setFilters(updated);
                    }}
                    placeholder="Filter value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setFilters(filters.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFilters([...filters, { name: '', value: '' }])}
                className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                disabled={loading}
              >
                <Plus className="w-4 h-4" />
                Add filter
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Optional: Add filters to apply to all dashboard queries (e.g., &quot;Workspace name&quot; = &quot;aer-lingus&quot;)
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded p-3">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Configuration saved successfully</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-400 font-medium text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </form>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border rounded-lg p-3">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> This configuration maps{' '}
          <code className="bg-white px-1 rounded">{configKey}</code> to a specific Looker dashboard.
          {auditType && ` The ${auditType.charAt(0).toUpperCase() + auditType.slice(1)} Audit view will use this dashboard.`}
        </p>
      </div>
    </div>
  );
}
