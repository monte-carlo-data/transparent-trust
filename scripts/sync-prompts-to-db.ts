#!/usr/bin/env tsx

/**
 * Sync prompts from git to database
 *
 * This script reads all prompt block and modifier markdown files from the prompts/ directory
 * and syncs them to the PostgreSQL database (cache).
 *
 * Use cases:
 * - After direct git edits (by engineers)
 * - After git pull (syncing remote changes)
 * - In GitHub Actions (automated sync on merge)
 * - Manual sync when git and database diverge
 *
 * Usage:
 *   npm run sync:prompts
 *   or
 *   npx tsx scripts/sync-prompts-to-db.ts
 */

import { prisma } from "../src/lib/prisma";
import {
  listBlockFiles,
  readBlockFile,
  listModifierFiles,
  readModifierFile,
} from "../src/lib/promptFiles";
import { withBlockSyncLogging, withModifierSyncLogging } from "../src/lib/promptSyncLog";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function syncPrompts() {
  console.log("🔄 Starting prompt sync from git to database...\n");

  let blocksCreated = 0;
  let blocksUpdated = 0;
  let blocksSkipped = 0;
  let modifiersCreated = 0;
  let modifiersUpdated = 0;
  let modifiersSkipped = 0;
  let errorCount = 0;

  // Get current git commit SHA
  let commitSha = "";
  try {
    const { stdout } = await execAsync("git rev-parse HEAD");
    commitSha = stdout.trim();
  } catch {
    console.warn("⚠️  Could not get git commit SHA");
  }

  // ============================================
  // SYNC BLOCKS
  // ============================================
  console.log("📦 Syncing prompt blocks...\n");

  const blockIds = await listBlockFiles();
  console.log(`   Found ${blockIds.length} block files in prompts/blocks/\n`);

  for (const blockId of blockIds) {
    try {
      console.log(`   Processing: ${blockId}.md`);

      // Read block from git
      const blockFile = await readBlockFile(blockId);

      // Check if block exists in database
      const existingBlock = await prisma.promptBlock.findUnique({
        where: { blockId: blockFile.id },
      });

      if (existingBlock) {
        // Check if git version is newer
        const gitUpdated = new Date(blockFile.updated);
        const dbUpdated = new Date(existingBlock.updatedAt);

        if (gitUpdated <= dbUpdated) {
          console.log(`      ⏭️  Skipped (database is newer or equal)\n`);
          blocksSkipped++;
          continue;
        }

        // Update existing block with sync logging
        await withBlockSyncLogging(
          {
            entityId: blockFile.id,
            entityUuid: existingBlock.id,
            operation: "update",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.promptBlock.update({
              where: { blockId: blockFile.id },
              data: {
                name: blockFile.name,
                description: blockFile.description,
                tier: blockFile.tier,
                variants: blockFile.variants,
                updatedAt: new Date(blockFile.updated),
                updatedBy: blockFile.updatedBy,
              },
            });
            return commitSha;
          }
        );

        console.log(`      ✅ Updated in database\n`);
        blocksUpdated++;
      } else {
        // Create new block with sync logging
        const newBlock = await prisma.promptBlock.create({
          data: {
            blockId: blockFile.id,
            name: blockFile.name,
            description: blockFile.description,
            tier: blockFile.tier,
            variants: blockFile.variants,
            createdAt: new Date(blockFile.created),
            updatedAt: new Date(blockFile.updated),
            updatedBy: blockFile.updatedBy,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
            gitCommitSha: commitSha,
          },
        });

        await withBlockSyncLogging(
          {
            entityId: blockFile.id,
            entityUuid: newBlock.id,
            operation: "create",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => commitSha
        );

        console.log(`      ✅ Created in database\n`);
        blocksCreated++;
      }
    } catch (error) {
      console.error(`      ❌ Error syncing block: ${error}`);
      console.error(`         Block ID: ${blockId}\n`);
      errorCount++;
    }
  }

  // ============================================
  // SYNC MODIFIERS
  // ============================================
  console.log("\n🔧 Syncing prompt modifiers...\n");

  const modifierIds = await listModifierFiles();
  console.log(`   Found ${modifierIds.length} modifier files in prompts/modifiers/\n`);

  for (const modifierId of modifierIds) {
    try {
      console.log(`   Processing: ${modifierId}.md`);

      // Read modifier from git
      const modifierFile = await readModifierFile(modifierId);

      // Check if modifier exists in database
      const existingModifier = await prisma.promptModifier.findUnique({
        where: { modifierId: modifierFile.id },
      });

      if (existingModifier) {
        // Check if git version is newer
        const gitUpdated = new Date(modifierFile.updated);
        const dbUpdated = new Date(existingModifier.updatedAt);

        if (gitUpdated <= dbUpdated) {
          console.log(`      ⏭️  Skipped (database is newer or equal)\n`);
          modifiersSkipped++;
          continue;
        }

        // Update existing modifier with sync logging
        await withModifierSyncLogging(
          {
            entityId: modifierFile.id,
            entityUuid: existingModifier.id,
            operation: "update",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.promptModifier.update({
              where: { modifierId: modifierFile.id },
              data: {
                name: modifierFile.name,
                type: modifierFile.type,
                tier: modifierFile.tier,
                content: modifierFile.content,
                updatedAt: new Date(modifierFile.updated),
                updatedBy: modifierFile.updatedBy,
              },
            });
            return commitSha;
          }
        );

        console.log(`      ✅ Updated in database\n`);
        modifiersUpdated++;
      } else {
        // Create new modifier with sync logging
        const newModifier = await prisma.promptModifier.create({
          data: {
            modifierId: modifierFile.id,
            name: modifierFile.name,
            type: modifierFile.type,
            tier: modifierFile.tier,
            content: modifierFile.content,
            createdAt: new Date(modifierFile.created),
            updatedAt: new Date(modifierFile.updated),
            updatedBy: modifierFile.updatedBy,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
            gitCommitSha: commitSha,
          },
        });

        await withModifierSyncLogging(
          {
            entityId: modifierFile.id,
            entityUuid: newModifier.id,
            operation: "create",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => commitSha
        );

        console.log(`      ✅ Created in database\n`);
        modifiersCreated++;
      }
    } catch (error) {
      console.error(`      ❌ Error syncing modifier: ${error}`);
      console.error(`         Modifier ID: ${modifierId}\n`);
      errorCount++;
    }
  }

  // ============================================
  // CHECK FOR ORPHANED DB ENTRIES
  // ============================================
  const gitBlockIds = new Set(blockIds);
  const gitModifierIds = new Set(modifierIds);

  const dbBlocks = await prisma.promptBlock.findMany({
    select: { blockId: true, name: true },
  });
  const dbModifiers = await prisma.promptModifier.findMany({
    select: { modifierId: true, name: true },
  });

  const orphanedBlocks = dbBlocks.filter((b) => !gitBlockIds.has(b.blockId));
  const orphanedModifiers = dbModifiers.filter((m) => !gitModifierIds.has(m.modifierId));

  if (orphanedBlocks.length > 0 || orphanedModifiers.length > 0) {
    console.log("\n⚠️  Found prompts in database that don't exist in git:");
    orphanedBlocks.forEach((b) => {
      console.log(`    - Block: ${b.name} (${b.blockId})`);
    });
    orphanedModifiers.forEach((m) => {
      console.log(`    - Modifier: ${m.name} (${m.modifierId})`);
    });
    console.log("\nThese may have been deleted from git. Consider removing from database.\n");
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 Sync Summary:");
  console.log("   Blocks:");
  console.log(`      ✨ Created:  ${blocksCreated}`);
  console.log(`      🔄 Updated:  ${blocksUpdated}`);
  console.log(`      ⏭️  Skipped:  ${blocksSkipped}`);
  console.log(`      📁 Total:    ${blockIds.length}`);
  console.log("   Modifiers:");
  console.log(`      ✨ Created:  ${modifiersCreated}`);
  console.log(`      🔄 Updated:  ${modifiersUpdated}`);
  console.log(`      ⏭️  Skipped:  ${modifiersSkipped}`);
  console.log(`      📁 Total:    ${modifierIds.length}`);
  console.log(`   ❌ Errors:      ${errorCount}`);
  if (orphanedBlocks.length > 0 || orphanedModifiers.length > 0) {
    console.log(`   ⚠️  Orphaned:   ${orphanedBlocks.length + orphanedModifiers.length}`);
  }
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Sync completed successfully!");
  } else {
    console.log("⚠️  Some prompts failed to sync. Please review errors above.");
    process.exit(1);
  }
}

// Run the sync
syncPrompts()
  .catch((error) => {
    console.error("\n❌ Fatal error during sync:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
