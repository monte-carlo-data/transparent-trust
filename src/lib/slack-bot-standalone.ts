#!/usr/bin/env node
/**
 * Slack Bot Standalone Runner
 *
 * Run this as a standalone process for the Slack bot.
 * Can be used in ECS as a separate service or locally for testing.
 *
 * Usage:
 *   npx tsx src/lib/slack-bot-standalone.ts
 *   SLACK_BOT_LIBRARIES=it,knowledge npx tsx src/lib/slack-bot-standalone.ts
 *
 * Environment variables:
 *   SLACK_BOT_LIBRARIES - Comma-separated list of library IDs to start (default: "it")
 *   DATABASE_URL        - PostgreSQL connection string
 *
 * Secrets (per library, stored in AWS Secrets Manager):
 *   slack-app-token-{library} - App-level token (xapp-...) with connections:write scope
 *   slack-bot-token-{library} - Bot token (xoxb-...) for API calls
 */

import { startSlackBots, stopAllSlackBots } from "./slack-bot-worker";
import type { BotLibraryId } from "./slack-bot-service";

// Parse library IDs from environment
const libraryIds = (process.env.SLACK_BOT_LIBRARIES || "it")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as BotLibraryId[];

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down...");
  await stopAllSlackBots();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down...");
  await stopAllSlackBots();
  process.exit(0);
});

// Start the bots
console.log(`Starting Slack bots for libraries: ${libraryIds.join(", ")}...`);
startSlackBots(libraryIds)
  .then((started) => {
    if (started.length === 0) {
      console.error("No Slack bots started. Check your credentials.");
      process.exit(1);
    }
    console.log(`Slack bots running for: ${started.join(", ")}. Press Ctrl+C to stop.`);
  })
  .catch((error) => {
    console.error("Failed to start Slack bots:", error);
    process.exit(1);
  });
