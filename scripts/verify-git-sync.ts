#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";

async function verifyGitSync() {
  console.log("🔍 Verifying git→database sync...\n");

  const skill = await prisma.skill.findFirst({
    where: { title: "Data Lineage Overview" },
    select: {
      content: true,
      updatedAt: true,
      syncStatus: true,
      lastSyncedAt: true,
      gitCommitSha: true,
    },
  });

  if (!skill) {
    console.log("❌ Skill not found");
    return;
  }

  console.log("📊 Database Skill Content (last 300 chars):");
  console.log(skill.content.slice(-300));
  console.log("\n📅 Updated at:", skill.updatedAt.toISOString());
  console.log("🔄 Sync status:", skill.syncStatus);
  console.log("⏰ Last synced:", skill.lastSyncedAt?.toISOString() || "Never");
  console.log("📝 Git SHA:", skill.gitCommitSha?.substring(0, 8) || "None");

  // Check if test edit is present
  const hasTestEdit = skill.content.includes(
    "Test edit made directly to markdown file"
  );
  console.log(
    "\n✅ Test edit present:",
    hasTestEdit ? "YES" : "NO (sync may have failed)"
  );

  await prisma.$disconnect();
}

verifyGitSync().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
