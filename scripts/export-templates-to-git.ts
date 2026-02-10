#!/usr/bin/env tsx

/**
 * Export templates from database to git
 *
 * This script exports all document templates from the PostgreSQL database
 * to markdown files in the templates/ directory.
 *
 * Use cases:
 * - Initial migration to git-first architecture
 * - Backing up templates to git
 * - After database-only edits that need to be persisted to git
 *
 * Usage:
 *   npm run export:templates
 *   or
 *   npx tsx scripts/export-templates-to-git.ts
 */

import { prisma } from "../src/lib/prisma";
import { writeTemplateFile, getTemplateSlug } from "../src/lib/templateFiles";
import type { TemplateFile, PlaceholderMapping } from "../src/lib/templateFiles";

async function exportTemplates() {
  console.log("📤 Starting template export from database to git...\n");

  // Get all active templates
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`📂 Found ${templates.length} active templates in database\n`);

  let exportedCount = 0;
  let errorCount = 0;

  for (const template of templates) {
    try {
      const slug = getTemplateSlug(template.name);
      console.log(`   Processing: ${template.name} → ${slug}.md`);

      const templateFile: TemplateFile = {
        id: template.id,
        slug,
        name: template.name,
        description: template.description || undefined,
        content: template.content,
        category: template.category || undefined,
        outputFormat: (template.outputFormat as "markdown" | "docx" | "pdf") || "markdown",
        placeholderMappings: (template.placeholderMappings as unknown as PlaceholderMapping[]) || [],
        instructionPresetId: template.instructionPresetId || undefined,
        isActive: template.isActive,
        sortOrder: template.sortOrder,
        created: template.createdAt.toISOString(),
        updated: template.updatedAt.toISOString(),
        createdBy: template.createdBy || undefined,
        updatedBy: template.updatedBy || undefined,
      };

      await writeTemplateFile(slug, templateFile);
      console.log(`   ✅ Exported: ${slug}.md\n`);
      exportedCount++;
    } catch (error) {
      console.error(`   ❌ Error exporting template: ${error}`);
      console.error(`      Name: ${template.name}\n`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Export Summary:");
  console.log(`   ✨ Exported: ${exportedCount}`);
  console.log(`   ❌ Errors:   ${errorCount}`);
  console.log(`   📁 Total:    ${templates.length}`);
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Export completed successfully!");
    console.log("\nNext steps:");
    console.log("  1. Review the exported files in templates/");
    console.log("  2. Commit the changes: git add templates/ && git commit -m 'Export templates to git'");
  } else {
    console.log("⚠️  Some templates failed to export. Please review errors above.");
    process.exit(1);
  }
}

// Run the export
exportTemplates()
  .catch((error) => {
    console.error("\n❌ Fatal error during export:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
