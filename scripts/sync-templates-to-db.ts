#!/usr/bin/env tsx

/**
 * Sync templates from git to database
 *
 * This script reads all template markdown files from the templates/ directory
 * and syncs them to the PostgreSQL database (cache).
 *
 * Use cases:
 * - After direct git edits (by engineers or designers)
 * - After git pull (syncing remote changes)
 * - In GitHub Actions (automated sync on merge)
 * - Manual sync when git and database diverge
 *
 * Usage:
 *   npm run sync:templates
 *   or
 *   npx tsx scripts/sync-templates-to-db.ts
 */

import { prisma } from "../src/lib/prisma";
import { listTemplateFiles, readTemplateFile } from "../src/lib/templateFiles";
import { withTemplateSyncLogging } from "../src/lib/templateSyncLog";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function syncTemplates() {
  console.log("🔄 Starting template sync from git to database...\n");

  // Get or create a system user for templates without an owner
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
    console.log("✨ Created system user for template ownership\n");
  }

  // Get all template files from git
  const templateSlugs = await listTemplateFiles();
  console.log(`📂 Found ${templateSlugs.length} template files in templates/ directory\n`);

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const slug of templateSlugs) {
    try {
      console.log(`   Processing: ${slug}.md`);

      // Read template from git
      const templateFile = await readTemplateFile(slug);

      // Check if template exists in database
      const existingTemplate = await prisma.template.findUnique({
        where: { id: templateFile.id },
      });

      if (existingTemplate) {
        // Check if git version is newer
        const gitUpdated = new Date(templateFile.updated);
        const dbUpdated = new Date(existingTemplate.updatedAt);

        if (gitUpdated <= dbUpdated) {
          console.log(`      ⏭️  Skipped (database is newer or equal)\n`);
          skippedCount++;
          continue;
        }

        // Get current git commit SHA
        const { stdout } = await execAsync("git rev-parse HEAD");
        const commitSha = stdout.trim();

        // Update existing template with sync logging
        await withTemplateSyncLogging(
          {
            templateId: templateFile.id,
            operation: "update",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.template.update({
              where: { id: templateFile.id },
              data: {
                name: templateFile.name,
                description: templateFile.description,
                content: templateFile.content,
                category: templateFile.category,
                outputFormat: templateFile.outputFormat,
                placeholderMappings: templateFile.placeholderMappings ? JSON.parse(JSON.stringify(templateFile.placeholderMappings)) : undefined,
                instructionPresetId: templateFile.instructionPresetId,
                isActive: templateFile.isActive,
                sortOrder: templateFile.sortOrder,
                updatedAt: new Date(templateFile.updated),
                updatedBy: templateFile.updatedBy,
              },
            });
            return commitSha;
          }
        );

        console.log(`      ✅ Updated in database\n`);
        updatedCount++;
      } else {
        // Get current git commit SHA
        const { stdout } = await execAsync("git rev-parse HEAD");
        const commitSha = stdout.trim();

        // Create new template with sync logging
        // Use system user as owner (templates don't have owners in git files)
        const ownerId = systemUser.id;

        await withTemplateSyncLogging(
          {
            templateId: templateFile.id,
            operation: "create",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.template.create({
              data: {
                id: templateFile.id,
                name: templateFile.name,
                description: templateFile.description,
                content: templateFile.content,
                category: templateFile.category,
                outputFormat: templateFile.outputFormat,
                placeholderMappings: templateFile.placeholderMappings ? JSON.parse(JSON.stringify(templateFile.placeholderMappings)) : undefined,
                instructionPresetId: templateFile.instructionPresetId,
                isActive: templateFile.isActive,
                sortOrder: templateFile.sortOrder,
                ownerId, // Add required ownerId field
                createdAt: new Date(templateFile.created),
                updatedAt: new Date(templateFile.updated),
                createdBy: templateFile.createdBy,
                updatedBy: templateFile.updatedBy,
              },
            });
            return commitSha;
          }
        );

        console.log(`      ✅ Created in database\n`);
        createdCount++;
      }
    } catch (error) {
      console.error(`      ❌ Error syncing template: ${error}`);
      console.error(`         Slug: ${slug}\n`);
      errorCount++;
    }
  }

  // Check for templates in database that don't exist in git
  const dbTemplates = await prisma.template.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const gitTemplateIds = new Set<string>();
  for (const slug of templateSlugs) {
    try {
      const templateFile = await readTemplateFile(slug);
      gitTemplateIds.add(templateFile.id);
    } catch {
      // Skip files that can't be read
    }
  }

  const orphanedTemplates = dbTemplates.filter((template) => !gitTemplateIds.has(template.id));

  if (orphanedTemplates.length > 0) {
    console.log("\n⚠️  Found templates in database that don't exist in git:");
    orphanedTemplates.forEach((template) => {
      console.log(`    - ${template.name} (${template.id})`);
    });
    console.log("\nThese templates may have been deleted from git.");
    console.log("Consider archiving them in the database.\n");
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Sync Summary:");
  console.log(`   ✨ Created:  ${createdCount}`);
  console.log(`   🔄 Updated:  ${updatedCount}`);
  console.log(`   ⏭️  Skipped:  ${skippedCount}`);
  console.log(`   ❌ Errors:   ${errorCount}`);
  console.log(`   📁 Total:    ${templateSlugs.length}`);
  if (orphanedTemplates.length > 0) {
    console.log(`   ⚠️  Orphaned: ${orphanedTemplates.length}`);
  }
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Sync completed successfully!");
  } else {
    console.log("⚠️  Some templates failed to sync. Please review errors above.");
    process.exit(1);
  }
}

// Run the sync
syncTemplates()
  .catch((error) => {
    console.error("\n❌ Fatal error during sync:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
