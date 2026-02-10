/**
 * Global Search Endpoint
 *
 * GET /api/v2/search?q=query
 * Searches across all libraries and returns results grouped by type
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  id: string;
  title: string;
  slug: string | null;
  libraryId: string;
  blockType: string;
  summary: string | null;
  status: string;
  updatedAt: Date;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  groupedByLibrary: Record<string, SearchResult[]>;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Search across title, summary, and categories
    const results = await prisma.buildingBlock.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            summary: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            categories: {
              hasSome: [query],
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        libraryId: true,
        blockType: true,
        summary: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Group by library
    const groupedByLibrary = results.reduce(
      (acc, result) => {
        if (!acc[result.libraryId]) {
          acc[result.libraryId] = [];
        }
        acc[result.libraryId].push(result);
        return acc;
      },
      {} as Record<string, SearchResult[]>
    );

    const response: SearchResponse = {
      query,
      total: results.length,
      results,
      groupedByLibrary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
