/**
 * Looker Discovery Adapter
 *
 * Fetches dashboard data from Looker API and extracts query results for analysis.
 * Used for Operations Audit view on customer profiles.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type { DiscoveryOptions, DiscoveredSource, LookerStagedSource, LookerSourceMetadata } from '@/types/v2';
import { CredentialManager, ApiClient, testConnection } from './utils';
import { logger } from '@/lib/logger';

interface LookerCredentials {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

interface LookerConfig {
  dashboardIds?: Record<
    string,
    {
      id: string; // Dashboard ID
      workspace?: string; // Optional: Looker workspace name
      filters?: Record<string, string>; // Optional: Dashboard filters (filter_name -> value)
    } | string // Or just the ID string for backwards compatibility
  >;
}

interface LookerDashboard {
  id: string;
  title: string;
  description?: string;
  dashboard_elements: Array<{
    id: string;
    title: string;
    body_text?: string;
    query_id?: string;
    look?: {
      query_id: string;
    };
  }>;
}

interface LookerQueryResult {
  data: Array<Record<string, unknown>>;
}

export class LookerDiscoveryAdapter extends BaseDiscoveryAdapter<LookerStagedSource> {
  readonly sourceType = 'looker' as const;
  readonly displayName = 'Looker Dashboards';

  private credentialManager = new CredentialManager<LookerCredentials, LookerConfig>({
    integrationType: 'looker',
    secretNames: ['looker-client-id', 'looker-client-secret', 'looker-base-url'],
    envVarNames: ['LOOKER_CLIENT_ID', 'LOOKER_CLIENT_SECRET', 'LOOKER_BASE_URL'],
    parseCredentials: (secrets) => ({
      clientId: secrets['looker-client-id'] || '',
      clientSecret: secrets['looker-client-secret'] || '',
      baseUrl: secrets['looker-base-url'] || 'https://looker.company.com',
    }),
    parseConfig: (config) => config as LookerConfig,
  });

  private apiClient?: ApiClient;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  // NOTE: apiClient and token are cached at instance level. Token expiry is handled
  // (refreshes 60s before expiry). However, if credentials change mid-session,
  // the cached token will continue to be used until it expires. For credential changes
  // to take effect immediately, a new adapter instance should be created.

  /**
   * Authenticate with Looker API and get access token
   */
  private async getAccessToken(credentials: LookerCredentials): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      // Add 30-second timeout to auth request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${credentials.baseUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Looker auth failed: ${error}`);
        }

        const data = (await response.json()) as { access_token: string; expires_in?: number };
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000; // Refresh 60s before expiry

        return this.accessToken;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      logger.error('Failed to authenticate with Looker', { error });
      throw error;
    }
  }

  /**
   * Get or create API client
   */
  private async getApiClient(credentials: LookerCredentials): Promise<ApiClient> {
    if (this.apiClient) return this.apiClient;

    this.apiClient = new ApiClient({
      baseUrl: credentials.baseUrl,
      getAuthHeaders: async () => ({
        Authorization: `Bearer ${await this.getAccessToken(credentials)}`,
      }),
      minRequestInterval: 100, // 100ms between requests to avoid rate limiting
      maxRetries: 3,
    });

    return this.apiClient;
  }

  /**
   * Test Looker API connection
   */
  async testConnection(credentials?: LookerCredentials): Promise<{ success: boolean; error?: string }> {
    return testConnection(async () => {
      const creds = credentials || (await this.credentialManager.load()).credentials;
      const client = await this.getApiClient(creds);
      await client.get<{ user_id: string }>('/api/4.0/user');
    });
  }

  /**
   * Discover dashboards - in Looker adapter, this fetches a specific dashboard
   * Dashboard ID is retrieved from IntegrationConnection config
   */
  async discover(options: DiscoveryOptions): Promise<DiscoveredSource<LookerStagedSource>[]> {
    try {
      // Load credentials and config
      const { credentials, config } = await this.credentialManager.load({
        libraryId: options.libraryId,
        customerId: options.customerId,
        teamId: options.teamId,
      });

      if (!credentials.clientId || !credentials.clientSecret) {
        throw new Error('Looker credentials not configured');
      }

      // Get dashboard config for this library
      const dashboardConfig = config?.dashboardIds?.[options.libraryId];
      if (!dashboardConfig) {
        logger.warn('No dashboard configured for library', { libraryId: options.libraryId });
        return [];
      }

      // Handle both string and object config formats
      const dashboardId = typeof dashboardConfig === 'string' ? dashboardConfig : dashboardConfig.id;
      const workspaceName = typeof dashboardConfig === 'string' ? undefined : dashboardConfig.workspace;
      const filters = typeof dashboardConfig === 'string' ? undefined : dashboardConfig.filters;

      // Validate dashboardId format (alphanumeric, underscores, hyphens only)
      if (!/^[a-zA-Z0-9_-]+$/.test(dashboardId)) {
        throw new Error(`Invalid dashboard ID format: ${dashboardId}`);
      }

      // Fetch dashboard
      const client = await this.getApiClient(credentials);
      const dashboardEndpoint = workspaceName
        ? `/api/4.0/dashboards/${dashboardId}?Workspace%20name=${encodeURIComponent(workspaceName)}`
        : `/api/4.0/dashboards/${dashboardId}`;
      const dashboard = await client.get<LookerDashboard>(dashboardEndpoint);

      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      // Extract queries and run them to get results
      const tiles = dashboard.dashboard_elements || [];
      const queryResults: Array<{
        tileId: string;
        tileTitle: string;
        queryId?: string;
        results: Record<string, unknown>[];
      }> = [];
      const failedQueries: Array<{ queryId: string; error: string }> = [];

      // Get tiles with queries
      const tilesWithQueries = tiles.filter((t) => t.query_id || t.look?.query_id);

      for (const tile of tiles) {
        const queryId = tile.query_id || tile.look?.query_id;
        if (!queryId) continue;

        try {
          // Build query params with filters if provided
          const queryParams: Record<string, string> = { result_format: 'json' };
          if (filters) {
            for (const [filterName, filterValue] of Object.entries(filters)) {
              queryParams[filterName] = filterValue;
            }
          }
          const results = await client.post<LookerQueryResult>(`/api/4.0/queries/${queryId}/run`, queryParams);

          queryResults.push({
            tileId: tile.id,
            tileTitle: tile.title || `Tile ${tile.id}`,
            queryId,
            results: results.data || [],
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedQueries.push({ queryId, error: errorMessage });
          logger.warn('Failed to fetch query results', { queryId, error: errorMessage });
        }
      }

      // If all queries failed, throw an error
      if (tilesWithQueries.length > 0 && failedQueries.length === tilesWithQueries.length) {
        throw new Error(
          `All ${failedQueries.length} Looker queries failed. First error: ${failedQueries[0].error}`
        );
      }

      // Build discovered source with all dashboard data
      const source: DiscoveredSource<LookerStagedSource> = {
        externalId: dashboardId,
        title: dashboard.title,
        content: JSON.stringify(
          {
            dashboardTitle: dashboard.title,
            dashboardDescription: dashboard.description,
            tileCount: tiles.length,
            queryResults,
          },
          null,
          2
        ),
        contentPreview: `Dashboard: ${dashboard.title} (${tiles.length} tiles, ${queryResults.length} queries)`,
        metadata: {
          dashboardId,
          dashboardTitle: dashboard.title,
          dashboardDescription: dashboard.description,
          tileCount: tiles.length,
          queryCount: queryResults.length,
          lastFetched: new Date().toISOString(),
        } as LookerSourceMetadata,
      };

      return [source];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Looker discovery failed', { libraryId: options.libraryId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Fetch full dashboard content for lazy loading
   * @throws Error if dashboard cannot be fetched
   */
  async fetchContent(dashboardId: string): Promise<string> {
    // Validate dashboardId format
    if (!/^[a-zA-Z0-9_-]+$/.test(dashboardId)) {
      throw new Error(`Invalid dashboard ID format: ${dashboardId}`);
    }

    const { credentials } = await this.credentialManager.load();
    const client = await this.getApiClient(credentials);

    const dashboard = await client.get<LookerDashboard>(`/api/4.0/dashboards/${dashboardId}`);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    return JSON.stringify(dashboard, null, 2);
  }
}

// Export singleton instance for registration
export const lookerAdapter = new LookerDiscoveryAdapter();
