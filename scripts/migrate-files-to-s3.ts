/**
 * File Migration Script: Database → S3
 *
 * Migrates existing document files from PostgreSQL BLOB storage to AWS S3.
 * This script is designed to be run in production after the S3 infrastructure
 * is deployed and configured.
 *
 * Features:
 * - Progress tracking with resume capability
 * - Batch processing to avoid memory issues
 * - Dry-run mode for testing
 * - Comprehensive error handling and logging
 * - Migration status reporting
 *
 * Usage:
 *   # Dry run (no changes)
 *   npx tsx scripts/migrate-files-to-s3.ts --dry-run
 *
 *   # Migrate documents (default batch size: 10)
 *   npx tsx scripts/migrate-files-to-s3.ts
 *
 *   # Custom batch size
 *   npx tsx scripts/migrate-files-to-s3.ts --batch-size 20
 *
 *   # Migrate specific document types
 *   npx tsx scripts/migrate-files-to-s3.ts --type knowledge
 *   npx tsx scripts/migrate-files-to-s3.ts --type customer
 *
 * Environment Requirements:
 * - AWS_REGION
 * - S3_DOCUMENTS_BUCKET
 * - AWS credentials (IAM role or env vars)
 * - DATABASE_URL
 *
 * @module scripts/migrate-files-to-s3
 */

import { prisma } from "../src/lib/prisma";
import { uploadToS3, generateS3Key, getMimeType, isS3Configured } from "../src/lib/s3";
import { logger } from "../src/lib/logger";

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; filename: string; error: string }>;
}

interface CliArgs {
  dryRun: boolean;
  batchSize: number;
  documentType: "knowledge" | "customer" | "all";
}

// Parse CLI arguments
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    batchSize: parseInt(args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] || "10", 10),
    documentType: (args.find((arg) => arg.startsWith("--type="))?.split("=")[1] || "all") as CliArgs["documentType"],
  };
}

/**
 * Migrate KnowledgeDocument files from database to S3
 */
