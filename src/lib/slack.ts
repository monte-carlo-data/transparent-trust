// Slack API Client
// Used for ingesting knowledge from Slack channels
// Fetches threads with Q&A patterns to build skills

import { circuitBreakers } from "./circuitBreaker";
import { getSecret } from "./secrets";

export type SlackConfig = {
  botToken: string; // xoxb-... Bot User OAuth Token
  appToken?: string; // xapp-... for Socket Mode (optional)
};

// Slack message types
export type SlackMessage = {
  type: "message";
  subtype?: string;
  ts: string; // Thread timestamp (unique ID)
  thread_ts?: string; // Parent thread timestamp (if reply)
  user: string; // User ID
  bot_id?: string; // Bot ID (for bot messages)
  username?: string; // Bot username (for bot messages)
  text: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reactions?: SlackReaction[];
  files?: SlackFile[];
  attachments?: SlackAttachment[];
};

export type SlackReaction = {
  name: string;
  count: number;
  users: string[];
};

export type SlackFile = {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  url_private: string;
};

export type SlackAttachment = {
  fallback?: string;
  text?: string;
  pretext?: string;
  title?: string;
  title_link?: string;
};

export type SlackUser = {
  id: string;
  name: string;
  real_name: string;
  is_bot: boolean;
  profile: {
    display_name: string;
    email?: string;
    image_48?: string;
  };
};

export type SlackChannel = {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
};

export type SlackThread = {
  parentMessage: SlackMessage;
  replies: SlackMessage[];
  channel: string;
  channelName?: string;
  users: Map<string, SlackUser>;
};

// API response types
type SlackApiResponse<T> = {
  ok: boolean;
  error?: string;
} & T;

type ConversationsListResponse = SlackApiResponse<{
  channels: SlackChannel[];
  response_metadata?: { next_cursor?: string };
}>;

type ConversationsHistoryResponse = SlackApiResponse<{
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: { next_cursor?: string };
}>;

type ConversationsRepliesResponse = SlackApiResponse<{
  messages: SlackMessage[];
  has_more: boolean;
}>;

type UsersInfoResponse = SlackApiResponse<{
  user: SlackUser;
}>;

let cachedConfig: SlackConfig | null = null;

async function getConfig(): Promise<SlackConfig> {
  // Return cached config to avoid repeated secret lookups
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const botToken = await getSecret("slack-bot-token", "SLACK_BOT_TOKEN");
    const appToken = await getSecret("slack-app-token", "SLACK_APP_TOKEN").catch(() => undefined);

    cachedConfig = {
      botToken,
      appToken,
    };

    return cachedConfig;
  } catch {
    throw new Error(
      "Slack not configured. Set SLACK_BOT_TOKEN in AWS Secrets Manager or environment variable."
    );
  }
}

export async function isSlackConfigured(): Promise<boolean> {
  try {
    await getSecret("slack-bot-token", "SLACK_BOT_TOKEN");
    return true;
  } catch {
    return false;
  }
}

async function getAuthHeader(): Promise<string> {
  const config = await getConfig();
  return `Bearer ${config.botToken}`;
}

/**
 * Make authenticated request to Slack API
 */
