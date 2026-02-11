#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import { getSkillSyncLogs } from "../src/lib/skillSyncLog";

async function verifySyncLogs() {
  console.log("🔍 Verifying sync logs...\n");

  const skill = await prisma.skill.findFirst({
    where: { title: "Data Lineage Overview" },
    select: {
      id: true,
      title: true,
      syncStatus: true,
      lastSyncedAt: true,
      gitCommitSha: true,
    },
  });

  if (!skill) {
    console.log("❌ Skill not found");
    return;
  }

  console.log("📊 Skill Sync Status:");
  console.log(`   ID: ${skill.id}`);
  console.log(`   Title: ${skill.title}`);
  console.log(`   Status: ${skill.syncStatus}`);
  console.log(`   Last synced: ${skill.lastSyncedAt?.toISOString() || "Never"}`);
  console.log(`   Git SHA: ${skill.gitCommitSha?.substring(0, 8) || "None"}\n`);

  // Get sync logs
  const logs = await getSkillSyncLogs(skill.id, 10);

  console.log(`📝 Recent Sync Logs (${logs.length}):`);
  logs.forEach((log, i) => {
    console.log(`\n   ${i + 1}. ${log.operation} (${log.direction})`);
    console.log(`      Status: ${log.status}`);
    console.log(`      Started: ${log.startedAt.toISOString()}`);
    console.log(`      Completed: ${log.completedAt?.toISOString() || "N/A"}`);
    console.log(`      SHA: ${log.gitCommitSha?.substring(0, 8) || "N/A"}`);
    console.log(`      By: ${log.syncedBy || "Unknown"}`);
  });

  await prisma.$disconnect();
}

verifySyncLogs().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