async function migrateKnowledgeDocuments(args: CliArgs): Promise<MigrationStats> {
  logger.info("Starting KnowledgeDocument migration", { dryRun: args.dryRun, batchSize: args.batchSize });

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch documents with fileData but no S3 key (not yet migrated)
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        fileData: { not: null },
        s3Key: null,
      },
      select: {
        id: true,
        filename: true,
        fileType: true,
        fileData: true,
      },
      take: args.batchSize,
      skip: offset,
    });

    if (documents.length === 0) {
      hasMore = false;
      break;
    }

    stats.total += documents.length;

    for (const doc of documents) {
      try {
        if (!doc.fileData) {
          logger.warn("Document has no fileData, skipping", { id: doc.id, filename: doc.filename });
          stats.skipped++;
          continue;
        }

        const buffer = Buffer.from(doc.fileData);
        const s3Key = generateS3Key(doc.fileType, doc.filename, doc.id);
        const mimeType = getMimeType(doc.fileType);

        logger.info("Migrating KnowledgeDocument", {
          id: doc.id,
          filename: doc.filename,
          fileType: doc.fileType,
          size: buffer.length,
          s3Key,
          dryRun: args.dryRun,
        });

        if (!args.dryRun) {
          // Upload to S3
          await uploadToS3(s3Key, buffer, mimeType);

          // Update database with S3 metadata
          await prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: {
              s3Key,
              s3Bucket: process.env.S3_DOCUMENTS_BUCKET || null,
              s3Region: process.env.AWS_REGION || null,
              // Keep fileData for now - can be cleaned up later after verification
            },
          });

          logger.info("Successfully migrated KnowledgeDocument", {
            id: doc.id,
            filename: doc.filename,
            s3Key,
          });
        }

        stats.migrated++;
      } catch (error) {
        logger.error("Failed to migrate KnowledgeDocument", error, {
          id: doc.id,
          filename: doc.filename,
        });
        stats.failed++;
        stats.errors.push({
          id: doc.id,
          filename: doc.filename,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    offset += documents.length;

    // Log progress
    logger.info("Migration progress", {
      type: "KnowledgeDocument",
      processed: offset,
      migrated: stats.migrated,
      failed: stats.failed,
      skipped: stats.skipped,
    });

    // Add small delay to avoid overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return stats;
}

/**
 * Migrate CustomerDocument files from database to S3
 * Note: CustomerDocument should not have fileData (always uses S3),
 * but this handles any edge cases where fileData was stored.
 */
async function migrateCustomerDocuments(args: CliArgs): Promise<MigrationStats> {
  logger.info("Starting CustomerDocument migration", { dryRun: args.dryRun, batchSize: args.batchSize });

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Check if any CustomerDocuments need migration (edge case)
  const count = await prisma.customerDocument.count({
    where: {
      s3Key: null,
    },
  });

  if (count === 0) {
    logger.info("No CustomerDocuments need migration");
    return stats;
  }

  logger.warn("Found CustomerDocuments without S3 keys - this is unexpected", { count });

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const documents = await prisma.customerDocument.findMany({
      where: {
        s3Key: null,
      },
      select: {
        id: true,
        filename: true,
        fileType: true,
        customerId: true,
      },
      take: args.batchSize,
      skip: offset,
    });

    if (documents.length === 0) {
      hasMore = false;
      break;
    }

    stats.total += documents.length;

    for (const doc of documents) {
      // CustomerDocuments without S3 keys cannot be recovered - no fileData field
      logger.error("CustomerDocument missing S3 key and cannot be recovered", {
        id: doc.id,
        filename: doc.filename,
        customerId: doc.customerId,
      });
      stats.failed++;
      stats.errors.push({
        id: doc.id,
        filename: doc.filename,
        error: "Missing S3 key and no fileData to migrate",
      });
    }

    offset += documents.length;
  }

  return stats;
}

/**
 * Generate migration summary report
 */
function printSummary(knowledgeStats: MigrationStats, customerStats: MigrationStats, dryRun: boolean) {
  const totalStats: MigrationStats = {
    total: knowledgeStats.total + customerStats.total,
    migrated: knowledgeStats.migrated + customerStats.migrated,
    skipped: knowledgeStats.skipped + customerStats.skipped,
    failed: knowledgeStats.failed + customerStats.failed,
    errors: [...knowledgeStats.errors, ...customerStats.errors],
  };

  console.log("\n" + "=".repeat(80));
  console.log(`Migration Summary ${dryRun ? "(DRY RUN)" : ""}`);
  console.log("=".repeat(80));
  console.log(`\nKnowledgeDocument:`);
  console.log(`  Total processed: ${knowledgeStats.total}`);
  console.log(`  Successfully migrated: ${knowledgeStats.migrated}`);
  console.log(`  Skipped: ${knowledgeStats.skipped}`);
  console.log(`  Failed: ${knowledgeStats.failed}`);

  console.log(`\nCustomerDocument:`);
  console.log(`  Total processed: ${customerStats.total}`);
  console.log(`  Successfully migrated: ${customerStats.migrated}`);
  console.log(`  Skipped: ${customerStats.skipped}`);
  console.log(`  Failed: ${customerStats.failed}`);

  console.log(`\nOverall:`);
  console.log(`  Total documents: ${totalStats.total}`);
  console.log(`  Successfully migrated: ${totalStats.migrated}`);
  console.log(`  Skipped: ${totalStats.skipped}`);
  console.log(`  Failed: ${totalStats.failed}`);

  if (totalStats.errors.length > 0) {
    console.log(`\nErrors (${totalStats.errors.length}):`);
    totalStats.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.filename} (${err.id}): ${err.error}`);
    });
  }

  if (dryRun) {
    console.log("\n⚠️  This was a dry run. No changes were made to the database or S3.");
    console.log("Run without --dry-run to perform the actual migration.");
  } else if (totalStats.failed === 0 && totalStats.migrated > 0) {
    console.log("\n✅ Migration completed successfully!");
  } else if (totalStats.failed > 0) {
    console.log("\n⚠️  Migration completed with errors. See logs above for details.");
  } else {
    console.log("\nℹ️  No documents needed migration.");
  }

  console.log("=".repeat(80) + "\n");
}

/**
 * Main migration function
 */
async function main() {
  const args = parseArgs();

  console.log("\n" + "=".repeat(80));
  console.log("Document Migration: Database → S3");
  console.log("=".repeat(80));
  console.log(`Mode: ${args.dryRun ? "DRY RUN (no changes)" : "LIVE MIGRATION"}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Document type: ${args.documentType}`);
  console.log("=".repeat(80) + "\n");

  // Verify S3 is configured
  if (!isS3Configured()) {
    logger.error("S3 is not configured. Please set AWS_REGION, S3_DOCUMENTS_BUCKET, and AWS credentials.");
    console.error("\n❌ S3 is not configured. Migration cannot proceed.");
    console.error("Required environment variables:");
    console.error("  - AWS_REGION");
    console.error("  - S3_DOCUMENTS_BUCKET");
    console.error("  - AWS credentials (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or IAM role)");
    process.exit(1);
  }

  logger.info("S3 configuration verified", {
    region: process.env.AWS_REGION,
    bucket: process.env.S3_DOCUMENTS_BUCKET,
  });

  let knowledgeStats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  let customerStats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Migrate KnowledgeDocuments
    if (args.documentType === "knowledge" || args.documentType === "all") {
      knowledgeStats = await migrateKnowledgeDocuments(args);
    }

    // Migrate CustomerDocuments (usually none, but check anyway)
    if (args.documentType === "customer" || args.documentType === "all") {
      customerStats = await migrateCustomerDocuments(args);
    }

    // Print summary
    printSummary(knowledgeStats, customerStats, args.dryRun);

    // Exit with appropriate code
    const totalFailed = knowledgeStats.failed + customerStats.failed;
    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    logger.error("Migration script failed", error);
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