async function slackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://slack.com/api/${endpoint}`;
  const authHeader = await getAuthHeader();

  const response = await circuitBreakers.slack.execute(() =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json; charset=utf-8",
        ...options.headers,
      },
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack API HTTP error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    throw new Error(`Slack API returned empty response for ${endpoint}`);
  }

  let data: SlackApiResponse<T>;
  try {
    data = JSON.parse(text) as SlackApiResponse<T>;
  } catch {
    throw new Error(`Slack API returned invalid JSON for ${endpoint}: ${text.substring(0, 100)}`);
  }

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || "Unknown error"}`);
  }

  return data as T;
}

/**
 * List channels the bot has access to
 */
export async function listChannels(params?: {
  types?: string; // "public_channel,private_channel"
  excludeArchived?: boolean;
}): Promise<SlackChannel[]> {
  const allChannels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const queryParams = new URLSearchParams({
      types: params?.types || "public_channel",
      exclude_archived: String(params?.excludeArchived ?? true),
      limit: "200",
    });

    if (cursor) {
      queryParams.set("cursor", cursor);
    }

    const response = await slackRequest<ConversationsListResponse>(
      `conversations.list?${queryParams}`
    );

    allChannels.push(...response.channels);
    cursor = response.response_metadata?.next_cursor;

    // Rate limit: Tier 2 method, ~20 requests/minute
    if (cursor) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } while (cursor);

  return allChannels;
}

/**
 * Get channel info by ID
 */
export async function getChannelInfo(channelId: string): Promise<SlackChannel> {
  const response = await slackRequest<{ channel: SlackChannel }>(
    `conversations.info?channel=${channelId}`
  );
  return response.channel;
}

/**
 * Fetch message history from a channel
 */
export async function fetchChannelHistory(params: {
  channelId: string;
  oldest?: Date; // Start of time range
  latest?: Date; // End of time range
  limit?: number;
}): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;
  const maxMessages = params.limit || 500;

  do {
    const queryParams = new URLSearchParams({
      channel: params.channelId,
      limit: String(Math.min(200, maxMessages - allMessages.length)),
    });

    if (params.oldest) {
      queryParams.set("oldest", String(params.oldest.getTime() / 1000));
    }
    if (params.latest) {
      queryParams.set("latest", String(params.latest.getTime() / 1000));
    }
    if (cursor) {
      queryParams.set("cursor", cursor);
    }

    const response = await slackRequest<ConversationsHistoryResponse>(
      `conversations.history?${queryParams}`
    );

    allMessages.push(...response.messages);
    cursor = response.response_metadata?.next_cursor;

    // Rate limit: Tier 3 method, ~50 requests/minute
    if (cursor && allMessages.length < maxMessages) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } while (cursor && allMessages.length < maxMessages);

  return allMessages;
}

/**
 * Fetch replies to a thread
 */
export async function fetchThreadReplies(params: {
  channelId: string;
  threadTs: string;
}): Promise<SlackMessage[]> {
  const allReplies: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const queryParams = new URLSearchParams({
      channel: params.channelId,
      ts: params.threadTs,
      limit: "200",
    });

    if (cursor) {
      queryParams.set("cursor", cursor);
    }

    const response = await slackRequest<ConversationsRepliesResponse>(
      `conversations.replies?${queryParams}`
    );

    // First message is the parent, rest are replies
    if (allReplies.length === 0) {
      allReplies.push(...response.messages);
    } else {
      // Skip parent on subsequent pages
      allReplies.push(...response.messages.slice(1));
    }

    cursor = response.has_more ? "more" : undefined; // Replies API uses has_more, not cursor

    if (response.has_more) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } while (cursor);

  return allReplies;
}

/**
 * Fetch user info
 */
export async function fetchUser(userId: string): Promise<SlackUser> {
  const response = await slackRequest<UsersInfoResponse>(
    `users.info?user=${userId}`
  );
  return response.user;
}

/**
 * Fetch multiple users (batched)
 */
export async function fetchUsers(userIds: string[]): Promise<Map<string, SlackUser>> {
  const users = new Map<string, SlackUser>();
  const uniqueIds = [...new Set(userIds)];

  // Process in batches of 10 to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchUser(id);
        } catch {
          // User might be deactivated
          return null;
        }
      })
    );

    for (const user of results) {
      if (user) {
        users.set(user.id, user);
      }
    }

    if (i + batchSize < uniqueIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return users;
}

/**
 * Fetch a complete thread with all replies and user info
 */
export async function fetchThread(params: {
  channelId: string;
  threadTs: string;
}): Promise<SlackThread> {
  const replies = await fetchThreadReplies(params);

  if (replies.length === 0) {
    throw new Error(`Thread not found: ${params.threadTs}`);
  }

  const parentMessage = replies[0];
  const threadReplies = replies.slice(1);

  // Collect all user IDs
  const userIds = new Set<string>();
  userIds.add(parentMessage.user);
  for (const reply of threadReplies) {
    userIds.add(reply.user);
  }

  // Fetch user info
  const users = await fetchUsers([...userIds]);

  // Get channel name
  let channelName: string | undefined;
  try {
    const channelInfo = await getChannelInfo(params.channelId);
    channelName = channelInfo.name;
  } catch {
    // Channel info might not be accessible
  }

  return {
    parentMessage,
    replies: threadReplies,
    channel: params.channelId,
    channelName,
    users,
  };
}

/**
 * Find threads with replies (potential Q&A discussions)
 * Filters for messages that have responses
 */
export async function findThreadsWithReplies(params: {
  channelId: string;
  oldest?: Date;
  latest?: Date;
  minReplies?: number;
  limit?: number;
}): Promise<SlackMessage[]> {
  const messages = await fetchChannelHistory({
    channelId: params.channelId,
    oldest: params.oldest,
    latest: params.latest,
    limit: params.limit || 200,
  });

  const minReplies = params.minReplies ?? 1;

  // Filter for messages with replies (user can ignore unwanted ones)
  return messages.filter(
    (m) => (m.reply_count ?? 0) >= minReplies
  );
}

/**
 * Find threads with specific reactions (e.g., checkmark for resolved)
 */
export async function findThreadsWithReactions(params: {
  channelId: string;
  reactions: string[]; // e.g., ["white_check_mark", "heavy_check_mark"]
  oldest?: Date;
  latest?: Date;
  limit?: number;
}): Promise<SlackMessage[]> {
  const messages = await fetchChannelHistory({
    channelId: params.channelId,
    oldest: params.oldest,
    latest: params.latest,
    limit: params.limit || 500,
  });

  // Filter for messages with any of the specified reactions
  return messages.filter((m) => {
    if (!m.reactions) return false;
    return m.reactions.some((r) => params.reactions.includes(r.name));
  });
}

// Document source format for skill generation (matches Zendesk)
export type DocumentSource = {
  id: string;
  title: string;
  filename: string;
  content: string;
};

/**
 * Convert a Slack thread to DocumentSource format
 * This is the format expected by the skill generation pipeline
 */
export function threadToDocumentSource(thread: SlackThread): DocumentSource {
  const parts: string[] = [];

  // Helper to get user display name
  const getUserName = (userId: string): string => {
    const user = thread.users.get(userId);
    return user?.profile?.display_name || user?.real_name || user?.name || userId;
  };

  // Header with thread info
  const parentTs = thread.parentMessage.ts;
  const threadDate = new Date(parseFloat(parentTs) * 1000);
  const title = extractThreadTitle(thread.parentMessage.text);

  parts.push(`# ${title}`);
  parts.push("");
  parts.push(`**Channel:** #${thread.channelName || thread.channel}`);
  parts.push(`**Date:** ${threadDate.toISOString().split("T")[0]}`);
  parts.push(`**Replies:** ${thread.replies.length}`);
  parts.push("");

  // Original question/message
  parts.push("## Question");
  parts.push(`**${getUserName(thread.parentMessage.user)}:**`);
  parts.push(cleanSlackText(thread.parentMessage.text));
  parts.push("");

  // Replies (the answers/discussion)
  if (thread.replies.length > 0) {
    parts.push("## Discussion");
    for (const reply of thread.replies) {
      parts.push(`**${getUserName(reply.user)}:**`);
      parts.push(cleanSlackText(reply.text));
      parts.push("");
    }
  }

  return {
    id: `slack-${thread.channel}-${parentTs}`,
    title,
    filename: `slack-thread-${parentTs.replace(".", "-")}.md`,
    content: parts.join("\n"),
  };
}

