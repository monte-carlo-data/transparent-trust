#!/usr/bin/env tsx

/**
 * Sync skills from git to database
 *
 * This script reads all skill markdown files from the skills/ directory
 * and syncs them to the PostgreSQL database (cache).
 *
 * Use cases:
 * - After direct git edits (by engineers)
 * - After git pull (syncing remote changes)
 * - In GitHub Actions (automated sync on merge)
 * - Manual sync when git and database diverge
 *
 * Usage:
 *   npm run sync:skills
 *   or
 *   npx tsx scripts/sync-skills-to-db.ts
 */

import { prisma } from "../src/lib/prisma";
import { listSkillFiles, readSkillFile } from "../src/lib/skillFiles";
import { withSyncLogging } from "../src/lib/skillSyncLog";
import { invalidateSkillCache } from "../src/lib/cache";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function syncSkills() {
  console.log("🔄 Starting skill sync from git to database...\n");

  // Get or create a system user for skills without an owner
  let systemUser = await prisma.user.findFirst({
    where: { email: "system@transparent-trust.internal" },
  });

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: "system@transparent-trust.internal",
        name: "System",
      },
    });
    console.log("✨ Created system user for skill ownership\n");
  }

  // Get all skill files from git
  const skillSlugs = await listSkillFiles();
  console.log(`📂 Found ${skillSlugs.length} skill files in skills/ directory\n`);

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const slug of skillSlugs) {
    try {
      console.log(`  Processing: ${slug}.md`);

      // Read skill from git
      const skillFile = await readSkillFile(slug);

      // Check if skill exists in database
      const existingSkill = await prisma.skill.findUnique({
        where: { id: skillFile.id },
      });

      if (existingSkill) {
        // Check if git version is newer
        const gitUpdated = new Date(skillFile.updated);
        const dbUpdated = new Date(existingSkill.updatedAt);

        if (gitUpdated <= dbUpdated) {
          console.log(`    ⏭️  Skipped (database is newer or equal)\n`);
          skippedCount++;
          continue;
        }

        // Get current git commit SHA
        const { stdout } = await execAsync("git rev-parse HEAD");
        const commitSha = stdout.trim();

        // Update existing skill with sync logging
        await withSyncLogging(
          {
            skillId: skillFile.id,
            operation: "update",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.skill.update({
              where: { id: skillFile.id },
              data: {
                title: skillFile.title,
                content: skillFile.content,
                categories: skillFile.categories,
                isActive: skillFile.active,
                sourceUrls: skillFile.sources,
                owners: skillFile.owners,
                updatedAt: new Date(skillFile.updated),
              },
            });
            return commitSha;
          }
        );

        console.log(`    ✅ Updated in database\n`);
        updatedCount++;
      } else {
        // Get current git commit SHA
        const { stdout } = await execAsync("git rev-parse HEAD");
        const commitSha = stdout.trim();

        // Create new skill with sync logging
        // Extract ownerId from skill file owners or use system user
        let ownerId = systemUser.id;
        if (skillFile.owners && skillFile.owners.length > 0) {
          const firstOwner = skillFile.owners[0];
          if (firstOwner.userId) {
            // Check if user exists
            const user = await prisma.user.findUnique({
              where: { id: firstOwner.userId },
            });
            if (user) {
              ownerId = firstOwner.userId;
            }
          } else if (firstOwner.email) {
            // Try to find user by email
            const user = await prisma.user.findFirst({
              where: { email: firstOwner.email },
            });
            if (user) {
              ownerId = user.id;
            }
          }
        }

        await withSyncLogging(
          {
            skillId: skillFile.id,
            operation: "create",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.skill.create({
              data: {
                id: skillFile.id,
                title: skillFile.title,
                content: skillFile.content,
                categories: skillFile.categories,
                isActive: skillFile.active,
                sourceUrls: skillFile.sources,
                owners: skillFile.owners,
                edgeCases: [], // Empty array for deprecated field
                ownerId, // Add required ownerId field
                createdAt: new Date(skillFile.created),
                updatedAt: new Date(skillFile.updated),
              },
            });
            return commitSha;
          }
        );

        console.log(`    ✅ Created in database\n`);
        createdCount++;
      }
    } catch (error) {
      console.error(`    ❌ Error syncing skill: ${error}`);
      console.error(`       Slug: ${slug}\n`);
      errorCount++;
    }
  }

  // Check for skills in database that don't exist in git
  const dbSkills = await prisma.skill.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
  });

  const gitSkillIds = new Set<string>();
  for (const slug of skillSlugs) {
    try {
      const skillFile = await readSkillFile(slug);
      gitSkillIds.add(skillFile.id);
    } catch {
      // Skip files that can't be read
    }
  }

  const orphanedSkills = dbSkills.filter((skill) => !gitSkillIds.has(skill.id));

  if (orphanedSkills.length > 0) {
    console.log("\n🗑️  Found skills in database that don't exist in git:");
    orphanedSkills.forEach((skill) => {
      console.log(`    - ${skill.title} (${skill.id})`);
    });
    console.log("\nDeleting orphaned skills from database...");

    let deletedCount = 0;
    for (const skill of orphanedSkills) {
      try {
        await prisma.skill.delete({ where: { id: skill.id } });
        deletedCount++;
      } catch (error) {
        console.error(`    ❌ Failed to delete ${skill.title}: ${error}`);
      }
    }

    console.log(`✅ Deleted ${deletedCount} orphaned skills\n`);

    // Invalidate cache after deletions
    if (deletedCount > 0) {
      await invalidateSkillCache();
    }
  }

  // Invalidate all skill caches (Redis + any HTTP caches)
  if (createdCount > 0 || updatedCount > 0) {
    console.log("🗑️  Invalidating skill caches...");
    await invalidateSkillCache();
    console.log("✅ Cache invalidated\n");
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Sync Summary:`);
  console.log(`   ✨ Created:  ${createdCount}`);
  console.log(`   🔄 Updated:  ${updatedCount}`);
  console.log(`   ⏭️  Skipped:  ${skippedCount}`);
  console.log(`   ❌ Errors:   ${errorCount}`);
  console.log(`   📁 Total:    ${skillSlugs.length}`);
  if (orphanedSkills.length > 0) {
    console.log(`   ⚠️  Orphaned: ${orphanedSkills.length}`);
  }
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Sync completed successfully!");
  } else {
    console.log("⚠️  Some skills failed to sync. Please review errors above.");
    process.exit(1);
  }
}

// Run the sync
syncSkills()
  .catch((error) => {
    console.error("\n❌ Fatal error during sync:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
