/**
 * V2 System Settings Page
 *
 * Centralized configuration for branding, integrations, and system settings.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Settings, Palette, Plug, BarChart3, Shield, Zap, Gauge, Clock, Loader, CheckCircle, AlertCircle, XCircle, RotateCw } from "lucide-react";
import UsageTab from "./components/UsageTab";
import AuthGroupsTab from "./components/AuthGroupsTab";
import LLMSpeedTab from "./components/LLMSpeedTab";
import RateLimitsTab from "./components/RateLimitsTab";
import AuditTab from "./components/AuditTab";

type BrandingSettings = {
  appName: string;
  tagline: string;
  sidebarSubtitle: string;
  primaryColor: string;
};

const TABS = [
  { id: "branding", label: "Branding", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "auth-groups", label: "Auth Groups", icon: Shield },
  { id: "llm-speed", label: "LLM Speed", icon: Zap },
  { id: "rate-limits", label: "Rate Limits", icon: Gauge },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "audit", label: "Audit", icon: Clock },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface IntegrationStatus {
  isConfigured: boolean;
  isHealthy: boolean;
  lastError?: string;
  lastChecked?: string;
}

interface IntegrationCardProps {
  title: string;
  description: string;
  type: "slack" | "zendesk" | "notion" | "gong";
  showConfig?: boolean;
}

function IntegrationCard({ title, description, type, showConfig = false }: IntegrationCardProps) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const [internalCompanyName, setInternalCompanyName] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const endpoint = type === 'gong'
          ? `/api/v2/integrations/gong/status?libraryId=gtm`
          : `/api/v2/integrations/status?type=${type}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          // Load config for Gong
          if (type === 'gong') {
            if (data.config?.workspaceId) {
              setWorkspaceId(data.config.workspaceId);
            }
            if (data.config?.internalCompanyName) {
              setInternalCompanyName(data.config.internalCompanyName);
            }
          }
        } else {
          setStatus({ isConfigured: false, isHealthy: false });
        }
      } catch (error) {
        console.error(`[IntegrationCard] Failed to check ${type} status:`, error);
        setStatus({ isConfigured: false, isHealthy: false });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [type]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const endpoint = type === 'gong'
        ? `/api/v2/integrations/gong/status?libraryId=gtm`
        : `/api/v2/integrations/status?type=${type}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (type === 'gong') {
          if (data.config?.workspaceId) {
            setWorkspaceId(data.config.workspaceId);
          }
          if (data.config?.internalCompanyName) {
            setInternalCompanyName(data.config.internalCompanyName);
          }
        }
      } else {
        setStatus({ isConfigured: false, isHealthy: false });
      }
    } catch (error) {
      console.error(`[IntegrationCard] Failed to refresh ${type} status:`, error);
      setStatus({ isConfigured: false, isHealthy: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/v2/integrations/gong/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: 'gtm', // Global config
          ...(workspaceId.trim() && { workspaceId: workspaceId.trim() }),
          ...(internalCompanyName.trim() && { internalCompanyName: internalCompanyName.trim() }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      toast.success('Gong workspace configured successfully');
      setShowConfigPanel(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{description}</p>
        </div>
        <Loader className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  const isHealthy = status?.isHealthy;
  const isConfigured = status?.isConfigured;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{description}</p>
        </div>
        <div className="ml-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!isConfigured ? (
              <>
                <XCircle className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">Not configured</span>
              </>
            ) : isHealthy ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-amber-600">Error</span>
              </>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <RotateCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!isConfigured && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
          {type === 'gong' ? (
            <>
              <strong>Step 1:</strong> Configure credentials in AWS Secrets Manager:
              <ul className="list-disc list-inside mt-2 ml-2 space-y-1">
                <li><code className="text-xs bg-gray-200 px-1 py-0.5 rounded">gong-access-key</code></li>
                <li><code className="text-xs bg-gray-200 px-1 py-0.5 rounded">gong-access-key-secret</code></li>
              </ul>
              <strong className="block mt-3">Step 2:</strong> Configure workspace ID below
            </>
          ) : (
            'Configure credentials in AWS Secrets Manager to enable this integration.'
          )}
        </div>
      )}

      {type === 'gong' && showConfig && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {!showConfigPanel ? (
            <button
              onClick={() => setShowConfigPanel(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {workspaceId ? 'Edit Workspace Configuration' : 'Configure Workspace ID'}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor={`${type}-workspace`} className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace ID
                </label>
                <input
                  id={`${type}-workspace`}
                  type="text"
                  placeholder="e.g., 123456789"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  disabled={savingConfig}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your company&apos;s Gong workspace ID (shared across all customers)
                </p>
              </div>
              <div>
                <label htmlFor={`${type}-company`} className="block text-sm font-medium text-gray-700 mb-1">
                  Your Company Name
                </label>
                <input
                  id={`${type}-company`}
                  type="text"
                  placeholder="e.g., Acme Corp"
                  value={internalCompanyName}
                  onChange={(e) => setInternalCompanyName(e.target.value)}
                  disabled={savingConfig}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used to identify external companies in Gong call titles like &quot;Customer <span className="font-mono">&lt;&gt;</span> Your Company&quot;
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingConfig ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowConfigPanel(false)}
                  disabled={savingConfig}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isConfigured && !isHealthy && status?.lastError && (
        <div className="mt-3 p-3 bg-amber-50 rounded text-sm text-amber-700">
          <strong>Error:</strong> {status.lastError}
        </div>
      )}

      {isConfigured && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
          {status?.lastChecked && `Last checked: ${new Date(status.lastChecked).toLocaleString()}`}
          {type === 'gong' && workspaceId && (
            <span className="ml-3">
              Workspace: <code className="bg-gray-100 px-1 py-0.5 rounded">{workspaceId}</code>
            </span>
          )}
          {type === 'gong' && internalCompanyName && (
            <span className="ml-3">
              Company: <code className="bg-gray-100 px-1 py-0.5 rounded">{internalCompanyName}</code>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>({
    appName: "Transparent Trust",
    tagline:
      "Turn your knowledge into trustworthy answers. An LLM-powered assistant telling you not just the answer, but why.",
    sidebarSubtitle: "Transparent LLM Assistant",
    primaryColor: "var(--accent-cyan)",
  });
  const [savingBranding, setSavingBranding] = useState(false);

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabId>(
    (TABS.find((t) => t.id === tabParam)?.id as TabId) || "branding"
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    fetchSettings();
  }, [session, status, router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      // For now, just load defaults. In the future, fetch from API
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch("/api/v2/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "branding", value: JSON.stringify(branding) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save branding");
      }
      toast.success("Branding saved! Changes will appear on next page load.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save branding"
      );
    } finally {
      setSavingBranding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure branding and system settings
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-8">
          {activeTab === "branding" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  App Branding
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Customize how your app appears to users.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  App Name
                </label>
                <input
                  type="text"
                  value={branding.appName}
                  onChange={(e) =>
                    setBranding({ ...branding, appName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Transparent Trust"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Displayed in the sidebar and homepage
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  value={branding.tagline}
                  onChange={(e) =>
                    setBranding({ ...branding, tagline: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Turn your knowledge into trustworthy answers..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Shown below the app name on the homepage
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sidebar Subtitle
                </label>
                <input
                  type="text"
                  value={branding.sidebarSubtitle}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      sidebarSubtitle: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Transparent LLM Assistant"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Shown below the app name in the sidebar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      setBranding({
                        ...branding,
                        primaryColor: e.target.value,
                      })
                    }
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                  />
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      setBranding({
                        ...branding,
                        primaryColor: e.target.value,
                      })
                    }
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="var(--accent-cyan)"
                  />
                  <div
                    className="px-3 py-1.5 rounded text-white text-sm font-medium"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    Preview
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Used for buttons and accents throughout the app
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingBranding ? "Saving..." : "Save Branding"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Integration Status
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  View the health of configured integrations. Credentials must be configured in AWS Secrets Manager.
                </p>
              </div>

              <div className="space-y-4">
                {/* Gong Integration */}
                <IntegrationCard
                  title="Gong"
                  description="Connect Gong to discover customer call recordings"
                  type="gong"
                  showConfig={true}
                />

                {/* Slack Integration */}
                <IntegrationCard
                  title="Slack"
                  description="Connect Slack channels to discover Q&A threads"
                  type="slack"
                />

                {/* Zendesk Integration */}
                <IntegrationCard
                  title="Zendesk"
                  description="Connect Zendesk to discover resolved tickets"
                  type="zendesk"
                />

                {/* Notion Integration */}
                <IntegrationCard
                  title="Notion"
                  description="Connect Notion databases to discover documentation"
                  type="notion"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>To configure integrations:</strong> Store API credentials in AWS Secrets Manager. See documentation for required secret names and format.
                </p>
              </div>
            </div>
          )}

          {activeTab === "usage" && <UsageTab />}
          {activeTab === "auth-groups" && <AuthGroupsTab />}
          {activeTab === "llm-speed" && <LLMSpeedTab />}
          {activeTab === "rate-limits" && <RateLimitsTab />}
          {activeTab === "audit" && <AuditTab />}
        </div>

        {/* Security Note */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800">Security Note</h3>
          <p className="text-sm text-amber-700 mt-1">
            For production, implement encryption at rest for sensitive values
            and consider using a secrets manager.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            color: "var(--muted-foreground)",
          }}
        >
          Loading settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
