/**
 * Migrate ChatSession.customersUsed JSON to ChatSessionCustomer join table
 *
 * This script:
 * 1. Reads all ChatSessions with non-empty customersUsed JSON
 * 2. Creates ChatSessionCustomer rows for each customer reference
 * 3. Validates migration completed successfully
 *
 * Usage:
 *   npx tsx scripts/migrate-chat-customers.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CustomerUsedEntry {
  id: string;
  name?: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🔍 Finding chat sessions with customersUsed data...\n");

  // Get all chat sessions with non-null customersUsed
  const sessions = await prisma.chatSession.findMany({
    where: {
      NOT: { customersUsed: { equals: undefined } },
    },
    select: {
      id: true,
      title: true,
      customersUsed: true,
      createdAt: true,
    },
  });

  // Filter to only sessions with actual customer data
  const sessionsWithCustomers = sessions.filter((s) => {
    const customers = s.customersUsed as CustomerUsedEntry[] | null;
    return customers && Array.isArray(customers) && customers.length > 0;
  });

  console.log(`📊 Found ${sessionsWithCustomers.length} sessions with customer data\n`);

  if (sessionsWithCustomers.length === 0) {
    console.log("✅ No sessions need migration!");
    return;
  }

  // Get all valid customer IDs
  const allCustomers = await prisma.customerProfile.findMany({
    select: { id: true, name: true },
  });
  const validCustomerIds = new Set(allCustomers.map((c) => c.id));

  let totalLinks = 0;
  let skippedLinks = 0;
  const migrationPlan: Array<{
    sessionId: string;
    sessionTitle: string | null;
    customerId: string;
    customerName?: string;
  }> = [];

  // Build migration plan
  for (const session of sessionsWithCustomers) {
    const customers = session.customersUsed as unknown as CustomerUsedEntry[];
    for (const customer of customers) {
      if (!customer.id) {
        console.log(`   ⚠️  Session "${session.title}" has customer without ID, skipping`);
        skippedLinks++;
        continue;
      }

      if (!validCustomerIds.has(customer.id)) {
        console.log(
          `   ⚠️  Session "${session.title}" references non-existent customer ${customer.id}, skipping`
        );
        skippedLinks++;
        continue;
      }

      migrationPlan.push({
        sessionId: session.id,
        sessionTitle: session.title,
        customerId: customer.id,
        customerName: customer.name,
      });
      totalLinks++;
    }
  }

  console.log(`\n📋 Migration plan:`);
  console.log(`   - ${totalLinks} customer links to create`);
  console.log(`   - ${skippedLinks} invalid references skipped\n`);

  // Show sample of what will be migrated
  console.log("📝 Sample links:");
  for (const link of migrationPlan.slice(0, 5)) {
    console.log(`   - Session "${link.sessionTitle}" → Customer "${link.customerName || link.customerId}"`);
  }
  if (migrationPlan.length > 5) {
    console.log(`   ... and ${migrationPlan.length - 5} more\n`);
  }

  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made.");
    console.log("   Run without --dry-run to execute migration.\n");
    return;
  }

  // Execute migration in transaction
  console.log("\n🚀 Executing migration...\n");

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let duplicates = 0;

    for (const link of migrationPlan) {
      try {
        await tx.chatSessionCustomer.upsert({
          where: {
            chatSessionId_customerId: {
              chatSessionId: link.sessionId,
              customerId: link.customerId,
            },
          },
          create: {
            chatSessionId: link.sessionId,
            customerId: link.customerId,
          },
          update: {}, // No-op if exists
        });
        created++;
      } catch (error) {
        // Unique constraint violation means it already exists
        duplicates++;
      }
    }

    return { created, duplicates };
  });

  console.log(`✅ Migration complete!`);
  console.log(`   - Created: ${result.created} links`);
  console.log(`   - Already existed: ${result.duplicates} links\n`);

  // Verify migration
  console.log("🔍 Verifying migration...\n");
  const totalJoinRows = await prisma.chatSessionCustomer.count();
  console.log(`   ChatSessionCustomer rows: ${totalJoinRows}`);

  // Note: We keep customersUsed for now (backwards compatibility)
  // A future cleanup can remove the JSON field once all code uses the relation
  console.log("\n💡 Note: customersUsed JSON field is kept for backwards compatibility.");
  console.log("   Update all code to use the new relation, then clean up the JSON field.\n");
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
