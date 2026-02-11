/**
 * Post-migration: Clean Slate - Remove existing customer-scoped Gong sources
 *
 * Part of GTM-first Gong discovery with customer linking feature.
 *
 * This removes all Gong sources that have a customerId set, as they will
 * be replaced by the new linking workflow where:
 * 1. Gong calls are discovered at GTM library level (customerId=null)
 * 2. Users link specific calls to customers via "Link to Customer" button
 * 3. Linked sources are copies with lazy content sync
 *
 * Safety:
 * - Only deletes StagedSource records with sourceType='gong' AND customerId NOT NULL
 * - Also removes any SourceAssignments linked to those sources
 * - Does NOT affect global GTM Gong sources (customerId=null)
 * - Does NOT affect non-Gong sources
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runPostMigration() {
  console.log('Running post-migration: Clean Slate - Remove customer-scoped Gong sources...');

  try {
    // First, count what we're about to delete
    const customerGongSourceCount = await prisma.stagedSource.count({
      where: {
        sourceType: 'gong',
        customerId: { not: null },
      },
    });

    if (customerGongSourceCount === 0) {
      console.log('✓ No customer-scoped Gong sources found. Nothing to clean up.');
      return;
    }

    console.log(`Found ${customerGongSourceCount} customer-scoped Gong sources to remove.`);

    // Get the IDs of sources we're about to delete
    const sourcesToDelete = await prisma.stagedSource.findMany({
      where: {
        sourceType: 'gong',
        customerId: { not: null },
      },
      select: { id: true, customerId: true },
    });

    const sourceIds = sourcesToDelete.map((s) => s.id);

    // Count and delete related assignments first
    const assignmentCount = await prisma.sourceAssignment.count({
      where: {
        stagedSourceId: { in: sourceIds },
      },
    });

    if (assignmentCount > 0) {
      console.log(`Removing ${assignmentCount} source assignments...`);
      await prisma.sourceAssignment.deleteMany({
        where: {
          stagedSourceId: { in: sourceIds },
        },
      });
    }

    // Delete the sources
    const result = await prisma.stagedSource.deleteMany({
      where: {
        sourceType: 'gong',
        customerId: { not: null },
      },
    });

    // Report per-customer breakdown
    const customerBreakdown = new Map<string, number>();
    for (const source of sourcesToDelete) {
      const customerId = source.customerId!;
      customerBreakdown.set(customerId, (customerBreakdown.get(customerId) || 0) + 1);
    }

    console.log('\nRemoved Gong sources by customer:');
    for (const [customerId, count] of customerBreakdown) {
      console.log(`  - ${customerId}: ${count} sources`);
    }

    console.log(`\n✓ Successfully removed ${result.count} customer-scoped Gong sources.`);
    console.log(
      'Gong calls should now be discovered at GTM library level and linked to customers via the new workflow.'
    );
    console.log('Post-migration completed successfully!');
  } catch (error) {
    console.error('Post-migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running directly
if (require.main === module) {
  runPostMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
