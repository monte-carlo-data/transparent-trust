/**
 * POST /api/v2/integrations/slack/test
 * Test Slack bot connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { getSecret } from '@/lib/secrets';
import { WebClient } from '@slack/web-api';
import type { LibraryId } from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { libraryId } = body;

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
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

    // Load library-specific bot token (strict library isolation)
    let botToken: string | null = null;

    try {
      const envVarName = `SLACK_BOT_TOKEN_${libraryId.toUpperCase()}`;
      botToken = await getSecret(`slack-bot-token-${libraryId}`, envVarName);
    } catch {
      // No library-specific token found - don't fall back to generic token
      // Each library should have its own dedicated token
    }

    if (!botToken) {
      return NextResponse.json(
        {
          error: 'Slack bot token not configured',
          configured: false,
          details: `Please add slack-bot-token-${libraryId} to AWS Secrets Manager for library "${libraryId}"`,
        },
        { status: 400 }
      );
    }

    // Test the connection
    const webClient = new WebClient(botToken);
    const authTest = await webClient.auth.test();

    if (!authTest.ok) {
      throw new Error('Auth test failed');
    }

    return NextResponse.json({
      status: {
        configured: true,
        connected: true,
      },
      botInfo: {
        botId: authTest.user_id,
        botName: authTest.user,
        teamId: authTest.team_id,
      },
    });
  } catch (error) {
    console.error('Error testing Slack connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to test Slack connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}
