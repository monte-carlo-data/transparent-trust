/**
 * POST /api/v2/integrations/slack/channels/lookup
 *
 * Look up a Slack channel by ID and return its details.
 * Requires authentication and library management permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { SlackDiscoveryAdapter } from '@/lib/v2/sources/adapters/slack-adapter';
import type { LibraryId } from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { channelName, libraryId, customerId } = body as {
      channelName: string;
      libraryId: LibraryId;
      customerId?: string;
    };

    if (!channelName) {
      return NextResponse.json(
        { error: 'channelName is required' },
        { status: 400 }
      );
    }

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Require library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    const adapter = new SlackDiscoveryAdapter();

    try {
      const channel = await adapter.lookupChannelByName({
        libraryId,
        customerId,
        channelName,
      });

      if (!channel) {
        // If channel not found, return ID as name fallback
        return NextResponse.json({
          channel: {
            id: channelName,
            name: channelName,
            isMember: true,
          },
        });
      }

      return NextResponse.json({
        channel: {
          id: channel.id,
          name: channel.name,
          isMember: channel.isMember,
        },
      });
    } catch (lookupError) {
      // If lookup fails, return ID as name fallback
      console.warn(`Channel lookup failed, using ID as name fallback:`, lookupError);
      return NextResponse.json({
        channel: {
          id: channelName,
          name: channelName,
          isMember: true,
        },
      });
    }
  } catch (error) {
    console.error('Slack channels lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to lookup channel' },
      { status: 500 }
    );
  }
}
