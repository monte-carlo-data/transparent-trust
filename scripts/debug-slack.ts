#!/usr/bin/env npx tsx
/**
 * Slack Diagnostic Script
 * Tests bot token, scopes, and channel membership
 */

import { WebClient } from "@slack/web-api";
import dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

async function diagnose() {
  console.log("\n🔍 SLACK DIAGNOSTIC\n");
  console.log("=".repeat(50));

  // Check for tokens
  const botToken = process.env.SLACK_BOT_TOKEN_IT || process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN_IT || process.env.SLACK_APP_TOKEN;

  console.log("\n📋 TOKEN STATUS:");
  console.log(`  Bot Token (xoxb-): ${botToken ? `✅ Found (${botToken.substring(0, 15)}...)` : "❌ Missing"}`);
  console.log(`  App Token (xapp-): ${appToken ? `✅ Found (${appToken.substring(0, 15)}...)` : "❌ Missing (needed for Socket Mode bot)"}`);

  if (!botToken) {
    console.log("\n❌ No bot token found. Add SLACK_BOT_TOKEN or SLACK_BOT_TOKEN_IT to .env.local");
    process.exit(1);
  }

  const client = new WebClient(botToken);

  // Test 1: Auth test
  console.log("\n📋 AUTH TEST:");
  try {
    const auth = await client.auth.test();
    console.log(`  ✅ Bot ID: ${auth.user_id}`);
    console.log(`  ✅ Bot Name: ${auth.user}`);
    console.log(`  ✅ Team: ${auth.team} (${auth.team_id})`);
    console.log(`  ✅ URL: ${auth.url}`);
  } catch (error) {
    console.log(`  ❌ Auth failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Test 2: List channels
  console.log("\n📋 CHANNEL LIST (conversations.list):");
  try {
    const result = await client.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 100,
    });

    const channels = result.channels || [];
    const memberChannels = channels.filter((c) => c.is_member === true);

    console.log(`  Total channels visible: ${channels.length}`);
    console.log(`  Channels bot is member of: ${memberChannels.length}`);

    if (memberChannels.length === 0) {
      console.log("\n  ⚠️  BOT IS NOT A MEMBER OF ANY CHANNELS!");
      console.log("  This is likely the issue. Possible causes:");
      console.log("  1. Bot was never invited to channels");
      console.log("  2. Bot token missing 'channels:read' scope");
      console.log("  3. Bot was removed from channels");

      console.log("\n  First 10 visible channels (not a member):");
      channels.slice(0, 10).forEach((c) => {
        console.log(`    - #${c.name} (${c.id}) - is_member: ${c.is_member}`);
      });
    } else {
      console.log("\n  ✅ Bot is a member of these channels:");
      memberChannels.forEach((c) => {
        console.log(`    - #${c.name} (${c.id})`);
      });
    }
  } catch (error) {
    const err = error as { data?: { error?: string } };
    console.log(`  ❌ Failed to list channels: ${err.data?.error || error}`);
    if (err.data?.error === "missing_scope") {
      console.log("  → Missing OAuth scope: channels:read");
    }
  }

  // Test 3: Check specific channel (it-helpdesk)
  console.log("\n📋 SPECIFIC CHANNEL CHECK (it-helpdesk / C02GRJK3N4X):");
  try {
    const result = await client.conversations.info({
      channel: "C02GRJK3N4X",
    });
    const channel = result.channel as { name?: string; is_member?: boolean; is_private?: boolean };
    console.log(`  Channel name: #${channel.name}`);
    console.log(`  is_member: ${channel.is_member}`);
    console.log(`  is_private: ${channel.is_private}`);

    if (!channel.is_member) {
      console.log("\n  ⚠️  Bot can see this channel but is NOT a member!");
      console.log("  → In Slack, go to #it-helpdesk and type: /invite @YourBotName");
    }
  } catch (error) {
    const err = error as { data?: { error?: string } };
    console.log(`  ❌ Failed: ${err.data?.error || error}`);
    if (err.data?.error === "channel_not_found") {
      console.log("  → Bot cannot see this channel (private channel it's not in?)");
    }
  }

  // Test 4: Check bot info and scopes
  console.log("\n📋 BOT SCOPES (from token):");
  try {
    // The auth.test response includes scopes in the response headers when using the WebClient
    // But we can infer from what works/doesn't work
    console.log("  Testing scope by attempting operations...");

    // Test channels:read
    try {
      await client.conversations.list({ limit: 1 });
      console.log("  ✅ channels:read - Working");
    } catch {
      console.log("  ❌ channels:read - Missing");
    }

    // Test channels:history
    try {
      await client.conversations.history({ channel: "C02GRJK3N4X", limit: 1 });
      console.log("  ✅ channels:history - Working");
    } catch (e) {
      const err = e as { data?: { error?: string } };
      if (err.data?.error === "not_in_channel") {
        console.log("  ⚠️  channels:history - Scope OK but bot not in channel");
      } else {
        console.log(`  ❌ channels:history - ${err.data?.error || "Missing"}`);
      }
    }

    // Test chat:write
    console.log("  ℹ️  chat:write - Cannot test without posting (assuming present)");

    // Test reactions:write
    console.log("  ℹ️  reactions:write - Cannot test without reacting (assuming present)");

    // Test users:read
    try {
      await client.users.list({ limit: 1 });
      console.log("  ✅ users:read - Working");
    } catch {
      console.log("  ❌ users:read - Missing");
    }

  } catch (error) {
    console.log(`  Error testing scopes: ${error}`);
  }

  // Test 5: Check ALL channels via conversations.info
  console.log("\n📋 VERIFYING MEMBERSHIP VIA conversations.info (ALL channels):");
  try {
    const listResult = await client.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
    });

    const channels = listResult.channels || [];
    let memberCount = 0;
    const memberChannels: Array<{ id: string; name: string }> = [];

    console.log(`  Checking all ${channels.length} channels via conversations.info...`);

    for (const c of channels) {
      try {
        const info = await client.conversations.info({ channel: c.id! });
        const channel = info.channel as { is_member?: boolean; name?: string };
        if (channel.is_member) {
          memberCount++;
          memberChannels.push({ id: c.id!, name: c.name! });
        }
      } catch {
        // Skip errors
      }
    }

    console.log(`  Found ${memberCount} channels where bot IS a member:`);
    memberChannels.forEach((c) => {
      console.log(`    ✅ #${c.name} (${c.id})`);
    });

    if (memberCount > 0) {
      console.log("\n  🎉 FIX CONFIRMED: conversations.info returns correct is_member!");
    } else {
      console.log("\n  ⚠️  No channels found - but it-helpdesk worked above...");
      console.log("  Let's check if it-helpdesk is in the list:");
      const itHelpdesk = channels.find((c) => c.id === "C02GRJK3N4X");
      console.log(`  it-helpdesk in list: ${itHelpdesk ? "YES" : "NO"}`);
    }
  } catch (error) {
    console.log(`  Error: ${error}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("DIAGNOSTIC COMPLETE\n");
}

diagnose().catch(console.error);
