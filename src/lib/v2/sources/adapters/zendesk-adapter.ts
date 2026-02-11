/**
 * Zendesk Discovery Adapter
 *
 * Discovers and stages content from Zendesk tickets.
 * Requires Zendesk API credentials configured in AWS Secrets Manager.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  ZendeskStagedSource,
  ZendeskSourceMetadata,
} from '@/types/v2';
import { CredentialManager, ApiClient, BatchProcessor, testConnection } from './utils';

interface ZendeskConfig {
  tags?: string[]; // Zendesk tags to filter tickets
}

interface ZendeskCredentials {
  subdomain: string;
  email: string;
  apiToken: string;
}

interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  assignee_id: number | null;
  requester_id: number;
  tags: string[];
  custom_fields: Array<{ id: number; value: unknown }>;
  created_at: string;
  updated_at: string;
  comment_count: number;
  satisfaction_rating: {
    score: 'good' | 'bad' | 'offered' | 'unoffered';
    comment: string | null;
  } | null;
}

interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  organization_id: number | null;
}

interface ZendeskComment {
  id: number;
  body: string;
  author_id: number;
  created_at: string;
  public: boolean;
}

export class ZendeskDiscoveryAdapter extends BaseDiscoveryAdapter<ZendeskStagedSource> {
  readonly sourceType = 'zendesk' as const;
  readonly displayName = 'Zendesk Tickets';

  private credentialManager = new CredentialManager<ZendeskCredentials, ZendeskConfig>({
    integrationType: 'zendesk',
    secretNames: ['zendesk-internal-subdomain', 'zendesk-internal-email', 'zendesk-internal-api-token'],
    envVarNames: ['ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN'],
    parseCredentials: (secrets) => ({
      subdomain: secrets['zendesk-internal-subdomain'] || '',
      email: secrets['zendesk-internal-email'] || '',
      apiToken: secrets['zendesk-internal-api-token'] || '',
    }),
    parseConfig: (config) => config as ZendeskConfig,
  });

  private apiClientsBySubdomain: Map<string, ApiClient> = new Map();

  /**
   * Initialize API client per subdomain
   */
  private async getApiClient(credentials: ZendeskCredentials): Promise<ApiClient> {
    // Cache per subdomain to support multi-connection scenarios
    const cacheKey = credentials.subdomain;
    if (this.apiClientsBySubdomain.has(cacheKey)) {
      return this.apiClientsBySubdomain.get(cacheKey)!;
    }

    const auth = Buffer.from(`${credentials.email}/token:${credentials.apiToken}`).toString('base64');

    const client = new ApiClient({
      baseUrl: `https://${credentials.subdomain}.zendesk.com/api/v2`,
      getAuthHeaders: () => ({ 'Authorization': `Basic ${auth}` }),
    });

    this.apiClientsBySubdomain.set(cacheKey, client);
    return client;
  }

  /**
   * Discover tickets from Zendesk.
   */
  async discover(options: DiscoveryOptions): Promise<DiscoveredSource<ZendeskStagedSource>[]> {
    const { credentials } = await this.credentialManager.load({
      connectionId: options.connectionId,
    });
    const client = await this.getApiClient(credentials);
    const { since, limit = 100, page = 1 } = options;

    // Build query
    let query = 'type:ticket';
    if (since) {
      query += ` updated>${since.toISOString().split('T')[0]}`;
    }

    const searchUrl = `/search.json?query=${encodeURIComponent(query)}&per_page=${limit}&page=${page}&sort_by=updated_at&sort_order=desc`;
    const searchResult = await client.get<{ results: ZendeskTicket[] }>(searchUrl);

    // Fetch user details
    const userIds = new Set<number>();
    searchResult.results.forEach((ticket: ZendeskTicket) => {
      userIds.add(ticket.requester_id);
      if (ticket.assignee_id) userIds.add(ticket.assignee_id);
    });

    const users = await this.fetchUsers(Array.from(userIds), client);
    const userMap = new Map(users.map((u: ZendeskUser) => [u.id, u]));

    // Batch fetch comments
    const batchProcessor = new BatchProcessor({
      batchSize: 5,
      delayBetweenBatches: 1500,
      processor: (ticketId: number) => this.fetchTicketComments(ticketId, client),
    });

    const commentsByTicketId = await batchProcessor.processToMap(
      searchResult.results.map((t: ZendeskTicket) => t.id),
      (id) => id
    );

    // Convert to discovered sources
    const discovered: DiscoveredSource<ZendeskStagedSource>[] = [];

    for (const ticket of searchResult.results) {
      const comments = commentsByTicketId.get(ticket.id) || [];
      const content = this.buildTicketContent(ticket, comments);

      const requester = userMap.get(ticket.requester_id);
      const assignee = ticket.assignee_id ? userMap.get(ticket.assignee_id) : undefined;

      const metadata: ZendeskSourceMetadata = {
        ticketId: ticket.id,
        status: ticket.status,
        priority: ticket.priority || undefined,
        assignee: assignee
          ? {
              id: assignee.id,
              name: assignee.name,
              email: assignee.email,
            }
          : undefined,
        requester: requester
          ? {
              id: requester.id,
              name: requester.name,
              email: requester.email,
            }
          : undefined,
        tags: ticket.tags,
        customFields: ticket.custom_fields.reduce((acc: Record<string, unknown>, f: Record<string, unknown>) => {
          acc[f.id?.toString() ?? ''] = f.value;
          return acc;
        }, {}),
        ticketCreatedAt: ticket.created_at,
        ticketUpdatedAt: ticket.updated_at,
        commentCount: ticket.comment_count,
        satisfaction: ticket.satisfaction_rating
          ? {
              score: ticket.satisfaction_rating.score,
              comment: ticket.satisfaction_rating.comment || undefined,
            }
          : undefined,
      };

      const ticketDate = new Date(ticket.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      discovered.push({
        externalId: ticket.id.toString(),
        title: `[TICKET #${ticket.id}]: ${ticket.subject} (${ticketDate})`,
        content,
        contentPreview: this.generatePreview(ticket.description || ''),
        metadata,
      });
    }

    return discovered;
  }

  /**
   * Fetch users by IDs.
   */
  private async fetchUsers(userIds: number[], client: ApiClient): Promise<ZendeskUser[]> {
    if (userIds.length === 0) return [];

    const url = `/users/show_many.json?ids=${userIds.join(',')}`;
    const result = await client.get<{ users: ZendeskUser[] }>(url);
    return result.users;
  }

  /**
   * Fetch comments for a ticket.
   */
  private async fetchTicketComments(
    ticketId: number,
    client: ApiClient
  ): Promise<ZendeskComment[]> {
    const url = `/tickets/${ticketId}/comments.json`;
    const result = await client.get<{ comments: ZendeskComment[] }>(url);
    return result.comments;
  }

  /**
   * Build full content from ticket and comments.
   */
  private buildTicketContent(ticket: ZendeskTicket, comments: ZendeskComment[]): string {
    const parts: string[] = [];

    parts.push(`# ${ticket.subject}`);
    parts.push('');
    parts.push(`Status: ${ticket.status}`);
    if (ticket.priority) parts.push(`Priority: ${ticket.priority}`);
    if (ticket.tags.length > 0) parts.push(`Tags: ${ticket.tags.join(', ')}`);
    parts.push('');
    parts.push('## Description');
    parts.push(ticket.description || '(No description)');
    parts.push('');

    if (comments.length > 0) {
      parts.push('## Comments');
      parts.push('');
      for (const comment of comments) {
        if (comment.public) {
          parts.push(`### ${new Date(comment.created_at).toLocaleString()}`);
          parts.push(comment.body);
          parts.push('');
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Test Zendesk connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return testConnection(async () => {
      const { credentials } = await this.credentialManager.load();
      const client = await this.getApiClient(credentials);
      await client.get('/users/me.json');
    });
  }
}

// Export singleton instance
export const zendeskAdapter = new ZendeskDiscoveryAdapter();
