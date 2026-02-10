#!/usr/bin/env tsx

/**
 * Export prompts from database to git
 *
 * This script exports all prompt blocks and modifiers from the PostgreSQL database
 * to markdown files in the prompts/ directory.
 *
 * Use cases:
 * - Initial migration to git-first architecture
 * - Backing up prompts to git
 * - After database-only edits that need to be persisted to git
 *
 * Usage:
 *   npm run export:prompts
 *   or
 *   npx tsx scripts/export-prompts-to-git.ts
 */

import { prisma } from "../src/lib/prisma";
import { writeBlockFile, writeModifierFile } from "../src/lib/promptFiles";
import type { PromptBlockFile, PromptModifierFile } from "../src/lib/promptFiles";
import { defaultBlocks, defaultModifiers, type PromptTier } from "../src/lib/promptBlocks";

async function exportPrompts() {
  console.log("📤 Starting prompt export from database to git...\n");

  let blocksExported = 0;
  let modifiersExported = 0;
  let blocksFromDefaults = 0;
  let modifiersFromDefaults = 0;
  let errorCount = 0;

  // ============================================
  // EXPORT BLOCKS
  // ============================================
  console.log("📦 Exporting prompt blocks...\n");

  // Get blocks from database
  const dbBlocks = await prisma.promptBlock.findMany();
  console.log(`   Found ${dbBlocks.length} blocks in database`);

  // Create a map of DB blocks by blockId
  const dbBlockMap = new Map(dbBlocks.map((b) => [b.blockId, b]));

  // Get all unique block IDs (from DB and defaults)
  const allBlockIds = new Set([
    ...dbBlocks.map((b) => b.blockId),
    ...defaultBlocks.map((b) => b.id),
  ]);

  console.log(`   Processing ${allBlockIds.size} unique blocks...\n`);

  for (const blockId of allBlockIds) {
    try {
      const dbBlock = dbBlockMap.get(blockId);
      const defaultBlock = defaultBlocks.find((b) => b.id === blockId);

      // Use DB version if available, otherwise use default
      if (dbBlock) {
        const blockFile: PromptBlockFile = {
          id: dbBlock.blockId,
          name: dbBlock.name,
          description: dbBlock.description || "",
          tier: (dbBlock.tier as PromptTier) || defaultBlock?.tier || 3,
          variants: dbBlock.variants as Record<string, string> & { default: string },
          created: dbBlock.createdAt?.toISOString() || new Date().toISOString(),
          updated: dbBlock.updatedAt.toISOString(),
          updatedBy: dbBlock.updatedBy || undefined,
        };

        await writeBlockFile(blockId, blockFile);
        console.log(`   ✅ Exported block: ${blockId} (from database)`);
        blocksExported++;
      } else if (defaultBlock) {
        // Export default block if not in database
        const blockFile: PromptBlockFile = {
          id: defaultBlock.id,
          name: defaultBlock.name,
          description: defaultBlock.description,
          tier: defaultBlock.tier,
          variants: defaultBlock.variants,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };

        await writeBlockFile(blockId, blockFile);
        console.log(`   ✅ Exported block: ${blockId} (from defaults)`);
        blocksFromDefaults++;
      }
    } catch (error) {
      console.error(`   ❌ Error exporting block ${blockId}: ${error}`);
      errorCount++;
    }
  }

  // ============================================
  // EXPORT MODIFIERS
  // ============================================
  console.log("\n🔧 Exporting prompt modifiers...\n");

  // Get modifiers from database
  const dbModifiers = await prisma.promptModifier.findMany();
  console.log(`   Found ${dbModifiers.length} modifiers in database`);

  // Create a map of DB modifiers by modifierId
  const dbModifierMap = new Map(dbModifiers.map((m) => [m.modifierId, m]));

  // Get all unique modifier IDs (from DB and defaults)
  const allModifierIds = new Set([
    ...dbModifiers.map((m) => m.modifierId),
    ...defaultModifiers.map((m) => m.id),
  ]);

  console.log(`   Processing ${allModifierIds.size} unique modifiers...\n`);

  for (const modifierId of allModifierIds) {
    try {
      const dbModifier = dbModifierMap.get(modifierId);
      const defaultModifier = defaultModifiers.find((m) => m.id === modifierId);

      // Use DB version if available, otherwise use default
      if (dbModifier) {
        const modifierFile: PromptModifierFile = {
          id: dbModifier.modifierId,
          name: dbModifier.name,
          type: dbModifier.type as "mode" | "domain",
          tier: (dbModifier.tier as PromptTier) || defaultModifier?.tier || 3,
          content: dbModifier.content,
          created: dbModifier.createdAt?.toISOString() || new Date().toISOString(),
          updated: dbModifier.updatedAt.toISOString(),
          updatedBy: dbModifier.updatedBy || undefined,
        };

        await writeModifierFile(modifierId, modifierFile);
        console.log(`   ✅ Exported modifier: ${modifierId} (from database)`);
        modifiersExported++;
      } else if (defaultModifier) {
        // Export default modifier if not in database
        const modifierFile: PromptModifierFile = {
          id: defaultModifier.id,
          name: defaultModifier.name,
          type: defaultModifier.type,
          tier: defaultModifier.tier,
          content: defaultModifier.content,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };

        await writeModifierFile(modifierId, modifierFile);
        console.log(`   ✅ Exported modifier: ${modifierId} (from defaults)`);
        modifiersFromDefaults++;
      }
    } catch (error) {
      console.error(`   ❌ Error exporting modifier ${modifierId}: ${error}`);
      errorCount++;
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 Export Summary:");
  console.log(`   📦 Blocks from database:  ${blocksExported}`);
  console.log(`   📦 Blocks from defaults:  ${blocksFromDefaults}`);
  console.log(`   🔧 Modifiers from database: ${modifiersExported}`);
  console.log(`   🔧 Modifiers from defaults: ${modifiersFromDefaults}`);
  console.log(`   ❌ Errors:               ${errorCount}`);
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Export completed successfully!");
    console.log("\nNext steps:");
    console.log("  1. Review the exported files in prompts/blocks/ and prompts/modifiers/");
    console.log("  2. Commit the changes: git add prompts/ && git commit -m 'Export prompts to git'");
  } else {
    console.log("⚠️  Some prompts failed to export. Please review errors above.");
    process.exit(1);
  }
}

// Run the export
exportPrompts()
  .catch((error) => {
    console.error("\n❌ Fatal error during export:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
