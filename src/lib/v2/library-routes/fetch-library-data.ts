/**
 * Shared Library Data Fetching
 *
 * Centralized data fetching for all library layouts with proper error handling.
 * Reduces duplication across knowledge, it, gtm, talent layouts.
 */

import { prisma } from '@/lib/prisma';
import { transformBotInteractions } from '@/lib/v2/bot-interactions';
import { getLibraryConfig, type SourceType } from '@/lib/library-config';
import type { LibraryContextValue } from './library-context';

type StandardLibraryId = 'knowledge' | 'it' | 'gtm' | 'talent';

interface FetchLibraryDataParams {
  libraryId: StandardLibraryId;
  userId: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  isAdmin: boolean;
}

/**
 * Fetch all data needed for a library layout.
 * Handles errors gracefully by returning empty arrays for failed queries.
 */
export async function fetchLibraryData({
  libraryId,
  userId,
  userName,
  userEmail,
  userImage,
  isAdmin,
}: FetchLibraryDataParams): Promise<LibraryContextValue> {
  const config = getLibraryConfig(libraryId);

  // Build query filters for skills
  const skillsWhere = {
    status: 'ACTIVE' as const,
    libraryId,
  };

  // Build source queries dynamically from config
  const sourceTypes = config.sourceTypes;

  try {
    // Execute all queries in parallel with individual error handling
    const [skillsResult, totalResult, ...sourceResults] = await Promise.all([
      // Skills query
      prisma.buildingBlock
        .findMany({
          where: skillsWhere,
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            attributes: true,
            status: true,
            updatedAt: true,
          },
        })
        .catch((error) => {
          console.error(`[fetchLibraryData] Failed to fetch skills for ${libraryId}:`, error);
          return [];
        }),

      // Count query
      prisma.buildingBlock.count({ where: skillsWhere }).catch((error) => {
        console.error(`[fetchLibraryData] Failed to count skills for ${libraryId}:`, error);
        return 0;
      }),

      // Source type queries - one per configured source type
      ...sourceTypes.map((sourceType) =>
        prisma.stagedSource
          .findMany({
            where: {
              libraryId,
              sourceType,
              customerId: null, // Global sources only
            },
            orderBy: { stagedAt: 'desc' },
            take: 200,
            include: {
              assignments: {
                where: { incorporatedAt: { not: null }, block: { status: 'ACTIVE' } },
                include: {
                  block: {
                    select: { id: true, title: true, slug: true, status: true },
                  },
                },
              },
            },
          })
          .catch((error) => {
            console.error(
              `[fetchLibraryData] Failed to fetch ${sourceType} sources for ${libraryId}:`,
              error
            );
            return [];
          })
      ),

      // Bot interactions query (last in the array)
      prisma.slackBotInteraction
        .findMany({
          where: { libraryId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            question: true,
            answer: true,
            createdAt: true,
          },
        })
        .then(transformBotInteractions)
        .catch((error) => {
          console.error(`[fetchLibraryData] Failed to fetch bot interactions for ${libraryId}:`, error);
          return [];
        }),
    ]);

    // Extract bot interactions (last result)
    const pendingBot = sourceResults.pop() || [];

    // Build sourcesByType from the source results
    const sourcesByType: Partial<Record<SourceType, unknown[]>> = {};
    sourceTypes.forEach((sourceType, index) => {
      sourcesByType[sourceType] = sourceResults[index] || [];
    });

    const skills = skillsResult;
    const total = totalResult;

    const pendingReview = skills.filter((s) => s.status === 'DRAFT').length;
    const activeSkills = skills.filter((s) => s.status === 'ACTIVE').length;

    // Current user info
    const currentUser = userId
      ? {
          id: userEmail || userId,
          name: userName || 'Unknown',
          email: userEmail,
          image: userImage,
        }
      : null;

    return {
      libraryId,
      skills,
      totalSkills: total,
      pendingReview,
      activeSkills,
      sourcesByType: sourcesByType as LibraryContextValue['sourcesByType'],
      pendingBot,
      currentUser,
      isAdmin,
    };
  } catch (error) {
    // Top-level catch for any unexpected errors
    console.error(`[fetchLibraryData] Unexpected error fetching data for ${libraryId}:`, error);

    // Return empty state instead of throwing - let the UI handle empty data gracefully
    return {
      libraryId,
      skills: [],
      totalSkills: 0,
      pendingReview: 0,
      activeSkills: 0,
      sourcesByType: {},
      pendingBot: [],
      currentUser: userId
        ? {
            id: userEmail || userId,
            name: userName || 'Unknown',
            email: userEmail,
            image: userImage,
          }
        : null,
      isAdmin,
    };
  }
}
