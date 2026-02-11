#!/usr/bin/env tsx

/**
 * Data Migration: Populate SkillSource join table from existing data
 *
 * This script migrates the skill-source relationships from:
 * 1. Skill.sourceUrls JSON array → SkillSource + ReferenceUrl (if needed)
 * 2. Skill.sourceDocuments JSON array → SkillSource (document already exists)
 *
 * Note: Steps 3 & 4 (ReferenceUrl.skillId and KnowledgeDocument.skillId) were
 * removed after those columns were dropped from the schema.
 *
 * Why: The existing data model has asymmetric relationships. This migration
 * creates a proper many-to-many join table (SkillSource) that enables:
 * - Querying "which skills use this URL?"
 * - Sources existing independently of skills
 * - Multiple skills sharing the same source
 *
 * Safe to run multiple times - uses upsert to avoid duplicates.
 *
 * Usage: npx tsx scripts/migrate-skill-sources.ts [--dry-run]
 */

import { prisma } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";

interface SourceUrl {
  url: string;
  addedAt?: string;
  lastFetchedAt?: string;
  title?: string;
}

interface SourceDocument {
  id: string;
  filename: string;
  uploadedAt?: string;
}

interface MigrationStats {
  skillsProcessed: number;
  urlsFromSkillJson: number;
  docsFromSkillJson: number;
  referenceUrlsCreated: number;
  skillSourcesCreated: number;
  duplicatesSkipped: number;
  errors: string[];
}

async function migrateSkillSources(dryRun: boolean = false) {
  const stats: MigrationStats = {
    skillsProcessed: 0,
    urlsFromSkillJson: 0,
    docsFromSkillJson: 0,
    referenceUrlsCreated: 0,
    skillSourcesCreated: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  console.log(`\n🔄 Starting Skill-Source Migration ${dryRun ? "(DRY RUN)" : ""}\n`);
  console.log("This migration will:");
  console.log("  1. Extract URLs from Skill.sourceUrls JSON → create ReferenceUrl if needed → link via SkillSource");
  console.log("  2. Extract docs from Skill.sourceDocuments JSON → link via SkillSource");
  console.log("  (Note: Steps 3 & 4 for legacy skillId columns have been removed - those columns were dropped)");
  console.log("");

  // Step 1: Process skills with sourceUrls JSON
  console.log("📋 Step 1: Processing Skill.sourceUrls JSON arrays...");
  const skillsWithUrls = await prisma.skill.findMany({
    where: {
      NOT: { sourceUrls: { equals: Prisma.DbNull } },
    },
    select: {
      id: true,
      title: true,
      sourceUrls: true,
      sourceDocuments: true,
    },
  });

  console.log(`   Found ${skillsWithUrls.length} skills with sourceUrls`);

  for (const skill of skillsWithUrls) {
    stats.skillsProcessed++;
    const sourceUrls = skill.sourceUrls as SourceUrl[] | null;
    const sourceDocuments = skill.sourceDocuments as SourceDocument[] | null;

    // Process URLs
    if (sourceUrls && Array.isArray(sourceUrls)) {
      for (const source of sourceUrls) {
        if (!source.url) continue;
        stats.urlsFromSkillJson++;

        try {
          // Find or create ReferenceUrl
          let refUrl = await prisma.referenceUrl.findFirst({
            where: { url: source.url },
          });

          if (!refUrl && !dryRun) {
            refUrl = await prisma.referenceUrl.create({
              data: {
                url: source.url,
                title: source.title || null,
                addedAt: source.addedAt ? new Date(source.addedAt) : new Date(),
              },
            });
            stats.referenceUrlsCreated++;
            console.log(`   ✅ Created ReferenceUrl: ${source.url.substring(0, 60)}...`);
          } else if (!refUrl && dryRun) {
            stats.referenceUrlsCreated++;
            console.log(`   [DRY RUN] Would create ReferenceUrl: ${source.url.substring(0, 60)}...`);
          }

          // Create SkillSource link
          if (refUrl && !dryRun) {
            await prisma.skillSource.upsert({
              where: {
                skillId_sourceId_sourceType: {
                  skillId: skill.id,
                  sourceId: refUrl.id,
                  sourceType: "url",
                },
              },
              create: {
                skillId: skill.id,
                sourceId: refUrl.id,
                sourceType: "url",
                addedAt: source.addedAt ? new Date(source.addedAt) : new Date(),
                isPrimary: false,
              },
              update: {}, // No-op if exists
            });
            stats.skillSourcesCreated++;
          } else if (dryRun) {
            stats.skillSourcesCreated++;
          }
        } catch (error) {
          const msg = `Error processing URL ${source.url} for skill ${skill.id}: ${error}`;
          stats.errors.push(msg);
          console.log(`   ⚠️ ${msg}`);
        }
      }
    }

    // Process source documents
    if (sourceDocuments && Array.isArray(sourceDocuments)) {
      for (const doc of sourceDocuments) {
        if (!doc.id) continue;
        stats.docsFromSkillJson++;

        try {
          // Verify document exists
          const existingDoc = await prisma.knowledgeDocument.findUnique({
            where: { id: doc.id },
          });

          if (existingDoc && !dryRun) {
            await prisma.skillSource.upsert({
              where: {
                skillId_sourceId_sourceType: {
                  skillId: skill.id,
                  sourceId: doc.id,
                  sourceType: "document",
                },
              },
              create: {
                skillId: skill.id,
                sourceId: doc.id,
                sourceType: "document",
                addedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
                isPrimary: false,
              },
              update: {},
            });
            stats.skillSourcesCreated++;
          } else if (existingDoc && dryRun) {
            stats.skillSourcesCreated++;
          } else if (!existingDoc) {
            console.log(`   ⚠️ Document ${doc.id} not found (referenced by skill ${skill.title})`);
          }
        } catch (error) {
          const msg = `Error processing document ${doc.id} for skill ${skill.id}: ${error}`;
          stats.errors.push(msg);
          console.log(`   ⚠️ ${msg}`);
        }
      }
    }
  }

  // Note: Steps 2 & 3 (ReferenceUrl.skillId and KnowledgeDocument.skillId migration)
  // have been removed - those columns were dropped from the schema after migration completed.

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Migration Summary ${dryRun ? "(DRY RUN - no changes made)" : ""}`);
  console.log("=".repeat(60));
  console.log(`Skills processed:              ${stats.skillsProcessed}`);
  console.log(`URLs from Skill.sourceUrls:    ${stats.urlsFromSkillJson}`);
  console.log(`Docs from Skill.sourceDocuments: ${stats.docsFromSkillJson}`);
  console.log(`ReferenceUrls created:         ${stats.referenceUrlsCreated}`);
  console.log(`SkillSource links created:     ${stats.skillSourcesCreated}`);
  console.log(`Errors:                        ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log("\n⚠️ Errors encountered:");
    stats.errors.forEach((e) => console.log(`   - ${e}`));
  }

  // Verification query
  if (!dryRun) {
    const totalLinks = await prisma.skillSource.count();
    const urlLinks = await prisma.skillSource.count({ where: { sourceType: "url" } });
    const docLinks = await prisma.skillSource.count({ where: { sourceType: "document" } });

    console.log("\n📈 Current SkillSource table:");
    console.log(`   Total links:    ${totalLinks}`);
    console.log(`   URL links:      ${urlLinks}`);
    console.log(`   Document links: ${docLinks}`);
  }

  console.log("\n✅ Migration complete!\n");
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

migrateSkillSources(dryRun)
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
