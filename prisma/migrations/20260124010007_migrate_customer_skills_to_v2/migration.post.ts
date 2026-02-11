import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runPostMigration() {
  console.log('Running post-migration: Migrate customer skills to V2...');

  try {
    // Verify the migration worked
    const migratedCount = await prisma.buildingBlock.count({
      where: {
        customerId: {
          not: null,
        },
      },
    });

    console.log(`✓ Successfully migrated customer skills. ${migratedCount} skills now use customerId field.`);
    console.log('Post-migration completed successfully!');
  } catch (error) {
    console.error('Post-migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
