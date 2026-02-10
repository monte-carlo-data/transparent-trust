/**
 * Skill Fetcher Utility
 *
 * Shared utility for fetching specific library and customer skills by IDs for RFP processing.
 * Used by batch-processor when processing questions with a selected set of skills.
 * Note: preview-skills uses a different pattern (fetches ALL library skills for matching).
 */

import prisma from '@/lib/prisma';
import type { LibraryId } from '@/types/v2';

export interface SkillData {
  id: string;
  title: string;
  content: string;
}

export interface FetchSkillsParams {
  skillIds: string[];
  libraryId: LibraryId;
  customerId?: string | null;
}

export interface FetchSkillsResult {
  librarySkills: SkillData[];
  customerSkills: SkillData[];
  allSkills: SkillData[];
}

/**
 * Fetch both library and customer skills for RFP processing.
 * Returns skills separately for logging/transparency, and combined for processing.
 */
export async function fetchRFPSkills(
  params: FetchSkillsParams
): Promise<FetchSkillsResult> {
  const { skillIds, libraryId, customerId } = params;

  // Fetch library skills
  const librarySkills = await prisma.buildingBlock.findMany({
    where: {
      id: { in: skillIds },
      libraryId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
  });

  // Fetch customer skills if project is linked to a customer
  let customerSkills: typeof librarySkills = [];
  if (customerId) {
    customerSkills = await prisma.buildingBlock.findMany({
      where: {
        id: { in: skillIds },
        libraryId: 'customers',
        customerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
    });
  }

  // Combine for processing (map to correct type)
  const allSkills: SkillData[] = [
    ...librarySkills.map(s => ({ id: s.id, title: s.title, content: s.content || '' })),
    ...customerSkills.map(s => ({ id: s.id, title: s.title, content: s.content || '' })),
  ];

  return {
    librarySkills: librarySkills.map(s => ({ id: s.id, title: s.title, content: s.content || '' })),
    customerSkills: customerSkills.map(s => ({ id: s.id, title: s.title, content: s.content || '' })),
    allSkills,
  };
}
