/**
 * Slack Bot Worker - Socket Mode (Multi-Library Support)
 *
 * This worker maintains persistent WebSocket connections to Slack
 * for receiving events (app_mention, reactions) without needing
 * a public HTTP endpoint.
 *
 * Each library can have its own Slack bot with separate credentials:
 * - slack-app-token-{library}: App-level token (xapp-...) with connections:write scope
 * - slack-bot-token-{library}: Bot token (xoxb-...) for API calls
 *
 * Usage:
 * - Start all configured bots: startSlackBots(["it", "knowledge", "gtm"])
 * - Start a single bot: startSlackBot("it")
 */

import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { generateLibraryAnswer, type BotLibraryId } from "./slack-bot-service";
import { getSecret } from "./secrets";
import { getIntegrationConnectionName } from "./v2/integrations/integration-config";
import { fetchThreadContext, type ThreadContext } from "./slack/thread-context";

/**
 * Wrap a promise with a timeout
 * Socket Mode expects ack within ~3 seconds, so we timeout AI calls at 25 seconds max
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 25000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Slack Bot Instance - manages a single library's Slack bot connection
 */
class SlackBotInstance {
  private libraryId: BotLibraryId;
  private socketClient: SocketModeClient | null = null;
  private webClient: WebClient | null = null;
  private botUserId: string | null = null;
  private isRunning = false;
  private configuredChannels: string[] = [];

  constructor(libraryId: BotLibraryId) {
    this.libraryId = libraryId;
  }

