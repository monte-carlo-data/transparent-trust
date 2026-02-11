/**
 * One-time script to seed prompt blocks and modifiers from code defaults to git.
 *
 * Run with: npx tsx scripts/seed-prompts-to-git.ts
 *
 * This creates the initial git commit for all prompt blocks and modifiers,
 * establishing git as the source of truth for prompts.
 */

import { defaultBlocks, defaultModifiers, type PromptTier } from "../src/lib/promptBlocks";
import { promptBlockGitSync, promptModifierGitSync } from "../src/lib/git-sync";
import type { PromptBlockFile, PromptModifierFile } from "../src/lib/promptFiles";

const AUTHOR = {
  name: "System Migration",
  email: "system@migration.local",
};

async function seedPromptsToGit() {
  console.log("Starting prompt seed to git...\n");

  // Seed blocks
  console.log(`Seeding ${defaultBlocks.length} blocks...`);
  for (const block of defaultBlocks) {
    const blockFile: PromptBlockFile = {
      id: block.id,
      name: block.name,
      description: block.description,
      tier: block.tier as PromptTier,
      variants: block.variants as Record<string, string> & { default: string },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      updatedBy: AUTHOR.email,
    };

    try {
      const sha = await promptBlockGitSync.saveAndCommit(
        block.id,
        blockFile,
        `Initial seed: ${block.name}`,
        AUTHOR
      );
      console.log(`  ✓ ${block.name} (${sha?.slice(0, 7) || "no commit"})`);
    } catch (err) {
      console.error(`  ✗ ${block.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // Seed modifiers
  console.log(`\nSeeding ${defaultModifiers.length} modifiers...`);
  for (const modifier of defaultModifiers) {
    const modifierFile: PromptModifierFile = {
      id: modifier.id,
      name: modifier.name,
      type: modifier.type,
      tier: (modifier.tier || 3) as PromptTier,
      content: modifier.content,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      updatedBy: AUTHOR.email,
    };

    try {
      const sha = await promptModifierGitSync.saveAndCommit(
        modifier.id,
        modifierFile,
        `Initial seed: ${modifier.name}`,
        AUTHOR
      );
      console.log(`  ✓ ${modifier.name} (${sha?.slice(0, 7) || "no commit"})`);
    } catch (err) {
      console.error(`  ✗ ${modifier.name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n✅ Seed complete!");
}

seedPromptsToGit().catch(console.error);
