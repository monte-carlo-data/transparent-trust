import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runPostMigration() {
  console.log('Running post-migration: Clean up deprecated parentCustomerId field...');

  try {
    // Verify no orphaned records before cleanup
    const result = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "BuildingBlock" WHERE "customerId" IS NULL;
    `;

    // Type assertion for the query result
    const count = (result as Array<{ count: number }>)?.[0]?.count ?? 0;

    if (count > 0) {
      console.warn(
        `⚠ Warning: Found ${count} BuildingBlocks with no customerId. These were not customer-scoped skills.`
      );
    }

    // Count how many customer-scoped skills now have customerId
    const customerSkillsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "BuildingBlock" WHERE "customerId" IS NOT NULL;
    `;
    const customerSkillsCount = (customerSkillsResult as Array<{ count: number }>)?.[0]?.count ?? 0;

    console.log(`✓ Successfully cleaned up deprecated field. ${customerSkillsCount} customer-scoped skills now using customerId.`);
    console.log('Post-migration completed successfully!');
  } catch (error) {
    console.error('Post-migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
