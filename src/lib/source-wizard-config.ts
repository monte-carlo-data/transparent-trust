/**
 * Source Wizard Configuration Registry
 *
 * Defines behavior for all 6 source types (Slack, Zendesk, Notion, Gong, URL, Document).
 * Each source specifies:
 * - Discovery API configuration (how to fetch from external systems)
 * - Config panel type (UI for source-specific settings)
 * - Source type filters for CreateWizard
 * - Quick-assign support
 */

import type { LibraryId } from '@/types/v2';

/**
 * Configuration for discovering sources from external APIs
 */
export interface DiscoveryApiConfig {
  /** Endpoint to fetch sources (e.g., /api/slack/sources/threads) */
  fetchEndpoint: (libraryId: LibraryId, sinceDays: number, customerId?: string) => string;

  /** Endpoint to stage discovered sources (e.g., /api/slack/sources/staged) */
  stageEndpoint: string;

  /** Key name for items in the stage request body (e.g., 'threads', 'tickets') */
  stageBodyKey: string;

  /** How to extract the items from API response */
  extractItems: (data: unknown) => unknown[];

  /** Whether there are more items available (hasMore pattern) */
  hasMore?: (data: unknown) => boolean;

  /** For page-based paginated APIs: extract current page and update state */
  pagination?: {
    /** Extract page number from response */
    currentPage: (data: unknown) => number;
    /** Whether more pages exist */
    hasMore: (data: unknown) => boolean;
  };

  /** For cursor-based paginated APIs (e.g., Gong) */
  cursorPagination?: {
    /** Extract cursor from response for next page */
    getCursor: (data: unknown) => string | undefined;
    /** Build URL with cursor parameter */
    buildUrl: (baseUrl: string, cursor: string) => string;
  };

  /** For time-based discovery: extract the time range used */
  timeRange?: {
    /** Extract the "since" date from response */
    since: (data: unknown) => string;
  };

  /** Name of the items being discovered (e.g., "threads", "tickets", "pages") */
  itemLabel: string;
}

/**
 * Configuration for the source-specific setup panel
 */
export type ConfigPanelType = 'slack-channel' | 'notion-import' | 'url-stage' | 'document-stage' | 'zendesk-filter' | 'gong-config' | 'none';

export interface ConfigPanelConfig {
  type: ConfigPanelType;
  /** Whether to show setup panel when no sources exist */
  showWhenEmpty?: boolean;
}

/**
 * Complete configuration for a source type
 */
export interface SourceWizardConfig {
  /** Display label (e.g., "Slack threads", "Zendesk tickets") */
  label: string;

  /** Label for skill generation progress (e.g., "Generating skill from Slack threads") */
  generatingLabel: string;

  /** Source types to filter in CreateWizard */
  sourceTypeFilter: string[];

  /** Discovery API configuration (optional - some sources don't have discovery) */
  discovery?: DiscoveryApiConfig;

  /** Configuration panel for source-specific settings */
  configPanel?: ConfigPanelConfig;

  /** Whether quick-assign is supported */
  supportsQuickAssign: boolean;
}

/**
 * Registry of all source type configurations
 */