  /**
   * Load configured channels from database for this library
   */
  private async loadConfiguredChannels(): Promise<string[]> {
    const connectionName = getIntegrationConnectionName('slack', this.libraryId);

    try {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          integrationType: 'slack',
          name: connectionName,
        },
      });

      const config = (connection?.config as Record<string, unknown>) || {};
      // Bot only responds in explicitly configured botChannels (strict mode)
      // Bot channels are separate from ingestion/source channels
      const botChannels = (config.botChannels as string[]) || [];
      const sourceChannels = (config.channels as string[]) || [];
      logger.info(`Loaded configured channels for ${this.libraryId}`, {
        botChannels,
        sourceChannels,
      });
      return botChannels;
    } catch (error) {
      logger.error(`Failed to load configured channels for ${this.libraryId}`, error);
      return [];
    }
  }

  /**
   * Load tokens from Secrets Manager for this library
   */
  private async loadTokens(): Promise<{ appToken: string | null; botToken: string | null }> {
    let appToken: string | null = null;
    let botToken: string | null = null;

    // Try library-specific app token first, then fall back to shared
    try {
      const envVarName = `SLACK_APP_TOKEN_${this.libraryId.toUpperCase()}`;
      appToken = await getSecret(`slack-app-token-${this.libraryId}`, envVarName);
    } catch {
      try {
        // Fall back to shared app token
        appToken = await getSecret("slack-app-token", "SLACK_APP_TOKEN");
      } catch {
        logger.debug(`No app token found for library ${this.libraryId}`);
      }
    }

    // Try library-specific bot token first, then fall back to shared
    try {
      const envVarName = `SLACK_BOT_TOKEN_${this.libraryId.toUpperCase()}`;
      botToken = await getSecret(`slack-bot-token-${this.libraryId}`, envVarName);
    } catch {
      try {
        // Fall back to shared bot token
        botToken = await getSecret("slack-bot-token", "SLACK_BOT_TOKEN");
      } catch {
        logger.debug(`No bot token found for library ${this.libraryId}`);
      }
    }

    return { appToken, botToken };
  }

  /**
   * Get the bot's user ID for detecting @mentions
   */
  private async getBotUserId(): Promise<string> {
    if (this.botUserId) return this.botUserId;

    if (!this.webClient) {
      throw new Error("Slack Web Client not initialized");
    }

    const result = await this.webClient.auth.test();
    this.botUserId = result.user_id as string;
    return this.botUserId;
  }

  /**
   * Extract the question from a message that mentions the bot
   */
  private extractQuestion(text: string, botId: string): string {
    return text.replace(new RegExp(`<@${botId}>`, "g"), "").trim().replace(/\s+/g, " ");
  }

  /**
   * Generate an answer using the library service
   */
  private async generateAnswer(question: string, threadContext?: ThreadContext) {
    const result = await generateLibraryAnswer(question, this.libraryId, threadContext);

    // Convert sourceUrls to notion URLs for Slack formatting
    const skillsWithNotionUrls = result.skillsUsed.map((s) => {
      const notionUrls = (s.sourceUrls || [])
        .filter((url) => url.includes("notion.so") || url.includes("notion.site"));
      return { id: s.id, title: s.title, notionUrls };
    });

    return {
      answer: result.answer,
      confidence: result.confidence,
      skillsUsed: skillsWithNotionUrls,
      skillsSearched: result.skillsSearched,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      contextWarning: result.contextWarning,
    };
  }

  /**
   * Format answer for Slack
   */
  private formatAnswerForSlack(answer: string): string {
    let formatted = answer;

    // Convert markdown headers to bold
    formatted = formatted.replace(/^### (.+)$/gm, "*$1*");
    formatted = formatted.replace(/^## (.+)$/gm, "*$1*");
    formatted = formatted.replace(/^# (.+)$/gm, "*$1*");

    // Convert markdown links to Slack format
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

    // Convert markdown bold to Slack bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "*$1*");

    return formatted;
  }

  /**
   * Build Block Kit blocks for the response
   */
  private buildAnswerBlocks(params: {
    answer: string;
    skillsUsed?: Array<{ id: string; title: string; notionUrls?: string[] }>;
  }): object[] {
    const blocks: object[] = [];
    const helpdeskUrl = process.env.ZENDESK_HELPDESK_URL || "";

    // Main answer section
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: this.formatAnswerForSlack(params.answer),
      },
    });

    // Sources footer - only show if there are Notion URLs
    if (params.skillsUsed && params.skillsUsed.length > 0) {
      const notionLinks: Array<{ title: string; url: string }> = [];
      for (const skill of params.skillsUsed) {
        if (skill.notionUrls && skill.notionUrls.length > 0) {
          for (const url of skill.notionUrls) {
            notionLinks.push({ title: skill.title, url });
          }
        }
      }

      if (notionLinks.length > 0) {
        const formattedLinks = notionLinks
          .slice(0, 3)
          .map((link) => `<${link.url}|${link.title}>`)
          .join(", ");

        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `:books: Sources: ${formattedLinks}`,
            },
          ],
        });
      }
    }

    // Helpdesk link footer - only show for IT bot
    if (this.libraryId === "it") {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Need more help? <${helpdeskUrl}|Submit a ticket to IT>`,
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
            text: ":+1:",
          },
          value: "helpful",
          action_id: "feedback_helpful",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: ":-1:",
          },
          value: "not_helpful",
          action_id: "feedback_not_helpful",
        },
      ],
    });

    return blocks;
  }

  /**
   * Handle app_mention events
   */
  private async handleAppMention(event: {
    type: string;
    user: string;
    text: string;
    ts: string;
    channel: string;
    thread_ts?: string;
    team?: string;
  }): Promise<void> {
    if (!this.webClient) {
      logger.error("Web client not initialized", { library: this.libraryId });
      return;
    }

    const startTime = Date.now();
    const { channel, text, ts, user, thread_ts, team } = event;

    logger.info(`[${this.libraryId}] Received app_mention event`, { channel, user, text: text.substring(0, 100) });

    try {
      // Get bot user ID first to validate this event is for this bot
      const botId = await this.getBotUserId();

      // Check if this mention was actually for this bot
      // With multiple bots on the same Socket Mode app, we need to validate the mention
      if (!text.includes(`<@${botId}>`)) {
        logger.debug(`[${this.libraryId}] Ignoring app_mention - not for this bot`, {
          botId,
          mentionedBots: text.match(/<@[A-Z0-9]+>/g) || [],
          libraryId: this.libraryId
        });
        return;
      }

      // Check if this channel is configured for bot responses
      // configuredChannels are bot response channels (separate from ingestion/source channels)
      // Bot only responds if mentioned in one of these configured channels
      if (this.configuredChannels.length > 0 && !this.configuredChannels.includes(channel)) {
        logger.info(`[${this.libraryId}] Ignoring app_mention - channel not configured for bot responses`, {
          channel,
          configuredChannels: this.configuredChannels,
        });
        return;
      }

      // Add eyes reaction to acknowledge
      await this.webClient.reactions.add({
        channel,
        timestamp: ts,
        name: "eyes",
      });

      // Extract question
      const question = this.extractQuestion(text, botId);
      logger.info(`[${this.libraryId}] Extracted question`, { question: question.substring(0, 100), botId });

      if (!question || question.length < 3) {
        await this.webClient.chat.postMessage({
          channel,
          thread_ts: thread_ts || ts,
          text: `Hi! I'm here to help with ${this.libraryId.toUpperCase()} questions. Please @mention me with your question and I'll do my best to answer.`,
        });
        return;
      }

      // Fetch thread context if this is part of a thread
      let threadContext: ThreadContext | undefined;
      const threadTs = thread_ts || ts;
      try {
        threadContext = await fetchThreadContext(threadTs, this.libraryId, {
          maxMessages: 10,
          tokenBudget: 2000,
          includeSkillContext: true,
        });
      } catch (error) {
        logger.error(`[${this.libraryId}] Failed to fetch thread context`, error, {
          threadTs,
          channel,
          errorName: error instanceof Error ? error.name : 'unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        // Continue without thread context - bot still functions
      }

      // Get channel info
      let channelName: string | undefined;
      try {
        const channelInfo = await this.webClient.conversations.info({ channel });
        channelName = (channelInfo.channel as { name?: string })?.name;
      } catch {
        // Channel info not available
      }

      // Get user info
      let userName: string | undefined;
      try {
        const userInfo = await this.webClient.users.info({ user });
        const profile = userInfo.user as { profile?: { display_name?: string }; real_name?: string; name?: string };
        userName = profile?.profile?.display_name || profile?.real_name || profile?.name;
      } catch {
        // User info not available
      }

      // Generate answer with timeout protection
      let answer: string;
      let confidence: string;
      let skillsUsed: Array<{ id: string; title: string }> | undefined;
      let skillsSearched: number;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let contextWarning: string | undefined;

      try {
        const result = await withTimeout(this.generateAnswer(question, threadContext), 25000);
        answer = result.answer;
        confidence = result.confidence;
        skillsUsed = result.skillsUsed;
        skillsSearched = result.skillsSearched;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        contextWarning = result.contextWarning;
      } catch (aiError) {
        logger.warn("AI generation timeout or error", aiError, { question, channel, library: this.libraryId });
        answer = "I'm taking too long to think about that question. Please try again or contact support for urgent issues.";
        confidence = "Low";
        skillsUsed = undefined;
        skillsSearched = 0;
        inputTokens = undefined;
        outputTokens = undefined;
        contextWarning = undefined;
      }

      // Prepend warning if context budget exceeded
      if (contextWarning) {
        answer = `⚠️ ${contextWarning}\n\n${answer}`;
      }

      // Build response blocks
      const blocks = this.buildAnswerBlocks({ answer, skillsUsed });

      // Post response in the channel where mentioned
      const responseTs = thread_ts || ts;
      const postResult = await this.webClient.chat.postMessage({
        channel,
        thread_ts: responseTs,
        text: answer,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: blocks as any,
      });

      // Get permalink
      let permalink: string | undefined;
      try {
        const linkResult = await this.webClient.chat.getPermalink({
          channel,
          message_ts: postResult.ts as string,
        });
        permalink = linkResult.permalink as string;
      } catch {
        // Permalink not available
      }

      // Add checkmark reaction
      try {
        await this.webClient.reactions.add({
          channel,
          timestamp: ts,
          name: "white_check_mark",
        });
      } catch {
        // Reaction might already exist
      }

      const responseTimeMs = Date.now() - startTime;

      // Log to database
      await prisma.slackBotInteraction.create({
        data: {
          slackTeamId: team || "",
          slackChannelId: channel,
          slackChannelName: channelName,
          slackThreadTs: responseTs,
          slackMessageTs: ts,
          slackUserId: user,
          slackUserName: userName,
          slackPermalink: permalink,
          question,
          answer,
          confidence,
          skillsUsed: skillsUsed || [],
          skillsSearched,
          responseTimeMs,
          inputTokens,
          outputTokens,
          ...(this.libraryId && { libraryId: this.libraryId }),
        },
      });

      logger.info("Slack bot answered question", {
        library: this.libraryId,
        channel,
        channelName,
        user,
        questionLength: question.length,
        answerLength: answer.length,
        confidence,
        skillsUsed: skillsUsed?.length || 0,
        responseTimeMs,
      });
    } catch (error) {
      logger.error("Failed to handle app mention", error, { channel, ts, library: this.libraryId });

      try {
        await this.webClient.chat.postMessage({
          channel,
          thread_ts: thread_ts || ts,
          text: "Sorry, I encountered an error processing your question. Please try again or contact support directly.",
        });
      } catch {
        // Couldn't send error message
      }
    }
  }

  /**
   * Handle reaction_added events
   */
  private async handleReaction(event: {
    type: string;
    user: string;
    reaction: string;
    item: {
      type: string;
      channel: string;
      ts: string;
    };
  }): Promise<void> {
    const { reaction, item, user } = event;

    if (item.type !== "message") return;

    const interaction = await prisma.slackBotInteraction.findFirst({
      where: {
        slackChannelId: item.channel,
        slackThreadTs: item.ts,
        libraryId: this.libraryId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!interaction) return;

    const positiveReactions = ["thumbsup", "+1", "white_check_mark", "heavy_check_mark", "100"];
    const negativeReactions = ["thumbsdown", "-1", "x", "negative_squared_cross_mark"];

    let wasHelpful: boolean | null = null;
    if (positiveReactions.includes(reaction)) {
      wasHelpful = true;
    } else if (negativeReactions.includes(reaction)) {
      wasHelpful = false;
    }

    if (wasHelpful !== null) {
      await prisma.slackBotInteraction.update({
        where: { id: interaction.id },
        data: {
          wasHelpful,
          userFeedback: `Reaction: ${reaction} from ${user}`,
        },
      });

      logger.info("Slack bot feedback received", {
        library: this.libraryId,
        interactionId: interaction.id,
        wasHelpful,
        reaction,
      });
    }
  }

  /**
   * Handle interactive components (button clicks)
   */
  private async handleInteraction(payload: {
    type: string;
    trigger_id?: string;
    user: { id: string; username: string; name: string };
    channel: { id: string; name: string };
    message: { ts: string; thread_ts?: string; text?: string };
    actions: Array<{ action_id: string; value: string }>;
    response_url: string;
  }): Promise<void> {
    if (payload.type !== "block_actions" || !payload.actions?.length) return;

    const action = payload.actions[0];

    if (action.action_id === "feedback_helpful" || action.action_id === "feedback_not_helpful") {
      const wasHelpful = action.action_id === "feedback_helpful";
      const threadTs = payload.message.thread_ts || payload.message.ts;

      const interaction = await prisma.slackBotInteraction.findFirst({
        where: {
          slackChannelId: payload.channel.id,
          slackThreadTs: threadTs,
          libraryId: this.libraryId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (interaction) {
        await prisma.slackBotInteraction.update({
          where: { id: interaction.id },
          data: {
            wasHelpful,
            userFeedback: `Button: ${wasHelpful ? "helpful" : "not helpful"} from ${payload.user.name}`,
          },
        });

        logger.info("Slack bot button feedback", {
          library: this.libraryId,
          interactionId: interaction.id,
          wasHelpful,
          user: payload.user.username,
        });
      }

      try {
        await fetch(payload.response_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replace_original: false,
            text: wasHelpful
              ? "Thanks for the feedback! Glad I could help."
              : "Thanks for the feedback. I'll try to do better!",
          }),
        });
      } catch (err) {
        logger.error("Failed to respond to interaction", err, { library: this.libraryId });
      }
    }
  }

  /**
   * Start the bot instance
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      logger.warn(`Slack bot for ${this.libraryId} is already running`);
      return true;
    }

    const { appToken, botToken } = await this.loadTokens();

    if (!appToken || !botToken) {
      logger.warn(`Slack bot for ${this.libraryId} not starting - missing tokens`, {
        hasAppToken: !!appToken,
        hasBotToken: !!botToken,
      });
      return false;
    }

    // Load configured channels from database
    this.configuredChannels = await this.loadConfiguredChannels();
    if (this.configuredChannels.length === 0) {
      logger.warn(`Slack bot for ${this.libraryId} has no configured channels - will respond in all channels where mentioned`);
    } else {
      logger.info(`Slack bot for ${this.libraryId} will only respond in configured channels`, {
        channels: this.configuredChannels,
      });
    }

    this.socketClient = new SocketModeClient({ appToken });
    this.webClient = new WebClient(botToken);

    // Handle app_mention events
    this.socketClient.on("app_mention", async ({ event, ack }) => {
      logger.info(`[${this.libraryId}] Socket Mode received app_mention event`, { type: event.type });
      await ack();
      await this.handleAppMention(event);
    });

    // Handle reaction_added events
    this.socketClient.on("reaction_added", async ({ event, ack }) => {
      await ack();
      await this.handleReaction(event);
    });

    // Handle interactive components
    this.socketClient.on("interactive", async ({ body, ack }) => {
      await ack();
      if (body.type === "block_actions") {
        await this.handleInteraction(body);
      }
    });

    // Handle connection events
    this.socketClient.on("connected", () => {
      logger.info(`Slack bot for ${this.libraryId} connected via Socket Mode`);
    });

    this.socketClient.on("disconnected", () => {
      logger.warn(`Slack bot for ${this.libraryId} disconnected from Socket Mode`);
    });

    this.socketClient.on("error", (error) => {
      logger.error(`Slack bot for ${this.libraryId} socket error`, error);
    });

    // Start the connection
    await this.socketClient.start();
    this.isRunning = true;
    logger.info(`Slack bot for ${this.libraryId} started`);
    return true;
  }

  /**
   * Stop the bot instance
   */
  async stop(): Promise<void> {
    if (this.socketClient && this.isRunning) {
      await this.socketClient.disconnect();
      this.isRunning = false;
      logger.info(`Slack bot for ${this.libraryId} stopped`);
    }
  }

  get running(): boolean {
    return this.isRunning;
  }

  get library(): BotLibraryId {
    return this.libraryId;
  }
}

// Registry of active bot instances
const botInstances = new Map<BotLibraryId, SlackBotInstance>();

/**
 * Start a Slack bot for a specific library
 */
export async function startSlackBot(libraryId: BotLibraryId): Promise<boolean> {
  if (botInstances.has(libraryId)) {
    logger.warn(`Slack bot for ${libraryId} already exists`);
    return botInstances.get(libraryId)!.running;
  }

  const instance = new SlackBotInstance(libraryId);
  const started = await instance.start();

  if (started) {
    botInstances.set(libraryId, instance);
  }

  return started;
}

/**
 * Start Slack bots for multiple libraries
 * Returns array of library IDs that successfully started
 */
export async function startSlackBots(libraryIds: BotLibraryId[]): Promise<BotLibraryId[]> {
  const started: BotLibraryId[] = [];

  for (const libraryId of libraryIds) {
    const success = await startSlackBot(libraryId);
    if (success) {
      started.push(libraryId);
    }
  }

  logger.info(`Started ${started.length}/${libraryIds.length} Slack bots`, {
    started,
    failed: libraryIds.filter((id) => !started.includes(id)),
  });

  return started;
}

/**
 * Stop a Slack bot for a specific library
 */
export async function stopSlackBot(libraryId: BotLibraryId): Promise<void> {
  const instance = botInstances.get(libraryId);
  if (instance) {
    await instance.stop();
    botInstances.delete(libraryId);
  }
}

/**
 * Stop all Slack bots
 */
export async function stopAllSlackBots(): Promise<void> {
  for (const [libraryId, instance] of botInstances) {
    await instance.stop();
    botInstances.delete(libraryId);
  }
  logger.info("All Slack bots stopped");
}

/**
 * Restart a Slack bot for a specific library (stop + start)
 * This reloads channel configuration from the database
 */
export async function restartSlackBot(libraryId: BotLibraryId): Promise<boolean> {
  logger.info(`Restarting Slack bot for ${libraryId}`);
  await stopSlackBot(libraryId);
  return startSlackBot(libraryId);
}

/**
 * Get status of all bot instances
 */
export function getSlackBotStatus(): Record<BotLibraryId, boolean> {
  const status: Partial<Record<BotLibraryId, boolean>> = {};
  for (const [libraryId, instance] of botInstances) {
    status[libraryId] = instance.running;
  }
  return status as Record<BotLibraryId, boolean>;
}

// If run directly, start bots based on env var
if (require.main === module) {
  const libraries = (process.env.SLACK_BOT_LIBRARIES || "it").split(",") as BotLibraryId[];
  startSlackBots(libraries).catch((error) => {
    logger.error("Failed to start Slack bots", error);
    process.exit(1);
  });
}
