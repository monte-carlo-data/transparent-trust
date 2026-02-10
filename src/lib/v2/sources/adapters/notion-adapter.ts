/**
 * Notion Discovery Adapter
 *
 * Discovers and stages content from Notion pages and databases.
 * Requires Notion Integration Token configured in AWS Secrets Manager.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  NotionStagedSource,
  NotionSourceMetadata,
} from '@/types/v2';
import { CredentialManager, ApiClient, testConnection } from './utils';
import { logger } from '@/lib/logger';

interface NotionCredentials {
  integrationToken: string;
}

interface NotionConfig {
  databaseIds?: string[]; // Specific databases to sync
  pageIds?: string[]; // Specific pages to sync
  rootPageId?: string; // Sync all children of this page
}

interface NotionPage {
  id: string;
  parent: {
    type: 'database_id' | 'page_id' | 'workspace';
    database_id?: string;
    page_id?: string;
  };
  properties: Record<string, NotionProperty>;
  icon: { type: string; emoji?: string; external?: { url: string }; file?: { url: string } } | null;
  cover: { type: string; external?: { url: string }; file?: { url: string } } | null;
  created_by: { id: string };
  last_edited_by: { id: string };
  created_time: string;
  last_edited_time: string;
  url: string;
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  // ... other property types
}

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[]; // Populated for blocks with children (tables, toggles)
  table?: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
  table_row?: {
    cells: Array<Array<{ plain_text: string }>>;
  };
  [key: string]: unknown;
}

export class NotionDiscoveryAdapter extends BaseDiscoveryAdapter<NotionStagedSource> {
  readonly sourceType = 'notion' as const;
  readonly displayName = 'Notion Pages';

  private credentialManager = new CredentialManager<NotionCredentials, NotionConfig>({
    integrationType: 'notion',
    secretNames: ['notion-api-token'],
    envVarNames: ['NOTION_API_TOKEN'],
    parseCredentials: (secrets) => ({
      integrationToken: secrets['notion-api-token'] || '',
    }),
    parseConfig: (config) => config as NotionConfig,
  });

  private apiClient?: ApiClient;

  /**
   * Initialize API client on first use
   */
  private async getApiClient(credentials: NotionCredentials): Promise<ApiClient> {
    if (this.apiClient) return this.apiClient;

    this.apiClient = new ApiClient({
      baseUrl: 'https://api.notion.com/v1',
      getAuthHeaders: () => ({
        'Authorization': `Bearer ${credentials.integrationToken}`,
        'Notion-Version': '2022-06-28',
      }),
    });

    return this.apiClient;
  }

  /**
   * Discover pages from Notion.
   */
  async discover(options: DiscoveryOptions): Promise<DiscoveredSource<NotionStagedSource>[]> {
    const { credentials, config } = await this.credentialManager.load({
      connectionId: options.connectionId,
      libraryId: options.libraryId,
      customerId: options.customerId,
    });
    const client = await this.getApiClient(credentials);
    const { since, limit = 50, config: overrideConfig } = options;

    // Apply config overrides if provided
    const finalConfig: NotionConfig | undefined = overrideConfig
      ? { ...config, ...(overrideConfig as NotionConfig) }
      : config;

    const discovered: DiscoveredSource<NotionStagedSource>[] = [];

    // Discover from configured databases
    if (finalConfig?.databaseIds?.length) {
      for (const dbId of finalConfig.databaseIds) {
        const pages = await this.queryDatabase(dbId, since, limit - discovered.length, client);
        const sources = await this.pagesToSources(pages, client);
        discovered.push(...sources);
        if (discovered.length >= limit) break;
      }
    }

    // Discover from configured pages
    if (finalConfig?.pageIds?.length && discovered.length < limit) {
      const pages = await Promise.all(
        finalConfig.pageIds.map((id) => this.getPage(id, client))
      );
      const filtered = pages.filter((p) => !since || new Date(p.last_edited_time) >= since);
      const sources = await this.pagesToSources(filtered, client);
      discovered.push(...sources);
    }

    // Discover from root page children
    if (finalConfig?.rootPageId && discovered.length < limit) {
      const children = await this.getPageChildren(finalConfig.rootPageId, since, limit - discovered.length, client);
      const sources = await this.pagesToSources(children, client);
      discovered.push(...sources);
    }

    // If no specific config, search all accessible pages
    if (!finalConfig?.databaseIds?.length && !finalConfig?.pageIds?.length && !finalConfig?.rootPageId) {
      const pages = await this.searchPages(since, limit, client);
      const sources = await this.pagesToSources(pages, client);
      discovered.push(...sources);
    }

    return discovered;
  }

  /**
   * Query a database for pages.
   */
  private async queryDatabase(
    databaseId: string,
    since?: Date,
    limit: number = 100,
    client?: ApiClient
  ): Promise<NotionPage[]> {
    if (!client) throw new Error('API client required');
    const filter = since ? {
      property: 'last_edited_time',
      date: { after: since.toISOString() },
    } : undefined;

    const response = await client.post<{ results: NotionPage[] }>(
      `/databases/${databaseId}/query`,
      {
        filter,
        page_size: Math.min(limit, 100),
        sorts: [{ property: 'last_edited_time', direction: 'descending' }],
      }
    );

    return response.results;
  }

  /**
   * Get a single page.
   */
  private async getPage(pageId: string, client?: ApiClient): Promise<NotionPage> {
    if (!client) throw new Error('API client required');
    return client.get<NotionPage>(`/pages/${pageId}`);
  }

  /**
   * Get children pages of a page.
   */
  private async getPageChildren(
    pageId: string,
    since?: Date,
    limit: number = 100,
    client?: ApiClient
  ): Promise<NotionPage[]> {
    if (!client) throw new Error('API client required');
    // Search for pages with this parent
    const response = await client.post<{ results: NotionPage[] }>(
      '/search',
      {
        filter: { property: 'object', value: 'page' },
        page_size: Math.min(limit, 100),
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
      }
    );

    // Filter to only children of the specified page
    return response.results.filter((page) => {
      if (page.parent.type === 'page_id' && page.parent.page_id === pageId) {
        if (since && new Date(page.last_edited_time) < since) return false;
        return true;
      }
      return false;
    });
  }

  /**
   * Search all accessible pages.
   */
  private async searchPages(since?: Date, limit: number = 100, client?: ApiClient): Promise<NotionPage[]> {
    if (!client) throw new Error('API client required');
    const response = await client.post<{ results: NotionPage[] }>(
      '/search',
      {
        filter: { property: 'object', value: 'page' },
        page_size: Math.min(limit, 100),
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
      }
    );

    if (since) {
      return response.results.filter((page) => new Date(page.last_edited_time) >= since);
    }

    return response.results;
  }

  /**
   * Get page content (blocks) with pagination support.
   */
  private async getPageContent(pageId: string, client?: ApiClient): Promise<string> {
    if (!client) throw new Error('API client required');
    const allBlocks: NotionBlock[] = [];
    let nextCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `/blocks/${pageId}/children${nextCursor ? `?start_cursor=${encodeURIComponent(nextCursor)}` : ''}`;
      const response = await client.get<{ results: NotionBlock[]; next_cursor: string | null }>(endpoint);

      allBlocks.push(...response.results);
      nextCursor = response.next_cursor || undefined;
      hasMore = !!nextCursor;
    }

    // Fetch children for blocks that have them (tables, toggles)
    for (const block of allBlocks) {
      if (block.has_children && (block.type === 'table' || block.type === 'toggle')) {
        try {
          const childResponse = await client.get<{ results: NotionBlock[] }>(
            `/blocks/${block.id}/children`
          );
          block.children = childResponse.results;
        } catch (error) {
          logger.warn('Failed to fetch Notion block children', {
            blockId: block.id,
            blockType: block.type,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue without children - content will be incomplete but not fail
        }
      }
    }

    return this.blocksToMarkdown(allBlocks);
  }

  /**
   * Convert Notion blocks to markdown.
   */
  private blocksToMarkdown(blocks: NotionBlock[]): string {
    const parts: string[] = [];

    for (const block of blocks) {
      const text = this.blockToMarkdown(block);
      if (text) parts.push(text);
    }

    return parts.join('\n\n');
  }

  /**
   * Convert a single block to markdown.
   */
  private blockToMarkdown(block: NotionBlock): string {
    const type = block.type;
    const content = block[type] as { rich_text?: Array<{ plain_text: string }>; text?: Array<{ plain_text: string }> };

    const getText = () => {
      const richText = content?.rich_text || content?.text || [];
      return richText.map((t: { plain_text: string }) => t.plain_text).join('');
    };

    switch (type) {
      case 'paragraph':
        return getText();
      case 'heading_1':
        return `# ${getText()}`;
      case 'heading_2':
        return `## ${getText()}`;
      case 'heading_3':
        return `### ${getText()}`;
      case 'bulleted_list_item':
        return `- ${getText()}`;
      case 'numbered_list_item':
        return `1. ${getText()}`;
      case 'code':
        return `\`\`\`\n${getText()}\n\`\`\``;
      case 'quote':
        return `> ${getText()}`;
      case 'divider':
        return '---';
      case 'callout':
        return `> ${getText()}`;
      case 'table': {
        // Tables have children (table_row blocks)
        const rows = block.children?.filter((b) => b.type === 'table_row') || [];
        if (rows.length === 0) return '';

        const tableRows: string[][] = [];
        for (const row of rows) {
          if (row.table_row?.cells) {
            const cellTexts = row.table_row.cells.map((cell) =>
              cell.map((t) => t.plain_text).join('').replace(/\|/g, '\\|').replace(/\n/g, ' ')
            );
            tableRows.push(cellTexts);
          }
        }

        if (tableRows.length === 0) return '';

        const lines: string[] = [];
        // First row is header
        const headerRow = tableRows[0];
        lines.push(`| ${headerRow.join(' | ')} |`);
        // Separator row
        lines.push(`| ${headerRow.map(() => '---').join(' | ')} |`);
        // Data rows
        for (let i = 1; i < tableRows.length; i++) {
          lines.push(`| ${tableRows[i].join(' | ')} |`);
        }
        return lines.join('\n');
      }
      case 'table_row':
        // Table rows are handled as children of table blocks
        return '';
      default:
        return getText();
    }
  }

  /**
   * Get page title from properties.
   */
  private getPageTitle(page: NotionPage): string {
    // Look for title property
    for (const [, prop] of Object.entries(page.properties)) {
      if (prop.type === 'title' && prop.title?.length) {
        return prop.title.map((t) => t.plain_text).join('');
      }
    }
    return 'Untitled';
  }

  /**
   * Convert a Notion page to a discovered source.
   */
  private async pageToSource(page: NotionPage, client?: ApiClient): Promise<DiscoveredSource<NotionStagedSource>> {
    if (!client) throw new Error('API client required');
    const title = this.getPageTitle(page);
    const content = await this.getPageContent(page.id, client);

    const metadata: NotionSourceMetadata = {
      pageId: page.id,
      parentId: page.parent.page_id || page.parent.database_id,
      parentType: page.parent.type === 'database_id' ? 'database' :
                  page.parent.type === 'page_id' ? 'page' : 'workspace',
      properties: page.properties as unknown as Record<string, unknown>,
      icon: page.icon ? {
        type: page.icon.type as 'emoji' | 'external' | 'file',
        value: page.icon.emoji || page.icon.external?.url || page.icon.file?.url || '',
      } : undefined,
      cover: page.cover ? {
        type: page.cover.type as 'external' | 'file',
        url: page.cover.external?.url || page.cover.file?.url || '',
      } : undefined,
      createdBy: { id: page.created_by.id },
      lastEditedBy: { id: page.last_edited_by.id },
      notionCreatedAt: page.created_time,
      notionUpdatedAt: page.last_edited_time,
      notionUrl: page.url,
    };

    return {
      externalId: page.id,
      title,
      content,
      contentPreview: this.generatePreview(content),
      metadata,
    };
  }

  /**
   * Convert multiple pages to discovered sources with batch content loading.
   * Fetches content for all pages in parallel to avoid sequential delays.
   */
  private async pagesToSources(
    pages: NotionPage[],
    client?: ApiClient
  ): Promise<DiscoveredSource<NotionStagedSource>[]> {
    if (!client) throw new Error('API client required');
    // Batch fetch content for all pages in parallel
    const contentMap = await this.getPagesContent(pages.map((p) => p.id), client);

    // Build sources from pages and their content
    const sources: DiscoveredSource<NotionStagedSource>[] = [];
    for (const page of pages) {
      const title = this.getPageTitle(page);
      const content = contentMap.get(page.id) || '';

      const metadata: NotionSourceMetadata = {
        pageId: page.id,
        parentId: page.parent.page_id || page.parent.database_id,
        parentType: page.parent.type === 'database_id' ? 'database' :
                    page.parent.type === 'page_id' ? 'page' : 'workspace',
        properties: page.properties as unknown as Record<string, unknown>,
        icon: page.icon ? {
          type: page.icon.type as 'emoji' | 'external' | 'file',
          value: page.icon.emoji || page.icon.external?.url || page.icon.file?.url || '',
        } : undefined,
        cover: page.cover ? {
          type: page.cover.type as 'external' | 'file',
          url: page.cover.external?.url || page.cover.file?.url || '',
        } : undefined,
        createdBy: { id: page.created_by.id },
        lastEditedBy: { id: page.last_edited_by.id },
        notionCreatedAt: page.created_time,
        notionUpdatedAt: page.last_edited_time,
        notionUrl: page.url,
      };

      const pageDate = new Date(page.created_time).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      sources.push({
        externalId: page.id,
        title: `${title} (${pageDate})`,
        content,
        contentPreview: this.generatePreview(content),
        metadata,
      });
    }

    return sources;
  }

  /**
   * Fetch content for multiple pages in parallel with chunking.
   * Processes pages in smaller batches to respect API rate limits.
   */
  private async getPagesContent(pageIds: string[], client?: ApiClient): Promise<Map<string, string>> {
    if (!client) throw new Error('API client required');
    const contentMap = new Map<string, string>();
    const batchSize = 10; // Process 10 pages at a time

    // Process pages in chunks
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);

      // Process this batch in parallel
      const results = await Promise.allSettled(
        batch.map((id) => this.getPageContent(id, client))
      );

      results.forEach((result, index) => {
        const pageId = batch[index];
        if (result.status === 'fulfilled') {
          contentMap.set(pageId, result.value);
        } else {
          // Log error but continue with empty content
          logger.warn(`Failed to fetch content for page ${pageId}:`, result.reason);
          contentMap.set(pageId, '');
        }
      });
    }

    return contentMap;
  }

  /**
   * Test Notion connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return testConnection(async () => {
      const { credentials } = await this.credentialManager.load();
      const client = await this.getApiClient(credentials);
      await client.get('/users/me');
    });
  }
}

// Export singleton instance
export const notionAdapter = new NotionDiscoveryAdapter();
