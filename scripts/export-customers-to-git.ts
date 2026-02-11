#!/usr/bin/env tsx

/**
 * Export all existing customer profiles from the database to git
 *
 * This is a one-time migration script to move from database-first to git-first storage.
 * After running this script, all customer profiles will exist as markdown files in the customers/ directory.
 *
 * Usage:
 *   npm run export:customers
 *   or
 *   npx tsx scripts/export-customers-to-git.ts
 */

import { prisma } from "../src/lib/prisma";
import { getCustomerSlug } from "../src/lib/customerFiles";
import { customerGitSync } from "../src/lib/git-sync";
import type { CustomerFile } from "../src/lib/customerFiles";

async function exportCustomers() {
  console.log("🚀 Starting customer profile export to git...\n");

  // Fetch all active customer profiles from database
  const customers = await prisma.customerProfile.findMany({
    where: { isActive: true },
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📦 Found ${customers.length} active customer profiles to export\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const customer of customers) {
    const slug = getCustomerSlug(customer.name);

    try {
      console.log(`  Processing: ${customer.name}`);
      console.log(`    → Slug: ${slug}`);

      // Parse sourceUrls from JSON
      const sourceUrls = customer.sourceUrls as Array<{
        url: string;
        addedAt: string;
        lastFetched?: string;
      }> | null;

      // Parse sourceDocuments from JSON
      const sourceDocuments = customer.sourceDocuments as Array<{
        id: string;
        filename: string;
        uploadedAt: string;
      }> | null;

      // Parse owners from JSON (legacy format)
      const legacyOwners = (customer.owners as Array<{
        name: string;
        email?: string;
      }>) || [];

      // Combine with owner relation
      const allOwners = [
        ...(customer.owner
          ? [
              {
                name: customer.owner.name || "Unknown",
                email: customer.owner.email || undefined,
                userId: customer.ownerId || undefined,
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

      // Build content from legacy fields if no unified content exists
      let content = customer.content || "";
      if (!content && customer.overview) {
        // Build content from legacy fields
        const sections: string[] = [];

        if (customer.overview) {
          sections.push(`## Overview\n${customer.overview}`);
        }
        if (customer.products) {
          sections.push(`## Products & Services\n${customer.products}`);
        }
        if (customer.challenges) {
          sections.push(`## Challenges & Pain Points\n${customer.challenges}`);
        }

        // Handle keyFacts JSON
        const keyFacts = customer.keyFacts as Array<{ label: string; value: string }> | null;
        if (keyFacts && keyFacts.length > 0) {
          const factsSection = keyFacts.map((f) => `- **${f.label}**: ${f.value}`).join("\n");
          sections.push(`## Key Facts\n${factsSection}`);
        }

        content = `# ${customer.name}\n\n${sections.join("\n\n")}`;
      }

      // Create CustomerFile object
      const customerFile: CustomerFile = {
        id: customer.id,
        slug,
        name: customer.name,
        content,
        industry: customer.industry || undefined,
        website: customer.website || undefined,
        salesforceId: customer.salesforceId || undefined,
        region: customer.region || undefined,
        tier: customer.tier || undefined,
        employeeCount: customer.employeeCount || undefined,
        annualRevenue: customer.annualRevenue || undefined,
        accountType: customer.accountType || undefined,
        billingLocation: customer.billingLocation || undefined,
        lastSalesforceSync: customer.lastSalesforceSync?.toISOString(),
        owners: uniqueOwners,
        sources: sourceUrls || [],
        documents: sourceDocuments || undefined,
        considerations: customer.considerations || [],
        created: customer.createdAt.toISOString(),
        updated: customer.updatedAt.toISOString(),
        active: customer.isActive,
      };

      // Commit to git
      await customerGitSync.saveAndCommit(
        slug,
        customerFile,
        `Export customer profile: ${customer.name}`,
        {
          name: customer.owner?.name || customer.createdBy || "System",
          email: customer.owner?.email || "system@localhost",
        }
      );

      console.log(`    ✅ Exported successfully\n`);
      successCount++;
    } catch (error) {
      console.error(`    ❌ Error exporting customer profile: ${error}`);
      console.error(`       Customer ID: ${customer.id}\n`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Export Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
  console.log(`   📁 Total:   ${customers.length}`);
  console.log("=".repeat(50) + "\n");

  if (errorCount === 0) {
    console.log("🎉 All customer profiles exported successfully!");
    console.log("\nNext steps:");
    console.log("  1. Review the customers/ directory");
    console.log("  2. Check git log to see commits");
    console.log("  3. Push to remote: git push origin main\n");
  } else {
    console.log("⚠️  Some customer profiles failed to export. Please review errors above.");
    process.exit(1);
  }
}

// Run the export
exportCustomers()
  .catch((error) => {
    console.error("\n❌ Fatal error during export:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
