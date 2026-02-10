/**
 * Slack Discovery Adapter
 *
 * Discovers and stages content from Slack threads.
 * Requires Slack Bot Token configured in AWS Secrets Manager.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  SlackStagedSource,
  SlackSourceMetadata,
  LibraryId,
} from '@/types/v2';
import { CredentialManager, ApiClient, testConnection } from './utils';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { logger } from '@/lib/logger';

interface SlackCredentials {
  botToken: string;
  teamId?: string;
}

interface SlackConfig {
  channels?: string[]; // Channel IDs to monitor
  includeThreadsOnly?: boolean; // Only capture threaded conversations
  minReplyCount?: number; // Minimum replies for a thread to be captured
}

interface SlackMessage {
  ts: string;
  thread_ts?: string;
  text: string;
  user: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number }>;
}

interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  is_bot: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
}

export class SlackDiscoveryAdapter extends BaseDiscoveryAdapter<SlackStagedSource> {
  readonly sourceType = 'slack' as const;
  readonly displayName = 'Slack Threads';

  private apiClient?: ApiClient;

  /**
   * Create a credential manager for the given library
   * Uses library-specific token names (e.g., slack-bot-token-it, slack-bot-token-customers)
   * to ensure each library can have its own dedicated Slack bot
   */
  private getCredentialManager(libraryId?: string, customerId?: string): CredentialManager<SlackCredentials, SlackConfig> {
    // Build library-specific secret name
    let secretName = 'slack-bot-token';
    let envVarName = 'SLACK_BOT_TOKEN';

    if (customerId) {
      // Customer-scoped integrations use customer-specific tokens
      secretName = `slack-bot-token-customers`;
      envVarName = 'SLACK_BOT_TOKEN_CUSTOMERS';
    } else if (libraryId) {
      // Library-scoped integrations use library-specific tokens
      secretName = `slack-bot-token-${libraryId}`;
      envVarName = `SLACK_BOT_TOKEN_${libraryId.toUpperCase()}`;
    }

    return new CredentialManager<SlackCredentials, SlackConfig>({
      integrationType: 'slack',
      secretNames: [secretName],
      envVarNames: [envVarName],
      parseCredentials: (secrets) => ({
        botToken: secrets[secretName] || '',
      }),
      parseConfig: (config) => config as SlackConfig,
      connectionNameResolver: () => {
        // Use closure variables from outer scope to ensure consistent connection naming
        return libraryId ? getIntegrationConnectionName('slack', libraryId, customerId) : undefined;
      },
    });
  }

  /**
   * Initialize API client on first use per connection
   */
  private async getApiClient(credentials: SlackCredentials): Promise<ApiClient> {
    if (this.apiClient) return this.apiClient;

    this.apiClient = new ApiClient({
      baseUrl: 'https://slack.com/api',
      getAuthHeaders: () => ({ 'Authorization': `Bearer ${credentials.botToken}` }),
    });

    return this.apiClient;
  }

  /**
   * Discover threads from configured Slack channels.
   *
   * IMPORTANT: Only call this in response to explicit user action
   * (e.g., "Discover More" button). Do not call during initialization or auto-sync.
   * This makes many API calls to fetch thread details and user information.
   * Includes rate limiting (1000ms delays between batches) to avoid hitting
   * Slack's ~50 requests/minute limit.
   */
  async discover(options: DiscoveryOptions): Promise<DiscoveredSource<SlackStagedSource>[]> {
    const credentialManager = this.getCredentialManager(options.libraryId, options.customerId);
    const { credentials, config } = await credentialManager.load({
      connectionId: options.connectionId,
      libraryId: options.libraryId,
      customerId: options.customerId,
    });
    const client = await this.getApiClient(credentials);
    const { since, limit = 50 } = options;
    const includeThreadsOnly = config?.includeThreadsOnly ?? true;
    const minReplyCount = config?.minReplyCount;

    // Extract channel IDs from config
    const configuredChannelIds = (config?.channels || []) as string[];
    logger.info('Slack discover: config channels', {
      configuredChannels: configuredChannelIds,
      connectionId: options.connectionId,
      libraryId: options.libraryId,
    });

    // Validate configured channels - the bot must be a member to access history
    const channelIds: string[] = [];

    if (configuredChannelIds.length === 0) {
      // If no channels configured, get all public channels the bot is in
      const channelList = await this.getJoinedChannels(client);
      logger.info('Slack discover: no configured channels, using joined channels', {
        joinedChannels: channelList.map((c) => ({ id: c.id, name: c.name })),
      });
      channelIds.push(...channelList.map((c) => c.id));
    } else {
      // Verify bot membership for each configured channel
      for (const channelId of configuredChannelIds) {
        try {
          const channelInfo = await this.getChannelInfo(channelId, client);
          if (channelInfo.isMember) {
            channelIds.push(channelId);
            logger.info('Slack discover: bot is member of configured channel', {
              channelId,
              channelName: channelInfo.name,
            });
          } else {
            logger.warn('Slack discover: bot is NOT a member of configured channel - skipping', {
              channelId,
              channelName: channelInfo.name,
              hint: 'Invite the bot to this channel using /invite @bot_name',
            });
          }
        } catch (error) {
          logger.error('Slack discover: failed to verify channel membership', {
            channelId,
            error: error instanceof Error ? error.message : 'Unknown error',
            botTokenPresent: credentials.botToken ? credentials.botToken.substring(0, 10) + '...' : 'MISSING',
            hint: !credentials.botToken
              ? 'Bot token is missing - check AWS Secrets Manager or env variables'
              : 'Check bot permissions or if channel exists and bot is invited',
          });
        }
      }
    }

    if (channelIds.length === 0) {
      logger.warn('Slack discover: no accessible channels to discover from', {
        configuredChannels: configuredChannelIds.length,
        hint: configuredChannelIds.length > 0
          ? 'Bot is not a member of any configured channels. Use /invite @bot_name in Slack to add the bot.'
          : 'No channels configured and bot is not a member of any channels.',
      });
      return [];
    }

    const discovered: DiscoveredSource<SlackStagedSource>[] = [];
    const userCache = new Map<string, SlackUser>();
    const channelCache = new Map<string, SlackChannel>();

    for (const channelId of channelIds) {
      logger.info('Slack discover: processing channel', { channelId });

      // Get channel info
      if (!channelCache.has(channelId)) {
        try {
          const channelInfo = await this.getChannelInfo(channelId, client);
          channelCache.set(channelId, channelInfo);
        } catch (error) {
          logger.error('Slack discover: failed to get channel info, skipping', {
            channelId,
            error: error instanceof Error ? error.message : 'Unknown error',
            botTokenPresent: credentials.botToken ? 'yes' : 'NO - TOKEN MISSING',
            hint: 'Verify bot has conversations:read permission and is invited to channel',
          });
          continue;
        }
      }
      const channel = channelCache.get(channelId);
      if (!channel) {
        logger.error('Slack discover: channel cache missing after retrieval', { channelId });
        continue;
      }

      // Get messages with threads
      let messages: SlackMessage[];
      try {
        messages = await this.getChannelMessages(channelId, since, limit, client);
      } catch (error) {
        logger.error('Slack discover: failed to get channel history, skipping', {
          channelId,
          channelName: channel.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          botTokenPresent: credentials.botToken ? 'yes' : 'NO - TOKEN MISSING',
          hint: credentials.botToken
            ? 'Bot may have been removed or lacks channels:history permission'
            : 'Bot token is missing - check AWS Secrets Manager and env variables',
        });
        continue;
      }

      // First pass: collect all threads and user IDs
      const threadsData: Array<{ message: SlackMessage; replies: SlackMessage[] }> = [];
      const userIdsToFetch = new Set<string>();

      // Filter to only thread parent messages first
      const threadMessages = messages.filter((message) => {
        if (!message.thread_ts || message.thread_ts !== message.ts) return false;
        if (minReplyCount && (message.reply_count || 0) < minReplyCount) return false;
        return true;
      });

      const standaloneMessages = includeThreadsOnly
        ? []
        : messages.filter((message) => {
            if (message.thread_ts) return false; // exclude thread parents/replies
            if (!message.text || !message.user) return false;
            return true;
          });

      // Fetch thread replies in batches to respect rate limits
      const batchSize = 5;
      for (let i = 0; i < threadMessages.length; i += batchSize) {
        const batch = threadMessages.slice(i, i + batchSize);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map((message) => this.getThreadReplies(channelId, message.ts, client))
        );

        results.forEach((result, index) => {
          const message = batch[index];
          const replies = result.status === 'fulfilled' ? result.value : [];
          if (result.status === 'rejected') {
            logger.warn(`Failed to fetch replies for thread ${message.ts}:`, result.reason);
          }
          threadsData.push({ message, replies });

          // Collect user IDs
          userIdsToFetch.add(message.user);
          replies.forEach((r) => userIdsToFetch.add(r.user));
        });

        // Rate limit: Add delay between batches
        if (i + batchSize < threadMessages.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Add standalone messages (non-thread) if enabled
      for (const message of standaloneMessages) {
        threadsData.push({ message, replies: [] });
        userIdsToFetch.add(message.user);
      }

      // Batch fetch all missing user info
      const missingUserIds = Array.from(userIdsToFetch).filter((id) => !userCache.has(id));
      if (missingUserIds.length > 0) {
        const newUsers = await this.getUsersInfo(missingUserIds, client);
        newUsers.forEach((user, id) => userCache.set(id, user));
      }

      // Batch fetch permalinks to avoid rate limiting
      const permalinkCache = new Map<string, string | undefined>();
      const permalinkBatchSize = 5;
      for (let i = 0; i < threadsData.length; i += permalinkBatchSize) {
        const batch = threadsData.slice(i, i + permalinkBatchSize);
        const results = await Promise.allSettled(
          batch.map(({ message }) => this.getPermalink(channelId, message.ts, client))
        );
        results.forEach((result, index) => {
          const ts = batch[index].message.ts;
          permalinkCache.set(ts, result.status === 'fulfilled' ? result.value : undefined);
        });
        // Rate limit delay between batches
        if (i + permalinkBatchSize < threadsData.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Second pass: build discovered sources
      for (const { message, replies } of threadsData) {
        const userIds = new Set<string>();
        userIds.add(message.user);
        replies.forEach((r) => userIds.add(r.user));

        // Build content and metadata
        const content = this.buildThreadContent(message, replies, userCache);
        const participants = Array.from(userIds).map((id) => {
          const user = userCache.get(id)!;
          return {
            userId: user.id,
            name: user.real_name || user.name,
            isBot: user.is_bot,
          };
        });

        const threadStartedAt = new Date(parseFloat(message.ts) * 1000).toISOString();
        const lastReply = replies.length > 0 ? replies[replies.length - 1] : message;
        const lastReplyAt = new Date(parseFloat(lastReply.ts) * 1000).toISOString();

        const metadata: SlackSourceMetadata = {
          channelId,
          channelName: channel.name,
          threadTs: message.ts,
          messageTs: message.ts,
          participants,
          replyCount: message.reply_count || 0,
          reactions: message.reactions,
          threadStartedAt,
          lastReplyAt,
          permalink: permalinkCache.get(message.ts),
          ...(options.customerId && { customerId: options.customerId }),
        };

        // Generate title from first message
        const title = this.generateThreadTitle(message, channel);

        discovered.push({
          externalId: `${channelId}:${message.ts}`,
          title,
          content,
          contentPreview: this.generatePreview(message.text),
          metadata,
        });

        if (discovered.length >= limit) break;
      }

      if (discovered.length >= limit) break;
    }

    return discovered;
  }

  /**
   * Get channels the bot has joined.
   *
   * Note: conversations.list often returns is_member: false even when the bot IS a member
   * (known Slack API quirk for bot tokens). We verify membership using conversations.info
   * which returns accurate is_member status.
   */
  private async getJoinedChannels(client: ApiClient): Promise<SlackChannel[]> {
    const response = await client.get<{
      channels?: Array<{ id: string; name: string; is_member?: boolean }>;
      ok?: boolean;
      error?: string;
    }>('/conversations.list?types=public_channel,private_channel&exclude_archived=true');

    // Validate response structure - conversations.list should return array of channels
    if (!response.channels || !Array.isArray(response.channels)) {
      const errorDetail = response.error || 'No channels in response';
      logger.error('Slack getJoinedChannels: invalid response structure', {
        hasChannels: !!response.channels,
        isArray: Array.isArray(response.channels),
        errorDetail,
        responseKeys: Object.keys(response),
      });
      throw new Error(`Invalid conversations.list response: ${errorDetail}`);
    }

    // conversations.list often returns incorrect is_member for bots
    // Verify membership using conversations.info for each channel
    const joinedChannels: SlackChannel[] = [];

    // Check membership in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < response.channels.length; i += batchSize) {
      const batch = response.channels.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (c) => {
          try {
            const info = await this.getChannelInfo(c.id, client);
            return info;
          } catch (error) {
            logger.warn('Failed to get channel info', {
              channelId: c.id,
              channelName: c.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.isMember) {
          joinedChannels.push(result.value);
        }
      }

      // Rate limit delay between batches
      if (i + batchSize < response.channels.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    logger.info('Slack getJoinedChannels: verified membership', {
      totalChannels: response.channels.length,
      memberOf: joinedChannels.length,
      channels: joinedChannels.map((c) => ({ id: c.id, name: c.name })),
    });

    return joinedChannels;
  }

  /**
   * Get channel info.
   */
  private async getChannelInfo(channelId: string, client: ApiClient): Promise<SlackChannel> {
    const response = await client.get<{
      channel?: { id: string; name: string; is_member?: boolean };
      ok?: boolean;
      error?: string;
    }>(`/conversations.info?channel=${encodeURIComponent(channelId)}`);

    // Validate response structure - conversations.info should return channel object
    if (!response.channel || typeof response.channel !== 'object') {
      const errorDetail = response.error || 'No channel in response';
      logger.error('Slack getChannelInfo: invalid response structure', {
        channelId,
        hasChannel: !!response.channel,
        channelType: typeof response.channel,
        errorDetail,
        responseKeys: Object.keys(response),
      });
      throw new Error(`Invalid conversations.info response for ${channelId}: ${errorDetail}`);
    }

    // Validate required fields in channel object
    if (!response.channel.id || !response.channel.name) {
      logger.error('Slack getChannelInfo: missing required fields in channel', {
        channelId,
        hasId: !!response.channel.id,
        hasName: !!response.channel.name,
        channel: response.channel,
      });
      throw new Error(`Channel ${channelId} missing id or name`);
    }

    return {
      id: response.channel.id,
      name: response.channel.name,
      isMember: response.channel.is_member === true,
    };
  }

  /**
   * Get messages from a channel.
   */
  private async getChannelMessages(
    channelId: string,
    since?: Date,
    limit: number = 100,
    client?: ApiClient
  ): Promise<SlackMessage[]> {
    if (!client) throw new Error('API client required');
    const params = new URLSearchParams({
      channel: channelId,
      limit: limit.toString(),
    });
    if (since) {
      params.set('oldest', (since.getTime() / 1000).toString());
    }

    const response = await client.get<{
      messages?: SlackMessage[];
      ok?: boolean;
      error?: string;
    }>(`/conversations.history?${params.toString()}`);

    if (!response.messages || !Array.isArray(response.messages)) {
      const errorDetail = response.error || 'No messages in response';
      logger.error('Slack getChannelMessages: invalid response structure', {
        channelId,
        hasMessages: !!response.messages,
        isArray: Array.isArray(response.messages),
        errorDetail,
      });
      throw new Error(`Invalid conversations.history response for ${channelId}: ${errorDetail}`);
    }

    return response.messages;
  }

  /**
   * Get thread replies.
   */
  private async getThreadReplies(
    channelId: string,
    threadTs: string,
    client: ApiClient
  ): Promise<SlackMessage[]> {
    const response = await client.get<{
      messages?: SlackMessage[];
      ok?: boolean;
      error?: string;
    }>(
      `/conversations.replies?channel=${encodeURIComponent(channelId)}&ts=${encodeURIComponent(threadTs)}`
    );

    if (!response.messages || !Array.isArray(response.messages)) {
      const errorDetail = response.error || 'No messages in response';
      logger.error('Slack getThreadReplies: invalid response structure', {
        channelId,
        threadTs,
        hasMessages: !!response.messages,
        isArray: Array.isArray(response.messages),
        errorDetail,
      });
      throw new Error(
        `Invalid conversations.replies response for thread ${threadTs} in ${channelId}: ${errorDetail}`
      );
    }

    // First message is the parent, rest are replies
    return response.messages.slice(1);
  }

  /**
   * Get user info.
   */
  private async getUserInfo(userId: string, client: ApiClient): Promise<SlackUser> {
    const response = await client.get<{
      user?: SlackUser;
      ok?: boolean;
      error?: string;
    }>(`/users.info?user=${encodeURIComponent(userId)}`);

    if (!response.user || typeof response.user !== 'object') {
      const errorDetail = response.error || 'No user in response';
      logger.warn('Slack getUserInfo: invalid response structure', {
        userId,
        hasUser: !!response.user,
        userType: typeof response.user,
        errorDetail,
      });
      // Return fallback for deactivated or missing users
      return {
        id: userId,
        name: 'Unknown',
        real_name: 'Unknown User',
        is_bot: false,
      };
    }

    return response.user;
  }

  /**
   * Get user info for multiple users in parallel with chunking.
   * Processes users in smaller batches to respect API rate limits.
   * Slack rate limit is ~50 requests/minute for most Web API methods.
   */
  private async getUsersInfo(userIds: string[], client: ApiClient): Promise<Map<string, SlackUser>> {
    const userMap = new Map<string, SlackUser>();
    const batchSize = 5; // Reduced to be conservative with rate limits

    // Process users in chunks
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      // Process this batch in parallel
      const results = await Promise.allSettled(
        batch.map((id) => this.getUserInfo(id, client))
      );

      results.forEach((result, index) => {
        const userId = batch[index];
        if (result.status === 'fulfilled') {
          userMap.set(userId, result.value);
        } else {
          // User might be deactivated, use fallback
          logger.warn(`Failed to fetch user info for ${userId}:`, result.reason);
          userMap.set(userId, { id: userId, name: 'Unknown', real_name: 'Unknown User', is_bot: false });
        }
      });

      // Rate limit: Add delay between batches to avoid hitting Slack's rate limit
      if (i + batchSize < userIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return userMap;
  }

  /**
   * Get permalink to a message.
   */
  private async getPermalink(channelId: string, messageTs: string, client: ApiClient): Promise<string | undefined> {
    try {
      const response = await client.get<{ permalink: string }>(
        `/chat.getPermalink?channel=${encodeURIComponent(channelId)}&message_ts=${encodeURIComponent(messageTs)}`
      );
      return response.permalink;
    } catch (error) {
      logger.warn('Failed to fetch Slack permalink', {
        channelId,
        messageTs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Build thread content from messages.
   */
  private buildThreadContent(
    parent: SlackMessage,
    replies: SlackMessage[],
    userCache: Map<string, SlackUser>
  ): string {
    const parts: string[] = [];

    const formatMessage = (msg: SlackMessage) => {
      // Handle missing user IDs (can happen with deleted users or bots)
      if (!msg.user) {
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
        return `**[System Message]** (${timestamp}):\n${msg.text}`;
      }

      const user = userCache.get(msg.user);
      // userCache.getUsersInfo already provides fallback for missing users
      const userName = user?.real_name || user?.name || 'Unknown';
      const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
      return `**${userName}** (${timestamp}):\n${msg.text}`;
    };

    parts.push(formatMessage(parent));
    parts.push('');

    if (replies.length > 0) {
      parts.push('---');
      parts.push('');
      for (const reply of replies) {
        parts.push(formatMessage(reply));
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate a title for the thread.
   */
  private generateThreadTitle(message: SlackMessage, channel: SlackChannel): string {
    // Take first line or first 50 chars
    const firstLine = message.text.split('\n')[0];
    const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    // Format: #channel: message text (date)
    const messageDate = new Date(parseFloat(message.ts) * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `#${channel.name}: ${title} (${messageDate})`;
  }

  /**
   * Test Slack connection.
   */
  async testConnection(options?: DiscoveryOptions): Promise<{ success: boolean; error?: string }> {
    return testConnection(async () => {
      const credentialManager = this.getCredentialManager(options?.libraryId, options?.customerId);
      const { credentials } = await credentialManager.load({
        connectionId: options?.connectionId,
        libraryId: options?.libraryId,
        customerId: options?.customerId,
      });
      const client = await this.getApiClient(credentials);
      await client.get('/auth.test');
    });
  }

  /**
   * Get the list of channels the bot is in (public method for status/configuration endpoints).
   */
  async getAvailableChannels(options?: DiscoveryOptions): Promise<SlackChannel[]> {
    const credentialManager = this.getCredentialManager(options?.libraryId, options?.customerId);
    const { credentials } = await credentialManager.load({
      connectionId: options?.connectionId,
      libraryId: options?.libraryId,
      customerId: options?.customerId,
    });
    const client = await this.getApiClient(credentials);
    return this.getJoinedChannels(client);
  }

  /**
   * Look up a channel by ID or name (public method for channel lookup endpoints).
   */
  async lookupChannelByName(options: { libraryId?: string; customerId?: string; channelName: string }): Promise<SlackChannel | null> {
    try {
      if (!options.libraryId) {
        throw new Error('libraryId is required for channel lookup');
      }
      const credentialManager = this.getCredentialManager(options.libraryId, options.customerId);
      const { credentials } = await credentialManager.load({
        libraryId: options.libraryId as LibraryId,
        customerId: options.customerId,
      });
      const client = await this.getApiClient(credentials);
      // channelName is actually the channel ID when called from lookup endpoint
      const result = await this.getChannelInfo(options.channelName, client);
      logger.info(`Successfully looked up channel ${options.channelName}:`, { id: result.id, name: result.name });
      return result;
    } catch (error) {
      logger.error(`Failed to lookup channel ${options.channelName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const slackAdapter = new SlackDiscoveryAdapter();
