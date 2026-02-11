#!/usr/bin/env tsx

/**
 * Export all existing skills from the database to git
 *
 * This is a one-time migration script to move from database-first to git-first storage.
 * After running this script, all skills will exist as markdown files in the skills/ directory.
 *
 * Usage:
 *   npm run export:skills
 *   or
 *   npx tsx scripts/export-skills-to-git.ts
 */

import { prisma } from "../src/lib/prisma";
import { getSkillSlug } from "../src/lib/skillFiles";
import { skillGitSync } from "../src/lib/git-sync";
import type { SkillFile } from "../src/lib/skillFiles";

async function exportSkills() {
  console.log("🚀 Starting skill export to git...\n");

  // Fetch all active skills from database
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📦 Found ${skills.length} active skills to export\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const skill of skills) {
    const slug = getSkillSlug(skill.title);

    try {
      console.log(`  Processing: ${skill.title}`);
      console.log(`    → Slug: ${slug}`);

      // Parse sourceUrls from JSON
      const sourceUrls = skill.sourceUrls as Array<{
        url: string;
        addedAt: string;
        lastFetched?: string;
      }> | null;

      // Parse owners from JSON (legacy format)
      const legacyOwners = (skill.owners as Array<{
        name: string;
        email?: string;
      }>) || [];

      // Combine with owner relation
      const allOwners = [
        ...(skill.owner
          ? [
              {
                name: skill.owner.name || "Unknown",
                email: skill.owner.email || undefined,
                userId: skill.ownerId || undefined,
              },
            ]
          : []),
        ...legacyOwners.map((o) => ({
          name: o.name,
          email: o.email,
          userId: undefined,
        })),
      ];

      // Remove duplicates based on email
      const uniqueOwners = allOwners.filter(
        (owner, index, self) =>
          index === self.findIndex((o) => o.email === owner.email)
      );

      // Create SkillFile object
      const skillFile: SkillFile = {
        id: skill.id,
        slug,
        title: skill.title,
        content: skill.content,
        categories: skill.categories,
        owners: uniqueOwners,
        sources: sourceUrls || [],
        created: skill.createdAt.toISOString(),
        updated: skill.updatedAt.toISOString(),
        active: skill.isActive,
      };

      // Commit to git
      await skillGitSync.saveAndCommit(
        slug,
        skillFile,
        `Export skill: ${skill.title}`,
        {
          name: skill.owner?.name || skill.createdBy || "System",
          email: skill.owner?.email || "system@localhost",
        }
      );

      console.log(`    ✅ Exported successfully\n`);
      successCount++;
    } catch (error) {
      console.error(`    ❌ Error exporting skill: ${error}`);
      console.error(`       Skill ID: ${skill.id}\n`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Export Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
  console.log(`   📁 Total:   ${skills.length}`);
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 All skills exported successfully!");
    console.log("\nNext steps:");
    console.log("  1. Review the skills/ directory");
    console.log("  2. Check git log to see commits");
    console.log("  3. Push to remote: git push origin main\n");
  } else {
    console.log("⚠️  Some skills failed to export. Please review errors above.");
    process.exit(1);
  }
}

// Run the export
exportSkills()
  .catch((error) => {
    console.error("\n❌ Fatal error during export:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