/**
 * Extract a title from Slack message text
 * Takes first line or first N characters
 */
function extractThreadTitle(text: string): string {
  // Clean the text first
  const cleaned = cleanSlackText(text);

  // Take first line
  const firstLine = cleaned.split("\n")[0];

  // Truncate if too long
  const maxLength = 80;
  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return firstLine.substring(0, maxLength - 3) + "...";
}

/**
 * Clean Slack-specific formatting from message text
 */
export function cleanSlackText(text: string): string {
  return (
    text
      // Convert user mentions <@U123456> to @username (we'd need user lookup for real names)
      .replace(/<@([A-Z0-9]+)>/g, "@user")
      // Convert channel mentions <#C123456|channel-name>
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
      // Convert URLs <http://example.com|example.com>
      .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2 ($1)")
      // Convert plain URLs <http://example.com>
      .replace(/<(https?:\/\/[^>]+)>/g, "$1")
      // Remove other Slack-specific markup
      .replace(/<!subteam\^[^|]+\|([^>]+)>/g, "@$1")
      .replace(/<!here>/g, "@here")
      .replace(/<!channel>/g, "@channel")
      .replace(/<!everyone>/g, "@everyone")
  );
}

/**
 * Convert multiple threads to DocumentSource array
 */
export function threadsToDocumentSources(threads: SlackThread[]): DocumentSource[] {
  return threads.map(threadToDocumentSource);
}