export const SOURCE_WIZARD_CONFIGS: Record<string, SourceWizardConfig> = {
  slack: {
    label: 'Slack threads',
    generatingLabel: 'Generating skill from Slack threads',
    sourceTypeFilter: ['slack'],
    discovery: {
      fetchEndpoint: (libraryId, sinceDays, customerId) => {
        const since = Math.floor((Date.now() - sinceDays * 24 * 60 * 60 * 1000) / 1000);
        const params = [`limit=25`, `since=${since}`, `libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);
        return `/api/v2/integrations/slack/discover?${params.join('&')}`;
      },
      stageEndpoint: '/api/v2/integrations/slack/stage',
      stageBodyKey: 'items',
      extractItems: (data: unknown) => {
        const typedData = data as Record<string, unknown>;
        return (typedData.items as unknown[]) || [];
      },
      hasMore: (data: unknown) => {
        const typedData = data as { pagination?: { hasMore?: boolean } };
        return Boolean(typedData.pagination?.hasMore);
      },
      itemLabel: 'threads',
    },
    configPanel: {
      type: 'slack-channel',
      showWhenEmpty: true,
    },
    supportsQuickAssign: true,
  },

  zendesk: {
    label: 'Zendesk tickets',
    generatingLabel: 'Generating skill from Zendesk tickets',
    sourceTypeFilter: ['zendesk'],
    discovery: {
      fetchEndpoint: (libraryId, sinceDays, customerId) => {
        const since = Math.floor((Date.now() - sinceDays * 24 * 60 * 60 * 1000) / 1000);
        const params = [`limit=25`, `since=${since}`, `libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);
        return `/api/v2/integrations/zendesk/discover?${params.join('&')}`;
      },
      stageEndpoint: '/api/v2/integrations/zendesk/stage',
      stageBodyKey: 'items',
      extractItems: (data: unknown) => {
        const typedData = data as Record<string, unknown>;
        return (typedData.items as unknown[]) || [];
      },
      hasMore: (data: unknown) => {
        const typedData = data as { pagination?: { hasMore?: boolean } };
        return Boolean(typedData.pagination?.hasMore);
      },
      pagination: {
        currentPage: (data: unknown) => {
          const typedData = data as { pagination?: { page?: number } };
          return typedData.pagination?.page || 1;
        },
        hasMore: (data: unknown) => {
          const typedData = data as { pagination?: { hasMore?: boolean } };
          return Boolean(typedData.pagination?.hasMore);
        },
      },
      itemLabel: 'tickets',
    },
    configPanel: {
      type: 'zendesk-filter',
      showWhenEmpty: false,
    },
    supportsQuickAssign: true,
  },

  notion: {
    label: 'Notion pages',
    generatingLabel: 'Generating skill from Notion pages',
    sourceTypeFilter: ['notion'],
    // No discovery - Notion pages are imported by URL via the config panel
    configPanel: {
      type: 'notion-import',
      showWhenEmpty: true,
    },
    supportsQuickAssign: false,
  },

  gong: {
    label: 'Gong calls',
    generatingLabel: 'Generating skill from Gong calls',
    sourceTypeFilter: ['gong'],
    discovery: {
      fetchEndpoint: (libraryId, sinceDays, customerId) => {
        const since = Math.floor((Date.now() - sinceDays * 24 * 60 * 60 * 1000) / 1000);
        const params = [`limit=25`, `since=${since}`, `libraryId=${libraryId}`];
        if (customerId) params.push(`customerId=${customerId}`);
        return `/api/v2/integrations/gong/discover?${params.join('&')}`;
      },
      stageEndpoint: '/api/v2/integrations/gong/stage',
      stageBodyKey: 'items',
      extractItems: (data: unknown) => {
        const typedData = data as Record<string, unknown>;
        return (typedData.items as unknown[]) || [];
      },
      hasMore: (data: unknown) => {
        const typedData = data as { pagination?: { hasMore?: boolean; cursor?: string } };
        return Boolean(typedData.pagination?.hasMore) || Boolean(typedData.pagination?.cursor);
      },
      cursorPagination: {
        getCursor: (data: unknown) => {
          const typedData = data as { pagination?: { cursor?: string } };
          return typedData.pagination?.cursor;
        },
        buildUrl: (baseUrl: string, cursor: string) => {
          const separator = baseUrl.includes('?') ? '&' : '?';
          return `${baseUrl}${separator}cursor=${encodeURIComponent(cursor)}`;
        },
      },
      itemLabel: 'calls',
    },
    configPanel: {
      type: 'gong-config',
      showWhenEmpty: true,
    },
    supportsQuickAssign: false,
  },

  url: {
    label: 'URLs',
    generatingLabel: 'Generating from URLs',
    sourceTypeFilter: ['url'],
    configPanel: {
      type: 'url-stage',
      showWhenEmpty: true,
    },
    supportsQuickAssign: true,
  },

  document: {
    label: 'Documents',
    generatingLabel: 'Generating from documents',
    sourceTypeFilter: ['document'],
    configPanel: {
      type: 'document-stage',
      showWhenEmpty: true,
    },
    supportsQuickAssign: true,
  },
};

/**
 * Get configuration for a source type
 * @throws Error if source type is not recognized
 */
export function getSourceWizardConfig(sourceType: string): SourceWizardConfig {
  const config = SOURCE_WIZARD_CONFIGS[sourceType];
  if (!config) {
    throw new Error(
      `Unknown source type: ${sourceType}. Available: ${Object.keys(SOURCE_WIZARD_CONFIGS).join(', ')}`
    );
  }
  return config;
}
