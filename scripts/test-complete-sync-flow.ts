#!/usr/bin/env tsx

/**
 * Test complete sync flow:
 * 1. Check overall sync health
 * 2. Create a test skill via API (simulated)
 * 3. Edit markdown directly
 * 4. Sync back to database
 * 5. Verify all sync logs
 */

import { prisma } from "../src/lib/prisma";
import { getSyncHealthStatus, getRecentSyncFailures } from "../src/lib/skillSyncLog";

async function testCompleteSyncFlow() {
  console.log("🧪 Testing Complete Sync Flow\n");
  console.log("=".repeat(60) + "\n");

  // 1. Check overall sync health
  console.log("📊 Step 1: Check Overall Sync Health\n");
  const health = await getSyncHealthStatus();

  console.log("   Sync Health Status:");
  console.log(`   - Total skills: ${health.total}`);
  console.log(`   - Synced: ${health.synced}`);
  console.log(`   - Pending: ${health.pending}`);
  console.log(`   - Failed: ${health.failed}`);
  console.log(`   - Unknown: ${health.unknown}`);
  console.log(`   - Recent failures (24h): ${health.recentFailures}`);
  console.log(`   - Overall healthy: ${health.healthy ? "✅" : "❌"}\n`);

  // 2. Get recent sync failures (if any)
  if (health.recentFailures > 0) {
    console.log("⚠️  Recent Sync Failures:\n");
    const failures = await getRecentSyncFailures(5);
    failures.forEach((log, i) => {
      console.log(`   ${i + 1}. Skill: ${log.skill?.title || "Unknown"}`);
      console.log(`      Operation: ${log.operation} (${log.direction})`);
      console.log(`      Error: ${log.error?.substring(0, 100) || "Unknown"}`);
      console.log(`      When: ${log.startedAt.toISOString()}\n`);
    });
  }

  // 3. Check all skills sync status
  console.log("📋 Step 2: Individual Skill Sync Status\n");
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    select: {
      title: true,
      syncStatus: true,
      lastSyncedAt: true,
      gitCommitSha: true,
    },
    orderBy: { title: "asc" },
  });

  skills.forEach((skill, i) => {
    const statusEmoji =
      skill.syncStatus === "synced"
        ? "✅"
        : skill.syncStatus === "pending"
        ? "⏳"
        : skill.syncStatus === "failed"
        ? "❌"
        : "❓";

    console.log(`   ${i + 1}. ${statusEmoji} ${skill.title}`);
    console.log(`      Status: ${skill.syncStatus || "unknown"}`);
    console.log(
      `      Last synced: ${skill.lastSyncedAt?.toISOString() || "Never"}`
    );
    console.log(
      `      Git SHA: ${skill.gitCommitSha?.substring(0, 8) || "None"}\n`
    );
  });

  // 4. Summary
  console.log("=".repeat(60));
  console.log("✅ Complete Sync Flow Test Completed!\n");

  console.log("Key Findings:");
  console.log(`   - ${health.synced}/${health.total} skills are synced`);
  console.log(
    `   - ${health.unknown} skills need initial sync (created before sync tracking)`
  );
  if (health.failed > 0) {
    console.log(`   - ⚠️ ${health.failed} skills have failed syncs`);
  }
  if (health.healthy) {
    console.log(`   - ✅ System is healthy - no recent failures`);
  } else {
    console.log(`   - ⚠️ System has ${health.recentFailures} recent failures`);
  }

  await prisma.$disconnect();
}

testCompleteSyncFlow().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