/**
 * Fetch threads from a channel ready for skill generation
 */
export async function fetchChannelThreadsForSkillGeneration(params: {
  channelId: string;
  oldest?: Date;
  latest?: Date;
  minReplies?: number;
  reactions?: string[]; // Filter by reactions if specified
  limit?: number;
}): Promise<{
  threads: SlackThread[];
  documents: DocumentSource[];
  channelId: string;
  channelName?: string;
}> {
  // Default to last 30 days
  const oldest = params.oldest || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find qualifying messages
  let parentMessages: SlackMessage[];

  if (params.reactions && params.reactions.length > 0) {
    // Filter by reactions
    parentMessages = await findThreadsWithReactions({
      channelId: params.channelId,
      reactions: params.reactions,
      oldest,
      latest: params.latest,
      limit: params.limit,
    });
  } else {
    // Filter by reply count
    parentMessages = await findThreadsWithReplies({
      channelId: params.channelId,
      oldest,
      latest: params.latest,
      minReplies: params.minReplies ?? 1,
      limit: params.limit,
    });
  }

  if (parentMessages.length === 0) {
    return { threads: [], documents: [], channelId: params.channelId };
  }

  // Fetch full thread details
  const threads: SlackThread[] = [];
  for (const msg of parentMessages.slice(0, params.limit || 50)) {
    try {
      const thread = await fetchThread({
        channelId: params.channelId,
        threadTs: msg.ts,
      });
      threads.push(thread);

      // Rate limit between thread fetches
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.warn(`Failed to fetch thread ${msg.ts}:`, error);
    }
  }

  // Convert to document sources
  const documents = threadsToDocumentSources(threads);

  // Get channel name from first thread if available
  const channelName = threads[0]?.channelName;

  return {
    threads,
    documents,
    channelId: params.channelId,
    channelName,
  };
}

// =============================================================================
// SLACK BOT FUNCTIONALITY
// For responding to @mentions and answering IT questions
// =============================================================================

type PostMessageResponse = SlackApiResponse<{
  channel: string;
  ts: string;
  message: SlackMessage;
}>;

type PermalinkResponse = SlackApiResponse<{
  permalink: string;
}>;

type AuthTestResponse = SlackApiResponse<{
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
}>;

/**
 * Get the bot's own user ID
 * Useful for detecting @mentions
 */
export async function getBotInfo(): Promise<{ botId: string; botUserId: string; teamId: string }> {
  const response = await slackRequest<AuthTestResponse>("auth.test");
  return {
    botId: response.bot_id || response.user_id,
    botUserId: response.user_id,
    teamId: response.team_id,
  };
}

/**
 * Post a message to a channel
 */
