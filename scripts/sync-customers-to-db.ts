#!/usr/bin/env tsx

/**
 * Sync customer profiles from git to database
 *
 * This script reads all customer markdown files from the customers/ directory
 * and syncs them to the PostgreSQL database (cache).
 *
 * Use cases:
 * - After direct git edits (by engineers)
 * - After git pull (syncing remote changes)
 * - In GitHub Actions (automated sync on merge)
 * - Manual sync when git and database diverge
 *
 * Usage:
 *   npm run sync:customers
 *   or
 *   npx tsx scripts/sync-customers-to-db.ts
 */

import { prisma } from "../src/lib/prisma";
import { listCustomerFiles, readCustomerFile } from "../src/lib/customerFiles";
import { withCustomerSyncLogging } from "../src/lib/customerSyncLog";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function syncCustomers() {
  console.log("🔄 Starting customer profile sync from git to database...\n");

  // Get or create a system user for customers without an owner
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
    console.log("✨ Created system user for customer ownership\n");
  }

  // Get all customer files from git
  const customerSlugs = await listCustomerFiles();
  console.log(`📂 Found ${customerSlugs.length} customer files in customers/ directory\n`);

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const slug of customerSlugs) {
    try {
      console.log(`  Processing: ${slug}.md`);

      // Read customer from git
      const customerFile = await readCustomerFile(slug);

      // Check if customer exists in database
      const existingCustomer = await prisma.customerProfile.findUnique({
        where: { id: customerFile.id },
      });

      if (existingCustomer) {
        // Check if git version is newer
        const gitUpdated = new Date(customerFile.updated);
        const dbUpdated = new Date(existingCustomer.updatedAt);

        if (gitUpdated <= dbUpdated) {
          console.log(`    ⏭️  Skipped (database is newer or equal)\n`);
          skippedCount++;
          continue;
        }

        // Get current git commit SHA
        const { stdout } = await execAsync("git rev-parse HEAD");
        const commitSha = stdout.trim();

        // Update existing customer with sync logging
        await withCustomerSyncLogging(
          {
            customerId: customerFile.id,
            operation: "update",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.customerProfile.update({
              where: { id: customerFile.id },
              data: {
                name: customerFile.name,
                content: customerFile.content,
                industry: customerFile.industry,
                website: customerFile.website,
                salesforceId: customerFile.salesforceId,
                region: customerFile.region,
                tier: customerFile.tier,
                employeeCount: customerFile.employeeCount,
                annualRevenue: customerFile.annualRevenue,
                accountType: customerFile.accountType,
                billingLocation: customerFile.billingLocation,
                considerations: customerFile.considerations,
                isActive: customerFile.active,
                sourceUrls: customerFile.sources,
                sourceDocuments: customerFile.documents,
                owners: customerFile.owners,
                updatedAt: new Date(customerFile.updated),
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

        // Create new customer with sync logging
        // Extract ownerId from customer file owners or use system user
        let ownerId = systemUser.id;
        if (customerFile.owners && customerFile.owners.length > 0) {
          const firstOwner = customerFile.owners[0];
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

        await withCustomerSyncLogging(
          {
            customerId: customerFile.id,
            operation: "create",
            direction: "git-to-db",
            syncedBy: "sync-script",
          },
          async () => {
            await prisma.customerProfile.create({
              data: {
                id: customerFile.id,
                name: customerFile.name,
                content: customerFile.content,
                overview: customerFile.content, // Legacy field - set to same as content
                industry: customerFile.industry,
                website: customerFile.website,
                salesforceId: customerFile.salesforceId,
                region: customerFile.region,
                tier: customerFile.tier,
                employeeCount: customerFile.employeeCount,
                annualRevenue: customerFile.annualRevenue,
                accountType: customerFile.accountType,
                billingLocation: customerFile.billingLocation,
                considerations: customerFile.considerations,
                isActive: customerFile.active,
                sourceUrls: customerFile.sources,
                sourceDocuments: customerFile.documents,
                owners: customerFile.owners,
                ownerId, // Add required ownerId field
                createdAt: new Date(customerFile.created),
                updatedAt: new Date(customerFile.updated),
              },
            });
            return commitSha;
          }
        );

        console.log(`    ✅ Created in database\n`);
        createdCount++;
      }
    } catch (error) {
      console.error(`    ❌ Error syncing customer profile: ${error}`);
      console.error(`       Slug: ${slug}\n`);
      errorCount++;
    }
  }

  // Check for customers in database that don't exist in git
  const dbCustomers = await prisma.customerProfile.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const gitCustomerIds = new Set<string>();
  for (const slug of customerSlugs) {
    try {
      const customerFile = await readCustomerFile(slug);
      gitCustomerIds.add(customerFile.id);
    } catch {
      // Skip files that can't be read
    }
  }

  const orphanedCustomers = dbCustomers.filter((customer) => !gitCustomerIds.has(customer.id));

  if (orphanedCustomers.length > 0) {
    console.log("\n⚠️  Found customer profiles in database that don't exist in git:");
    orphanedCustomers.forEach((customer) => {
      console.log(`    - ${customer.name} (${customer.id})`);
    });
    console.log("\nThese customer profiles may have been deleted from git.");
    console.log("Consider archiving them in the database.\n");
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Sync Summary:`);
  console.log(`   ✨ Created:  ${createdCount}`);
  console.log(`   🔄 Updated:  ${updatedCount}`);
  console.log(`   ⏭️  Skipped:  ${skippedCount}`);
  console.log(`   ❌ Errors:   ${errorCount}`);
  console.log(`   📁 Total:    ${customerSlugs.length}`);
  if (orphanedCustomers.length > 0) {
    console.log(`   ⚠️  Orphaned: ${orphanedCustomers.length}`);
  }
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 Sync completed successfully!");
  } else {
    console.log("⚠️  Some customer profiles failed to sync. Please review errors above.");
    process.exit(1);
  }
}

// Run the sync
syncCustomers()
  .catch((error) => {
    console.error("\n❌ Fatal error during sync:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
