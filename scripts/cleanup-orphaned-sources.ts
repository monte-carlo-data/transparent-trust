/**
 * Cleanup Orphaned Sources Script
 *
 * Finds and deletes KnowledgeDocuments and ReferenceUrls that are not linked
 * to any skill via SkillSource.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-sources.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findOrphanedDocuments() {
  // Get all document IDs that have at least one SkillSource link
  const linkedDocIds = await prisma.skillSource.findMany({
    where: { sourceType: "document" },
    select: { sourceId: true },
  });
  const linkedDocIdSet = new Set(linkedDocIds.map((s) => s.sourceId));

  // Get all documents
  const allDocs = await prisma.knowledgeDocument.findMany({
    select: { id: true, title: true, filename: true, uploadedAt: true },
  });

  // Filter to only orphans
  return allDocs.filter((doc) => !linkedDocIdSet.has(doc.id));
}

async function findOrphanedUrls() {
  // Get all URL IDs that have at least one SkillSource link
  const linkedUrlIds = await prisma.skillSource.findMany({
    where: { sourceType: "url" },
    select: { sourceId: true },
  });
  const linkedUrlIdSet = new Set(linkedUrlIds.map((s) => s.sourceId));

  // Get all URLs
  const allUrls = await prisma.referenceUrl.findMany({
    select: { id: true, url: true, title: true, addedAt: true },
  });

  // Filter to only orphans
  return allUrls.filter((url) => !linkedUrlIdSet.has(url.id));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🔍 Finding orphaned sources...\n");

  // Find orphaned documents
  const orphanedDocs = await findOrphanedDocuments();
  console.log(`📄 Found ${orphanedDocs.length} orphaned documents:`);
  for (const doc of orphanedDocs) {
    console.log(`   - [${doc.id}] ${doc.title} (${doc.filename})`);
  }

  // Find orphaned URLs
  const orphanedUrls = await findOrphanedUrls();
  console.log(`\n🔗 Found ${orphanedUrls.length} orphaned URLs:`);
  for (const url of orphanedUrls) {
    console.log(`   - [${url.id}] ${url.title || url.url}`);
  }

  if (orphanedDocs.length === 0 && orphanedUrls.length === 0) {
    console.log("\n✅ No orphaned sources found. Database is clean!");
    return;
  }

  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made.");
    console.log("   Run without --dry-run to delete these orphans.");
    return;
  }

  // Confirm deletion
  console.log("\n🗑️  Deleting orphaned sources...\n");

  // Delete orphaned documents
  if (orphanedDocs.length > 0) {
    const docIds = orphanedDocs.map((d) => d.id);
    const deleteResult = await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: docIds } },
    });
    console.log(`   ✅ Deleted ${deleteResult.count} orphaned documents`);
  }

  // Delete orphaned URLs
  if (orphanedUrls.length > 0) {
    const urlIds = orphanedUrls.map((u) => u.id);
    const deleteResult = await prisma.referenceUrl.deleteMany({
      where: { id: { in: urlIds } },
    });
    console.log(`   ✅ Deleted ${deleteResult.count} orphaned URLs`);
  }

  console.log("\n✅ Cleanup complete!");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
