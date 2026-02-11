/**
 * POST /api/v2/integrations/slack/restart
 * Restart the Slack bot for a library to pick up configuration changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { logger } from '@/lib/logger';
import { restartSlackBot } from '@/lib/slack-bot-worker';
import type { LibraryId } from '@/types/v2';
import type { BotLibraryId } from '@/lib/slack-bot-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { libraryId } = body as { libraryId: string };

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Validate libraryId is a valid bot library
    const validBotLibraries = ['it', 'knowledge', 'gtm'];
    if (!validBotLibraries.includes(libraryId)) {
      return NextResponse.json(
        { error: 'Invalid libraryId for Slack bot' },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    logger.info('Restarting Slack bot via API', {
      libraryId,
      userId: session.user.id,
    });

    const success = await restartSlackBot(libraryId as BotLibraryId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Slack bot for ${libraryId} restarted successfully`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to restart bot - check that tokens are configured',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error restarting Slack bot:', error);
    return NextResponse.json(
      {
        error: 'Failed to restart Slack bot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
