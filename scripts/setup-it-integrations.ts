/**
 * Setup Script: Initialize IT Integrations
 *
 * This script stores integration credentials in AWS Secrets Manager and creates
 * IntegrationConnection records for discovery configuration (channels, databases, etc.)
 *
 * Usage: npx tsx scripts/setup-it-integrations.ts
 *
 * Environment Variables Required:
 * - SLACK_BOT_TOKEN (for Slack integration)
 * - NOTION_API_TOKEN (for Notion)
 * - AWS credentials for Secrets Manager access
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';
import { putSecret } from '../src/lib/secrets';

async function setupIntegrations() {
  try {
    logger.info('Setting up IT integrations...');

    // 1. Slack Integration
    if (process.env.SLACK_BOT_TOKEN) {
      logger.info('Setting up Slack integration...');

      try {
        // Store token in AWS Secrets Manager
        await putSecret('slack-bot-token', process.env.SLACK_BOT_TOKEN);
        logger.info('✓ Slack bot token stored in AWS Secrets Manager');

        // Create/update IntegrationConnection with configuration (not credentials)
        const slackConnection = await prisma.integrationConnection.upsert({
          where: {
            id: 'slack-it-connection', // Use a predictable ID
          },
          update: {
            config: {
              channels: process.env.SLACK_CHANNEL_IDS?.split(',').filter(Boolean) || [],
              minReplyCount: 1,
              includeThreadsOnly: true,
            },
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
          create: {
            id: 'slack-it-connection',
            integrationType: 'slack',
            name: 'IT Support Slack',
            config: {
              channels: process.env.SLACK_CHANNEL_IDS?.split(',').filter(Boolean) || [],
              minReplyCount: 1,
              includeThreadsOnly: true,
            },
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        logger.info(`✓ Slack connection created/updated: ${slackConnection.id}`);
        logger.info(`  Configure SLACK_CHANNEL_IDS env var with comma-separated channel IDs`);
      } catch (error) {
        logger.error('Failed to setup Slack integration:', error);
      }
    } else {
      logger.warn('SLACK_BOT_TOKEN not set - skipping Slack setup');
    }

    // 2. Notion Integration
    if (process.env.NOTION_API_TOKEN) {
      logger.info('Setting up Notion integration...');

      try {
        // Store token in AWS Secrets Manager
        await putSecret('notion-api-token', process.env.NOTION_API_TOKEN);
        logger.info('✓ Notion API token stored in AWS Secrets Manager');

        // Create/update IntegrationConnection with configuration (not credentials)
        const notionConnection = await prisma.integrationConnection.upsert({
          where: {
            id: 'notion-it-connection',
          },
          update: {
            config: {
              databaseIds: process.env.NOTION_DATABASE_IDS?.split(',').filter(Boolean) || [],
              pageIds: process.env.NOTION_PAGE_IDS?.split(',').filter(Boolean) || [],
              rootPageId: process.env.NOTION_ROOT_PAGE_ID || undefined,
            },
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
          create: {
            id: 'notion-it-connection',
            integrationType: 'notion',
            name: 'IT Notion Documentation',
            config: {
              databaseIds: process.env.NOTION_DATABASE_IDS?.split(',').filter(Boolean) || [],
              pageIds: process.env.NOTION_PAGE_IDS?.split(',').filter(Boolean) || [],
              rootPageId: process.env.NOTION_ROOT_PAGE_ID || undefined,
            },
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        logger.info(`✓ Notion connection created/updated: ${notionConnection.id}`);
        logger.info(`  Configure NOTION_DATABASE_IDS or NOTION_PAGE_IDS env vars`);
      } catch (error) {
        logger.error('Failed to setup Notion integration:', error);
      }
    } else {
      logger.warn('NOTION_API_TOKEN not set - skipping Notion setup');
    }

    logger.info('✓ Integration setup complete!');
    logger.info('Credentials stored in AWS Secrets Manager');
    logger.info('Configuration stored in database');

  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupIntegrations();