export async function postMessage(params: {
  channelId: string;
  text: string;
  threadTs?: string; // Reply to a specific thread
  blocks?: unknown[]; // Slack Block Kit blocks for rich formatting
}): Promise<{ ts: string; permalink: string }> {
  const body: Record<string, unknown> = {
    channel: params.channelId,
    text: params.text,
  };

  if (params.threadTs) {
    body.thread_ts = params.threadTs;
  }

  if (params.blocks) {
    body.blocks = params.blocks;
  }

  const response = await slackRequest<PostMessageResponse>("chat.postMessage", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Get permalink for the message
  let permalink = "";
  try {
    const permalinkResponse = await slackRequest<PermalinkResponse>(
      `chat.getPermalink?channel=${params.channelId}&message_ts=${response.ts}`
    );
    permalink = permalinkResponse.permalink;
  } catch {
    // Permalink might not be available
  }

  return {
    ts: response.ts,
    permalink,
  };
}

/**
 * Add a reaction to a message
 */
export async function addReaction(params: {
  channelId: string;
  messageTs: string;
  reaction: string; // Without colons, e.g., "eyes" not ":eyes:"
}): Promise<void> {
  await slackRequest<SlackApiResponse<object>>("reactions.add", {
    method: "POST",
    body: JSON.stringify({
      channel: params.channelId,
      timestamp: params.messageTs,
      name: params.reaction,
    }),
  });
}

/**
 * Get permalink for a message
 */
export async function getPermalink(channelId: string, messageTs: string): Promise<string> {
  const response = await slackRequest<PermalinkResponse>(
    `chat.getPermalink?channel=${channelId}&message_ts=${messageTs}`
  );
  return response.permalink;
}

/**
 * Check if a message mentions the bot
 */
export function messagesMentionsBot(text: string, botUserId: string): boolean {
  // Slack mentions look like <@U12345678>
  const mentionPattern = new RegExp(`<@${botUserId}>`);
  return mentionPattern.test(text);
}

/**
 * Extract the question from a message that mentions the bot
 * Removes the @mention and cleans up the text
 */
export function extractQuestionFromMention(text: string, botUserId: string): string {
  // Remove the bot mention
  const withoutMention = text.replace(new RegExp(`<@${botUserId}>`, "g"), "");

  // Clean up extra whitespace
  return withoutMention.trim().replace(/\s+/g, " ");
}

/**
 * Format an answer for Slack with markdown
 * Converts our internal markdown to Slack's mrkdwn format
 */
export function formatAnswerForSlack(answer: string, confidence?: string): string {
  let formatted = answer;

  // Convert markdown headers to bold (Slack doesn't support headers)
  formatted = formatted.replace(/^### (.+)$/gm, "*$1*");
  formatted = formatted.replace(/^## (.+)$/gm, "*$1*");
  formatted = formatted.replace(/^# (.+)$/gm, "*$1*");

  // Convert markdown links to Slack format: [text](url) -> <url|text>
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert markdown bold **text** to Slack bold *text*
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  // Add confidence indicator if provided
  if (confidence) {
    const emoji = confidence === "High" ? "✅" : confidence === "Medium" ? "⚡" : "🤔";
    formatted = `${emoji} _Confidence: ${confidence}_\n\n${formatted}`;
  }

  return formatted;
}

/**
 * Build Block Kit blocks for a rich answer
 */
export function buildAnswerBlocks(params: {
  answer: string;
  confidence?: string;
  skillsUsed?: Array<{ id: string; title: string }>;
}): unknown[] {
  const blocks: unknown[] = [];

  // Main answer section
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: formatAnswerForSlack(params.answer, params.confidence),
    },
  });

  // Skills used footer
  if (params.skillsUsed && params.skillsUsed.length > 0) {
    const skillNames = params.skillsUsed.map((s) => s.title).join(", ");
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📚 Sources: ${skillNames}`,
        },
      ],
    });
  }

  // Feedback buttons
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "👍 Helpful",
        },
        value: "helpful",
        action_id: "feedback_helpful",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "👎 Not helpful",
        },
        value: "not_helpful",
        action_id: "feedback_not_helpful",
      },
    ],
  });

  return blocks;
}
