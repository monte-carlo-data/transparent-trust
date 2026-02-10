/**
 * Cleanup script: Delete staged Notion sources with malformed titles
 *
 * Problem: Some Notion pages were staged with S3 image URLs in their titles
 * instead of actual page titles. This occurred when the Notion API returned
 * empty titles and the adapter incorrectly used the first image URL as fallback.
 *
 * Solution: Deletes all StagedSource records where:
 * - sourceType is 'notion'
 * - title contains '.s3.' (indicates S3 URL was used as title)
 *
 * Usage: npx ts-node scripts/cleanup-notion-staged.ts
 */

import { prisma } from '@/lib/prisma';

async function cleanup() {
  try {
    const deleted = await prisma.stagedSource.deleteMany({
      where: {
        sourceType: 'notion',
        title: {
          contains: '.s3.',
        },
      },
    });

    console.log(`Deleted ${deleted.count} bad staged sources`);
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
}

cleanup()
  .then(() => {
    console.log('Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
